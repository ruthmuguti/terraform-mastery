import type { Monaco } from "@monaco-editor/react";

/**
 * Registers HCL (HashiCorp Configuration Language) as a Monaco language
 * with full syntax highlighting for Terraform files.
 */
export function registerHCL(monaco: Monaco) {
  // Prevent double-registration
  if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === "hcl")) return;

  monaco.languages.register({ id: "hcl", extensions: [".tf", ".tfvars", ".hcl"] });

  monaco.languages.setMonarchTokensProvider("hcl", {
    defaultToken: "",
    tokenPostfix: ".hcl",

    keywords: [
      "resource", "data", "provider", "variable", "output", "locals",
      "module", "terraform", "required_providers", "required_version",
      "backend", "for_each", "count", "depends_on", "lifecycle",
      "create_before_destroy", "prevent_destroy", "ignore_changes",
      "dynamic", "content", "each", "self", "path", "var", "local",
    ],

    typeKeywords: [
      "string", "number", "bool", "list", "map", "set", "object",
      "tuple", "any", "null", "true", "false",
    ],

    builtins: [
      "abs", "ceil", "floor", "log", "max", "min", "pow", "signum",
      "chomp", "format", "formatlist", "indent", "join", "lower",
      "regex", "regexall", "replace", "split", "strrev", "substr",
      "title", "trim", "trimprefix", "trimsuffix", "trimspace", "upper",
      "chunklist", "coalesce", "coalescelist", "compact", "concat",
      "contains", "distinct", "element", "flatten", "index", "keys",
      "length", "lookup", "map", "matchkeys", "merge", "range",
      "reverse", "setintersection", "setproduct", "setsubtract",
      "setunion", "slice", "sort", "sum", "transpose", "values",
      "zipmap", "base64decode", "base64encode", "base64gzip",
      "csvdecode", "jsondecode", "jsonencode", "textdecodebase64",
      "textencodebase64", "urlencode", "yamldecode", "yamlencode",
      "abspath", "dirname", "pathexpand", "basename", "file",
      "fileexists", "fileset", "filebase64", "templatefile",
      "formatdate", "timeadd", "timestamp",
      "cidrhost", "cidrnetmask", "cidrsubnet", "cidrsubnets",
      "tostring", "tonumber", "tobool", "toset", "tolist", "tomap",
      "can", "nonsensitive", "sensitive", "try",
    ],

    operators: [
      "=", "==", "!=", "<", "<=", ">", ">=",
      "&&", "||", "!", "+", "-", "*", "/", "%",
      "?", ":", "...", "=>",
    ],

    symbols: /[=><!~?:&|+\-*/^%]+/,

    tokenizer: {
      root: [
        // Heredoc
        [/<<-?(\w+)/, { token: "string.heredoc.delimiter", next: "@heredoc.$1" }],

        // Block labels (resource "aws_s3_bucket" "name")
        [/\b(resource|data|provider|module)\b/, { token: "keyword", next: "@block_labels" }],

        // Keywords
        [/[a-z_$][\w$]*/, {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@builtins": "support.function",
            "@default": "identifier",
          },
        }],

        // Whitespace
        { include: "@whitespace" },

        // Numbers
        [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
        [/0[xX][0-9a-fA-F]+/, "number.hex"],
        [/\d+/, "number"],

        // Strings with interpolation
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

        // Operators and punctuation
        [/@symbols/, {
          cases: {
            "@operators": "operator",
            "@default": "",
          },
        }],

        // Brackets
        [/[{}[\]()]/, "@brackets"],

        // Attribute access
        [/\./, "delimiter"],
      ],

      block_labels: [
        [/\s+/, ""],
        [/"([^"]*)"/, "string.block-label"],
        [/[{]/, { token: "@brackets", next: "@pop" }],
        [/[^\s"{]+/, { token: "@rematch", next: "@pop" }],
      ],

      string: [
        // Template interpolation ${...}
        [/\$\{/, { token: "delimiter.bracket", next: "@interpolation" }],
        // Template directive %{...}
        [/%\{/, { token: "delimiter.bracket", next: "@interpolation" }],
        // Escape sequences
        [/\\./, "string.escape"],
        // End of string
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        // String content
        [/[^"\\$%]+/, "string"],
        [/[$%]/, "string"],
      ],

      interpolation: [
        [/\}/, { token: "delimiter.bracket", next: "@pop" }],
        { include: "@root" },
      ],

      heredoc: [
        [/^\s*(\w+)\s*$/, {
          cases: {
            "$1==$S2": { token: "string.heredoc.delimiter", next: "@pop" },
            "@default": "string.heredoc",
          },
        }],
        [/./, "string.heredoc"],
      ],

      whitespace: [
        [/[ \t\r\n]+/, ""],
        // Line comments
        [/#.*$/, "comment"],
        [/\/\/.*$/, "comment"],
        // Block comments
        [/\/\*/, "comment", "@block_comment"],
      ],

      block_comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  });

  // Auto-close brackets and quotes
  monaco.languages.setLanguageConfiguration("hcl", {
    comments: { lineComment: "#", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string"] },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}]*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
    folding: {
      markers: {
        start: /\{/,
        end: /\}/,
      },
    },
  });

  // Basic HCL completions
  monaco.languages.registerCompletionItemProvider("hcl", {
    provideCompletionItems(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const SNIPPETS = [
        {
          label: "resource",
          insertText: 'resource "${1:type}" "${2:name}" {\n  $0\n}',
          detail: "Resource block",
        },
        {
          label: "variable",
          insertText: 'variable "${1:name}" {\n  type        = ${2:string}\n  description = "${3}"\n  default     = "${4}"\n}',
          detail: "Input variable",
        },
        {
          label: "output",
          insertText: 'output "${1:name}" {\n  value       = $0\n  description = "${2}"\n}',
          detail: "Output value",
        },
        {
          label: "locals",
          insertText: "locals {\n  $0\n}",
          detail: "Local values block",
        },
        {
          label: "provider",
          insertText: 'provider "${1:name}" {\n  $0\n}',
          detail: "Provider block",
        },
        {
          label: "module",
          insertText: 'module "${1:name}" {\n  source = "${2}"\n  $0\n}',
          detail: "Module call",
        },
        {
          label: "terraform",
          insertText:
            'terraform {\n  required_providers {\n    ${1:aws} = {\n      source  = "hashicorp/${1:aws}"\n      version = "~> ${2:5.0}"\n    }\n  }\n}',
          detail: "Terraform block",
        },
        {
          label: "for_each",
          insertText: "for_each = ${1:var.items}",
          detail: "for_each meta-argument",
        },
        {
          label: "lifecycle",
          insertText: "lifecycle {\n  create_before_destroy = ${1:true}\n}",
          detail: "Lifecycle block",
        },
      ];

      return {
        suggestions: SNIPPETS.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: s.detail,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
      };
    },
  });
}

export function defineNoirTheme(monaco: Monaco) {
  monaco.editor.defineTheme("noir", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "7c5df9", fontStyle: "bold" },
      { token: "type", foreground: "00c8ff" },
      { token: "support.function", foreground: "c9a227" },
      { token: "string", foreground: "00ff9f" },
      { token: "string.quote", foreground: "00ff9f" },
      { token: "string.heredoc", foreground: "00cc7a" },
      { token: "string.heredoc.delimiter", foreground: "5a3fd4", fontStyle: "bold" },
      { token: "string.block-label", foreground: "00c8ff" },
      { token: "string.escape", foreground: "ffaa00" },
      { token: "number", foreground: "c9a227" },
      { token: "number.float", foreground: "c9a227" },
      { token: "number.hex", foreground: "c9a227" },
      { token: "comment", foreground: "404068", fontStyle: "italic" },
      { token: "operator", foreground: "9898c8" },
      { token: "delimiter", foreground: "6464a0" },
      { token: "delimiter.bracket", foreground: "ffaa00" },
      { token: "identifier", foreground: "e2e2f0" },
      { token: "@brackets", foreground: "6464a0" },
    ],
    colors: {
      "editor.background": "#0a0a12",
      "editor.foreground": "#e2e2f0",
      "editor.lineHighlightBackground": "#111120",
      "editor.lineHighlightBorder": "#1e1e38",
      "editorLineNumber.foreground": "#2a2a4a",
      "editorLineNumber.activeForeground": "#7c5df9",
      "editor.selectionBackground": "#7c5df930",
      "editor.inactiveSelectionBackground": "#7c5df918",
      "editorCursor.foreground": "#00ff9f",
      "editorCursor.background": "#0a0a12",
      "editorIndentGuide.background1": "#16162a",
      "editorIndentGuide.activeBackground1": "#2a2a4a",
      "editorBracketMatch.background": "#7c5df920",
      "editorBracketMatch.border": "#7c5df960",
      "editor.findMatchBackground": "#c9a22730",
      "editor.findMatchHighlightBackground": "#c9a22718",
      "editorSuggestWidget.background": "#0d0d18",
      "editorSuggestWidget.border": "#1e1e38",
      "editorSuggestWidget.selectedBackground": "#111120",
      "editorSuggestWidget.highlightForeground": "#00ff9f",
      "editorHoverWidget.background": "#0d0d18",
      "editorHoverWidget.border": "#1e1e38",
    },
  });
}
