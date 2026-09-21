// ==========================================================
// SplitCode V12.3 — Project Importer
//
// Goals:
// - Import individual files or complete folders.
// - Preserve readable source for React, Angular, Vue, Svelte,
//   Astro, TypeScript and other common web-project files.
// - Support drag-and-drop folders in Chromium/Edge through
//   webkitGetAsEntry().
// - Ignore generated/heavy directories such as node_modules.
// - Never navigate the browser away from SplitCode.
// ==========================================================

const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".angular",
  ".cache",
  ".parcel-cache",
  ".turbo",
  "coverage",
  "out",
]);

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".vue",
  ".svelte",
  ".astro",
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".txt",
  ".svg",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".config",
  ".properties",
  ".graphql",
  ".gql",
  ".prisma",
  ".env",
  ".editorconfig",
  ".gitignore",
  ".gitattributes",
  ".npmrc",
  ".nvmrc",
  ".prettierrc",
  ".eslintrc",
  ".stylelintrc",
  ".babelrc",
  ".browserslistrc",
  ".py",
  ".java",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".bat",
  ".cmd",
  ".sql",
  ".lock",
]);

const TEXT_FILE_NAMES = new Set([
  "dockerfile",
  "makefile",
  "procfile",
  "license",
  "licence",
  "readme",
  "changelog",
  "authors",
  "contributors",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "jsconfig.json",
  "angular.json",
  "vite.config.js",
  "vite.config.ts",
  "webpack.config.js",
  "webpack.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "nuxt.config.js",
  "nuxt.config.ts",
  "svelte.config.js",
  "astro.config.mjs",
  "astro.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "eslint.config.js",
  "eslint.config.mjs",
]);

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function normalizePath(value = "") {
  return String(value)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function getFileName(path = "") {
  return normalizePath(path).split("/").pop() || "";
}

function getExtension(path = "") {
  const name = getFileName(path);
  const index = name.lastIndexOf(".");

  if (index <= 0) {
    return "";
  }

  return name.slice(index).toLowerCase();
}

function languageFromPath(path = "") {
  const lower = path.toLowerCase();

  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".scss") || lower.endsWith(".sass")) return "scss";
  if (lower.endsWith(".less")) return "less";

  if (
    lower.endsWith(".js") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs")
  ) {
    return "javascript";
  }

  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".ts")) return "typescript";

  if (lower.endsWith(".json") || lower.endsWith(".jsonc")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "markdown";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".xml") || lower.endsWith(".svg")) return "xml";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cs")) return "csharp";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".sh") || lower.endsWith(".ps1")) return "shell";

  // Keep framework single-file components readable in Monaco even
  // without installing framework-specific Monaco language packages.
  if (
    lower.endsWith(".vue") ||
    lower.endsWith(".svelte") ||
    lower.endsWith(".astro")
  ) {
    return "html";
  }

  return "text";
}

function isIgnoredPath(path = "") {
  const segments = normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  return segments.some((segment) =>
    IGNORED_DIRECTORY_NAMES.has(segment)
  );
}

function isLikelyTextFile(file, path) {
  const normalized = normalizePath(path);
  const name = getFileName(normalized).toLowerCase();
  const extension = getExtension(normalized);

  if (TEXT_EXTENSIONS.has(extension)) {
    return true;
  }

  if (
    TEXT_FILE_NAMES.has(name) ||
    name.startsWith(".env")
  ) {
    return true;
  }

  const type = String(file?.type || "").toLowerCase();

  if (
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("xml") ||
    type.includes("svg")
  ) {
    return true;
  }

  return false;
}

function collectFolders(paths) {
  const folders = new Set();

  paths.forEach((path) => {
    const parts = normalizePath(path)
      .split("/")
      .filter(Boolean);

    parts.pop();

    let current = "";

    parts.forEach((part) => {
      current = current
        ? `${current}/${part}`
        : part;

      folders.add(current);
    });
  });

  return [...folders].sort((a, b) =>
    a.localeCompare(b)
  );
}

function commonTopLevelDirectory(paths) {
  if (!paths.length) {
    return "";
  }

  const firstSegments =
    paths.map((path) =>
      normalizePath(path).split("/")[0]
    );

  const first =
    firstSegments[0];

  if (
    !first ||
    !firstSegments.every(
      (segment) => segment === first
    )
  ) {
    return "";
  }

  // Only strip a shared root when every item actually has a
  // nested path. This prevents a single selected file from
  // losing its own filename.
  const allNested =
    paths.every((path) =>
      normalizePath(path).includes("/")
    );

  return allNested ? first : "";
}

function stripSharedRoot(items) {
  const root =
    commonTopLevelDirectory(
      items.map((item) => item.path)
    );

  if (!root) {
    return items;
  }

  const prefix =
    `${root}/`;

  return items.map((item) => ({
    ...item,
    path:
      item.path.startsWith(prefix)
        ? item.path.slice(prefix.length)
        : item.path,
  }));
}

function uniquePath(path, usedPaths) {
  const normalized = normalizePath(path);

  if (!usedPaths.has(normalized.toLowerCase())) {
    usedPaths.add(normalized.toLowerCase());
    return normalized;
  }

  const slashIndex =
    normalized.lastIndexOf("/");

  const directory =
    slashIndex >= 0
      ? normalized.slice(0, slashIndex)
      : "";

  const fileName =
    slashIndex >= 0
      ? normalized.slice(slashIndex + 1)
      : normalized;

  const dotIndex =
    fileName.lastIndexOf(".");

  const base =
    dotIndex > 0
      ? fileName.slice(0, dotIndex)
      : fileName;

  const extension =
    dotIndex > 0
      ? fileName.slice(dotIndex)
      : "";

  let index = 2;

  while (true) {
    const candidateName =
      `${base}-${index}${extension}`;

    const candidate =
      directory
        ? `${directory}/${candidateName}`
        : candidateName;

    if (!usedPaths.has(candidate.toLowerCase())) {
      usedPaths.add(candidate.toLowerCase());
      return candidate;
    }

    index += 1;
  }
}

