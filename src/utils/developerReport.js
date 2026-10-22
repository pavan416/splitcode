// Human-readable, offline report that can be pasted into an issue tracker.
// Do not claim code was compiled or linted: these are structural checks only.
export function generateDeveloperReport({ files = [], diagnostics = {}, framework = {}, previewPlan = {}, relationships = {} } = {}) {
  const issues = diagnostics.issues || [];
  const lines = [
    'SplitCode — Project checks',
    `Files: ${files.length}`,
    `Detected stack: ${framework.stackSummary || framework.label || 'Unknown'}`,
    `Preview: ${previewPlan.label || 'Not checked'}`,
    `HTML entry: ${previewPlan.entryPath || 'None detected'}`,
    `Problems: ${diagnostics.errors || 0} errors, ${diagnostics.warnings || 0} warnings`,
    `Missing references: ${relationships.missingCount || 0}`,
    '',
    'Structural findings:',
    ...(!issues.length ? ['None detected. This is not a full lint/build/security audit.'] : issues.map(issue =>
      `- [${issue.severity.toUpperCase()}] ${issue.file || 'Project'}${issue.line ? `:${issue.line}` : ''}: ${issue.message}${issue.reference ? ` (${issue.reference})` : ''}`
    )),
    '',
    'Checked locally by SplitCode. Confirm runtime, browser behavior and build separately.',
  ];
  return lines.join('\n');
}
