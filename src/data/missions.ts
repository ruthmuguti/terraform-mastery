import type { Mission } from "@/lib/types";
import { resourceType } from "@/lib/providers";

export const MISSIONS: Mission[] = [
  // ─────────────────────────────────────────────
  // CHAPTER 1 — FOUNDATION
  // ─────────────────────────────────────────────
  {
    id: "mission-01",
    operationCode: "OP-INIT",
    title: "Operation: INIT",
    description: "Every Terraform operation begins with initialization. Configure a provider and prepare the workspace.",
    briefing:
      "Agent — you've been dropped into an unmapped zone. No provider configuration, no initialized workspace, no comms. Before any operation can run, you must establish a foothold. Configure your cloud provider, declare the required plugin, and initialize the working directory. The clock is ticking.",
    difficulty: "rookie",
    xpReward: 100,
    badgeId: "badge-init",
    chapter: 1,
    order: 1,
    estimatedMinutes: 10,
    tags: ["basics", "init", "providers"],
    concepts: [
      "Terraform is an Infrastructure as Code (IaC) tool — infrastructure defined in files, not consoles",
      "`terraform init` downloads provider plugins and sets up the backend",
      "Providers are plugins that let Terraform talk to cloud APIs",
      "The `required_providers` block pins the provider source and version",
      "The `.terraform/` directory is created by init and should not be committed to git",
    ],
    starterCodes: {
      aws: `# OP-INIT — Configure the AWS provider
# Your mission: fill in the required_providers block
# and run terraform init

terraform {
  required_providers {
    # TODO: Add the AWS provider
    # source  = "hashicorp/aws"
    # version = "~> 5.0"
  }
}

# TODO: Add the provider block for AWS with region = "us-east-1"
`,
      gcp: `# OP-INIT — Configure the Google Cloud provider
# Your mission: fill in the required_providers block
# and run terraform init

terraform {
  required_providers {
    # TODO: Add the Google provider
    # source  = "hashicorp/google"
    # version = "~> 5.0"
  }
}

# TODO: Add the provider block for Google with:
#   project = "my-gcp-project"
#   region  = "us-central1"
`,
      azure: `# OP-INIT — Configure the Azure provider
# Your mission: fill in the required_providers block
# and run terraform init

terraform {
  required_providers {
    # TODO: Add the AzureRM provider
    # source  = "hashicorp/azurerm"
    # version = "~> 3.0"
  }
}

# TODO: Add the provider block for AzureRM
# provider "azurerm" { features {} }
`,
    },
    objectives: [
      {
        id: "add-provider-source",
        description: "Declare the provider in the `required_providers` block",
        hints: [
          "Edit the `terraform {}` block and uncomment the provider lines inside `required_providers`.",
          "The block needs `source` and `version` attributes — use the values shown in the comments.",
          "For AWS: `aws = { source = \"hashicorp/aws\", version = \"~> 5.0\" }`",
        ],
        check: (_, hcl, __, provider) => {
          const src = { aws: "hashicorp/aws", gcp: "hashicorp/google", azure: "hashicorp/azurerm" }[provider];
          return hcl.includes(src);
        },
      },
      {
        id: "add-provider-block",
        description: "Add a `provider` configuration block",
        hints: [
          "After the `terraform {}` block, add a `provider` block for your cloud.",
          "For AWS: `provider \"aws\" { region = \"us-east-1\" }`",
          "For GCP: `provider \"google\" { project = \"my-gcp-project\", region = \"us-central1\" }` — for Azure: `provider \"azurerm\" { features {} }`",
        ],
        check: (_, hcl, __, provider) => {
          const name = { aws: '"aws"', gcp: '"google"', azure: '"azurerm"' }[provider];
          return hcl.includes(`provider ${name}`);
        },
      },
      {
        id: "run-init",
        description: "Run `terraform init` to download the provider",
        hints: [
          "Type `terraform init` in the terminal on the right.",
          "Make sure your `required_providers` block is valid before running init.",
        ],
        check: (state) => state.initialized,
      },
      {
        id: "check-provider",
        description: "Confirm the provider was installed successfully",
        hints: [
          "Run `terraform version` — it should list the installed provider.",
          "If init succeeded, the provider is installed. Try `terraform validate` to confirm the config is valid.",
        ],
        check: (state) => state.providerInstalled,
      },
    ],
    unlocks: ["mission-02"],
  },

  {
    id: "mission-02",
    operationCode: "OP-RESOURCE",
    title: "Operation: FIRST RESOURCE",
    description: "Deploy your first cloud resource. Write the configuration, preview the plan, execute the apply.",
    briefing:
      "Intel confirms an unprovisioned storage resource is blocking the deployment pipeline. The team needs a named, versioned storage bucket deployed immediately — no console access, no manual steps. Write the resource block, preview the plan, and execute. A successful `apply` confirms mission success.",
    difficulty: "rookie",
    xpReward: 150,
    badgeId: "badge-first-resource",
    chapter: 1,
    order: 2,
    estimatedMinutes: 15,
    tags: ["resources", "plan", "apply"],
    concepts: [
      "Resources are the core building blocks of Terraform configurations",
      "Syntax: `resource \"<type>\" \"<local_name>\" { attribute = value }`",
      "The resource type is provider-specific (e.g. `aws_s3_bucket`, `google_storage_bucket`)",
      "`terraform plan` shows a preview — nothing is created until you apply",
      "`terraform apply -auto-approve` applies without the interactive confirmation prompt",
    ],
    starterCodes: {
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

# TODO: Add an aws_s3_bucket resource named "mission_bucket"
# with bucket = "my-terraops-mission-bucket"
`,
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

# TODO: Add a google_storage_bucket resource named "mission_bucket"
# with name = "my-terraops-mission-bucket"
# and location = "US"
`,
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

# TODO: Add an azurerm_resource_group resource named "mission_rg"
# with name = "terraops-mission-rg"
# and location = "East US"
`,
    },
    objectives: [
      {
        id: "run-init",
        description: "Initialize the working directory",
        hints: ["Run `terraform init` in the terminal."],
        check: (state) => state.initialized,
      },
      {
        id: "add-resource",
        description: "Define a storage resource with the correct type for your provider",
        hints: [
          "Use `resource \"<type>\" \"<name>\" { ... }` — check the TODO comment for the correct type.",
          "AWS: `aws_s3_bucket` · GCP: `google_storage_bucket` · Azure: `azurerm_resource_group`",
          "For AWS: `resource \"aws_s3_bucket\" \"mission_bucket\" { bucket = \"my-terraops-mission-bucket\" }`",
        ],
        check: (_, hcl, __, provider) => {
          const types: Record<string, string[]> = {
            aws: ['resource "aws_s3_bucket"'],
            gcp: ['resource "google_storage_bucket"'],
            azure: ['resource "azurerm_resource_group"', 'resource "azurerm_storage_account"'],
          };
          return (types[provider] ?? []).some((t) => hcl.includes(t));
        },
      },
      {
        id: "run-plan",
        description: "Run `terraform plan` — confirm 1 resource to add",
        hints: [
          "Type `terraform plan` in the terminal.",
          "The plan output should show `1 to add`. If it shows errors, check your HCL syntax.",
        ],
        check: (state) => state.planned && state.planResources.some((r) => r.action === "create"),
      },
      {
        id: "run-apply",
        description: "Run `terraform apply -auto-approve` to create the resource",
        hints: [
          "Type `terraform apply -auto-approve` in the terminal.",
          "The `-auto-approve` flag skips the interactive confirmation prompt.",
        ],
        check: (state, _, __, provider) => {
          const rtype = resourceType(provider, "storage_bucket");
          const altType = provider === "azure" ? "azurerm_resource_group" : rtype;
          return state.applied && state.appliedResources.some(
            (r) => r.type === rtype || r.type === altType
          );
        },
      },
    ],
    unlocks: ["mission-03"],
  },

  // ─────────────────────────────────────────────
  // CHAPTER 2 — FIELD OPERATIONS
  // ─────────────────────────────────────────────
  {
    id: "mission-03",
    operationCode: "OP-VARIABLES",
    title: "Operation: VARIABLES",
    description: "Eliminate hardcoded values. Make your configuration reusable with input variables and outputs.",
    briefing:
      "Hardcoded strings have been detected across the configuration — environment names, bucket identifiers, region codes, all baked in. Any change requires editing 8 different files. This is how incidents happen. Your orders: extract all repeated values into input variables, wire them through the configuration, and expose critical identifiers as outputs for downstream consumers. Clean configuration or mission failure.",
    difficulty: "specialist",
    xpReward: 200,
    badgeId: "badge-variables",
    chapter: 2,
    order: 1,
    estimatedMinutes: 20,
    tags: ["variables", "outputs", "best-practices"],
    concepts: [
      "Variables make configurations reusable: `variable \"name\" { type = string, default = \"value\" }`",
      "Reference a variable with `var.<name>` anywhere in your configuration",
      "Outputs expose values after apply: `output \"name\" { value = resource.name.attribute }`",
      "Variable types: `string`, `number`, `bool`, `list(string)`, `map(string)`, `object({...})`",
      "Use `terraform.tfvars` or `-var` flags to override variable defaults at runtime",
      "Mark sensitive variables with `sensitive = true` — their values are redacted in plan/apply output",
      "Add `validation` blocks to enforce constraints: `validation { condition = ... error_message = \"...\" }`",
    ],
    starterCodes: {
      aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# TODO: Define a variable "bucket_name" with:
#   type    = string
#   default = "my-ops-bucket"

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "ops_bucket" {
  # TODO: Replace the hardcoded string with var.bucket_name
  bucket = "my-hardcoded-bucket-name"
}

# TODO: Add an output "bucket_id" that exposes
#       aws_s3_bucket.ops_bucket.id
`,
      gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# TODO: Define a variable "bucket_name" with:
#   type    = string
#   default = "my-ops-bucket"

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_storage_bucket" "ops_bucket" {
  # TODO: Replace the hardcoded string with var.bucket_name
  name     = "my-hardcoded-bucket-name"
  location = "US"
}

# TODO: Add an output "bucket_url" that exposes
#       google_storage_bucket.ops_bucket.url
`,
      azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# TODO: Define a variable "rg_name" with:
#   type    = string
#   default = "my-ops-rg"

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "ops_rg" {
  # TODO: Replace the hardcoded name with var.rg_name
  name     = "my-hardcoded-rg"
  location = "East US"
}

# TODO: Add an output "rg_id" that exposes
#       azurerm_resource_group.ops_rg.id
`,
    },
    objectives: [
      {
        id: "add-variable",
        description: "Define an input variable block",
        hints: [
          "Add a `variable` block before the provider block.",
          "Variable syntax: `variable \"name\" { type = string  default = \"value\" }`",
          "For AWS use `bucket_name`, for Azure use `rg_name`. Check the TODO comments.",
        ],
        check: (_, hcl) => /variable\s+"[^"]+"/.test(hcl),
      },
      {
        id: "use-variable",
        description: "Reference the variable inside the resource block (use `var.<name>`)",
        hints: [
          "Replace the hardcoded string in the resource with `var.<variable_name>`.",
          "For AWS: `bucket = var.bucket_name` · For Azure: `name = var.rg_name`",
        ],
        check: (_, hcl) => hcl.includes("var."),
      },
      {
        id: "add-output",
        description: "Add an `output` block to expose the resource identifier",
        hints: [
          "Add an `output` block after the resource block.",
          "Output syntax: `output \"name\" { value = <resource_ref> }`",
          "For AWS: `output \"bucket_id\" { value = aws_s3_bucket.ops_bucket.id }`",
        ],
        check: (_, hcl) => /output\s+"[^"]+"/.test(hcl),
      },
      {
        id: "run-apply",
        description: "Apply the configuration and inspect the output value",
        hints: [
          "Run `terraform apply -auto-approve` then `terraform output` to see the output value.",
        ],
        check: (state) => state.applied && Object.keys(state.outputs).length > 0,
      },
    ],
    unlocks: ["mission-04"],
  },

  {
    id: "mission-04",
    operationCode: "OP-STATE",
    title: "Operation: STATE",
    description: "Terraform's state file is its memory. Learn to read, inspect, and trust it.",
    briefing:
      "State is Terraform's single source of truth — the delta between what you've declared and what actually exists in the cloud. The ops team reports a suspected drift in the deployed environment. Your orders: provision the infrastructure, interrogate the state file, cross-reference the deployed resources, and confirm the deployment is clean. A blind operator is a dangerous one.",
    difficulty: "specialist",
    xpReward: 250,
    badgeId: "badge-state",
    chapter: 2,
    order: 2,
    estimatedMinutes: 20,
    tags: ["state", "inspection", "terraform.tfstate"],
    concepts: [
      "`terraform.tfstate` is a JSON file recording the real state of all managed resources",
      "`terraform state list` — shows all resource addresses tracked in state",
      "`terraform state show <address>` — shows full attributes of a specific resource",
      "`terraform show` — renders the entire state in human-readable format",
      "State contains sensitive data — never commit it to git; use remote backends in production",
    ],
    starterCodes: {
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
}
`,
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
}
`,
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
}
`,
    },
    objectives: [
      {
        id: "apply-config",
        description: "Initialize and apply — get at least 2 resources into state",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve`.",
          "Both resources need to be applied before you can inspect state.",
        ],
        check: (state) => state.applied && state.appliedResources.length >= 2,
      },
      {
        id: "list-state",
        description: "Run `terraform state list` to see all tracked resources",
        hints: [
          "Type exactly: `terraform state list`",
          "This command shows every resource address Terraform is tracking.",
        ],
        check: (_, __, history) => history.some((c) => c.trim() === "terraform state list"),
      },
      {
        id: "show-resource",
        description: "Run `terraform state show` on one of your resources",
        hints: [
          "Copy a resource address from `state list` output, then: `terraform state show <address>`",
          "Example: `terraform state show aws_s3_bucket.data_lake`",
        ],
        check: (_, __, history) => history.some((c) => c.startsWith("terraform state show ")),
      },
      {
        id: "run-show",
        description: "Run `terraform show` to view the full state at once",
        hints: [
          "Type `terraform show` — this renders all tracked resources in human-readable form.",
        ],
        check: (_, __, history) => history.some((c) => c.trim() === "terraform show"),
      },
    ],
    unlocks: ["mission-05"],
  },

  {
    id: "mission-05",
    operationCode: "OP-DATA",
    title: "Operation: DATA SOURCES",
    description: "Read external infrastructure into your configuration without managing it.",
    briefing:
      "Intel confirms pre-existing infrastructure deployed months ago by a separate team — a network, an image registry, an existing storage resource. You cannot destroy or recreate them. Your mission: use data sources to query the existing assets and attach new resources to them. Read-only access. No ownership transfer. No collateral damage.",
    difficulty: "specialist",
    xpReward: 300,
    badgeId: "badge-data",
    chapter: 2,
    order: 3,
    estimatedMinutes: 25,
    tags: ["data sources", "query", "read-only"],
    concepts: [
      "Data sources let you query existing infrastructure NOT managed by this Terraform config",
      "Syntax: `data \"<type>\" \"<name>\" { filter = value }` — reference with `data.<type>.<name>.<attr>`",
      "Common uses: look up an existing AMI/image, query a VPC, read a secret",
      "Data sources are read during `terraform plan` — they never create or modify resources",
      "Useful for bridging Terraform configurations that share infrastructure",
    ],
    starterCodes: {
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

# TODO: Add an aws_ami data source named "ubuntu"
# most_recent = true
# owners      = ["099720109477"]
# filter { name = "name", values = ["ubuntu/images/*ubuntu-jammy*"] }

resource "aws_instance" "target" {
  # TODO: Use data.aws_ami.ubuntu.id here instead of a hardcoded AMI
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}
`,
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

# TODO: Add a google_compute_image data source named "ubuntu"
# family  = "ubuntu-2204-lts"
# project = "ubuntu-os-cloud"

resource "google_compute_instance" "target" {
  name         = "ops-target"
  machine_type = "e2-micro"
  zone         = "us-central1-a"

  # TODO: Use data.google_compute_image.ubuntu.self_link
  # in a boot_disk block here
}
`,
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

# TODO: Add an azurerm_resource_group data source named "existing"
# name = "ops-existing-rg"

resource "azurerm_storage_account" "target" {
  name                = "opstargetstore"
  # TODO: Use data.azurerm_resource_group.existing.location
  location            = "East US"
  # TODO: Use data.azurerm_resource_group.existing.name
  resource_group_name = "ops-existing-rg"
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
`,
    },
    objectives: [
      {
        id: "add-data-source",
        description: "Define a `data` source block for your provider",
        hints: [
          "Add a `data` block above the resource. Check the TODO comment for the correct type.",
          "Data block syntax: `data \"<type>\" \"<name>\" { attribute = value }`",
          "For AWS: `data \"aws_ami\" \"ubuntu\" { most_recent = true, owners = [\"099720109477\"] }`",
        ],
        check: (_, hcl) => /data\s+"[^"]+"\s+"[^"]+"/.test(hcl),
      },
      {
        id: "reference-data",
        description: "Reference the data source in your resource (`data.<type>.<name>.<attr>`)",
        hints: [
          "Replace the hardcoded value in the resource with a `data.<type>.<name>.<attr>` reference.",
          "For AWS: `ami = data.aws_ami.ubuntu.id`",
          "For GCP: `data.google_compute_image.ubuntu.self_link` · For Azure: `data.azurerm_resource_group.existing.location`",
        ],
        check: (_, hcl) => hcl.includes("data."),
      },
      {
        id: "apply-config",
        description: "Initialize and apply the configuration",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve`.",
        ],
        check: (state) => state.applied,
      },
    ],
    unlocks: ["mission-06"],
  },

  // ─────────────────────────────────────────────
  // CHAPTER 3 — ADVANCED TACTICS
  // ─────────────────────────────────────────────
  {
    id: "mission-06",
    operationCode: "OP-MODULES",
    title: "Operation: MODULES",
    description: "Eliminate duplication. Build reusable infrastructure blueprints with Terraform modules.",
    briefing:
      "Field report: the same network configuration has been copy-pasted across 14 projects. Every one of them has drifted. A single security patch now requires 14 separate deployments. Your orders: consolidate the pattern into a reusable module. One source of truth. Zero drift. Infinite scale.",
    difficulty: "expert",
    xpReward: 400,
    badgeId: "badge-modules",
    chapter: 3,
    order: 1,
    estimatedMinutes: 35,
    tags: ["modules", "reusability", "registry"],
    concepts: [
      "Modules are self-contained packages of Terraform configurations used together",
      "Module syntax: `module \"name\" { source = \"./path\" or \"registry/module\" }`",
      "Root module = the directory where you run terraform commands",
      "Child modules have their own inputs (variables) and outputs",
      "The Terraform Registry hosts thousands of verified community modules",
    ],
    starterCodes: {
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

# TODO: Call the official AWS VPC module from the Terraform Registry
# module "vpc" {
#   source  = "terraform-aws-modules/vpc/aws"
#   version = "~> 5.0"
#   name    = "ops-vpc"
#   cidr    = "10.0.0.0/16"
#   azs     = ["us-east-1a", "us-east-1b"]
# }
`,
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

# TODO: Call the official Google network module from the Terraform Registry
# module "network" {
#   source       = "terraform-google-modules/network/google"
#   version      = "~> 9.0"
#   project_id   = "my-gcp-project"
#   network_name = "ops-vpc"
#   routing_mode = "GLOBAL"
#   subnets      = []
# }
`,
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

# TODO: Call the Azure naming module from the Terraform Registry
# module "naming" {
#   source  = "Azure/naming/azurerm"
#   version = "~> 0.3"
#   suffix  = ["ops", "prod"]
# }
`,
    },
    objectives: [
      {
        id: "add-module",
        description: "Add a `module` block referencing a registry source",
        hints: [
          "Add a `module \"<name>\" { source = \"<registry-path>\" }` block.",
          "Uncomment the TODO block in the starter code — it has the correct source path.",
          "For AWS: `source = \"terraform-aws-modules/vpc/aws\"` with `version = \"~> 5.0\"`",
        ],
        check: (_, hcl) => /module\s+"[^"]+"/.test(hcl) && hcl.includes("source"),
      },
      {
        id: "set-inputs",
        description: "Provide at least two input arguments to the module",
        hints: [
          "Inside the module block, add named arguments like `name = \"...\"` and `cidr = \"...\"`.",
          "Each module has its own required and optional inputs — check the TODO comments.",
        ],
        check: (_, hcl) => {
          const moduleMatch = hcl.match(/module\s+"[^"]+"\s*\{([^}]+)\}/s);
          if (!moduleMatch) return false;
          const body = moduleMatch[1];
          const attrs = body.match(/^\s*\w+\s*=/gm) ?? [];
          // Must have source + at least 2 other attrs
          return attrs.length >= 3;
        },
      },
      {
        id: "run-init-apply",
        description: "Initialize (to download the module) and apply",
        hints: [
          "Modules must be downloaded during `terraform init` before you can apply.",
          "Run `terraform init` then `terraform apply -auto-approve`.",
        ],
        check: (state) => state.initialized && state.applied,
      },
    ],
    unlocks: ["mission-07"],
  },

  {
    id: "mission-07",
    operationCode: "OP-REMOTE",
    title: "Operation: REMOTE STATE",
    description: "Store Terraform state remotely for production-grade, team-safe deployments.",
    briefing:
      "Critical alert: the state file lives on a developer's laptop. That developer is on leave. No one can run terraform without their machine. Meanwhile production is broken. Configure a remote backend — state in the cloud, locked against concurrent writes. Local state is a liability we can no longer afford.",
    difficulty: "master",
    xpReward: 500,
    badgeId: "badge-remote-state",
    chapter: 3,
    order: 2,
    estimatedMinutes: 40,
    tags: ["remote state", "backend", "teams", "collaboration"],
    concepts: [
      "Remote backends store `terraform.tfstate` in a shared, versioned location",
      "State locking prevents two operators from running `apply` simultaneously",
      "AWS S3 + DynamoDB is the most common backend pattern for AWS workloads",
      "GCS (Google Cloud Storage) and Azure Blob Storage are native options for GCP/Azure",
      "After changing backend config, run `terraform init` again to migrate state",
      "`terraform_remote_state` lets you read *another* module's outputs from its remote state — enabling cross-module sharing without tight coupling",
    ],
    starterCodes: {
      aws: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # TODO: Add an S3 backend block here
  # backend "s3" {
  #   bucket         = "ops-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "app_storage" {
  bucket = "ops-app-storage-prod"
}

# TODO: Add a terraform_remote_state data source to read the
# networking module's outputs (its backend also uses S3):
# data "terraform_remote_state" "networking" {
#   backend = "s3"
#   config = {
#     bucket = "ops-terraform-state"
#     key    = "networking/terraform.tfstate"
#     region = "us-east-1"
#   }
# }
`,
      gcp: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # TODO: Add a GCS backend block here
  # backend "gcs" {
  #   bucket = "ops-terraform-state"
  #   prefix = "prod/terraform.tfstate"
  # }
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

resource "google_storage_bucket" "app_storage" {
  name     = "ops-app-storage-prod"
  location = "US"
}

# TODO: Add a terraform_remote_state data source to read the
# networking module's outputs (its backend also uses GCS):
# data "terraform_remote_state" "networking" {
#   backend = "gcs"
#   config = {
#     bucket = "ops-terraform-state"
#     prefix = "networking/terraform.tfstate"
#   }
# }
`,
      azure: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  # TODO: Add an Azure Blob backend block here
  # backend "azurerm" {
  #   resource_group_name  = "ops-state-rg"
  #   storage_account_name = "opsterraformstate"
  #   container_name       = "tfstate"
  #   key                  = "prod.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "app" {
  name     = "ops-app-prod-rg"
  location = "East US"
}

