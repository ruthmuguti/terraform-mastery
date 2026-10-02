import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { replay } from "../replay";
import { mulberry32 } from "../rng";
import type { Transcript, TranscriptStep } from "../types";
import { MISSIONS, getStarterCode } from "@/data/missions";
import type { Provider } from "@/lib/providers";
import type { Mission, SimulatorState } from "@/lib/types";
import { createInitialState, executeCommand } from "@/lib/terraform-simulator";

const PROVIDERS: Provider[] = ["aws", "gcp", "azure"];

/**
 * A realistic command alphabet: the terraform subcommands the simulator understands,
 * an empty command (pushed to history by the browser too), and some junk that the
 * simulator rejects. This exercises `executeCommand` across its branches.
 */
const COMMAND_ALPHABET = [
  "terraform init",
  "terraform validate",
  "terraform plan",
  "terraform apply -auto-approve",
  "terraform apply",
  "terraform fmt",
  "terraform output",
  "terraform state list",
  "terraform state show aws_s3_bucket.mission_bucket",
  "terraform show",
  "terraform workspace show",
  "terraform workspace new staging",
  "terraform destroy -auto-approve",
  "ls",
  "pwd",
  "whoami",
  "",
];

const commandArb = fc.constantFrom(...COMMAND_ALPHABET);

/**
 * HCL for a step: sampled from the chosen mission's starter code (the field is
 * `starterCodes[provider]`, read via `getStarterCode`) so that objectives whose
 * checks inspect the HCL text can actually latch; plus an empty string and a tiny
 * junk snippet to vary the input space.
 */
function hclArbForStarter(starter: string) {
  return fc.constantFrom(
    starter,
    "",
    'resource "aws_s3_bucket" "x" { bucket = "y" }',
    'provider "aws" { region = "us-east-1" }',
  );
}

const kindArb = fc.constantFrom<"run" | "check" | "reset" | undefined>(
  "run",
  "check",
  "reset",
  undefined,
);

/** Sort a Set's contents for order-independent comparison. */
function sorted(s: Set<string>): string[] {
  return Array.from(s).sort();
}

