import type { SimulatorState, ParsedHCL, PlannedResource, AppliedResource } from "./types";

export interface SimulatorOutput {
  lines: OutputLine[];
  newState: SimulatorState;
}

export interface OutputLine {
  text: string;
  type: "normal" | "success" | "error" | "warning" | "info" | "dim" | "bold";
}

function line(text: string, type: OutputLine["type"] = "normal"): OutputLine {
  return { text, type };
}

export function createInitialState(): SimulatorState {
  return {
    initialized: false,
    validated: false,
    planned: false,
    applied: false,
    destroyed: false,
    appliedResources: [],
    planResources: [],
    outputs: {},
    variables: {},
    workingDir: "/workspace",
    providerInstalled: false,
    lastCommand: undefined,
    workspace: "default",
    workspaces: ["default"],
  };
}

export function executeCommand(
  input: string,
  state: SimulatorState,
  hcl: string
): SimulatorOutput {
  const trimmed = input.trim();
  const newState = { ...state, lastCommand: trimmed };

  if (!trimmed) return { lines: [], newState };

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const subcmd = parts[1] || "";
  const args = parts.slice(2);

  if (cmd === "clear") return { lines: [{ text: "\x1b[2J\x1b[H", type: "normal" }], newState };

  if (cmd === "pwd") {
    return { lines: [line(state.workingDir)], newState };
  }

  if (cmd === "ls") {
    const files = ["main.tf"];
    if (state.initialized) files.push(".terraform/", ".terraform.lock.hcl");
    if (state.applied) files.push("terraform.tfstate");
    return {
      lines: [line(files.join("  "), "normal")],
      newState,
    };
  }

  if (cmd === "cat" && parts[1] === "main.tf") {
    return {
      lines: hcl.split("\n").map((l) => line(l, "dim")),
      newState,
    };
  }

  if (cmd !== "terraform") {
    return {
      lines: [line(`Command not found: ${cmd}. Try 'terraform <subcommand>'`, "error")],
      newState,
    };
  }

  switch (subcmd) {
    case "version":
      return terraformVersion(newState);
    case "init":
      return terraformInit(hcl, newState);
    case "validate":
      return terraformValidate(hcl, newState);
    case "fmt":
      return terraformFmt(hcl, newState);
    case "plan":
      return terraformPlan(hcl, newState, args);
    case "apply":
      return terraformApply(hcl, newState, args);
    case "destroy":
      return terraformDestroy(newState, args);
    case "output":
      return terraformOutput(newState, args);
    case "state":
      return terraformState(newState, args);
    case "show":
      return terraformShow(newState);
    case "workspace":
      return terraformWorkspace(newState, args);
    case "":
      return { lines: [line(TERRAFORM_HELP, "dim")], newState };
    default:
      return {
        lines: [
          line(`Error: terraform: no such command '${subcmd}'`, "error"),
          line("Run 'terraform' with no arguments to see help.", "dim"),
        ],
        newState,
      };
  }
}

function terraformVersion(state: SimulatorState): SimulatorOutput {
  const providerLines = state.providerInstalled
    ? [
        line("+ provider registry.terraform.io/hashicorp/aws v5.72.1", "dim"),
        // additional providers shown dynamically after init
      ]
    : [];
  return {
    lines: [
      line("Terraform v1.9.8", "success"),
      line("on linux_amd64", "dim"),
      ...providerLines,
    ],
    newState: state,
  };
}