# TODO: Add a terraform_remote_state data source to read the
# networking module's outputs (its backend uses Azure Blob):
# data "terraform_remote_state" "networking" {
#   backend = "azurerm"
#   config = {
#     resource_group_name  = "ops-state-rg"
#     storage_account_name = "opsterraformstate"
#     container_name       = "tfstate"
#     key                  = "networking.terraform.tfstate"
#   }
# }
`,
    },
    objectives: [
      {
        id: "add-backend",
        description: "Configure a remote backend inside the `terraform` block",
        hints: [
          "Uncomment the `backend` block in the starter code.",
          "The backend block goes inside `terraform { }`, alongside `required_providers`.",
          "For AWS use `backend \"s3\"`, GCP use `backend \"gcs\"`, Azure use `backend \"azurerm\"`.",
        ],
        check: (_, hcl) => /backend\s+"[^"]+"/.test(hcl),
      },
      {
        id: "set-bucket-key",
        description: "Specify `bucket`/`prefix` (or equivalent) and `key` for the state path",
        hints: [
          "The backend block needs at minimum a bucket name and a key (path to the state file).",
          "For GCS the attribute is `prefix` instead of `key`.",
        ],
        check: (_, hcl) => {
          const backendMatch = hcl.match(/backend\s+"[^"]+"\s*\{([^}]+)\}/s);
          if (!backendMatch) return false;
          const body = backendMatch[1];
          return (body.includes("bucket") || body.includes("container_name")) &&
                 (body.includes("key") || body.includes("prefix"));
        },
      },
      {
        id: "run-init",
        description: "Run `terraform init` to configure the new backend",
        hints: [
          "After changing backend config you must re-run `terraform init`.",
          "Init will offer to migrate existing local state to the remote backend.",
        ],
        check: (state) => state.initialized,
      },
      {
        id: "apply-config",
        description: "Apply your infrastructure with the remote backend active",
        hints: [
          "Run `terraform apply -auto-approve` after init succeeds.",
        ],
        check: (state) => state.applied,
      },
      {
        id: "add-remote-state",
        description: "Add a `terraform_remote_state` data source to read another module's outputs",
        hints: [
          "Uncomment the `data \"terraform_remote_state\"` block at the bottom of the starter code.",
          "`terraform_remote_state` is a special data source — its `backend` and `config` must match the remote module's backend configuration.",
          "Reference outputs from the remote state with: `data.terraform_remote_state.<name>.outputs.<output_name>`",
        ],
        check: (_, hcl) => hcl.includes("terraform_remote_state"),
      },
    ],
    unlocks: ["mission-08"],
  },

  // ─────────────────────────────────────────────
  // CHAPTER 4 — EXPRESSION MASTERY
  // ─────────────────────────────────────────────
  {
    id: "mission-08",
    operationCode: "OP-LOCALS",
    title: "Operation: LOCALS",
    description: "Centralize computed values to eliminate magic strings and reduce drift.",
    briefing:
      "Audit complete. The configuration is riddled with magic strings — the environment name appears in 9 different places, each slightly different. One team member typed 'production', another typed 'prod', a third used 'PROD'. The infrastructure is inconsistent and partially broken. Your orders: centralize all repeated values in a `locals` block and reference them everywhere. One definition. Zero drift.",
    difficulty: "specialist",
    xpReward: 275,
    badgeId: "badge-locals",
    chapter: 4,
    order: 1,
    estimatedMinutes: 20,
    tags: ["locals", "expressions", "DRY"],
    concepts: [
      "`locals` block defines computed values reusable across the configuration",
      "Syntax: `locals { name = value }` — reference with `local.name`",
      "Unlike variables, locals can't be overridden at runtime — they're computed inside the module",
      "Locals can reference variables, other locals, and resource attributes",
      "Use locals to avoid repeating the same expression — DRY (Don't Repeat Yourself)",
    ],
    starterCodes: {
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

# TODO: Add a locals block with:
#   env         = var.environment
#   bucket_name = "ops-\${var.environment}-storage"
#   common_tags = { Environment = var.environment, ManagedBy = "Terraform" }

resource "aws_s3_bucket" "storage" {
  # TODO: Use local.bucket_name instead of this hardcoded string
  bucket = "ops-production-storage"
  # TODO: Add tags = local.common_tags
}

output "env" {
  # TODO: Use local.env here
  value = var.environment
}
`,
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

# TODO: Add a locals block with:
#   env         = var.environment
#   bucket_name = "ops-\${var.environment}-storage"
#   common_labels = { environment = var.environment, managed_by = "terraform" }

resource "google_storage_bucket" "storage" {
  # TODO: Use local.bucket_name
  name     = "ops-production-storage"
  location = "US"
  # TODO: Add labels = local.common_labels
}

output "env" {
  # TODO: Use local.env here
  value = var.environment
}
`,
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

# TODO: Add a locals block with:
#   env     = var.environment
#   rg_name = "ops-\${var.environment}-rg"
#   common_tags = { Environment = var.environment, ManagedBy = "Terraform" }

resource "azurerm_resource_group" "main" {
  # TODO: Use local.rg_name
  name     = "ops-production-rg"
  location = "East US"
  # TODO: Add tags = local.common_tags
}

output "env" {
  # TODO: Use local.env here
  value = var.environment
}
`,
    },
    objectives: [
      {
        id: "add-locals",
        description: "Define a `locals` block with at least `env` and a derived name",
        hints: [
          "Add a `locals { }` block. Reference variables with `var.name` inside it.",
          "locals { env = var.environment  bucket_name = \"ops-${var.environment}-storage\" }",
        ],
        check: (_, hcl) => /locals\s*\{/.test(hcl) && hcl.includes("local."),
      },
      {
        id: "use-local-name",
        description: "Use a `local.*` value inside the resource block",
        hints: [
          "Replace the hardcoded name/bucket string in the resource with `local.<name>`.",
          "For AWS: `bucket = local.bucket_name` · For Azure: `name = local.rg_name`",
        ],
        check: (_, hcl) => {
          const resourceMatch = hcl.match(/resource\s+"[^"]+"\s+"[^"]+"\s*\{([^}]+)\}/s);
          return !!resourceMatch && resourceMatch[1].includes("local.");
        },
      },
      {
        id: "use-local-output",
        description: "Reference a `local.*` value in an output block",
        hints: [
          "Update the `output` block so its value uses `local.env` instead of `var.environment`.",
        ],
        check: (_, hcl) => {
          const outputMatch = hcl.match(/output\s+"[^"]+"\s*\{([^}]+)\}/s);
          return !!outputMatch && outputMatch[1].includes("local.");
        },
      },
      {
        id: "apply-config",
        description: "Initialize and apply the configuration",
        hints: ["Run `terraform init` then `terraform apply -auto-approve`."],
        check: (state) => state.initialized && state.applied,
      },
    ],
    unlocks: ["mission-09"],
  },

  {
    id: "mission-09",
    operationCode: "OP-FOREACH",
    title: "Operation: FOR_EACH",
    description: "Stop copying resource blocks. Generate infrastructure dynamically with for_each.",
    briefing:
      "Three environments, three identical storage buckets — each hand-written, each already diverging. The platform team wants six more environments next quarter. Manually duplicating resource blocks does not scale. Your orders: replace the static resource blocks with a single `for_each` loop that generates one resource per environment. Dynamic infrastructure. One definition.",
    difficulty: "expert",
    xpReward: 375,
    badgeId: "badge-foreach",
    chapter: 4,
    order: 2,
    estimatedMinutes: 30,
    tags: ["for_each", "count", "loops", "meta-arguments"],
    concepts: [
      "`for_each` creates multiple resource instances from a map or set of strings",
      "Inside a `for_each` resource: `each.key` = map key, `each.value` = map value",
      "`count` creates N copies, indexed with `count.index` (0-based) — simpler but less expressive",
      "`for_each` is preferred over `count` when each instance has a meaningful name",
      "Use `toset([...])` to convert a list literal to a set for `for_each`",
    ],
    starterCodes: {
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

# TODO: Replace this single resource with one that uses for_each
# so one bucket is created per environment.
# The bucket name should be: "ops-\${each.key}-data"

resource "aws_s3_bucket" "env_data" {
  bucket = "ops-dev-data"
}
`,
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

# TODO: Replace this single resource with one that uses for_each
# so one bucket is created per environment.
# The bucket name should be: "ops-\${each.key}-data"

resource "google_storage_bucket" "env_data" {
  name     = "ops-dev-data"
  location = "US"
}
`,
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

# TODO: Replace this single resource with one that uses for_each
# so one resource group is created per environment.
# Use name = "ops-\${each.key}-rg"

resource "azurerm_resource_group" "env" {
  name     = "ops-dev-rg"
  location = "East US"
}
`,
    },
    objectives: [
      {
        id: "add-foreach",
        description: "Add `for_each = var.environments` to the resource block",
        hints: [
          "Add `for_each = var.environments` as the first line inside the resource block.",
          "The resource block stays otherwise the same — for_each is a meta-argument that runs the block once per item.",
        ],
        check: (_, hcl) => hcl.includes("for_each") && hcl.includes("var.environments"),
      },
      {
        id: "use-each-key",
        description: "Use `each.key` in the resource name/identifier",
        hints: [
          "Replace the hardcoded environment name (e.g. `\"dev\"`) with `each.key`.",
          "For AWS: `bucket = \"ops-\\${each.key}-data\"` · For Azure: `name = \"ops-\\${each.key}-rg\"`",
        ],
        check: (_, hcl) => hcl.includes("each.key"),
      },
      {
        id: "apply-config",
        description: "Apply — confirm all 3 environment resources are created",
        hints: [
          "Run `terraform apply -auto-approve`, then `terraform state list` to see all 3 instances.",
          "Each instance address will look like: `resource_type.name[\"key\"]`",
        ],
        check: (state) => state.applied && state.appliedResources.length >= 3,
      },
    ],
    unlocks: ["mission-10"],
  },

  {
    id: "mission-10",
    operationCode: "OP-FUNCTIONS",
    title: "Operation: FUNCTIONS",
    description: "Transform and normalize data with Terraform's built-in function library.",
    briefing:
      "Data arrives in every possible format — mixed case, raw JSON blobs, inconsistent separators, undated names. Without normalization, every resource ends up named differently. Your mission: use Terraform's built-in function library to standardize all input values before they reach a single resource. A consistent configuration is a secure one.",
    difficulty: "expert",
    xpReward: 425,
    badgeId: "badge-functions",
    chapter: 4,
    order: 3,
    estimatedMinutes: 35,
    tags: ["functions", "expressions", "string manipulation", "encoding"],
    concepts: [
      "Terraform has 100+ built-in functions: string, numeric, collection, encoding, filesystem",
      "String: `lower()`, `upper()`, `replace()`, `format()`, `trimspace()`, `split()`, `join()`",
      "Collection: `length()`, `flatten()`, `merge()`, `keys()`, `values()`, `contains()`",
      "Encoding: `jsonencode()`, `jsondecode()`, `base64encode()`, `tostring()`",
      "Conditional: `condition ? true_value : false_value`",
    ],
    starterCodes: {
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
  default = "{\"team\": \"platform\", \"cost_center\": \"eng\"}"
}

locals {
  # TODO: Use lower() and replace() to normalize the project name
  # "MyTerraProject" → "my-terra-project"
  normalized_name = var.project_name

  # TODO: Use jsondecode() to parse tags_json into a map
  tags = {}

  # TODO: Use format() to build a bucket name:
  # "ops-\${local.normalized_name}-store"
  bucket_name = "ops-bucket"
}

resource "aws_s3_bucket" "project" {
  bucket = local.bucket_name
  tags   = local.tags
}

output "normalized_name" {
  value = local.normalized_name
}
`,
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
  default = "{\"team\": \"platform\", \"cost_center\": \"eng\"}"
}

locals {
  # TODO: Use lower() and replace() to normalize the project name
  normalized_name = var.project_name

  # TODO: Use jsondecode() to parse labels_json into a map
  labels = {}

  # TODO: Use format() to build a bucket name:
  # "ops-\${local.normalized_name}-store"
  bucket_name = "ops-bucket"
}

resource "google_storage_bucket" "project" {
  name     = local.bucket_name
  location = "US"
  labels   = local.labels
}

output "normalized_name" {
  value = local.normalized_name
}
`,
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
  default = "{\"team\": \"platform\", \"cost_center\": \"eng\"}"
}

