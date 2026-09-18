// ==========================================================
// SplitCode V11.7 — Export Readiness
// src/utils/exportReadiness.js
//
// Produces a deterministic preflight report before ZIP export.
// Statuses:
// - ready   -> clean export
// - review  -> exportable, but user should review warnings
// - blocked -> unresolved structural problems are present
// ==========================================================

function makeCheck(
  id,
  label,
  status,
  detail
) {
  return {
    id,
    label,
    status,
    detail,
  };
}

export function getExportReadiness({
  files = [],
  diagnostics = {},
  relationships = {},
  framework = {},
  previewPlan = {},
  projectHealth = {},
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

  const safeFixCount =
    Number(
      projectHealth.safeFixCount || 0
    );

  const reviewFixCount =
    Number(
      projectHealth.reviewFixCount || 0
    );

  const runtimeRequired =
    previewPlan.mode ===
    "runtime";

  const previewUnavailable =
    previewPlan.mode ===
    "unavailable";

  const checks = [];

  if (!fileCount) {
    checks.push(
      makeCheck(
        "files",
        "Project files",
        "fail",
        "No project files are loaded."
      )
    );
  } else {
    checks.push(
      makeCheck(
        "files",
        "Project files",
        "pass",
        `${fileCount} file${
          fileCount === 1
            ? ""
            : "s"
        } ready for packaging.`
      )
    );
  }

  if (errors > 0) {
    checks.push(
      makeCheck(
        "diagnostics",
        "Structural diagnostics",
        "fail",
        `${errors} error${
          errors === 1
            ? ""
            : "s"
        } remain unresolved.`
      )
    );
  } else if (warnings > 0) {
    checks.push(
      makeCheck(
        "diagnostics",
        "Structural diagnostics",
        "warn",
        `${warnings} warning${
          warnings === 1
            ? ""
            : "s"
        } should be reviewed.`
      )
    );
  } else {
    checks.push(
      makeCheck(
        "diagnostics",
        "Structural diagnostics",
        "pass",
        "No structural errors or warnings detected."
      )
    );
  }

  if (missing > 0) {
    checks.push(
      makeCheck(
        "relationships",
        "Local references",
        "fail",
        `${missing} broken local reference${
          missing === 1
            ? ""
            : "s"
        } detected.${
          safeFixCount > 0
            ? ` ${safeFixCount} high-confidence fix${
                safeFixCount === 1
                  ? " is"
                  : "es are"
              } available.`
            : ""
        }`
      )
    );
  } else {
    checks.push(
      makeCheck(
        "relationships",
        "Local references",
        "pass",
        "No broken local file references detected."
      )
    );
  }

  if (orphaned > 0) {
    checks.push(
      makeCheck(
        "orphans",
        "Unused / orphaned files",
        "warn",
        `${orphaned} possible orphaned file${
          orphaned === 1
            ? ""
            : "s"
        } should be reviewed.`
      )
    );
  } else {
    checks.push(
      makeCheck(
        "orphans",
        "Unused / orphaned files",
        "pass",
        "No possible orphaned files detected."
      )
    );
  }

  if (runtimeRequired) {
    const command =
      previewPlan.runCommand
        ? ` Run ${previewPlan.runCommand} after export.`
        : "";

    checks.push(
      makeCheck(
        "runtime",
        "Preview / runtime",
        "warn",
        `${previewPlan.label || "Framework runtime required"}.${command}`
      )
    );
  } else if (
    previewUnavailable &&
    fileCount > 0
  ) {
    checks.push(
      makeCheck(
        "runtime",
        "Entry / preview",
        "fail",
        previewPlan.description ||
          "No usable application entry point was detected."
      )
    );
  } else {
    checks.push(
      makeCheck(
        "runtime",
        "Preview / runtime",
        "pass",
        previewPlan.label ||
          "Browser-ready project detected."
      )
    );
  }

  if (reviewFixCount > 0) {
    checks.push(
      makeCheck(
        "uncertain-repairs",
        "Suggested repairs",
        "warn",
        `${reviewFixCount} medium/low-confidence repair${
          reviewFixCount === 1
            ? ""
            : "s"
        } require manual review.`
      )
    );
  }

  const blockerCount =
    checks.filter(
      (check) =>
        check.status ===
        "fail"
    ).length;

  const warningCount =
    checks.filter(
      (check) =>
        check.status ===
        "warn"
    ).length;

  let status =
    "ready";

  let label =
    "Ready";

  let headline =
    "Ready to export";

  let summary =
    "Preflight checks passed. The project can be packaged as a ZIP.";

  if (blockerCount > 0) {
    status =
      "blocked";

    label =
      "Blocked";

    headline =
      "Export needs attention";

    summary =
      `${blockerCount} blocking check${
        blockerCount === 1
          ? ""
          : "s"
      } failed. You can review the project before exporting, or export anyway if you intentionally want the current source.`;
  } else if (warningCount > 0) {
    status =
      "review";

    label =
      "Review Required";

    headline =
      "Review before export";

    summary =
      `${warningCount} preflight warning${
        warningCount === 1
          ? ""
          : "s"
      } remain. The project can still be exported.`;
  }

  return {
    status,
    label,
    headline,
    summary,
    checks,
    blockerCount,
    warningCount,
    safeFixCount,
    runtimeRequired,
    canExportCleanly:
      status === "ready",
    requiresConfirmation:
      status !== "ready",
    frameworkLabel:
      framework.stackSummary ||
      framework.label ||
      "Project",
  };
}
