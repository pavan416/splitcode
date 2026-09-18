// ==========================================================
// SplitCode V11.8 — Export Documentation
// src/utils/exportDocumentation.js
//
// Generates export-time documentation without modifying the
// user's in-editor project:
// - README.md when the project does not already contain one
// - SPLITCODE-EXPORT-REPORT.md on every export
//
// Existing README files are always preserved.
// ==========================================================

function normalizePath(path = "") {
  return String(path)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function lowerPath(path = "") {
  return normalizePath(path)
    .toLowerCase();
}

function getFilePath(file = {}) {
  return normalizePath(
    file.path ||
    file.name ||
    ""
  );
}

function findRootReadme(files = []) {
  return files.find((file) => {
    const path =
      lowerPath(
        getFilePath(file)
      );

    return [
      "readme.md",
      "readme.markdown",
      "readme.txt",
    ].includes(path);
  }) || null;
}

function getPackageJson(files = []) {
  const file =
    files.find(
      (item) =>
        lowerPath(
          getFilePath(item)
        ) ===
        "package.json"
    );

  if (!file) {
    return null;
  }

  try {
    return JSON.parse(
      file.content
    );
  } catch {
    return null;
  }
}

function getHtmlTitle(files = []) {
  const html =
    files.find(
      (file) =>
        lowerPath(
          getFilePath(file)
        ) ===
        "index.html"
    ) ||
    files.find(
      (file) =>
        /\.(?:html|htm)$/i.test(
          getFilePath(file)
        )
    );

  if (!html) {
    return "";
  }

  const match =
    String(
      html.content || ""
    ).match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  return match
    ? match[1]
        .replace(
          /\s+/g,
          " "
        )
        .trim()
    : "";
}

function cleanProjectName(
  value = ""
) {
  return String(value)
    .replace(
      /^@[^/]+\//,
      ""
    )
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function inferProjectName(files = []) {
  const packageJson =
    getPackageJson(files);

  if (
    packageJson?.name
  ) {
    return (
      cleanProjectName(
        packageJson.name
      ) ||
      "SplitCode Project"
    );
  }

  const htmlTitle =
    getHtmlTitle(files);

  if (htmlTitle) {
    return htmlTitle;
  }

  return "SplitCode Project";
}

function findAvailableReportPath(
  files = []
) {
  const existing =
    new Set(
      files.map(
        (file) =>
          lowerPath(
            getFilePath(file)
          )
      )
    );

  const primary =
    "SPLITCODE-EXPORT-REPORT.md";

  if (
    !existing.has(
      primary.toLowerCase()
    )
  ) {
    return primary;
  }

  let index = 2;

  while (
    existing.has(
      `splitcode-export-report-${index}.md`
    )
  ) {
    index += 1;
  }

  return `SPLITCODE-EXPORT-REPORT-${index}.md`;
}

function formatStatus(
  value = ""
) {
  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    normalized === "pass" ||
    normalized === "ready" ||
    normalized === "healthy"
  ) {
    return "PASS";
  }

  if (
    normalized === "warn" ||
    normalized === "review" ||
    normalized === "warning"
  ) {
    return "REVIEW";
  }

  if (
    normalized === "fail" ||
    normalized === "blocked" ||
    normalized === "error"
  ) {
    return "BLOCKED";
  }

  return (
    String(value)
      .trim()
      .toUpperCase() ||
    "INFO"
  );
}

function safeMarkdown(
  value = ""
) {
  return String(value)
    .replace(
      /\|/g,
      "\\|"
    )
    .replace(
      /\r?\n/g,
      " "
    )
    .trim();
}

function buildSetupSection(
  previewPlan = {}
) {
  const commands = [];

  if (
    previewPlan.installCommand
  ) {
    commands.push(
      previewPlan.installCommand
    );
  }

  if (
    previewPlan.runCommand
  ) {
    commands.push(
      previewPlan.runCommand
    );
  }

  if (!commands.length) {
    if (
      previewPlan.canPreview
    ) {
      return `## Getting Started

Open \`${previewPlan.entryPath || "index.html"}\` in a browser, or serve the project with your preferred local static server.`;
    }

    return `## Getting Started

Review the project files and use the runtime or build process required by the detected stack.`;
  }

  return `## Getting Started

Run the following commands from the project directory:

\`\`\`bash
${commands.join("\n")}
\`\`\``;
}

function buildReadme({
  projectName,
  framework = {},
  previewPlan = {},
  projectHealth = {},
  exportReadiness = {},
  reportPath =
    "SPLITCODE-EXPORT-REPORT.md",
} = {}) {
  const stack =
    framework.stackSummary ||
    framework.label ||
    "Web Project";

  const entry =
    previewPlan.entryPath ||
    "Framework entry determined by the project runtime";

  return `# ${projectName}

Project prepared with SplitCode.

## Project Overview

- **Detected stack:** ${stack}
- **Entry point:** ${entry}
- **Preview status:** ${previewPlan.label || "Not available"}
- **Project health:** ${projectHealth.status || "Not evaluated"}
- **Export preflight:** ${exportReadiness.label || "Not evaluated"}

${buildSetupSection(
  previewPlan
)}

## Export Notes

This README was generated by SplitCode because the project did not contain a root README file.

For a detailed preflight snapshot, see \`${reportPath}\`.

> SplitCode generates documentation from the project structure it can detect. Review framework-specific deployment requirements before publishing.
`;
}

function buildPreflightTable(
  checks = []
) {
  if (
    !Array.isArray(checks) ||
    !checks.length
  ) {
    return "No preflight checks were available.";
  }

  const rows =
    checks.map(
      (check) =>
        `| ${safeMarkdown(
          check.label
        )} | ${formatStatus(
          check.status
        )} | ${safeMarkdown(
          check.detail
        )} |`
    );

  return [
    "| Check | Status | Details |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function buildDiagnosticsSection(
  diagnostics = {}
) {
  const issues =
    Array.isArray(
      diagnostics.issues
    )
      ? diagnostics.issues
      : [];

  if (!issues.length) {
    return "No diagnostic issues were reported.";
  }

  return issues
    .slice(0, 30)
    .map((issue) => {
      const location =
        [
          issue.file,
          issue.reference,
        ]
          .filter(Boolean)
          .join(" → ");

      return `- **${String(
        issue.severity ||
        "info"
      ).toUpperCase()}** — ${
        issue.message ||
        issue.type ||
        "Project issue"
      }${
        location
          ? ` (\`${location}\`)`
          : ""
      }`;
    })
    .join("\n");
}

function buildMissingRelationshipsSection(
  relationships = {}
) {
  const missing =
    Array.isArray(
      relationships.missing
    )
      ? relationships.missing
      : [];

  if (!missing.length) {
    return "No broken local references were detected.";
  }

  return missing
    .slice(0, 30)
    .map(
      (edge) =>
        `- \`${edge.sourcePath || "unknown"}\` → \`${edge.reference || "unknown"}\`${
          edge.line
            ? ` (line ${edge.line})`
            : ""
        }`
    )
    .join("\n");
}

function buildOrphanedSection(
  relationships = {}
) {
  const orphaned =
    Array.isArray(
      relationships.orphaned
    )
      ? relationships.orphaned
      : [];

  if (!orphaned.length) {
    return "No possible orphaned files were detected.";
  }

  return orphaned
    .slice(0, 30)
    .map(
      (node) =>
        `- \`${node.path || "unknown"}\``
    )
    .join("\n");
}

function buildReport({
  projectName,
  generatedAt,
  files = [],
  framework = {},
  previewPlan = {},
  projectHealth = {},
  exportReadiness = {},
  diagnostics = {},
  relationships = {},
  readmeGenerated = false,
  reportPath,
} = {}) {
  const stack =
    framework.stackSummary ||
    framework.label ||
    "Unknown";

  const generatedLabel =
    generatedAt ||
    "Export time";

  return `# SplitCode Export Report

## Summary

- **Project:** ${projectName}
- **Generated:** ${generatedLabel}
- **Files packaged:** ${files.length}
- **Detected stack:** ${stack}
- **Framework:** ${framework.label || "Unknown"}
- **Preview / runtime:** ${previewPlan.label || "Unavailable"}
- **Project health:** ${projectHealth.status || "Not evaluated"}
- **Export readiness:** ${exportReadiness.label || "Not evaluated"}
- **Blocking checks:** ${exportReadiness.blockerCount || 0}
- **Warnings:** ${exportReadiness.warningCount || 0}
- **Safe automatic fixes remaining:** ${projectHealth.safeFixCount || 0}
- **Generated README:** ${readmeGenerated ? "Yes" : "No — existing README preserved"}
- **Report file:** ${reportPath}

## Setup

${buildSetupSection(
  previewPlan
).replace(
  /^## Getting Started\s*/m,
  ""
)}

## Export Preflight

${buildPreflightTable(
  exportReadiness.checks
)}

## Diagnostics

${buildDiagnosticsSection(
  diagnostics
)}

## Broken Local References

${buildMissingRelationshipsSection(
  relationships
)}

## Possible Orphaned Files

${buildOrphanedSection(
  relationships
)}

## Notes

- SplitCode does not execute framework build pipelines during export.
- Runtime-based projects should be installed and started with the detected project commands.
- Existing project source files are packaged without being rewritten by documentation generation.
- Review unresolved warnings and framework-specific deployment requirements before production use.
`;
}

export function getExportDocumentationPlan(
  files = []
) {
  const safeFiles =
    Array.isArray(files)
      ? files
      : [];

  const existingReadme =
    findRootReadme(
      safeFiles
    );

  const reportPath =
    findAvailableReportPath(
      safeFiles
    );

  return {
    hasExistingReadme:
      Boolean(
        existingReadme
      ),
    readmePath:
      existingReadme
        ? getFilePath(
            existingReadme
          )
        : "README.md",
    readmeAction:
      existingReadme
        ? "preserve"
        : "generate",
    reportPath,
    generatedFileCount:
      existingReadme
        ? 1
        : 2,
  };
}

export function generateExportDocumentation({
  files = [],
  framework = {},
  previewPlan = {},
  projectHealth = {},
  exportReadiness = {},
  diagnostics = {},
  relationships = {},
  generatedAt = "",
} = {}) {
  const safeFiles =
    Array.isArray(files)
      ? files
      : [];

  const plan =
    getExportDocumentationPlan(
      safeFiles
    );

  const projectName =
    inferProjectName(
      safeFiles
    );

  const documents = [];

  if (
    !plan.hasExistingReadme
  ) {
    documents.push({
      path:
        "README.md",
      content:
        buildReadme({
          projectName,
          framework,
          previewPlan,
          projectHealth,
          exportReadiness,
          reportPath:
            plan.reportPath,
        }),
      kind:
        "readme",
    });
  }

  documents.push({
    path:
      plan.reportPath,
    content:
      buildReport({
        projectName,
        generatedAt,
        files:
          safeFiles,
        framework,
        previewPlan,
        projectHealth,
        exportReadiness,
        diagnostics,
        relationships,
        readmeGenerated:
          !plan.hasExistingReadme,
        reportPath:
          plan.reportPath,
      }),
    kind:
      "report",
  });

  return {
    projectName,
    plan,
    documents,
  };
}
