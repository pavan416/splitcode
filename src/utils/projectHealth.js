// ==========================================================
// SplitCode V11.6 — Project Health Summary
// src/utils/projectHealth.js
//
// Combines diagnostics, relationships, framework detection and
// preview/runtime status into one deterministic project-health view.
// ==========================================================

export function getProjectHealthSummary({
  files = [],
  diagnostics = {},
  relationships = {},
  framework = {},
  previewPlan = {},
  relationshipRepairs = {},
} = {}) {
  const fileCount =
    Array.isArray(files)
      ? files.length
      : 0;

  const errors =
    Number(
      diagnostics.errors || 0
    );

  const warnings =
    Number(
      diagnostics.warnings || 0
    );

  const missing =
    Number(
      relationships.missingCount || 0
    );

  const orphaned =
    Number(
      relationships.orphanedCount || 0
    );

  const repairs =
    Object.values(
      relationshipRepairs || {}
    );

  const safeFixCount =
    repairs.filter(
      (repair) =>
        repair?.confidence ===
        "high"
    ).length;

  const reviewFixCount =
    repairs.filter(
      (repair) =>
        repair?.confidence !==
        "high"
    ).length;

  const unresolvedWithoutMatch =
    Math.max(
      0,
      missing -
        repairs.length
    );

  const runtimeRequired =
    previewPlan.mode ===
    "runtime";

  const issueCount =
    errors +
    warnings +
    missing +
    orphaned;

  let status =
    "Healthy";

  let tone =
    "healthy";

  let headline =
    "Project looks healthy";

  let description =
    "No structural problems or broken local references were detected.";

  if (!fileCount) {
    status =
      "No project";

    tone =
      "neutral";

    headline =
      "No project loaded";

    description =
      "Import or split a project to calculate health and repair options.";
  } else if (
    errors > 0 ||
    missing > 0
  ) {
    status =
      "Needs attention";

    tone =
      "error";

    headline =
      "Project needs repair";

    description =
      safeFixCount > 0
        ? `${safeFixCount} high-confidence repair${
            safeFixCount === 1
              ? ""
              : "s"
          } can be applied safely.`
        : "Review the errors and broken relationships before exporting.";
  } else if (
    warnings > 0 ||
    orphaned > 0
  ) {
    status =
      "Review recommended";

    tone =
      "warning";

    headline =
      "Project is usable, but needs review";

    description =
      "Warnings or possible orphaned files were detected.";
  } else if (
    runtimeRequired
  ) {
    status =
      "Runtime required";

    tone =
      "runtime";

    headline =
      `${framework.label || "Framework"} project detected`;

    description =
      "The project structure looks healthy, but its framework runtime is required for an accurate preview.";
  }

  return {
    fileCount,
    errors,
    warnings,
    missing,
    orphaned,
    issueCount,
    safeFixCount,
    reviewFixCount,
    unresolvedWithoutMatch,
    runtimeRequired,
    status,
    tone,
    headline,
    description,
    frameworkLabel:
      framework.stackSummary ||
      framework.label ||
      "Project",
    previewLabel:
      previewPlan.label ||
      "Preview unavailable",
  };
}