function terraformInit(hcl: string, state: SimulatorState): SimulatorOutput {
  const parsed = parseHCL(hcl);
  const lines: OutputLine[] = [
    line(""),
    line("Initializing the backend...", "normal"),
    line(""),
  ];

  if (parsed.errors.length > 0) {
    lines.push(line("╷", "error"));
    lines.push(line("│ Error: Failed to load root module", "error"));
    lines.push(line("│", "error"));
    parsed.errors.forEach((e) => lines.push(line(`│   ${e}`, "error")));
    lines.push(line("╵", "error"));
    return { lines, newState: state };
  }

  if (parsed.providers.length === 0 && parsed.resources.length > 0) {
    lines.push(line("╷", "warning"));
    lines.push(line("│ Warning: No provider configuration found.", "warning"));
    lines.push(line("│ Add a provider block before running terraform apply.", "warning"));
    lines.push(line("╵", "warning"));
  }

  if (parsed.providers.length > 0) {
    lines.push(line("Initializing provider plugins...", "normal"));
    parsed.providers.forEach((p) => {
      lines.push(line(`- Finding hashicorp/${p.labels[0]} versions matching ">= 5.0.0"...`, "dim"));
      lines.push(line(`- Installing hashicorp/${p.labels[0]} v5.72.1...`, "dim"));
      lines.push(line(`- Installed hashicorp/${p.labels[0]} v5.72.1 (signed by HashiCorp)`, "success"));
    });
    lines.push(line(""));
    lines.push(line("Terraform has been successfully initialized!", "success"));
    lines.push(line(""));
    lines.push(line('You may now begin working with Terraform. Try running "terraform plan"', "dim"));
    lines.push(line("to see any changes that are required for your infrastructure.", "dim"));
  } else {
    lines.push(line("Terraform initialized in an empty directory!", "success"));
    lines.push(line("The directory has no Terraform configuration files.", "warning"));
  }

  return {
    lines,
    newState: { ...state, initialized: true, providerInstalled: parsed.providers.length > 0 },
  };
}

function terraformValidate(hcl: string, state: SimulatorState): SimulatorOutput {
  if (!state.initialized) {
    return {
      lines: [
        line("╷", "error"),
        line("│ Error: Module not initialized", "error"),
        line("│", "error"),
        line("│ Run 'terraform init' first.", "error"),
        line("╵", "error"),
      ],
      newState: state,
    };
  }

  const parsed = parseHCL(hcl);
  if (parsed.errors.length > 0) {
    const lines: OutputLine[] = [];
    parsed.errors.forEach((e) => {
      lines.push(line("╷", "error"));
      lines.push(line(`│ Error: ${e}`, "error"));
      lines.push(line("╵", "error"));
    });
    return { lines, newState: state };
  }

  return {
    lines: [line("Success! The configuration is valid.", "success")],
    newState: { ...state, validated: true },
  };
}

function terraformFmt(hcl: string, state: SimulatorState): SimulatorOutput {
  return {
    lines: [line("main.tf", "normal")],
    newState: state,
  };
}