locals {
  # TODO: Use lower() and replace() to normalize the project name
  normalized_name = var.project_name

  # TODO: Use jsondecode() to parse tags_json into a map
  tags = {}

  # TODO: Use format() to build a resource group name:
  # "ops-\${local.normalized_name}-rg"
  rg_name = "ops-rg"
}

resource "azurerm_resource_group" "project" {
  name     = local.rg_name
  location = "East US"
  tags     = local.tags
}

output "normalized_name" {
  value = local.normalized_name
}
`,
    },
    objectives: [
      {
        id: "use-lower",
        description: "Use `lower()` to normalize the project name in `locals`",
        hints: [
          "Inside the `locals` block, update `normalized_name` to call `lower(var.project_name)`.",
          "To also convert camel-case to kebab: `lower(replace(var.project_name, \"/([A-Z])/\", \"-$1\"))` — but any use of `lower()` counts.",
        ],
        check: (_, hcl) => hcl.includes("lower("),
      },
      {
        id: "use-jsondecode",
        description: "Use `jsondecode()` to parse the JSON tags variable",
        hints: [
          "Update the `tags` (or `labels`) local to `jsondecode(var.tags_json)`.",
          "jsondecode converts a JSON string into a Terraform map: `tags = jsondecode(var.tags_json)`",
        ],
        check: (_, hcl) => hcl.includes("jsondecode("),
      },
      {
        id: "use-format",
        description: "Use `format()` or string interpolation to build the resource name",
        hints: [
          "Use format() or `\"ops-\\${local.normalized_name}-store\"` for the bucket/resource name.",
          "`format(\"ops-%s-store\", local.normalized_name)` is equivalent to `\"ops-\\${local.normalized_name}-store\"`",
        ],
        check: (_, hcl) =>
          hcl.includes("format(") ||
          (hcl.includes("local.normalized_name") && (hcl.includes("bucket_name") || hcl.includes("rg_name"))),
      },
      {
        id: "apply-config",
        description: "Initialize and apply — inspect the `normalized_name` output",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve`.",
          "After apply, run `terraform output normalized_name` to see the transformed value.",
        ],
        check: (state) => state.initialized && state.applied,
      },
    ],
    unlocks: ["mission-11"],
  },

  // ─────────────────────────────────────────────
  // CHAPTER 5 — PRODUCTION HARDENING
  // (Concepts from "Terraform: Up and Running, 3rd Edition")
  // ─────────────────────────────────────────────
  {
    id: "mission-11",
    operationCode: "OP-SECRETS",
    title: "Operation: SECRETS",
    description: "Protect sensitive data. Use sensitive variables and outputs to keep secrets out of logs.",
    briefing:
      "Field alert: credentials are appearing in plain text inside Terraform plan output and CI logs — database passwords, API tokens, everything. Someone has been committing secrets directly into .tf files. Immediate remediation required. Mark all sensitive variables, sanitize all outputs, and demonstrate that Terraform can mask values before they hit the screen. Zero tolerance for plaintext secrets.",
    difficulty: "specialist",
    xpReward: 350,
    badgeId: "badge-secrets",
    chapter: 5,
    order: 1,
    estimatedMinutes: 25,
    tags: ["secrets", "sensitive", "security", "best-practices"],
    concepts: [
      "**Never** hardcode credentials in .tf files — they end up in version control and state files",
      "Mark sensitive variables with `sensitive = true` — Terraform redacts their values in all output",
      "Mark outputs as `sensitive = true` when they expose secrets (e.g. `value = aws_db_instance.main.password`)",
      "Pass secrets via environment variables: `TF_VAR_db_password=mysecret terraform apply`",
      "For production, use a secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) and retrieve values with a `data` source — never store them in state",
    ],
    starterCodes: {
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

# TODO: Mark this variable sensitive = true
# Never hardcode the default — use TF_VAR_db_password env var instead
variable "db_password" {
  type        = string
  description = "The database master password"
  default     = "change-me-use-env-var"
  # TODO: Add sensitive = true here
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

# TODO: This output exposes a sensitive value — mark it sensitive = true
output "db_endpoint" {
  value       = aws_db_instance.main.id
  description = "Database endpoint"
  # TODO: Add sensitive = true here
}
`,
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

# TODO: Mark this variable sensitive = true
variable "db_password" {
  type        = string
  description = "The database master password"
  default     = "change-me-use-env-var"
  # TODO: Add sensitive = true here
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

# TODO: Mark this output sensitive = true
output "db_connection" {
  value       = google_sql_database_instance.main.id
  description = "Database connection name"
  # TODO: Add sensitive = true here
}
`,
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

# TODO: Mark this variable sensitive = true
variable "db_password" {
  type        = string
  description = "The database administrator password"
  default     = "change-me-use-env-var"
  # TODO: Add sensitive = true here
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

# TODO: Mark this output sensitive = true
output "sql_server_id" {
  value       = azurerm_mssql_server.main.id
  description = "SQL Server resource ID"
  # TODO: Add sensitive = true here
}
`,
    },
    objectives: [
      {
        id: "mark-variable-sensitive",
        description: "Add `sensitive = true` to the `db_password` variable",
        hints: [
          "Inside the `variable \"db_password\"` block, add a new line: `sensitive = true`",
          "This tells Terraform to redact the value in all plan, apply, and output logs.",
          "Variable with sensitive: `variable \"db_password\" { type = string  sensitive = true }`",
        ],
        check: (_, hcl) => {
          const varMatch = hcl.match(/variable\s+"db_password"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
          return !!varMatch && /sensitive\s*=\s*true/.test(varMatch[1]);
        },
      },
      {
        id: "mark-output-sensitive",
        description: "Add `sensitive = true` to the output block",
        hints: [
          "Inside the `output` block, add: `sensitive = true`",
          "Any output whose value references a sensitive variable or credential must itself be marked sensitive.",
          "Output with sensitive: `output \"name\" { value = ... sensitive = true }`",
        ],
        check: (_, hcl) => {
          const outMatch = hcl.match(/output\s+"[^"]+"\s*\{([^}]*)\}/s);
          return !!outMatch && /sensitive\s*=\s*true/.test(outMatch[1]);
        },
      },
      {
        id: "apply-config",
        description: "Initialize and apply — confirm outputs are shown as `(sensitive value)`",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve`.",
          "After apply, run `terraform output` — sensitive outputs should display as `(sensitive value)`.",
        ],
        check: (state) => state.initialized && state.applied,
      },
    ],
    unlocks: ["mission-12"],
  },

  {
    id: "mission-12",
    operationCode: "OP-LIFECYCLE",
    title: "Operation: LIFECYCLE",
    description: "Control how Terraform creates, updates, and destroys resources using lifecycle rules.",
    briefing:
      "Production incident report: a routine configuration change triggered an outage. Terraform destroyed the old load balancer before the new one was ready — 7 minutes of downtime, 40k affected users. Root cause: no lifecycle rules. Your orders: implement `create_before_destroy` on critical resources, `prevent_destroy` on the database, and `ignore_changes` on tags that external tools manage. Production hardening, chapter one.",
    difficulty: "expert",
    xpReward: 450,
    badgeId: "badge-lifecycle",
    chapter: 5,
    order: 2,
    estimatedMinutes: 30,
    tags: ["lifecycle", "create_before_destroy", "prevent_destroy", "ignore_changes", "zero-downtime"],
    concepts: [
      "`lifecycle { create_before_destroy = true }` — creates the replacement resource *before* destroying the old one (zero-downtime pattern)",
      "`lifecycle { prevent_destroy = true }` — Terraform errors if you try to destroy this resource (protects databases, state buckets)",
      "`lifecycle { ignore_changes = [tags, name] }` — ignores drift in specified attributes (useful when external tools manage tags)",
      "`lifecycle { ignore_changes = all }` — tells Terraform to never update this resource after initial creation",
      "Lifecycle rules are meta-arguments, like `for_each` and `count` — they appear inside the resource block but aren't sent to the provider",
    ],
    starterCodes: {
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

# Web server - needs zero-downtime replacement
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "ops-web-server"
  }

  # TODO: Add a lifecycle block with create_before_destroy = true
  # lifecycle {
  #   create_before_destroy = true
  # }
}

# Database - must never be accidentally destroyed
resource "aws_db_instance" "main" {
  identifier     = "ops-prod-db"
  engine         = "postgres"
  instance_class = "db.t3.micro"
  username       = "admin"
  password       = "placeholder"

  # TODO: Add a lifecycle block with prevent_destroy = true
  # lifecycle {
  #   prevent_destroy = true
  # }
}

# Storage bucket - tags are managed by an external tagging tool
resource "aws_s3_bucket" "assets" {
  bucket = "ops-assets-bucket"

  tags = {
    Name = "ops-assets"
  }

  # TODO: Add a lifecycle block that ignores changes to tags
  # lifecycle {
  #   ignore_changes = [tags]
  # }
}
`,
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

# Web server - needs zero-downtime replacement
resource "google_compute_instance" "web" {
  name         = "ops-web-server"
  machine_type = "e2-micro"
  zone         = "us-central1-a"

  labels = {
    role = "web"
  }

  # TODO: Add a lifecycle block with create_before_destroy = true
  # lifecycle {
  #   create_before_destroy = true
  # }
}

# Database - must never be accidentally destroyed
resource "google_sql_database_instance" "main" {
  name             = "ops-prod-db"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier = "db-f1-micro"
  }

  # TODO: Add a lifecycle block with prevent_destroy = true
  # lifecycle {
  #   prevent_destroy = true
  # }
}

# Storage bucket - labels managed by external tooling
resource "google_storage_bucket" "assets" {
  name     = "ops-assets-bucket"
  location = "US"

  labels = {
    role = "assets"
  }

  # TODO: Add a lifecycle block that ignores changes to labels
  # lifecycle {
  #   ignore_changes = [labels]
  # }
}
`,
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

# Web server - needs zero-downtime replacement
resource "azurerm_linux_virtual_machine" "web" {
  name                = "ops-web-server"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "Standard_B1s"
  admin_username      = "adminuser"

  tags = {
    role = "web"
  }

  # TODO: Add a lifecycle block with create_before_destroy = true
  # lifecycle {
  #   create_before_destroy = true
  # }
}

# Storage account - tags managed by Azure Policy
resource "azurerm_storage_account" "assets" {
  name                     = "opsassetsstore"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    role = "assets"
  }

  # TODO: Add a lifecycle block with prevent_destroy = true
  # lifecycle {
  #   prevent_destroy = true
  # }
}
`,
    },
    objectives: [
      {
        id: "add-create-before-destroy",
        description: "Add `lifecycle { create_before_destroy = true }` to the web server resource",
        hints: [
          "Uncomment the lifecycle block inside the `aws_instance.web` (or equivalent) resource.",
          "The `lifecycle` block is a meta-argument — it goes directly inside the resource block.",
          "Syntax: `lifecycle { create_before_destroy = true }`",
        ],
        check: (_, hcl) =>
          /lifecycle\s*\{[^}]*create_before_destroy\s*=\s*true[^}]*\}/s.test(hcl),
      },
      {
        id: "add-prevent-destroy",
        description: "Add `lifecycle { prevent_destroy = true }` to the database resource",
        hints: [
          "Uncomment the lifecycle block inside the database resource (aws_db_instance, google_sql_database_instance, or azurerm_storage_account).",
          "`prevent_destroy = true` causes `terraform destroy` to error out for this resource.",
        ],
        check: (_, hcl) =>
          /lifecycle\s*\{[^}]*prevent_destroy\s*=\s*true[^}]*\}/s.test(hcl),
      },
      {
        id: "add-ignore-changes",
        description: "Add `lifecycle { ignore_changes = [...] }` to the storage/assets resource",
        hints: [
          "Uncomment the lifecycle block inside the storage resource.",
          "Syntax: `lifecycle { ignore_changes = [tags] }` — the attribute name inside the list must match the resource attribute.",
          "This prevents Terraform from reverting tag/label changes made by external tools.",
        ],
        check: (_, hcl) =>
          /lifecycle\s*\{[^}]*ignore_changes\s*=[^}]*\}/s.test(hcl),
      },
      {
        id: "apply-config",
        description: "Initialize and apply the hardened configuration",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve`.",
          "Note: `prevent_destroy = true` won't block an apply — it only blocks terraform destroy.",
        ],
        check: (state) => state.initialized && state.applied,
      },
    ],
    unlocks: ["mission-13"],
  },

  {
    id: "mission-13",
    operationCode: "OP-CONDITIONALS",
    title: "Operation: CONDITIONALS",
    description: "Write dynamic infrastructure using conditional expressions, count toggles, and for expressions.",
    briefing:
      "Platform audit complete. Three different configurations exist for dev, staging, and prod — each a hand-edited copy of the previous. A feature flag in prod requires a separate resource. A list of team names needs to become a map of IAM roles. This configuration does not scale. Your orders: collapse all of this into a single, dynamic configuration using conditional expressions, count-based toggles, and for expressions. One file, infinite environments.",
    difficulty: "expert",
    xpReward: 425,
    badgeId: "badge-conditionals",
    chapter: 5,
    order: 3,
    estimatedMinutes: 30,
    tags: ["conditionals", "count", "for expressions", "dynamic", "ternary"],
    concepts: [
      "Conditional expression: `condition ? true_value : false_value` — works anywhere a value is expected",
      "`count = var.enabled ? 1 : 0` — the idiomatic way to optionally create a resource",
      "`for` expressions transform collections: `[for s in var.names : upper(s)]` (list) or `{for k, v in var.map : k => v}` (map)",
      "Use `one()` to safely reference a `count`-based resource that may or may not exist: `one(aws_instance.server[*].id)`",
      "String directives: `%{if condition}...%{else}...%{endif}` work inside template strings for multi-line conditional content",
    ],
    starterCodes: {
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

# TODO: Use a conditional expression to set the instance type
# based on whether environment == "prod":
# instance_type = var.environment == "prod" ? "t3.large" : "t3.micro"

resource "aws_instance" "app" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}

# TODO: Use count = var.enable_monitoring ? 1 : 0
# to conditionally create this monitoring bucket

resource "aws_s3_bucket" "monitoring" {
  bucket = "ops-monitoring-bucket"
}

# TODO: Use a for expression to build a map of team bucket names:
# locals {
#   team_buckets = { for name in var.team_names : name => "ops-\${name}-data" }
# }
`,
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

# TODO: Use a conditional expression to set the machine type
# based on whether environment == "prod":
# machine_type = var.environment == "prod" ? "e2-standard-2" : "e2-micro"

resource "google_compute_instance" "app" {
  name         = "ops-app"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
}

# TODO: Use count = var.enable_monitoring ? 1 : 0
# to conditionally create this monitoring bucket

resource "google_storage_bucket" "monitoring" {
  name     = "ops-monitoring-bucket"
  location = "US"
}

# TODO: Use a for expression to build a map of team bucket names:
# locals {
#   team_buckets = { for name in var.team_names : name => "ops-\${name}-data" }
# }
`,
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

resource "azurerm_resource_group" "main" {
  name     = "ops-conditionals-rg"
  location = "East US"
}

# TODO: Use a conditional expression to set the SKU
# based on whether environment == "prod":
# account_tier = var.environment == "prod" ? "Premium" : "Standard"

resource "azurerm_storage_account" "app" {
  name                     = "opsconditionalstore"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# TODO: Use count = var.enable_monitoring ? 1 : 0
# to conditionally create this monitoring resource group

resource "azurerm_resource_group" "monitoring" {
  name     = "ops-monitoring-rg"
  location = "East US"
}

# TODO: Use a for expression to build a map of team resource group names:
# locals {
#   team_rgs = { for name in var.team_names : name => "ops-\${name}-rg" }
# }
`,
    },
    objectives: [
      {
        id: "use-conditional-expression",
        description: "Use a ternary conditional (`condition ? a : b`) in a resource attribute",
        hints: [
          "Update the `instance_type` (or `machine_type` / `account_tier`) attribute to use a conditional: `var.environment == \"prod\" ? \"large_type\" : \"small_type\"`",
          "A conditional expression evaluates the condition and returns either the true or false value.",
          "Example: `instance_type = var.environment == \"prod\" ? \"t3.large\" : \"t3.micro\"`",
        ],
        check: (_, hcl) => /\?\s*"[^"]*"\s*:\s*"[^"]*"/.test(hcl) || /\?\s*\d+\s*:\s*\d+/.test(hcl),
      },
      {
        id: "use-count-conditional",
        description: "Use `count = var.enable_monitoring ? 1 : 0` to make a resource optional",
        hints: [
          "Add `count = var.enable_monitoring ? 1 : 0` as the first attribute inside the monitoring resource block.",
          "When `enable_monitoring = false` the count is 0 — Terraform will not create the resource.",
          "This is the idiomatic Terraform pattern for feature flags.",
        ],
        check: (_, hcl) =>
          hcl.includes("count") &&
          /count\s*=\s*var\.[a-z_]+\s*\?/.test(hcl),
      },
      {
        id: "use-for-expression",
        description: "Add a `locals` block with a `for` expression to transform the `team_names` list",
        hints: [
          "Add a `locals {}` block with a for expression: `team_buckets = { for name in var.team_names : name => \"ops-\\${name}-data\" }`",
          "For expressions can produce lists `[for ...]` or maps `{for ...}`. The `:` separates key from value in a map.",
          "Uncomment the TODO locals block in the starter code.",
        ],
        check: (_, hcl) =>
          /\{for\s+[a-z_]+\s+in\s+var\.[a-z_]+/.test(hcl) ||
          /\[for\s+[a-z_]+\s+in\s+var\.[a-z_]+/.test(hcl),
      },
      {
        id: "apply-config",
        description: "Initialize and apply the dynamic configuration",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve`.",
          "With `enable_monitoring = false` (default), the monitoring resource should NOT be created.",
        ],
        check: (state) => state.initialized && state.applied,
      },
    ],
    unlocks: ["mission-14"],
  },

  {
    id: "mission-14",
    operationCode: "OP-WORKSPACE",
    title: "Operation: WORKSPACE",
    description: "Use Terraform workspaces to isolate dev, staging, and production environments from one shared configuration.",
    briefing:
      "Environment sprawl report: three separate Terraform directories for dev, staging, and prod — all running the same configuration with slightly different variable files. A change to the network module needs to be applied to all three separately, in sequence. This is unsustainable. Your orders: consolidate into a single configuration backed by Terraform workspaces. One codebase, one backend, multiple isolated state files. Environment parity guaranteed.",
    difficulty: "expert",
    xpReward: 400,
    badgeId: "badge-workspace",
    chapter: 5,
    order: 4,
    estimatedMinutes: 30,
    tags: ["workspaces", "environments", "isolation", "terraform.workspace"],
    concepts: [
      "`terraform workspace new <name>` — creates a new, isolated state file for that workspace",
      "`terraform workspace select <name>` — switches the active workspace",
      "`terraform workspace list` — shows all workspaces (`*` marks the active one)",
      "`terraform.workspace` — a built-in string containing the current workspace name, usable anywhere in config",
      "Each workspace has its own state file — changes in `prod` workspace cannot affect `dev` workspace state",
      "Workspaces are best for environment isolation within the same codebase; use separate root modules for truly divergent environments",
    ],
    starterCodes: {
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
  # TODO: Use terraform.workspace to make resource names workspace-aware
  # env         = terraform.workspace
  # bucket_name = "ops-\${terraform.workspace}-storage"
  env         = "dev"
  bucket_name = "ops-dev-storage"

  # TODO: Use a conditional to size differently per workspace
  # instance_type = terraform.workspace == "prod" ? "t3.large" : "t3.micro"
  instance_type = "t3.micro"
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
}
`,
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
  # TODO: Use terraform.workspace to make resource names workspace-aware
  # env         = terraform.workspace
  # bucket_name = "ops-\${terraform.workspace}-storage"
  env         = "dev"
  bucket_name = "ops-dev-storage"

  # TODO: Use a conditional to size differently per workspace
  # machine_type = terraform.workspace == "prod" ? "e2-standard-2" : "e2-micro"
  machine_type = "e2-micro"
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
}
`,
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
  # TODO: Use terraform.workspace to make resource names workspace-aware
  # env     = terraform.workspace
  # rg_name = "ops-\${terraform.workspace}-rg"
  env     = "dev"
  rg_name = "ops-dev-rg"

  # TODO: Use a conditional for SKU per workspace
  # sku = terraform.workspace == "prod" ? "Premium" : "Standard"
  sku = "Standard"
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
}
`,
    },
    objectives: [
      {
        id: "show-workspace",
        description: "Run `terraform workspace show` to see the current workspace",
        hints: [
          "Type `terraform workspace show` in the terminal.",
          "It should output `default` — that's the workspace you start in.",
        ],
        check: (_, __, history) => history.some((c) => c.trim() === "terraform workspace show"),
      },
      {
        id: "create-workspace",
        description: "Create a new workspace called `staging` with `terraform workspace new staging`",
        hints: [
          "Type `terraform workspace new staging` — this creates the workspace and switches to it.",
          "After this, `terraform workspace show` should output `staging`.",
        ],
        check: (state) => state.workspaces.includes("staging"),
      },
      {
        id: "use-terraform-workspace",
        description: "Use `terraform.workspace` built-in to make resource names workspace-aware",
        hints: [
          "Update the `locals` block: replace the hardcoded `\"dev\"` with `terraform.workspace`.",
          "Then update the derived name: `bucket_name = \"ops-\\${terraform.workspace}-storage\"`",
          "Uncomment the TODO lines in the starter code.",
        ],
        check: (_, hcl) => hcl.includes("terraform.workspace"),
      },
      {
        id: "apply-in-workspace",
        description: "Initialize and apply — resources should be named with the active workspace",
        hints: [
          "Run `terraform init` then `terraform apply -auto-approve` while in the `staging` workspace.",
          "The bucket/resource name should now include `staging` (from `terraform.workspace`).",
        ],
        check: (state) => state.initialized && state.applied && state.workspace !== "default",
      },
    ],
    unlocks: ["mission-15"],
  },

  {
    id: "mission-15",
    operationCode: "OP-VALIDATE",
    title: "Operation: VALIDATE",
    description: "Build validation gates into your variables. Catch invalid inputs before they reach the cloud.",
    briefing:
      "Post-mortem complete. An environment was deployed to `us-wets-1` — a typo in the region variable. The provider silently accepted it, created malformed resources, and the incident took 4 hours to diagnose. Root cause: no input validation. Your orders: add `validation` blocks to all critical variables, run `terraform validate` to confirm the configuration structure is correct, and run `terraform fmt` to enforce code style. Quality gates before the blast radius.",
    difficulty: "specialist",
    xpReward: 325,
    badgeId: "badge-validate",
    chapter: 5,
    order: 5,
    estimatedMinutes: 25,
    tags: ["validation", "fmt", "validate", "code quality", "input constraints"],
    concepts: [
      "`validation` blocks inside `variable` declarations enforce constraints before resources are created",
      "Syntax: `validation { condition = <expr>  error_message = \"Human-readable error\" }`",
      "`condition` must be an expression that returns `true` when the value is valid",
      "Use `contains()`, `length()`, `regex()`, and comparison operators in conditions",
      "`terraform validate` checks the configuration structure and catches type errors without contacting any provider",
      "`terraform fmt` reformats HCL files to the canonical style — run it in CI to enforce consistency",
    ],
    starterCodes: {
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

  # TODO: Add a validation block to ensure only valid environments are used
  # validation {
  #   condition     = contains(["dev", "staging", "prod"], var.environment)
  #   error_message = "Environment must be one of: dev, staging, prod."
  # }
}

variable "bucket_name" {
  type        = string
  default     = "my-ops-bucket"
  description = "Name of the S3 bucket"

  # TODO: Add a validation block to ensure bucket name length
  # validation {
  #   condition     = length(var.bucket_name) >= 3 && length(var.bucket_name) <= 63
  #   error_message = "Bucket name must be between 3 and 63 characters."
  # }
}

resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name

  tags = {
    Environment = var.environment
  }
}

output "bucket_name" {
  value = aws_s3_bucket.main.bucket
}
`,
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

  # TODO: Add a validation block to ensure only valid environments are used
  # validation {
  #   condition     = contains(["dev", "staging", "prod"], var.environment)
  #   error_message = "Environment must be one of: dev, staging, prod."
  # }
}

variable "bucket_name" {
  type        = string
  default     = "my-ops-bucket"
  description = "Name of the GCS bucket"

  # TODO: Add a validation block to ensure the name is lowercase
  # validation {
  #   condition     = var.bucket_name == lower(var.bucket_name)
  #   error_message = "Bucket name must be lowercase."
  # }
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
}
`,
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

  # TODO: Add a validation block to ensure only valid environments are used
  # validation {
  #   condition     = contains(["dev", "staging", "prod"], var.environment)
  #   error_message = "Environment must be one of: dev, staging, prod."
  # }
}

