// ==========================================================
// SplitCode V11.3 — Project-Type Aware Preview
// src/utils/previewManager.js
//
// Decides whether a project can be previewed safely inside
// SplitCode's browser iframe or needs its real framework runtime.
// ==========================================================

function normalizePath(path = "") {
  return String(path)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function findFile(files, wantedPath) {
  const target =
    normalizePath(wantedPath);

  return (
    files.find(
      (file) =>
        normalizePath(
          file.path || file.name
        ) === target
    ) || null
  );
}

function hasFile(files, pattern) {
  return files.some((file) =>
    pattern.test(
      normalizePath(
        file.path || file.name
      )
    )
  );
}

function safeJson(content = "") {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getPackageJson(files) {
  const file =
    findFile(
      files,
      "package.json"
    );

  if (!file) {
    return null;
  }

  return safeJson(
    file.content
  );
}

function detectPackageManager(files) {
  if (
    findFile(
      files,
      "pnpm-lock.yaml"
    )
  ) {
    return "pnpm";
  }

  if (
    findFile(
      files,
      "yarn.lock"
    )
  ) {
    return "yarn";
  }

  if (
    findFile(
      files,
      "bun.lockb"
    ) ||
    findFile(
      files,
      "bun.lock"
    )
  ) {
    return "bun";
  }

  return "npm";
}

function getInstallCommand(
  packageManager
) {
  if (
    packageManager === "yarn"
  ) {
    return "yarn";
  }

  if (
    packageManager === "bun"
  ) {
    return "bun install";
  }

  if (
    packageManager === "pnpm"
  ) {
    return "pnpm install";
  }

  return "npm install";
}

function getRunCommand(
  packageJson,
  packageManager
) {
  const scripts =
    packageJson?.scripts || {};

  const scriptName =
    ["dev", "start", "serve"]
      .find(
        (name) =>
          typeof scripts[name] ===
            "string"
      );

  if (!scriptName) {
    return "";
  }

  if (
    packageManager === "yarn"
  ) {
    return `yarn ${scriptName}`;
  }

  if (
    packageManager === "bun"
  ) {
    return `bun run ${scriptName}`;
  }

  if (
    packageManager === "pnpm"
  ) {
    return `pnpm ${scriptName}`;
  }

  return `npm run ${scriptName}`;
}

function hasLocalModuleGraph(
  files
) {
  const scriptFiles =
    files.filter((file) =>
      [
        "javascript",
        "jsx",
        "typescript",
        "tsx",
      ].includes(
        file.language
      ) ||
      /\.(?:m?js|cjs|jsx|tsx?|ts)$/i.test(
        file.path || file.name || ""
      )
    );

  return scriptFiles.some(
    (file) => {
      const content =
        String(
          file.content || ""
        );

      return (
        /(?:^|\n)\s*import\s+[\s\S]*?\s+from\s+["'][./]/m.test(
          content
        ) ||
        /(?:^|\n)\s*import\s*["'][./]/m.test(
          content
        ) ||
        /(?:^|\n)\s*export\s+(?:default\s+)?(?:\{|\*|const|let|var|function|class)/m.test(
          content
        )
      );
    }
  );
}

function getHtmlEntry(files) {
  const htmlFiles =
    files.filter((file) => {
      const path =
        normalizePath(
          file.path || file.name
        );

      return (
        file.language ===
          "html" ||
        /\.html?$/.test(path)
      );
    });

  return (
    htmlFiles.find(
      (file) =>
        normalizePath(
          file.path || file.name
        ) === "index.html"
    ) ||
    htmlFiles[0] ||
    null
  );
}

function frameworkNeedsRuntime(
  framework
) {
  return [
    "react",
    "next",
    "angular",
    "vue",
    "svelte",
    "nuxt",
    "astro",
  ].includes(
    framework
  );
}

export function getProjectPreviewPlan(
  files = [],
  frameworkInfo = {}
) {
  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {
    return {
      mode: "empty",
      canPreview: false,
      label: "No project",
      description:
        "Add project files to create a preview.",
      reason: "",
      entryPath: "",
      packageManager: "",
      installCommand: "",
      runCommand: "",
    };
  }

  const framework =
    frameworkInfo.framework ||
    "unknown";

  const stackLabel =
    frameworkInfo.stackSummary ||
    frameworkInfo.label ||
    "Project";

  const packageJson =
    getPackageJson(files);

  const packageManager =
    detectPackageManager(
      files
    );

  const installCommand =
    packageJson
      ? getInstallCommand(
          packageManager
        )
      : "";

  const runCommand =
    packageJson
      ? getRunCommand(
          packageJson,
          packageManager
        )
      : "";

  const htmlEntry =
    getHtmlEntry(files);

  if (
    frameworkNeedsRuntime(
      framework
    )
  ) {
    return {
      mode: "runtime",
      canPreview: false,
      label:
        `${stackLabel} runtime required`,
      description:
        "This project needs its framework dev server or build tool. SplitCode will not run framework source as raw browser JavaScript.",
      reason:
        `${frameworkInfo.label || "Framework"} project detected.`,
      entryPath:
        htmlEntry?.path || "",
      packageManager,
      installCommand,
      runCommand,
    };
  }

  if (
    hasFile(
      files,
      /\.(?:jsx|tsx|ts)$/
    )
  ) {
    return {
      mode: "runtime",
      canPreview: false,
      label:
        "Build step required",
      description:
        "TypeScript or JSX source must be compiled before a browser can execute it reliably.",
      reason:
        "Compiled source files detected.",
      entryPath:
        htmlEntry?.path || "",
      packageManager,
      installCommand,
      runCommand,
    };
  }

  if (
    frameworkInfo.buildTool &&
    packageJson
  ) {
    return {
      mode: "runtime",
      canPreview: false,
      label:
        `${frameworkInfo.buildTool} runtime required`,
      description:
        "This project uses a build tool. Run the project's development command for an accurate preview.",
      reason:
        `${frameworkInfo.buildTool} and package.json detected.`,
      entryPath:
        htmlEntry?.path || "",
      packageManager,
      installCommand,
      runCommand,
    };
  }

  if (
    hasLocalModuleGraph(
      files
    )
  ) {
    return {
      mode: "runtime",
      canPreview: false,
      label:
        "Module runtime required",
      description:
        "This project contains a local JavaScript module graph. The current iframe preview cannot safely resolve those module files.",
      reason:
        "Local import/export relationships detected.",
      entryPath:
        htmlEntry?.path || "",
      packageManager,
      installCommand,
      runCommand,
    };
  }

  if (!htmlEntry) {
    return {
      mode: "unavailable",
      canPreview: false,
      label:
        "Preview unavailable",
      description:
        "No HTML entry file was found. Add an index.html file or run the project through its own framework runtime.",
      reason:
        "No HTML entry point detected.",
      entryPath: "",
      packageManager,
      installCommand,
      runCommand,
    };
  }

  return {
    mode: "live",
    canPreview: true,
    label:
      "Browser-ready preview",
    description:
      "This project can be rendered directly inside SplitCode.",
    reason:
      "HTML entry point with browser-ready assets detected.",
    entryPath:
      htmlEntry.path ||
      htmlEntry.name ||
      "index.html",
    packageManager,
    installCommand: "",
    runCommand: "",
  };
}