function terraformPlan(hcl: string, state: SimulatorState, args: string[]): SimulatorOutput {
  if (!state.initialized) {
    return {
      lines: [
        line("╷", "error"),
        line("│ Error: Module not initialized", "error"),
        line("│ Run 'terraform init' first.", "error"),
        line("╵", "error"),
      ],
      newState: state,
    };
  }

  const parsed = parseHCL(hcl);
  if (parsed.errors.length > 0) {
    const lines: OutputLine[] = [];
    parsed.errors.forEach((e) => {
      lines.push(line("╷", "error"));
      lines.push(line(`│ Error: ${e}`, "error"));
      lines.push(line("╵", "error"));
    });
    return { lines, newState: state };
  }

  const planResources = buildPlanResources(parsed, state);
  const toCreate = planResources.filter((r) => r.action === "create");
  const toDestroy = planResources.filter((r) => r.action === "destroy");
  const toUpdate = planResources.filter((r) => r.action === "update");

  const lines: OutputLine[] = [
    line(""),
    line("Terraform used the selected providers to generate the following execution"),
    line("plan. Resource actions are indicated with the following symbols:"),
    line("  + create", "success"),
    line("  ~ update in-place", "warning"),
    line("  - destroy", "error"),
    line(""),
    line("Terraform will perform the following actions:", "bold"),
    line(""),
  ];

  if (planResources.length === 0) {
    lines.push(line("No changes. Your infrastructure matches the configuration.", "success"));
    lines.push(line(""));
    lines.push(line("Terraform has compared your real infrastructure against your", "dim"));
    lines.push(line("configuration and found no differences.", "dim"));
    return { lines, newState: { ...state, planned: true, planResources: [] } };
  }

  toCreate.forEach((r) => {
    lines.push(line(`  # ${r.type}.${r.name} will be created`, "success"));
    lines.push(line(`  + resource "${r.type}" "${r.name}" {`, "success"));
    Object.entries(r.attributes).forEach(([k, v]) => {
      lines.push(line(`      + ${k} = ${v}`, "success"));
    });
    lines.push(line(`    }`, "success"));
    lines.push(line(""));
  });

  toUpdate.forEach((r) => {
    lines.push(line(`  # ${r.type}.${r.name} will be updated in-place`, "warning"));
    lines.push(line(`  ~ resource "${r.type}" "${r.name}" {`, "warning"));
    lines.push(line("    }"));
    lines.push(line(""));
  });

  toDestroy.forEach((r) => {
    lines.push(line(`  # ${r.type}.${r.name} will be destroyed`, "error"));
    lines.push(line(`  - resource "${r.type}" "${r.name}" {`, "error"));
    lines.push(line(`    }`, "error"));
    lines.push(line(""));
  });

  lines.push(line("Plan: ", "bold"));
  const summary = [];
  if (toCreate.length) summary.push(`${toCreate.length} to add`);
  if (toUpdate.length) summary.push(`${toUpdate.length} to change`);
  if (toDestroy.length) summary.push(`${toDestroy.length} to destroy`);
  lines[lines.length - 1] = line(`Plan: ${summary.join(", ")}.`, "bold");
  lines.push(line(""));
  lines.push(line("─────────────────────────────────────────────────────────────", "dim"));
  lines.push(line('Note: Run "terraform apply" to apply these changes.', "dim"));

  return {
    lines,
    newState: { ...state, planned: true, planResources },
  };
}

function terraformApply(hcl: string, state: SimulatorState, args: string[]): SimulatorOutput {
  if (!state.initialized) {
    return {
      lines: [line("│ Error: Module not initialized. Run 'terraform init' first.", "error")],
      newState: state,
    };
  }

  const autoApprove = args.includes("-auto-approve");
  if (!autoApprove && !state.planned) {
    const parsed = parseHCL(hcl);
    const planResources = buildPlanResources(parsed, state);
    const planResult = terraformPlan(hcl, state, []);
    const confirmLines: OutputLine[] = [
      ...planResult.lines,
      line(""),
      line("Do you want to perform these actions?", "bold"),
      line('  Enter a value: (use -auto-approve to skip this prompt)', "dim"),
    ];
    return { lines: confirmLines, newState: planResult.newState };
  }

  const parsed = parseHCL(hcl);
  if (parsed.errors.length > 0) {
    return {
      lines: parsed.errors.map((e) => line(`│ Error: ${e}`, "error")),
      newState: state,
    };
  }

  const planResources = state.planned ? state.planResources : buildPlanResources(parsed, state);
  const toCreate = planResources.filter((r) => r.action === "create");

  const lines: OutputLine[] = [line("")];

  toCreate.forEach((r) => {
    lines.push(line(`${r.type}.${r.name}: Creating...`, "normal"));
    lines.push(line(`${r.type}.${r.name}: Creation complete after 2s [id=${generateId(r.type)}]`, "success"));
  });

  const appliedResources: AppliedResource[] = [
    ...state.appliedResources,
    ...toCreate.map((r) => ({
      type: r.type,
      name: r.name,
      id: generateId(r.type),
      attributes: r.attributes,
    })),
  ];

  const outputValues = buildOutputs(parsed, appliedResources);

  lines.push(line(""));
  lines.push(line(`Apply complete! Resources: ${toCreate.length} added, 0 changed, 0 destroyed.`, "success"));

  if (Object.keys(outputValues).length > 0) {
    lines.push(line(""));
    lines.push(line("Outputs:", "bold"));
    lines.push(line(""));
    Object.entries(outputValues).forEach(([k, v]) => {
      lines.push(line(`${k} = "${v}"`, "success"));
    });
  }

  return {
    lines,
    newState: {
      ...state,
      applied: true,
      planned: false,
      planResources: [],
      appliedResources,
      outputs: outputValues,
    },
  };
}