describe("replay", () => {
  // Feature: progress-sync, Property 2: Replay ignores random IDs
  it("Property 2: replay returns the same latched set regardless of the random source", () => {
    fc.assert(
      fc.property(
        fc.nat(MISSIONS.length - 1),
        fc.constantFrom(...PROVIDERS),
        fc.integer(),
        fc.integer(),
        fc.boolean(),
        (missionIdx, provider, seed1, seed2, useMathRandom) => {
          const mission = MISSIONS[missionIdx];
          const starter = getStarterCode(mission, provider);

          // Build a transcript whose HCL steps are sampled from this mission's starter
          // code and snippets, so some objectives latch for at least some inputs.
          const transcript: Transcript = fc.sample(
            fc.record({
              provider: fc.constant(provider),
              steps: fc.array(
                fc.record(
                  {
                    command: commandArb,
                    hcl: hclArbForStarter(starter),
                    kind: kindArb,
                  },
                  { requiredKeys: ["command", "hcl"] },
                ),
                { maxLength: 40 },
              ),
            }),
            1,
          )[0] as Transcript;

          // Two independent random sources. One run optionally uses Math.random itself
          // to prove the outcome is independent of a genuinely nondeterministic source.
          const r1 = useMathRandom ? Math.random : mulberry32(seed1);
          const r2 = mulberry32(seed2);

          const latched1 = replay(mission, transcript, r1);
          const latched2 = replay(mission, transcript, r2);

          expect(sorted(latched1)).toEqual(sorted(latched2));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Browser/Server parity
//
// A test-only harness that reproduces `MissionExecutor`'s loop EXACTLY, and
// simultaneously builds the Transcript its recorder (design task 14.2) would
// produce for the same sequence of events. The property asserts that the set of
// objectives the browser latches equals `replay(mission, builtTranscript)`.
//
// Executor semantics reproduced here (see src/components/missions/MissionExecutor.tsx):
//  - command: run `executeCommand(cmd, simState, hcl)`, THEN set
//    `commandHistory = [...history, cmd]` and `simState = newState`, THEN the
//    objective-check effect (deps [simState, hcl, commandHistory]) runs against
//    (newState, hcl, newHistory, provider). Latches are sticky (`!has(id)` guard).
//  - edit: set `hcl = newHcl`, THEN the effect runs against (simState, newHcl, history, provider).
//  - reset ("Reset terminal"): `simState = createInitialState()`, `commandHistory = []`,
//    THEN the effect runs against (initialState, hcl, [], provider). Latches are kept.
//
// Recorder semantics reproduced here (design "Transcript recorder"):
//  - run:   every command appends `{ command: cmd, hcl: <hcl at that time>, kind: "run" }`
//           (empty command included — the browser pushes it to history too).
//  - check: an objective latching from an *edit* appends `{ command: "", hcl: <current>, kind: "check" }`,
//           but only when a latch actually happens AND the current HCL differs from the
//           last recorded step's HCL, OR there are no steps yet.
//  - reset: pressing "Reset terminal" appends `{ command: "", hcl: <current>, kind: "reset" }`.
// ─────────────────────────────────────────────────────────────────────────────

type ExecutorEvent =
  | { type: "command"; cmd: string }
  | { type: "edit"; hcl: string }
  | { type: "reset" };

/**
 * Drive the executor loop and the recorder in lock-step. Returns the browser's
 * latched objective set and the Transcript the recorder would have persisted.
 *
 * `random` is threaded into `executeCommand` so the harness is deterministic; the
 * outcome does not depend on it (Property 2), but fixing it keeps the two sides
 * computing against identical state.
 */
function simulateExecutor(
  mission: Mission,
  provider: Provider,
  initialHcl: string,
  events: ExecutorEvent[],
  random: () => number,
): { latched: Set<string>; transcript: Transcript } {
  let simState: SimulatorState = createInitialState();
  let history: string[] = [];
  let hcl = initialHcl;
  const latched = new Set<string>();
  const steps: TranscriptStep[] = [];

  // Mirrors the executor's checking effect: check every not-yet-latched objective
  // against the current (state, hcl, history, provider); latch on first pass.
  // Returns whether anything newly latched (needed for the recorder's "check" rule).
  const runChecks = (): boolean => {
    let changed = false;
    for (const obj of mission.objectives) {
      if (latched.has(obj.id)) continue;
      let passed = false;
      try {
        passed = obj.check(simState, hcl, history, provider);
      } catch {
        passed = false;
      }
      if (passed) {
        latched.add(obj.id);
        changed = true;
      }
    }
    return changed;
  };

  // On mount the executor runs the check effect once against the starter HCL
  // (deps include `hcl`), so an objective can latch from the starter code before
  // any user event. The recorder captures this with an initial "check" step
  // ("or when there are no steps yet"), so replay — which only checks inside its
  // step loop — sees the same starting HCL.
  {
    const changed = runChecks();
    if (changed) {
      steps.push({ command: "", hcl, kind: "check" });
    }
  }

  for (const ev of events) {
    if (ev.type === "command") {
      // executeCommand first, then history + state update, then checks (effect).
      simState = executeCommand(ev.cmd, simState, hcl, { random }).newState;
      history = [...history, ev.cmd];
      // Recorder: every command is a "run" step with the HCL at that moment.
      steps.push({ command: ev.cmd, hcl, kind: "run" });
      runChecks();
    } else if (ev.type === "edit") {
      hcl = ev.hcl;
      const changed = runChecks();
      // Recorder: append a "check" step only when the edit caused a latch AND the
      // current HCL differs from the last recorded step's HCL (or there are no steps).
      if (changed) {
        const last = steps[steps.length - 1];
        if (!last || last.hcl !== hcl) {
          steps.push({ command: "", hcl, kind: "check" });
        }
      }
    } else {
      // reset: clear sim state + history, keep latches, then re-check.
      simState = createInitialState();
      history = [];
      steps.push({ command: "", hcl, kind: "reset" });
      runChecks();
    }
  }

  return { latched, transcript: { provider, steps } };
}

/**
 * Build the per-mission HCL alphabet. Includes the starter code (so pre-filled
 * objectives can latch) and a handful of generic solution-ish snippets that make
 * the text-based `check`s latch for at least some inputs across the catalog.
 */
function hclAlphabet(starter: string): string[] {
  return [
    starter,
    "",
    'resource "aws_s3_bucket" "x" { bucket = "y" }',
    // A broad "solution-ish" blob: contains tokens many objective checks look for
    // across providers (provider blocks, variables, outputs, locals, data, module,
    // backend, lifecycle, for_each/each.key, conditionals, functions, validation,
    // sensitive, terraform.workspace, terraform_remote_state).
    `terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    google = { source = "hashicorp/google", version = "~> 5.0" }
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.0" }
  }
  backend "s3" { bucket = "ops-terraform-state"  key = "prod/terraform.tfstate" }
}

provider "aws" { region = "us-east-1" }
provider "google" { project = "my-gcp-project"  region = "us-central1" }
provider "azurerm" { features {} }

variable "bucket_name" { type = string  default = "my-ops-bucket"  sensitive = true
  validation { condition = contains(["dev","staging","prod"], var.bucket_name)  error_message = "bad" }
}
variable "rg_name" { type = string  default = "my-ops-rg"
  validation { condition = length(var.rg_name) <= 90  error_message = "bad" }
}
variable "db_password" { type = string  sensitive = true }
variable "environments" { type = set(string)  default = ["dev","staging","prod"] }

locals {
  env = terraform.workspace
  bucket_name = "ops-\${terraform.workspace}-storage"
  normalized_name = lower(var.bucket_name)
  tags = jsondecode(var.bucket_name)
  team_buckets = { for name in var.environments : name => "ops-\${name}-data" }
}

data "aws_ami" "ubuntu" { most_recent = true  owners = ["099720109477"] }
data "terraform_remote_state" "networking" { backend = "s3"  config = {} }

module "vpc" { source = "terraform-aws-modules/vpc/aws"  name = "ops-vpc"  cidr = "10.0.0.0/16" }

resource "aws_s3_bucket" "mission_bucket" {
  for_each = var.environments
  bucket = format("ops-%s-store", local.normalized_name)
  tags = local.tags
  lifecycle { create_before_destroy = true  prevent_destroy = true  ignore_changes = [tags] }
}
resource "google_storage_bucket" "ops_bucket" { name = local.bucket_name  location = "US" }
resource "azurerm_resource_group" "ops_rg" { name = local.env }

output "bucket_id" { value = aws_s3_bucket.mission_bucket.id  sensitive = true }`,
  ];
}

/** The command alphabet drives sim-state objectives (init/plan/apply/state/etc). */
const PARITY_COMMANDS = [
  "terraform init",
  "terraform validate",
  "terraform plan",
  "terraform apply -auto-approve",
  "terraform apply",
  "terraform fmt",
  "terraform output",
  "terraform state list",
  "terraform state show aws_s3_bucket.mission_bucket",
  "terraform show",
  "terraform workspace show",
  "terraform workspace new staging",
  "terraform destroy -auto-approve",
  "ls",
  "",
];

describe("replay — browser/server parity", () => {
  // Feature: progress-sync, Property 1: Browser/Server parity
  it("Property 1: executor-latched objectives equal replay() of the recorded transcript", () => {
    fc.assert(
      fc.property(
        fc.nat(MISSIONS.length - 1),
        fc.constantFrom(...PROVIDERS),
        fc.integer(),
        (missionIdx, provider, seed) => {
          const mission = MISSIONS[missionIdx];
          const starter = getStarterCode(mission, provider);
          const hcls = hclAlphabet(starter);

          const eventArb: fc.Arbitrary<ExecutorEvent> = fc.oneof(
            { weight: 5, arbitrary: fc.record({ type: fc.constant("command" as const), cmd: fc.constantFrom(...PARITY_COMMANDS) }) },
            { weight: 4, arbitrary: fc.record({ type: fc.constant("edit" as const), hcl: fc.constantFrom(...hcls) }) },
            { weight: 1, arbitrary: fc.record({ type: fc.constant("reset" as const) }) },
          );

          // Sample a realistic event sequence. The executor starts with the starter
          // code already in the editor (useState(starterCode)); the recorder on a
          // fresh attempt has no steps until the first event.
          const events = fc.sample(fc.array(eventArb, { minLength: 1, maxLength: 50 }), 1)[0];

          const random = mulberry32(seed);
          const { latched, transcript } = simulateExecutor(mission, provider, starter, events, random);

          // Replay must reach the same verdict the browser did.
          const replayed = replay(mission, transcript, mulberry32(seed));

          expect(sorted(replayed)).toEqual(sorted(latched));
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 5.3 — Golden transcript example tests
//
// For EACH of the 15 catalog missions, a hand-written PASSING transcript that
// latches ALL objectives (verified for every provider the mission supports), and
// a TRUNCATED variant that must NOT latch all objectives.
//
// These are the "golden solutions" referenced by the design's Testing Strategy:
// they guard against catalog edits (objective checks, starter codes) silently
// breaking server-side verification. The solution HCL below is hand-written to
// satisfy every objective's `check` for each provider; the transcript threads it
// through the simulator with the terraform commands each sim-state objective needs.
//
// Feature: progress-sync, Task 5.3: Golden transcript example tests
// ─────────────────────────────────────────────────────────────────────────────

import { isAccepted } from "../replay";
import { getMission } from "@/data/missions";

/** Per-provider solution HCL that latches every objective of a mission. */
type SolutionByProvider = Partial<Record<Provider, string>>;

/** How to build the passing step list from the solution HCL for a mission. */
type GoldenSpec = {
  solutions: SolutionByProvider;
  /** Commands run (as "run" steps) with the solution HCL in the editor. */
  commands: string[];
};

// mission-01 OP-INIT: declare provider in required_providers, add provider block,
// init (initialized), confirm provider installed (providerInstalled).
const SOL_01: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}`,
};

// mission-02 OP-RESOURCE: init, add storage resource, plan (create), apply.
const SOL_02: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "mission_bucket" {
  bucket = "my-terraops-mission-bucket"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_storage_bucket" "mission_bucket" {
  name     = "my-terraops-mission-bucket"
  location = "US"
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "mission_rg" {
  name     = "terraops-mission-rg"
  location = "East US"
}`,
};

// mission-03 OP-VARIABLES: variable, var. usage, output, apply with outputs.
const SOL_03: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  type    = string
  default = "my-ops-bucket"
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "ops_bucket" {
  bucket = var.bucket_name
}

output "bucket_id" {
  value = aws_s3_bucket.ops_bucket.id
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  type    = string
  default = "my-ops-bucket"
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_storage_bucket" "ops_bucket" {
  name     = var.bucket_name
  location = "US"
}

output "bucket_url" {
  value = google_storage_bucket.ops_bucket.url
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

variable "rg_name" {
  type    = string
  default = "my-ops-rg"
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "ops_rg" {
  name     = var.rg_name
  location = "East US"
}

output "rg_id" {
  value = azurerm_resource_group.ops_rg.id
}`,
};

// mission-04 OP-STATE: apply ≥2 resources, state list, state show <addr>, show.
const SOL_04: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "data_lake" {
  bucket = "ops-data-lake-2024"
}

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_storage_bucket" "data_lake" {
  name     = "ops-data-lake-2024"
  location = "US"
}

resource "google_compute_instance" "web_server" {
  name         = "web-server"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "data_lake" {
  name     = "ops-data-lake-rg"
  location = "East US"
}

resource "azurerm_resource_group" "web_server" {
  name     = "ops-web-server-rg"
  location = "East US"
}`,
};

// mission-05 OP-DATA: data source block, data. reference, apply.
const SOL_05: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
}

resource "aws_instance" "target" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

data "google_compute_image" "ubuntu" {
  family  = "ubuntu-2204-lts"
  project = "ubuntu-os-cloud"
}

resource "google_compute_instance" "target" {
  name         = "ops-target"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
  boot_disk {
    initialize_params {
      image = data.google_compute_image.ubuntu.self_link
    }
  }
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_resource_group" "existing" {
  name = "ops-existing-rg"
}

resource "azurerm_storage_account" "target" {
  name                     = "opstargetstore"
  location                 = data.azurerm_resource_group.existing.location
  resource_group_name      = data.azurerm_resource_group.existing.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
}`,
};

// mission-06 OP-MODULES: module block w/ source + ≥2 inputs (≥3 attrs total), init+apply.
const SOL_06: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = "ops-vpc"
  cidr    = "10.0.0.0/16"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

module "network" {
  source       = "terraform-google-modules/network/google"
  version      = "~> 9.0"
  project_id   = "my-gcp-project"
  network_name = "ops-vpc"
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "ops-modules-rg"
  location = "East US"
}

module "naming" {
  source  = "Azure/naming/azurerm"
  version = "~> 0.3"
  suffix  = ["ops", "prod"]
}`,
};

// mission-07 OP-REMOTE: backend block w/ bucket+key (or container+key), init, apply,
// terraform_remote_state data source.
const SOL_07: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ops-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "app_storage" {
  bucket = "ops-app-storage-prod"
}

data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "ops-terraform-state"
    key    = "networking/terraform.tfstate"
    region = "us-east-1"
  }
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "ops-terraform-state"
    prefix = "prod/terraform.tfstate"
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_storage_bucket" "app_storage" {
  name     = "ops-app-storage-prod"
  location = "US"
}

data "terraform_remote_state" "networking" {
  backend = "gcs"
  config = {
    bucket = "ops-terraform-state"
    prefix = "networking/terraform.tfstate"
  }
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "ops-state-rg"
    storage_account_name = "opsterraformstate"
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "app" {
  name     = "ops-app-prod-rg"
  location = "East US"
}

data "terraform_remote_state" "networking" {
  backend = "azurerm"
  config = {
    resource_group_name  = "ops-state-rg"
    storage_account_name = "opsterraformstate"
    container_name       = "tfstate"
    key                  = "networking.terraform.tfstate"
  }
}`,
};

// mission-08 OP-LOCALS: locals block + local. in resource + local. in output, init+apply.
const SOL_08: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "environment" {
  type    = string
  default = "production"
}

locals {
  env         = var.environment
  bucket_name = "ops-\${var.environment}-storage"
  common_tags = { Environment = var.environment, ManagedBy = "Terraform" }
}

resource "aws_s3_bucket" "storage" {
  bucket = local.bucket_name
  tags   = local.common_tags
}

output "env" {
  value = local.env
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

variable "environment" {
  type    = string
  default = "production"
}

locals {
  env           = var.environment
  bucket_name   = "ops-\${var.environment}-storage"
  common_labels = { environment = var.environment, managed_by = "terraform" }
}

resource "google_storage_bucket" "storage" {
  name     = local.bucket_name
  location = "US"
  labels   = local.common_labels
}

output "env" {
  value = local.env
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "environment" {
  type    = string
  default = "production"
}

locals {
  env         = var.environment
  rg_name     = "ops-\${var.environment}-rg"
  common_tags = { Environment = var.environment, ManagedBy = "Terraform" }
}

resource "azurerm_resource_group" "main" {
  name     = local.rg_name
  location = "East US"
  tags     = local.common_tags
}

output "env" {
  value = local.env
}`,
};

// mission-09 OP-FOREACH: for_each = var.environments, each.key, apply ≥3 resources.
const SOL_09: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "environments" {
  type    = set(string)
  default = ["dev", "staging", "prod"]
}

resource "aws_s3_bucket" "env_data" {
  for_each = var.environments
  bucket   = "ops-\${each.key}-data"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

variable "environments" {
  type    = set(string)
  default = ["dev", "staging", "prod"]
}

resource "google_storage_bucket" "env_data" {
  for_each = var.environments
  name     = "ops-\${each.key}-data"
  location = "US"
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "environments" {
  type    = set(string)
  default = ["dev", "staging", "prod"]
}

resource "azurerm_resource_group" "env" {
  for_each = var.environments
  name     = "ops-\${each.key}-rg"
  location = "East US"
}`,
};

// mission-10 OP-FUNCTIONS: lower(), jsondecode(), format()/interpolation, init+apply.
const SOL_10: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "MyTerraProject"
}

variable "tags_json" {
  type    = string
  default = "{}"
}

locals {
  normalized_name = lower(var.project_name)
  tags            = jsondecode(var.tags_json)
  bucket_name     = format("ops-%s-store", local.normalized_name)
}

resource "aws_s3_bucket" "project" {
  bucket = local.bucket_name
  tags   = local.tags
}

output "normalized_name" {
  value = local.normalized_name
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

variable "project_name" {
  type    = string
  default = "MyTerraProject"
}

variable "labels_json" {
  type    = string
  default = "{}"
}

locals {
  normalized_name = lower(var.project_name)
  labels          = jsondecode(var.labels_json)
  bucket_name     = format("ops-%s-store", local.normalized_name)
}

resource "google_storage_bucket" "project" {
  name     = local.bucket_name
  location = "US"
  labels   = local.labels
}

output "normalized_name" {
  value = local.normalized_name
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "project_name" {
  type    = string
  default = "MyTerraProject"
}

variable "tags_json" {
  type    = string
  default = "{}"
}

locals {
  normalized_name = lower(var.project_name)
  tags            = jsondecode(var.tags_json)
  rg_name         = format("ops-%s-rg", local.normalized_name)
}

resource "azurerm_resource_group" "project" {
  name     = local.rg_name
  location = "East US"
  tags     = local.tags
}

output "normalized_name" {
  value = local.normalized_name
}`,
};

// mission-11 OP-SECRETS: db_password var sensitive=true, output sensitive=true, init+apply.
const SOL_11: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "db_password" {
  type        = string
  description = "The database master password"
  default     = "change-me-use-env-var"
  sensitive   = true
}

variable "db_name" {
  type    = string
  default = "opsdb"
}

resource "aws_db_instance" "main" {
  identifier     = "ops-database"
  engine         = "postgres"
  instance_class = "db.t3.micro"
  username       = "admin"
  password       = var.db_password
  db_name        = var.db_name
}

output "db_endpoint" {
  value       = aws_db_instance.main.id
  description = "Database endpoint"
  sensitive   = true
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

variable "db_password" {
  type        = string
  description = "The database master password"
  default     = "change-me-use-env-var"
  sensitive   = true
}

variable "db_name" {
  type    = string
  default = "opsdb"
}

resource "google_sql_database_instance" "main" {
  name             = "ops-database"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier = "db-f1-micro"
  }
}

output "db_connection" {
  value       = google_sql_database_instance.main.id
  description = "Database connection name"
  sensitive   = true
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "db_password" {
  type        = string
  description = "The database administrator password"
  default     = "change-me-use-env-var"
  sensitive   = true
}

resource "azurerm_resource_group" "main" {
  name     = "ops-database-rg"
  location = "East US"
}

resource "azurerm_mssql_server" "main" {
  name                         = "ops-sql-server"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = "sqladmin"
  administrator_login_password = var.db_password
}

output "sql_server_id" {
  value       = azurerm_mssql_server.main.id
  description = "SQL Server resource ID"
  sensitive   = true
}`,
};

// mission-12 OP-LIFECYCLE: create_before_destroy, prevent_destroy, ignore_changes, init+apply.
const SOL_12: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "ops-web-server"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "main" {
  identifier     = "ops-prod-db"
  engine         = "postgres"
  instance_class = "db.t3.micro"
  username       = "admin"
  password       = "placeholder"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = "ops-assets-bucket"

  tags = {
    Name = "ops-assets"
  }

  lifecycle {
    ignore_changes = [tags]
  }
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_compute_instance" "web" {
  name         = "ops-web-server"
  machine_type = "e2-micro"
  zone         = "us-central1-a"

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_sql_database_instance" "main" {
  name             = "ops-prod-db"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier = "db-f1-micro"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_storage_bucket" "assets" {
  name     = "ops-assets-bucket"
  location = "US"

  lifecycle {
    ignore_changes = [labels]
  }
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "ops-lifecycle-rg"
  location = "East US"
}

resource "azurerm_linux_virtual_machine" "web" {
  name                = "ops-web-server"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "Standard_B1s"
  admin_username      = "adminuser"

  lifecycle {
    create_before_destroy = true
  }
}

resource "azurerm_storage_account" "assets" {
  name                     = "opsassetsstore"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [tags]
  }
}`,
};

// mission-13 OP-CONDITIONALS: ternary, count conditional, for expression locals, init+apply.
const SOL_13: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "enable_monitoring" {
  type    = bool
  default = false
}

variable "team_names" {
  type    = list(string)
  default = ["platform", "security", "data"]
}

locals {
  team_buckets = { for name in var.team_names : name => "ops-\${name}-data" }
}

resource "aws_instance" "app" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.environment == "prod" ? "t3.large" : "t3.micro"
}

resource "aws_s3_bucket" "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  bucket = "ops-monitoring-bucket"
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "enable_monitoring" {
  type    = bool
  default = false
}

variable "team_names" {
  type    = list(string)
  default = ["platform", "security", "data"]
}

locals {
  team_buckets = { for name in var.team_names : name => "ops-\${name}-data" }
}

resource "google_compute_instance" "app" {
  name         = "ops-app"
  machine_type = var.environment == "prod" ? "e2-standard-2" : "e2-micro"
  zone         = "us-central1-a"
}

resource "google_storage_bucket" "monitoring" {
  count    = var.enable_monitoring ? 1 : 0
  name     = "ops-monitoring-bucket"
  location = "US"
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "enable_monitoring" {
  type    = bool
  default = false
}

variable "team_names" {
  type    = list(string)
  default = ["platform", "security", "data"]
}

locals {
  team_rgs = { for name in var.team_names : name => "ops-\${name}-rg" }
}

resource "azurerm_resource_group" "main" {
  name     = "ops-conditionals-rg"
  location = "East US"
}

resource "azurerm_storage_account" "app" {
  name                     = "opsconditionalstore"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = var.environment == "prod" ? "Premium" : "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_resource_group" "monitoring" {
  count    = var.enable_monitoring ? 1 : 0
  name     = "ops-monitoring-rg"
  location = "East US"
}`,
};

// mission-14 OP-WORKSPACE: workspace show, workspace new staging, terraform.workspace, apply in workspace.
const SOL_14: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  env         = terraform.workspace
  bucket_name = "ops-\${terraform.workspace}-storage"
}

resource "aws_s3_bucket" "env_storage" {
  bucket = local.bucket_name

  tags = {
    Environment = local.env
    ManagedBy   = "Terraform"
  }
}

output "workspace" {
  value = local.env
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

locals {
  env         = terraform.workspace
  bucket_name = "ops-\${terraform.workspace}-storage"
}

resource "google_storage_bucket" "env_storage" {
  name     = local.bucket_name
  location = "US"

  labels = {
    environment = local.env
  }
}

output "workspace" {
  value = local.env
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  env     = terraform.workspace
  rg_name = "ops-\${terraform.workspace}-rg"
}

resource "azurerm_resource_group" "env" {
  name     = local.rg_name
  location = "East US"

  tags = {
    Environment = local.env
    ManagedBy   = "Terraform"
  }
}

output "workspace" {
  value = local.env
}`,
};

// mission-15 OP-VALIDATE: two validation blocks, validate, fmt, apply.
const SOL_15: SolutionByProvider = {
  aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "bucket_name" {
  type        = string
  default     = "my-ops-bucket"
  description = "Name of the S3 bucket"

  validation {
    condition     = length(var.bucket_name) >= 3 && length(var.bucket_name) <= 63
    error_message = "Bucket name must be between 3 and 63 characters."
  }
}

resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name

  tags = {
    Environment = var.environment
  }
}

output "bucket_name" {
  value = aws_s3_bucket.main.bucket
}`,
  gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "bucket_name" {
  type        = string
  default     = "my-ops-bucket"
  description = "Name of the GCS bucket"

  validation {
    condition     = var.bucket_name == lower(var.bucket_name)
    error_message = "Bucket name must be lowercase."
  }
}

resource "google_storage_bucket" "main" {
  name     = var.bucket_name
  location = "US"

  labels = {
    environment = var.environment
  }
}

output "bucket_name" {
  value = google_storage_bucket.main.name
}`,
  azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "rg_name" {
  type        = string
  default     = "my-ops-rg"
  description = "Name of the Azure resource group"

  validation {
    condition     = length(var.rg_name) <= 90
    error_message = "Resource group name must be 90 characters or fewer."
  }
}

resource "azurerm_resource_group" "main" {
  name     = var.rg_name
  location = "East US"

  tags = {
    Environment = var.environment
  }
}

output "rg_name" {
  value = azurerm_resource_group.main.name
}`,
};

/**
 * Per-mission golden spec: solution HCL (by provider) + the terraform commands the
 * passing attempt runs. The command list is applied as "run" steps, each with the
 * solution HCL in the editor. Objectives that only inspect HCL latch from the first
 * step; sim-state objectives latch once their command has run.
 */
const GOLDEN: Record<string, GoldenSpec> = {
  "mission-01": { solutions: SOL_01, commands: ["terraform init", "terraform version"] },
  "mission-02": {
    solutions: SOL_02,
    commands: ["terraform init", "terraform plan", "terraform apply -auto-approve"],
  },
  "mission-03": {
    solutions: SOL_03,
    commands: ["terraform init", "terraform apply -auto-approve", "terraform output"],
  },
  "mission-04": {
    solutions: SOL_04,
    commands: [
      "terraform init",
      "terraform apply -auto-approve",
      "terraform state list",
      "terraform state show RESOURCE_ADDR",
      "terraform show",
    ],
  },
  "mission-05": {
    solutions: SOL_05,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-06": {
    solutions: SOL_06,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-07": {
    solutions: SOL_07,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-08": {
    solutions: SOL_08,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-09": {
    solutions: SOL_09,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-10": {
    solutions: SOL_10,
    commands: ["terraform init", "terraform apply -auto-approve", "terraform output normalized_name"],
  },
  "mission-11": {
    solutions: SOL_11,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-12": {
    solutions: SOL_12,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-13": {
    solutions: SOL_13,
    commands: ["terraform init", "terraform apply -auto-approve"],
  },
  "mission-14": {
    solutions: SOL_14,
    // show current workspace, create+switch to staging, then apply in staging.
    commands: ["terraform workspace show", "terraform workspace new staging", "terraform init", "terraform apply -auto-approve"],
  },
  "mission-15": {
    solutions: SOL_15,
    commands: ["terraform init", "terraform validate", "terraform fmt", "terraform apply -auto-approve"],
  },
};

/**
 * The address used by mission-04's `terraform state show <addr>` step. The check
 * only requires the command to START WITH "terraform state show ", so the exact
 * address doesn't need to exist in state.
 */
const STATE_SHOW_ADDR: Record<Provider, string> = {
  aws: "aws_s3_bucket.data_lake",
  gcp: "google_storage_bucket.data_lake",
  azure: "azurerm_resource_group.data_lake",
};

/** Build a passing transcript: every command is a "run" step with the solution HCL. */
function buildPassingTranscript(
  provider: Provider,
  solution: string,
  commands: string[],
): Transcript {
  const steps: TranscriptStep[] = commands.map((command) => ({
    command: command === "terraform state show RESOURCE_ADDR"
      ? `terraform state show ${STATE_SHOW_ADDR[provider]}`
      : command,
    hcl: solution,
    kind: "run" as const,
  }));
  return { provider, steps };
}

describe("replay — golden transcripts (Task 5.3)", () => {
  for (const [missionId, spec] of Object.entries(GOLDEN)) {
    const mission = getMission(missionId)!;
    const providers = Object.keys(spec.solutions) as Provider[];

    describe(`${missionId} (${mission.operationCode})`, () => {
      for (const provider of providers) {
        const solution = spec.solutions[provider]!;

        // Feature: progress-sync, Task 5.3: Golden transcript example tests
        it(`${provider}: passing transcript latches ALL ${mission.objectives.length} objectives`, () => {
          const transcript = buildPassingTranscript(provider, solution, spec.commands);
          const latched = replay(mission, transcript, mulberry32(0));
          const missing = mission.objectives
            .map((o) => o.id)
            .filter((id) => !latched.has(id));
          // Surface exactly which objective failed to latch if this ever breaks.
          expect(missing, `unlatched objectives: ${missing.join(", ")}`).toEqual([]);
          expect(latched.size).toBe(mission.objectives.length);
          expect(isAccepted(mission, transcript, mulberry32(0))).toBe(true);
        });

        // Feature: progress-sync, Task 5.3: Golden transcript example tests
        it(`${provider}: truncated transcript (drop final command) is NOT accepted`, () => {
          // Dropping the last command removes the step that latches the final
          // sim-state objective (apply/output/fmt/etc).
          const truncated = buildPassingTranscript(
            provider,
            solution,
            spec.commands.slice(0, -1),
          );
          expect(isAccepted(mission, truncated, mulberry32(0))).toBe(false);
          expect(replay(mission, truncated, mulberry32(0)).size).toBeLessThan(
            mission.objectives.length,
          );
        });

        // Feature: progress-sync, Task 5.3: Golden transcript example tests
        it(`${provider}: starter HCL with all commands is NOT accepted (TODOs unfilled)`, () => {
          const starter = getStarterCode(mission, provider);
          const starterTranscript = buildPassingTranscript(provider, starter, spec.commands);
          expect(isAccepted(mission, starterTranscript, mulberry32(0))).toBe(false);
        });
      }
    });
  }
});
