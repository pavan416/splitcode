// ==========================================================
// SplitCode V5.4
// Project Importer
// ==========================================================

const SUPPORTED_EXTENSIONS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "json",
  "md",
  "txt",
  "svg",
  "xml",
  "yml",
  "yaml",
]);

const IGNORED_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
]);

const IGNORED_FOLDERS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
]);

// ==========================================================
// HELPERS
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

function getFileName(path = "") {
  const normalized = normalizePath(path);

  return normalized.split("/").pop() || "";
}

function getExtension(path = "") {
  const fileName = getFileName(path);

  const index = fileName.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return fileName
    .slice(index + 1)
    .toLowerCase();
}

function languageFromFilename(path = "") {
  const extension = getExtension(path);

  switch (extension) {
    case "html":
    case "htm":
      return "html";

    case "css":
      return "css";

    case "js":
    case "mjs":
    case "cjs":
      return "javascript";

    case "jsx":
      return "jsx";

    case "ts":
      return "typescript";

    case "tsx":
      return "tsx";

    case "json":
      return "json";

    case "md":
      return "markdown";

    case "svg":
      return "xml";

    case "xml":
      return "xml";

    case "yml":
    case "yaml":
      return "yaml";

    default:
      return "text";
  }
}

function createFileId() {
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

// ==========================================================
// IGNORE CHECKS
// ==========================================================

function shouldIgnorePath(path = "") {
  const normalized = normalizePath(path);

  const parts = normalized
    .split("/")
    .filter(Boolean);

  if (!parts.length) {
    return true;
  }

  const fileName = parts[parts.length - 1];

  if (IGNORED_FILES.has(fileName)) {
    return true;
  }

  const folderParts = parts.slice(0, -1);

  return folderParts.some((folder) =>
    IGNORED_FOLDERS.has(folder)
  );
}

function isSupportedFile(path = "") {
  const extension = getExtension(path);

  return SUPPORTED_EXTENSIONS.has(extension);
}

// ==========================================================
// REMOVE COMMON ROOT FOLDER
// ==========================================================

function removeCommonRoot(paths) {
  if (!paths.length) {
    return paths;
  }

  const splitPaths = paths.map((path) =>
    normalizePath(path)
      .split("/")
      .filter(Boolean)
  );

  if (
    splitPaths.some(
      (parts) => parts.length < 2
    )
  ) {
    return paths.map(normalizePath);
  }

  const firstRoot = splitPaths[0][0];

  const sameRoot = splitPaths.every(
    (parts) => parts[0] === firstRoot
  );

  if (!sameRoot) {
    return paths.map(normalizePath);
  }

  return splitPaths.map((parts) =>
    parts.slice(1).join("/")
  );
}

// ==========================================================
// COLLECT FOLDERS
// ==========================================================

function collectFolders(files) {
  const folders = new Set();

  files.forEach((file) => {
    const parts = normalizePath(file.path)
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

  return [...folders];
}

// ==========================================================
// READ FILE
// ==========================================================

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(
        typeof reader.result === "string"
          ? reader.result
          : ""
      );
    };

    reader.onerror = () => {
      reject(
        new Error(
          `Unable to read ${file.name}`
        )
      );
    };

    reader.readAsText(file);
  });
}

// ==========================================================
// IMPORT MULTIPLE FILES
// ==========================================================

export async function importProjectFiles(fileList) {
  const incomingFiles = Array.from(
    fileList || []
  );

  if (!incomingFiles.length) {
    return {
      files: [],
      folders: [],
      ignoredCount: 0,
      unsupportedCount: 0,
      message: "No files selected.",
    };
  }

  const candidates = [];

  let ignoredCount = 0;
  let unsupportedCount = 0;

  incomingFiles.forEach((file) => {
    const originalPath =
      file.webkitRelativePath ||
      file.relativePath ||
      file.name;

    const normalizedPath =
      normalizePath(originalPath);

    if (
      shouldIgnorePath(normalizedPath)
    ) {
      ignoredCount += 1;
      return;
    }

    if (
      !isSupportedFile(normalizedPath)
    ) {
      unsupportedCount += 1;
      return;
    }

    candidates.push({
      file,
      originalPath: normalizedPath,
    });
  });

  if (!candidates.length) {
    return {
      files: [],
      folders: [],
      ignoredCount,
      unsupportedCount,
      message:
        "No supported project files were found.",
    };
  }

  // --------------------------------------------------------
  // REMOVE TOP-LEVEL PROJECT FOLDER
  //
  // Example:
  //
  // my-project/index.html
  // my-project/css/style.css
  //
  // becomes:
  //
  // index.html
  // css/style.css
  // --------------------------------------------------------

  const cleanedPaths = removeCommonRoot(
    candidates.map(
      (item) => item.originalPath
    )
  );

  const projectFiles = [];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const candidate =
      candidates[index];

    const path =
      normalizePath(
        cleanedPaths[index]
      );

    try {
      const content =
        await readTextFile(
          candidate.file
        );

      projectFiles.push({
        id: createFileId(),
        path,
        name: getFileName(path),
        language:
          languageFromFilename(path),
        content,
      });
    } catch (error) {
      console.error(error);

      ignoredCount += 1;
    }
  }

  const folders =
    collectFolders(projectFiles);

  let message =
    `Imported ${projectFiles.length} file${
      projectFiles.length === 1
        ? ""
        : "s"
    }`;

  if (folders.length) {
    message +=
      ` across ${folders.length} folder${
        folders.length === 1
          ? ""
          : "s"
      }`;
  }

  message += ".";

  if (ignoredCount > 0) {
    message +=
      ` Ignored ${ignoredCount} file${
        ignoredCount === 1
          ? ""
          : "s"
      }.`;
  }

  if (unsupportedCount > 0) {
    message +=
      ` Skipped ${unsupportedCount} unsupported file${
        unsupportedCount === 1
          ? ""
          : "s"
      }.`;
  }

  return {
    files: projectFiles,
    folders,
    ignoredCount,
    unsupportedCount,
    message,
  };
}

// ==========================================================
// PUBLIC HELPERS
// ==========================================================

export function getSupportedExtensions() {
  return [
    ...SUPPORTED_EXTENSIONS,
  ];
}

export function getSupportedAcceptString() {
  return [
    ...SUPPORTED_EXTENSIONS,
  ]
    .map(
      (extension) =>
        `.${extension}`
    )
    .join(",");
}