function terraformDestroy(state: SimulatorState, args: string[]): SimulatorOutput {
  if (!state.applied || state.appliedResources.length === 0) {
    return {
      lines: [line("No resources to destroy.", "warning")],
      newState: state,
    };
  }

  const autoApprove = args.includes("-auto-approve");
  const lines: OutputLine[] = [line("")];

  state.appliedResources.forEach((r) => {
    lines.push(line(`  # ${r.type}.${r.name} will be destroyed`, "error"));
  });

  lines.push(line(""));
  lines.push(line(`Plan: 0 to add, 0 to change, ${state.appliedResources.length} to destroy.`, "error"));

  if (!autoApprove) {
    lines.push(line(""));
    lines.push(line("Do you really want to destroy all resources?", "warning"));
    lines.push(line('  Add -auto-approve to skip this prompt.', "dim"));
    return { lines, newState: state };
  }

  state.appliedResources.forEach((r) => {
    lines.push(line(`${r.type}.${r.name}: Destroying... [id=${r.id}]`, "normal"));
    lines.push(line(`${r.type}.${r.name}: Destruction complete after 1s`, "error"));
  });

  lines.push(line(""));
  lines.push(line(`Destroy complete! Resources: ${state.appliedResources.length} destroyed.`, "success"));

  return {
    lines,
    newState: {
      ...state,
      applied: false,
      destroyed: true,
      appliedResources: [],
      outputs: {},
    },
  };
}

function terraformOutput(state: SimulatorState, args: string[]): SimulatorOutput {
  if (!state.applied) {
    return {
      lines: [line("│ Warning: No outputs. Apply your configuration first.", "warning")],
      newState: state,
    };
  }

  if (Object.keys(state.outputs).length === 0) {
    return {
      lines: [line("No outputs defined in configuration.", "dim")],
      newState: state,
    };
  }

  const lines: OutputLine[] = [];
  const targetKey = args[0];
  if (targetKey) {
    const val = state.outputs[targetKey];
    if (!val) return { lines: [line(`│ Error: Output "${targetKey}" not found.`, "error")], newState: state };
    lines.push(line(val, "success"));
  } else {
    Object.entries(state.outputs).forEach(([k, v]) => {
      lines.push(line(`${k} = "${v}"`, "normal"));
    });
  }

  return { lines, newState: state };
}

function terraformState(state: SimulatorState, args: string[]): SimulatorOutput {
  const sub = args[0] || "list";

  if (sub === "list") {
    if (!state.applied || state.appliedResources.length === 0) {
      return { lines: [line("No state found. Run terraform apply first.", "dim")], newState: state };
    }
    return {
      lines: state.appliedResources.map((r) => line(`${r.type}.${r.name}`)),
      newState: state,
    };
  }

  if (sub === "show") {
    const target = args[1];
    if (!target) return { lines: [line("Usage: terraform state show <resource>", "dim")], newState: state };
    const resource = state.appliedResources.find((r) => `${r.type}.${r.name}` === target);
    if (!resource) return { lines: [line(`No instance found for "${target}"`, "error")], newState: state };

    const lines: OutputLine[] = [
      line(`# ${resource.type}.${resource.name}:`),
      line(`resource "${resource.type}" "${resource.name}" {`),
      line(`    id = "${resource.id}"`, "dim"),
      ...Object.entries(resource.attributes).map(([k, v]) => line(`    ${k} = ${v}`, "dim")),
      line("}"),
    ];
    return { lines, newState: state };
  }

  return { lines: [line(`Unknown subcommand: state ${sub}`, "error")], newState: state };
}

