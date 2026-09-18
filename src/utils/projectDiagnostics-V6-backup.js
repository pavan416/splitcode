// ==========================================================
// SplitCode V6
// Project Diagnostics Engine
// ==========================================================

function normalizePath(path = "") {
  return String(path)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function getDirectory(path = "") {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");

  if (index === -1) {
    return "";
  }

  return normalized.slice(0, index);
}

function resolvePath(baseFilePath, reference) {
  if (!reference) {
    return "";
  }

  const cleanReference = reference
    .split("#")[0]
    .split("?")[0];

  if (cleanReference.startsWith("/")) {
    return normalizePath(cleanReference.slice(1));
  }

  const baseDirectory = getDirectory(baseFilePath);

  const parts = [
    ...baseDirectory.split("/"),
    ...cleanReference.split("/"),
  ].filter(Boolean);

  const resolved = [];

  parts.forEach((part) => {
    if (part === ".") {
      return;
    }

    if (part === "..") {
      resolved.pop();
      return;
    }

    resolved.push(part);
  });

  return resolved.join("/");
}

function isExternalReference(reference = "") {
  const value = reference.trim();

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("data:") ||
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:")
  );
}

function createIssue({
  type,
  severity = "warning",
  file = "",
  reference = "",
  message = "",
}) {
  return {
    id: `${type}-${file}-${reference}-${Math.random()
      .toString(36)
      .slice(2)}`,
    type,
    severity,
    file,
    reference,
    message,
  };
}

// ==========================================================
// HTML REFERENCES
// ==========================================================

function scanHTMLFile(file, fileMap) {
  const issues = [];

  const pattern =
    /\b(?:src|href)=["']([^"']+)["']/gi;

  let match;

  while (
    (match = pattern.exec(file.content)) !== null
  ) {
    const reference = match[1];

    if (
      !reference ||
      isExternalReference(reference)
    ) {
      continue;
    }

    const resolved = resolvePath(
      file.path,
      reference
    );

    if (!fileMap.has(resolved)) {
      issues.push(
        createIssue({
          type: "missing-reference",
          severity: "error",
          file: file.path,
          reference,
          message: `Missing local file: ${reference}`,
        })
      );
    }
  }

  return issues;
}

// ==========================================================
// CSS URL REFERENCES
// ==========================================================

function scanCSSFile(file, fileMap) {
  const issues = [];

  const pattern =
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

  let match;

  while (
    (match = pattern.exec(file.content)) !== null
  ) {
    const reference = match[1];

    if (
      !reference ||
      isExternalReference(reference)
    ) {
      continue;
    }

    const resolved = resolvePath(
      file.path,
      reference
    );

    if (!fileMap.has(resolved)) {
      issues.push(
        createIssue({
          type: "missing-asset",
          severity: "error",
          file: file.path,
          reference,
          message: `Missing CSS asset: ${reference}`,
        })
      );
    }
  }

  return issues;
}

// ==========================================================
// JS / TS IMPORT REFERENCES
// ==========================================================

function scanScriptFile(file, fileMap) {
  const issues = [];

  const references = [];

  const importPattern =
    /import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

  const requirePattern =
    /require\s*\(\s*["']([^"']+)["']\s*\)/g;

  const dynamicImportPattern =
    /import\s*\(\s*["']([^"']+)["']\s*\)/g;

  let match;

  while (
    (match = importPattern.exec(file.content)) !== null
  ) {
    references.push(match[1]);
  }

  while (
    (match = requirePattern.exec(file.content)) !== null
  ) {
    references.push(match[1]);
  }

  while (
    (match =
      dynamicImportPattern.exec(file.content)) !== null
  ) {
    references.push(match[1]);
  }

  references.forEach((reference) => {
    if (
      !reference ||
      isExternalReference(reference)
    ) {
      return;
    }

    // Package import:
    // react
    // jszip
    // @monaco-editor/react
    if (
      !reference.startsWith(".") &&
      !reference.startsWith("/")
    ) {
      return;
    }

    const resolved = resolvePath(
      file.path,
      reference
    );

    const possiblePaths = [
      resolved,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.json`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
    ];

    const found = possiblePaths.some(
      (path) => fileMap.has(path)
    );

    if (!found) {
      issues.push(
        createIssue({
          type: "missing-import",
          severity: "error",
          file: file.path,
          reference,
          message: `Missing imported file: ${reference}`,
        })
      );
    }
  });

  return issues;
}

// ==========================================================
// MAIN DIAGNOSTIC ENGINE
// ==========================================================

export function diagnoseProject(files = []) {
  const issues = [];

  if (!files.length) {
    return {
      issues: [],
      errors: 0,
      warnings: 0,
      filesScanned: 0,
      hasIndexHTML: false,
    };
  }

  const fileMap = new Map();

  files.forEach((file) => {
    fileMap.set(
      normalizePath(file.path),
      file
    );
  });

  // --------------------------------------------------------
  // DUPLICATE PATHS
  // --------------------------------------------------------

  const seenPaths = new Set();

  files.forEach((file) => {
    const path =
      normalizePath(file.path).toLowerCase();

    if (seenPaths.has(path)) {
      issues.push(
        createIssue({
          type: "duplicate-path",
          severity: "error",
          file: file.path,
          message: `Duplicate project path: ${file.path}`,
        })
      );
    }

    seenPaths.add(path);
  });

  // --------------------------------------------------------
  // EMPTY FILES
  // --------------------------------------------------------

  files.forEach((file) => {
    if (!file.content.trim()) {
      issues.push(
        createIssue({
          type: "empty-file",
          severity: "warning",
          file: file.path,
          message: "This file is empty.",
        })
      );
    }
  });

  // --------------------------------------------------------
  // INDEX.HTML
  // --------------------------------------------------------

  const hasIndexHTML = files.some((file) => {
    const path =
      normalizePath(file.path).toLowerCase();

    return (
      path === "index.html" ||
      path.endsWith("/index.html")
    );
  });

  if (!hasIndexHTML) {
    issues.push(
      createIssue({
        type: "missing-index",
        severity: "warning",
        message:
          "No index.html file was found in this project.",
      })
    );
  }

  // --------------------------------------------------------
  // FILE-BY-FILE SCAN
  // --------------------------------------------------------

  files.forEach((file) => {
    const language =
      String(file.language || "").toLowerCase();

    if (language === "html") {
      issues.push(
        ...scanHTMLFile(
          file,
          fileMap
        )
      );
    }

    if (language === "css") {
      issues.push(
        ...scanCSSFile(
          file,
          fileMap
        )
      );
    }

    if (
      [
        "javascript",
        "jsx",
        "typescript",
        "tsx",
      ].includes(language)
    ) {
      issues.push(
        ...scanScriptFile(
          file,
          fileMap
        )
      );
    }
  });

  const errors = issues.filter(
    (issue) =>
      issue.severity === "error"
  ).length;

  const warnings = issues.filter(
    (issue) =>
      issue.severity === "warning"
  ).length;

  return {
    issues,
    errors,
    warnings,
    filesScanned: files.length,
    hasIndexHTML,
  };
}