variable "rg_name" {
  type        = string
  default     = "my-ops-rg"
  description = "Name of the Azure resource group"

  # TODO: Add a validation block to ensure the name is not too long
  # validation {
  #   condition     = length(var.rg_name) <= 90
  #   error_message = "Resource group name must be 90 characters or fewer."
  # }
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
}
`,
    },
    objectives: [
      {
        id: "add-environment-validation",
        description: "Add a `validation` block to the `environment` variable using `contains()`",
        hints: [
          "Uncomment the first `validation {}` block inside the `variable \"environment\"` block.",
          "The `condition` uses `contains(list, value)` — it returns `true` if the value is in the list.",
          "Example: `condition = contains([\"dev\", \"staging\", \"prod\"], var.environment)`",
        ],
        check: (_, hcl) => {
          const varMatch = hcl.match(/variable\s+"environment"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
          return !!varMatch && /validation\s*\{/.test(varMatch[1]);
        },
      },
      {
        id: "add-name-validation",
        description: "Add a second `validation` block to the name variable (bucket_name or rg_name)",
        hints: [
          "Uncomment the second `validation {}` block inside the bucket/rg variable.",
          "For AWS: use `length(var.bucket_name) >= 3 && length(var.bucket_name) <= 63`",
          "For GCP: use `var.bucket_name == lower(var.bucket_name)` to enforce lowercase.",
          "For Azure: use `length(var.rg_name) <= 90`",
        ],
        check: (_, hcl) => {
          const varBlocks = hcl.matchAll(/variable\s+"[^"]+"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs);
          let count = 0;
          for (const m of varBlocks) {
            if (/validation\s*\{/.test(m[1])) count++;
          }
          return count >= 2;
        },
      },
      {
        id: "run-validate",
        description: "Run `terraform validate` to confirm the configuration is structurally valid",
        hints: [
          "Run `terraform init` first, then `terraform validate`.",
          "`terraform validate` checks syntax, types, and required attributes without connecting to any provider.",
        ],
        check: (state) => state.validated,
      },
      {
        id: "run-fmt",
        description: "Run `terraform fmt` to auto-format the configuration",
        hints: [
          "Type `terraform fmt` — it reformats `main.tf` to canonical HCL style.",
          "In CI pipelines, use `terraform fmt -check` to fail if files need formatting.",
        ],
        check: (_, __, history) => history.some((c) => c.trim() === "terraform fmt"),
      },
      {
        id: "apply-config",
        description: "Apply the validated, formatted configuration",
        hints: [
          "Run `terraform apply -auto-approve`. The validation blocks will now catch invalid inputs before any resource is created.",
        ],
        check: (state) => state.applied,
      },
    ],
  },
];

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Returns the starter code for a mission given the selected provider */
export function getStarterCode(mission: Mission, provider: import("@/lib/providers").Provider): string {
  return mission.starterCodes[provider] ?? mission.starterCodes["aws"];
}

export function getChapters() {
  const chapters = new Map<number, Mission[]>();
  for (const mission of MISSIONS) {
    if (!chapters.has(mission.chapter)) chapters.set(mission.chapter, []);
    chapters.get(mission.chapter)!.push(mission);
  }
  return Array.from(chapters.entries()).map(([chapter, missions]) => ({
    chapter,
    missions: missions.sort((a, b) => a.order - b.order),
  }));
}

export const CHAPTER_NAMES: Record<number, string> = {
  1: "Foundation",
  2: "Field Operations",
  3: "Advanced Tactics",
  4: "Expression Mastery",
  5: "Production Hardening",
};