function terraformWorkspace(state: SimulatorState, args: string[]): SimulatorOutput {
  const sub = args[0] || "list";
  const wsName = args[1];

  if (sub === "show") {
    return {
      lines: [line(state.workspace, "success")],
      newState: state,
    };
  }

  if (sub === "list") {
    const lines = state.workspaces.map((ws) =>
      line(ws === state.workspace ? `* ${ws}` : `  ${ws}`, ws === state.workspace ? "success" : "normal")
    );
    return { lines, newState: state };
  }

  if (sub === "new") {
    if (!wsName) {
      return { lines: [line("Usage: terraform workspace new <name>", "error")], newState: state };
    }
    if (state.workspaces.includes(wsName)) {
      return { lines: [line(`Workspace "${wsName}" already exists`, "error")], newState: state };
    }
    const newWorkspaces = [...state.workspaces, wsName];
    return {
      lines: [
        line(`Created and switched to workspace "${wsName}"!`, "success"),
        line(""),
        line("You're now on a new, empty workspace. Existing resources in the"),
        line('"default" workspace are not available here.', "dim"),
      ],
      newState: {
        ...state,
        workspace: wsName,
        workspaces: newWorkspaces,
        // new workspace = fresh state
        initialized: state.initialized,
        applied: false,
        planned: false,
        appliedResources: [],
        planResources: [],
        outputs: {},
      },
    };
  }

  if (sub === "select") {
    if (!wsName) {
      return { lines: [line("Usage: terraform workspace select <name>", "error")], newState: state };
    }
    if (!state.workspaces.includes(wsName)) {
      return {
        lines: [
          line(`Workspace "${wsName}" doesn't exist.`, "error"),
          line(`Use 'terraform workspace new ${wsName}' to create it.`, "dim"),
        ],
        newState: state,
      };
    }
    return {
      lines: [line(`Switched to workspace "${wsName}".`, "success")],
      newState: {
        ...state,
        workspace: wsName,
        // Switching workspaces clears current runtime state
        applied: false,
        planned: false,
        appliedResources: [],
        planResources: [],
        outputs: {},
      },
    };
  }

  if (sub === "delete") {
    if (!wsName) {
      return { lines: [line("Usage: terraform workspace delete <name>", "error")], newState: state };
    }
    if (wsName === "default") {
      return { lines: [line("The 'default' workspace cannot be deleted.", "error")], newState: state };
    }
    if (wsName === state.workspace) {
      return {
        lines: [line(`Cannot delete the currently active workspace "${wsName}". Switch away first.`, "error")],
        newState: state,
      };
    }
    if (!state.workspaces.includes(wsName)) {
      return { lines: [line(`Workspace "${wsName}" doesn't exist.`, "error")], newState: state };
    }
    return {
      lines: [line(`Deleted workspace "${wsName}".`, "success")],
      newState: { ...state, workspaces: state.workspaces.filter((w) => w !== wsName) },
    };
  }

  return {
    lines: [
      line(`Unknown subcommand: workspace ${sub}`, "error"),
      line("Available: list, new <name>, select <name>, show, delete <name>", "dim"),
    ],
    newState: state,
  };
}

function terraformShow(state: SimulatorState): SimulatorOutput {
  if (!state.applied) {
    return { lines: [line("No state found. Run terraform apply first.", "dim")], newState: state };
  }

  const lines: OutputLine[] = [
    line("# terraform.tfstate", "bold"),
    line(""),
  ];

  state.appliedResources.forEach((r) => {
    lines.push(line(`# ${r.type}.${r.name}:`));
    lines.push(line(`resource "${r.type}" "${r.name}" {`, "normal"));
    lines.push(line(`    id                   = "${r.id}"`, "dim"));
    Object.entries(r.attributes).forEach(([k, v]) => {
      lines.push(line(`    ${k.padEnd(20)} = ${v}`, "dim"));
    });
    lines.push(line("}"));
    lines.push(line(""));
  });

  return { lines, newState: state };
}

