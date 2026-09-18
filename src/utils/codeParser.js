// SplitCode V11.1 SAFE — Smart Project Detection
// Drop-in replacement for src/utils/codeParser.js

const LANGUAGE_BY_EXTENSION = {
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  svg: "svg",
  xml: "xml",
  py: "python",
  sh: "shell",
  ps1: "powershell",
  yaml: "yaml",
  yml: "yaml",
};

const LANGUAGE_ALIASES = {
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  react: "jsx",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  text: "text",
  plaintext: "text",
  svg: "svg",
  xml: "xml",
  py: "python",
  python: "python",
  sh: "shell",
  bash: "shell",
  shell: "shell",
  ps1: "powershell",
  powershell: "powershell",
  yaml: "yaml",
  yml: "yaml",
};

const DEFAULT_NAMES = {
  html: "index.html",
  css: "style.css",
  scss: "style.scss",
  javascript: "script.js",
  jsx: "App.jsx",
  typescript: "index.ts",
  tsx: "App.tsx",
  json: "data.json",
  markdown: "README.md",
  text: "notes.txt",
  svg: "image.svg",
  xml: "data.xml",
  python: "main.py",
  shell: "script.sh",
  powershell: "script.ps1",
  yaml: "config.yaml",
};

function createId() {
  return `file-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function normalizePath(path = "") {
  return String(path)
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function fileNameFromPath(path = "") {
  const clean = normalizePath(path);
  return clean.split("/").pop() || "";
}

function extensionFromPath(path = "") {
  const name = fileNameFromPath(path);
  const index = name.lastIndexOf(".");

  if (index <= 0) {
    return "";
  }

  return name.slice(index + 1).toLowerCase();
}

function languageFromPath(path = "") {
  return LANGUAGE_BY_EXTENSION[extensionFromPath(path)] || "text";
}

function normalizeLanguage(language = "") {
  const key = String(language).trim().toLowerCase();
  return LANGUAGE_ALIASES[key] || key || "text";
}

function looksLikeFilePath(value = "") {
  const clean = normalizePath(value);

  if (!clean || clean.includes("://")) {
    return false;
  }

  return /\.(html?|css|scss|sass|m?js|cjs|jsx|tsx?|json|md|markdown|txt|svg|xml|py|sh|ps1|ya?ml)$/i.test(
    clean
  );
}

function cleanPossiblePath(value = "") {
  return normalizePath(
    String(value)
      .trim()
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .replace(/^__(.+)__$/, "$1")
      .replace(/^`(.+)`$/, "$1")
      .replace(/^(?:file(?:name)?|path)\s*[:=-]\s*/i, "")
      .replace(/[,:;]+$/, "")
      .trim()
  );
}

function extractPathFromFenceInfo(info = "") {
  const text = String(info).trim();

  const patterns = [
    /\b(?:filename|file|path)\s*=\s*"([^"]+)"/i,
    /\b(?:filename|file|path)\s*=\s*'([^']+)'/i,
    /\b(?:filename|file|path)\s*=\s*([^\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const candidate = cleanPossiblePath(match[1]);

      if (looksLikeFilePath(candidate)) {
        return candidate;
      }
    }
  }

  const tokens = text.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const candidate = cleanPossiblePath(token);

    if (looksLikeFilePath(candidate)) {
      return candidate;
    }
  }

  return "";
}

function extractLanguageFromFenceInfo(info = "") {
  const first = String(info).trim().split(/\s+/)[0] || "";

  if (!first) {
    return "";
  }

  if (looksLikeFilePath(first)) {
    return languageFromPath(first);
  }

  return normalizeLanguage(first);
}

function extractNearbyPath(source, index) {
  const before = source
    .slice(Math.max(0, index - 350), index)
    .split(/\r?\n/)
    .slice(-5);

  for (let i = before.length - 1; i >= 0; i -= 1) {
    const line = before[i].trim();

    if (!line) {
      continue;
    }

    const candidate = cleanPossiblePath(line);

    if (looksLikeFilePath(candidate)) {
      return candidate;
    }

    if (line.length > 100 || /[.!?]$/.test(line)) {
      break;
    }
  }

  return "";
}

function detectLanguage(content = "") {
  const source = String(content).trim();

  if (!source) {
    return "text";
  }

  if (
    /<!doctype\s+html/i.test(source) ||
    /<html[\s>]/i.test(source)
  ) {
    return "html";
  }

  if (/^<svg[\s>]/i.test(source)) {
    return "svg";
  }

  if (
    /(?:import|export)\s+.+from\s+["']/m.test(source) &&
    /<[A-Z][A-Za-z0-9]*(?:\s|>|\/>)/.test(source)
  ) {
    return "jsx";
  }

  if (
    /\b(?:interface|type)\s+[A-Z]\w*/.test(source) ||
    /:\s*(?:string|number|boolean|unknown|any)\b/.test(source)
  ) {
    return "typescript";
  }

  if (
    /\b(?:const|let|var|function)\b/.test(source) ||
    /document\.|window\.|addEventListener\s*\(/.test(source)
  ) {
    return "javascript";
  }

  try {
    JSON.parse(source);
    return "json";
  } catch {
    // Continue detection.
  }

  if (
    /(?:^|\n)\s*(?:@media|:root|[.#][\w-]+\s*\{|\w+\s*\{)/m.test(source) &&
    /:\s*[^;\n]+;/m.test(source)
  ) {
    return "css";
  }

  if (
    /(?:^|\n)#{1,6}\s+\S/.test(source) ||
    /(?:^|\n)[-*+]\s+\S/.test(source)
  ) {
    return "markdown";
  }

  return "text";
}

function uniquePath(requested, used) {
  const clean = normalizePath(requested);

  if (!clean) {
    return "";
  }

  const key = clean.toLowerCase();

  if (!used.has(key)) {
    used.add(key);
    return clean;
  }

  const slash = clean.lastIndexOf("/");
  const directory = slash >= 0 ? clean.slice(0, slash) : "";
  const name = slash >= 0 ? clean.slice(slash + 1) : clean;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  let number = 2;

  while (true) {
    const nextName = `${base}-${number}${extension}`;
    const nextPath = directory ? `${directory}/${nextName}` : nextName;
    const nextKey = nextPath.toLowerCase();

    if (!used.has(nextKey)) {
      used.add(nextKey);
      return nextPath;
    }

    number += 1;
  }
}

function inferredName(language, counts) {
  const normalized = normalizeLanguage(language);
  const base = DEFAULT_NAMES[normalized] || "file.txt";
  const count = (counts[normalized] || 0) + 1;
  counts[normalized] = count;

  if (count === 1) {
    return base;
  }

  const dot = base.lastIndexOf(".");

  if (dot <= 0) {
    return `${base}-${count}`;
  }

  return `${base.slice(0, dot)}-${count}${base.slice(dot)}`;
}

function makeFile(path, language, content) {
  const normalizedPath = normalizePath(path);
  const pathLanguage = languageFromPath(normalizedPath);

  return {
    id: createId(),
    path: normalizedPath,
    name: fileNameFromPath(normalizedPath),
    language:
      pathLanguage !== "text"
        ? pathLanguage
        : normalizeLanguage(language),
    content: String(content ?? "").trimEnd(),
  };
}

function parseFencedBlocks(source) {
  const files = [];
  const used = new Set();
  const counts = {};
  const fenceRegex = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;
  let match;

  while ((match = fenceRegex.exec(source)) !== null) {
    const info = match[1] || "";
    const content = match[2] || "";

    let path =
      extractPathFromFenceInfo(info) ||
      extractNearbyPath(source, match.index);

    let language = extractLanguageFromFenceInfo(info);

    if (!language || language === "text") {
      language = path ? languageFromPath(path) : detectLanguage(content);
    }

    if (!path) {
      path = inferredName(language, counts);
    }

    path = uniquePath(path, used);

    files.push(makeFile(path, language, content));
  }

  return files;
}

function parseNamedSections(source) {
  const lines = String(source).split(/\r?\n/);
  const headers = [];

  lines.forEach((line, index) => {
    const candidate = cleanPossiblePath(line);

    if (
      line.trim().length <= 160 &&
      looksLikeFilePath(candidate)
    ) {
      headers.push({
        lineIndex: index,
        path: candidate,
      });
    }
  });

  if (!headers.length) {
    return [];
  }

  const files = [];
  const used = new Set();

  headers.forEach((header, index) => {
    const next = headers[index + 1];
    const content = lines
      .slice(
        header.lineIndex + 1,
        next ? next.lineIndex : lines.length
      )
      .join("\n")
      .trim();

    if (!content) {
      return;
    }

    const path = uniquePath(header.path, used);

    files.push(
      makeFile(
        path,
        languageFromPath(path),
        content
      )
    );
  });

  return files;
}

export function parseProject(input = "") {
  const source = String(input ?? "").trim();

  if (!source) {
    return {
      files: [],
      message: "Paste AI-generated code or import a project first.",
    };
  }

  let files = parseFencedBlocks(source);
  let mode = "AI code blocks";

  if (!files.length) {
    files = parseNamedSections(source);
    mode = "named file sections";
  }

  if (!files.length) {
    const language = detectLanguage(source);

    if (language !== "text") {
      const path = inferredName(language, {});
      files = [makeFile(path, language, source)];
      mode = "source code";
    }
  }

  if (!files.length) {
    return {
      files: [],
      message:
        "No project files were detected. Add filenames or fenced code blocks and try again.",
    };
  }

  return {
    files,
    message: `Detected ${files.length} ${
      files.length === 1 ? "file" : "files"
    } from ${mode}.`,
  };
}

export function findMainHTMLFile(files = []) {
  if (!Array.isArray(files)) {
    return null;
  }

  const htmlFiles = files.filter((file) => {
    const path = normalizePath(file?.path || file?.name || "");

    return (
      file?.language === "html" ||
      /\.html?$/i.test(path)
    );
  });

  if (!htmlFiles.length) {
    return null;
  }

  return (
    htmlFiles.find(
      (file) =>
        normalizePath(file.path || file.name).toLowerCase() ===
        "index.html"
    ) ||
    htmlFiles.find(
      (file) =>
        fileNameFromPath(file.path || file.name).toLowerCase() ===
        "index.html"
    ) ||
    htmlFiles[0]
  );
}

export function updateProjectFile(
  files = [],
  fileId,
  content
) {
  if (!Array.isArray(files)) {
    return [];
  }

  return files.map((file) =>
    file.id === fileId
      ? {
          ...file,
          content: String(content ?? ""),
        }
      : file
  );
}