async function readTextProjectItem(item) {
  const file =
    item.file;

  const path =
    normalizePath(
      item.path ||
      file?.webkitRelativePath ||
      file?.name ||
      ""
    );

  if (
    !file ||
    !path ||
    isIgnoredPath(path)
  ) {
    return {
      skipped: true,
      reason: "ignored",
      path,
    };
  }

  if (
    Number.isFinite(file.size) &&
    file.size > MAX_TEXT_FILE_BYTES
  ) {
    return {
      skipped: true,
      reason: "too-large",
      path,
    };
  }

  if (!isLikelyTextFile(file, path)) {
    return {
      skipped: true,
      reason: "binary-or-unsupported",
      path,
    };
  }

  try {
    const content =
      await file.text();

    return {
      skipped: false,
      path,
      file: {
        id: createId(),
        path,
        name: getFileName(path),
        language:
          languageFromPath(path),
        content,
      },
    };
  } catch {
    return {
      skipped: true,
      reason: "unreadable",
      path,
    };
  }
}

function normalizeInputItems(fileList) {
  return Array.from(fileList || []).map((file) => ({
    file,
    path:
      file.webkitRelativePath ||
      file.name,
  }));
}

async function buildImportResult(rawItems) {
  const normalizedItems =
    stripSharedRoot(
      rawItems
        .map((item) => ({
          file: item.file,
          path: normalizePath(item.path),
        }))
        .filter((item) => item.file && item.path)
    );

  const readResults =
    await Promise.all(
      normalizedItems.map(
        readTextProjectItem
      )
    );

  const usedPaths =
    new Set();

  const files = [];

  const skipped = [];

  readResults.forEach((result) => {
    if (result.skipped) {
      if (result.path) {
        skipped.push(result);
      }
      return;
    }

    const path =
      uniquePath(
        result.file.path,
        usedPaths
      );

    files.push({
      ...result.file,
      path,
      name:
        getFileName(path),
    });
  });

  files.sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  const folders =
    collectFolders(
      files.map((file) => file.path)
    );

  const skippedCount =
    skipped.length;

  let message;

  if (!files.length) {
    message =
      skippedCount
        ? `No readable source files were imported. ${skippedCount} generated, binary, unsupported or oversized file${skippedCount === 1 ? "" : "s"} were skipped.`
        : "No readable source files were found.";
  } else {
    message =
      `Imported ${files.length} readable file${files.length === 1 ? "" : "s"}` +
      (folders.length
        ? ` across ${folders.length} folder${folders.length === 1 ? "" : "s"}`
        : "") +
      (skippedCount
        ? `. Skipped ${skippedCount} generated, binary, unsupported or oversized file${skippedCount === 1 ? "" : "s"}.`
        : ".");
  }

  return {
    files,
    folders,
    skipped,
    skippedCount,
    message,
  };
}

// ----------------------------------------------------------
// Folder drag/drop helpers
// ----------------------------------------------------------

function readEntryFile(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

async function readAllDirectoryEntries(directoryEntry) {
  const reader =
    directoryEntry.createReader();

  const entries = [];

  while (true) {
    const batch =
      await readDirectoryEntries(
        reader
      );

    if (!batch.length) {
      break;
    }

    entries.push(...batch);
  }

  return entries;
}

async function walkEntry(entry, parentPath = "") {
  const path =
    normalizePath(
      parentPath
        ? `${parentPath}/${entry.name}`
        : entry.name
    );

  if (
    entry.isDirectory
  ) {
    if (
      IGNORED_DIRECTORY_NAMES.has(
        entry.name.toLowerCase()
      )
    ) {
      return [];
    }

    const children =
      await readAllDirectoryEntries(
        entry
      );

    const nested =
      await Promise.all(
        children.map((child) =>
          walkEntry(
            child,
            path
          )
        )
      );

    return nested.flat();
  }

  if (
    entry.isFile
  ) {
    const file =
      await readEntryFile(
        entry
      );

    return [{
      file,
      path,
    }];
  }

  return [];
}

async function dataTransferToItems(dataTransfer) {
  const items =
    Array.from(
      dataTransfer?.items || []
    );

  const entries =
    items
      .map((item) =>
        typeof item.webkitGetAsEntry === "function"
          ? item.webkitGetAsEntry()
          : null
      )
      .filter(Boolean);

  if (entries.length) {
    const nested =
      await Promise.all(
        entries.map((entry) =>
          walkEntry(entry)
        )
      );

    const walked =
      nested.flat();

    if (walked.length) {
      return walked;
    }
  }

  return normalizeInputItems(
    dataTransfer?.files
  );
}

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

export function getSupportedAcceptString() {
  return [
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".js",
    ".mjs",
    ".cjs",
    ".jsx",
    ".ts",
    ".tsx",
    ".vue",
    ".svelte",
    ".astro",
    ".json",
    ".jsonc",
    ".md",
    ".mdx",
    ".txt",
    ".svg",
    ".xml",
    ".yaml",
    ".yml",
    ".toml",
    ".graphql",
    ".gql",
    ".prisma",
    ".py",
    ".java",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".sh",
    ".ps1",
    ".sql",
  ].join(",");
}

export async function importProjectFiles(fileList) {
  return buildImportResult(
    normalizeInputItems(
      fileList
    )
  );
}

export async function importDroppedProject(dataTransfer) {
  const items =
    await dataTransferToItems(
      dataTransfer
    );

  return buildImportResult(
    items
  );
}