export function parseHCL(hcl: string): ParsedHCL {
  const result: ParsedHCL = {
    providers: [], resources: [], variables: [], outputs: [],
    locals: [], modules: [], data: [], valid: true, errors: [],
  };

  if (!hcl.trim()) return result;

  // Check for basic syntax errors: unmatched braces
  let depth = 0;
  let inString = false;
  for (let i = 0; i < hcl.length; i++) {
    const c = hcl[i];
    if (c === '"' && hcl[i - 1] !== "\\") inString = !inString;
    if (!inString) {
      if (c === "{") depth++;
      if (c === "}") depth--;
    }
    if (depth < 0) {
      result.errors.push("Unexpected closing brace '}'");
      result.valid = false;
      return result;
    }
  }
  if (depth !== 0) {
    result.errors.push(`Unclosed block: ${depth} brace(s) not closed`);
    result.valid = false;
    return result;
  }

  // Parse resource blocks
  const resourceRe = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
  for (const match of hcl.matchAll(resourceRe)) {
    const attributes = parseAttributes(match[3]);
    result.resources.push({
      type: "resource",
      labels: [match[1], match[2]],
      attributes,
      resourceType: match[1],
      resourceName: match[2],
    });
  }

  // Parse provider blocks
  const providerRe = /provider\s+"([^"]+)"\s*\{([^}]*)\}/gs;
  for (const match of hcl.matchAll(providerRe)) {
    result.providers.push({
      type: "provider",
      labels: [match[1]],
      attributes: parseAttributes(match[2]),
    });
  }

  // Parse variable blocks (handles nested blocks like validation {})
  const variableRe = /variable\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
  for (const match of hcl.matchAll(variableRe)) {
    const attrs = parseAttributes(match[2]);
    result.variables.push({
      name: match[1],
      type: attrs["type"],
      default: attrs["default"],
      description: attrs["description"],
    });
  }

  // Parse output blocks
  const outputRe = /output\s+"([^"]+)"\s*\{([^}]*)\}/gs;
  for (const match of hcl.matchAll(outputRe)) {
    const attrs = parseAttributes(match[2]);
    result.outputs.push({
      name: match[1],
      value: attrs["value"] || "",
      description: attrs["description"],
    });
  }

  // Parse module blocks
  const moduleRe = /module\s+"([^"]+)"\s*\{([^}]*)\}/gs;
  for (const match of hcl.matchAll(moduleRe)) {
    const attrs = parseAttributes(match[2]);
    result.modules.push({
      name: match[1],
      source: attrs["source"] || "",
      inputs: attrs,
    });
  }

  // Parse data blocks
  const dataRe = /data\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*)\}/gs;
  for (const match of hcl.matchAll(dataRe)) {
    result.data.push({
      dataType: match[1],
      dataName: match[2],
      attributes: parseAttributes(match[3]),
    });
  }

  return result;
}

function parseAttributes(body: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /^\s*(\w+)\s*=\s*(.+?)\s*$/gm;
  for (const match of body.matchAll(attrRe)) {
    attrs[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return attrs;
}

function buildPlanResources(parsed: ParsedHCL, state: SimulatorState): PlannedResource[] {
  const plan: PlannedResource[] = [];
  const appliedKeys = new Set(state.appliedResources.map((r) => `${r.type}.${r.name}`));

  for (const r of parsed.resources) {
    const key = `${r.resourceType}.${r.resourceName}`;
    const action = appliedKeys.has(key) ? "no-change" : "create";
    if (action === "create") {
      plan.push({
        type: r.resourceType,
        name: r.resourceName,
        action,
        attributes: buildMockAttributes(r.resourceType, r.resourceName, r.attributes),
      });
    }
  }

  // Resources that exist in state but not in config -> destroy
  for (const applied of state.appliedResources) {
    const stillInConfig = parsed.resources.some(
      (r) => r.resourceType === applied.type && r.resourceName === applied.name
    );
    if (!stillInConfig) {
      plan.push({ type: applied.type, name: applied.name, action: "destroy", attributes: {} });
    }
  }

  return plan;
}

function buildMockAttributes(type: string, name: string, attrs: Record<string, string>): Record<string, string> {
  const mock: Record<string, string> = { ...attrs };
  // AWS
  if (type === "aws_s3_bucket") {
    mock["bucket"] = attrs["bucket"] || `"${name}-bucket"`;
    mock["arn"] = `"(known after apply)"`;
  } else if (type === "aws_instance") {
    mock["ami"] = attrs["ami"] || `"(required)"`;
    mock["instance_type"] = attrs["instance_type"] || `"(required)"`;
    mock["public_ip"] = `"(known after apply)"`;
  } else if (type === "aws_vpc") {
    mock["cidr_block"] = attrs["cidr_block"] || `"(required)"`;
  }
  // GCP
  else if (type === "google_storage_bucket") {
    mock["name"] = attrs["name"] || `"${name}-bucket"`;
    mock["url"] = `"(known after apply)"`;
    mock["self_link"] = `"(known after apply)"`;
  } else if (type === "google_compute_instance") {
    mock["name"] = attrs["name"] || name;
    mock["self_link"] = `"(known after apply)"`;
    mock["network_interface.0.network_ip"] = `"(known after apply)"`;
  } else if (type === "google_compute_network") {
    mock["name"] = attrs["name"] || name;
    mock["self_link"] = `"(known after apply)"`;
  }
  // Azure
  else if (type === "azurerm_resource_group") {
    mock["name"] = attrs["name"] || name;
    mock["location"] = attrs["location"] || `"(required)"`;
  } else if (type === "azurerm_storage_account") {
    mock["name"] = attrs["name"] || name;
    mock["primary_blob_endpoint"] = `"(known after apply)"`;
  } else if (type === "azurerm_virtual_network") {
    mock["name"] = attrs["name"] || name;
    mock["id"] = `"(known after apply)"`;
  }
  mock["id"] = `"(known after apply)"`;
  return mock;
}

function buildOutputs(parsed: ParsedHCL, resources: AppliedResource[]): Record<string, string> {
  const outputs: Record<string, string> = {};
  for (const output of parsed.outputs) {
    const valueExpr = output.value;
    // Try to resolve simple resource references
    const refMatch = valueExpr.match(/^([a-z_]+)\.([a-z_]+)\.([a-z_]+)$/);
    if (refMatch) {
      const resource = resources.find((r) => r.type === refMatch[1] && r.name === refMatch[2]);
      if (resource) {
        outputs[output.name] = resource.attributes[refMatch[3]] || resource.id;
      } else {
        outputs[output.name] = "(computed)";
      }
    } else {
      outputs[output.name] = valueExpr.replace(/^"(.*)"$/, "$1") || "(computed)";
    }
  }
  return outputs;
}

function generateId(resourceType: string): string {
  const prefixes: Record<string, string> = {
    // AWS
    aws_s3_bucket: "my-bucket-",
    aws_instance: "i-",
    aws_vpc: "vpc-",
    aws_subnet: "subnet-",
    aws_security_group: "sg-",
    aws_iam_role: "role-",
    aws_lambda_function: "fn-",
    aws_db_instance: "db-",
    // GCP
    google_storage_bucket: "gs-bucket-",
    google_compute_instance: "gce-",
    google_compute_network: "gcp-net-",
    google_sql_database_instance: "gcp-db-",
    // Azure
    azurerm_resource_group: "/subscriptions/00000000/resourceGroups/",
    azurerm_storage_account: "azsa-",
    azurerm_virtual_network: "azvnet-",
    azurerm_linux_virtual_machine: "azvm-",
  };
  const prefix = prefixes[resourceType] ?? resourceType.split("_").pop() + "-";
  const chars = "0123456789abcdef";
  const randomHex = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}${randomHex}`;
}

const TERRAFORM_HELP = `Usage: terraform [global options] <subcommand> [args]

Main commands:
  init          Prepare your working directory for other commands
  validate      Check whether the configuration is valid
  plan          Show changes required by the current configuration
  apply         Create or update infrastructure
  destroy       Destroy previously-created infrastructure

Other commands:
  fmt           Reformat your configuration in the standard style
  output        Show output values from your root module
  show          Show the current state or a plan
  state         Advanced state management
  workspace     Workspace management (list, new, select, show, delete)`;
