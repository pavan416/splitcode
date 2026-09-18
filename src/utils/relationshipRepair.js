// ==========================================================
// SplitCode V11.5 — Relationship Repair Engine
// src/utils/relationshipRepair.js
// ==========================================================

function normalizePath(path = "") {
  return String(path)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function getDirectory(path = "") {
  const clean = normalizePath(path);
  const index = clean.lastIndexOf("/");
  return index >= 0 ? clean.slice(0, index) : "";
}

function getFileName(path = "") {
  const clean = normalizePath(path);
  return clean.split("/").pop() || "";
}

function splitName(path = "") {
  const name = getFileName(path);
  const dot = name.lastIndexOf(".");

  if (dot <= 0) {
    return {
      name,
      stem: name.toLowerCase(),
      extension: "",
    };
  }

  return {
    name,
    stem: name.slice(0, dot).toLowerCase(),
    extension: name.slice(dot + 1).toLowerCase(),
  };
}

function stripQueryAndHash(value = "") {
  return String(value)
    .split("#")[0]
    .split("?")[0]
    .trim();
}

function resolveRelativePath(sourcePath, reference) {
  const raw = stripQueryAndHash(reference);

  if (!raw) {
    return "";
  }

  if (raw.startsWith("/")) {
    return normalizePath(raw.slice(1));
  }

  const directory = getDirectory(sourcePath);

  const parts = [
    ...directory.split("/"),
    ...raw.split("/"),
  ].filter(Boolean);

  const resolved = [];

  parts.forEach((part) => {
    if (part === "." || part === "") {
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

function commonSuffixSegments(leftPath, rightPath) {
  const left = normalizePath(leftPath)
    .toLowerCase()
    .split("/")
    .filter(Boolean);

  const right = normalizePath(rightPath)
    .toLowerCase()
    .split("/")
    .filter(Boolean);

  let count = 0;

  while (
    count < left.length &&
    count < right.length &&
    left[left.length - 1 - count] ===
      right[right.length - 1 - count]
  ) {
    count += 1;
  }

  return count;
}

function levenshtein(left = "", right = "") {
  const a = String(left).toLowerCase();
  const b = String(right).toLowerCase();

  const matrix = Array.from(
    { length: a.length + 1 },
    () => Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost =
        a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function filenameSimilarity(expectedPath, candidatePath) {
  const expected = splitName(expectedPath);
  const candidate = splitName(candidatePath);

  if (!expected.name || !candidate.name) {
    return 0;
  }

  let score = 0;

  if (
    expected.name.toLowerCase() ===
    candidate.name.toLowerCase()
  ) {
    score += 72;
  } else if (expected.stem === candidate.stem) {
    score += 52;
  } else {
    const maxLength = Math.max(
      expected.stem.length,
      candidate.stem.length
    );

    if (maxLength > 0) {
      const distance = levenshtein(
        expected.stem,
        candidate.stem
      );

      const similarity =
        1 - distance / maxLength;

      if (similarity >= 0.8) {
        score += 38;
      } else if (similarity >= 0.65) {
        score += 22;
      }
    }

    const shorter =
      expected.stem.length <= candidate.stem.length
        ? expected.stem
        : candidate.stem;

    const longer =
      expected.stem.length > candidate.stem.length
        ? expected.stem
        : candidate.stem;

    if (
      shorter.length >= 3 &&
      longer.startsWith(shorter)
    ) {
      score += 28;
    }
  }

  if (
    expected.extension &&
    candidate.extension &&
    expected.extension === candidate.extension
  ) {
    score += 18;
  }

  score += Math.min(
    commonSuffixSegments(
      expectedPath,
      candidatePath
    ) * 8,
    24
  );

  return score;
}

function directorySimilarity(expectedPath, candidatePath) {
  const expectedDir = getDirectory(expectedPath)
    .toLowerCase()
    .split("/")
    .filter(Boolean);

  const candidateDir = getDirectory(candidatePath)
    .toLowerCase()
    .split("/")
    .filter(Boolean);

  if (!expectedDir.length || !candidateDir.length) {
    return 0;
  }

  const candidateSet = new Set(candidateDir);

  const overlap = expectedDir.filter((segment) =>
    candidateSet.has(segment)
  ).length;

  return Math.min(overlap * 5, 15);
}

function scoreCandidate(edge, candidate) {
  const sourcePath = normalizePath(edge.sourcePath);

  const expectedPath = resolveRelativePath(
    sourcePath,
    edge.reference
  );

  const candidatePath = normalizePath(
    candidate.path || candidate.name
  );

  if (
    !candidatePath ||
    candidate.id === edge.sourceId
  ) {
    return 0;
  }

  let score =
    filenameSimilarity(
      expectedPath,
      candidatePath
    ) +
    directorySimilarity(
      expectedPath,
      candidatePath
    );

  const expected = splitName(expectedPath);
  const actual = splitName(candidatePath);

  if (
    expected.extension &&
    actual.extension &&
    expected.extension !== actual.extension
  ) {
    score -= 18;
  }

  return Math.max(
    0,
    Math.min(100, score)
  );
}

function confidenceFromScore(score) {
  if (score >= 84) {
    return "high";
  }

  if (score >= 64) {
    return "medium";
  }

  return "low";
}

function makeRelativeReference(
  sourcePath,
  targetPath,
  originalReference = ""
) {
  const sourceDir = getDirectory(sourcePath);

  const sourceParts = sourceDir
    .split("/")
    .filter(Boolean);

  const targetParts = normalizePath(targetPath)
    .split("/")
    .filter(Boolean);

  let common = 0;

  while (
    common < sourceParts.length &&
    common < targetParts.length &&
    sourceParts[common].toLowerCase() ===
      targetParts[common].toLowerCase()
  ) {
    common += 1;
  }

  const up = Array(
    sourceParts.length - common
  ).fill("..");

  const down = targetParts.slice(common);

  let relative = [...up, ...down].join("/");

  if (!relative) {
    relative = getFileName(targetPath);
  }

  if (String(originalReference).trim().startsWith("/")) {
    return `/${normalizePath(targetPath)}`;
  }

  if (!relative.startsWith(".") && sourceDir) {
    relative = `./${relative}`;
  }

  return relative;
}

function escapeRegex(value = "") {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function replaceQuotedReference(
  content,
  oldReference,
  newReference
) {
  const escaped = escapeRegex(oldReference);

  const pattern = new RegExp(
    `(["'])${escaped}\\1`,
    "g"
  );

  return String(content).replace(
    pattern,
    (full, quote) =>
      `${quote}${newReference}${quote}`
  );
}

function replaceCssReference(
  content,
  oldReference,
  newReference
) {
  const escaped = escapeRegex(oldReference);

  const urlPattern = new RegExp(
    `(url\\(\\s*["']?)${escaped}(["']?\\s*\\))`,
    "gi"
  );

  let updated = String(content).replace(
    urlPattern,
    `$1${newReference}$2`
  );

  const importPattern = new RegExp(
    `(@import\\s+(?:url\\(\\s*)?["'])${escaped}(["'])`,
    "gi"
  );

  updated = updated.replace(
    importPattern,
    `$1${newReference}$2`
  );

  return updated;
}

export function getRelationshipRepair(
  edge,
  files = []
) {
  if (
    !edge ||
    edge.status !== "missing" ||
    !edge.sourcePath ||
    !edge.reference ||
    !Array.isArray(files)
  ) {
    return null;
  }

  const ranked = files
    .map((file) => ({
      file,
      score: scoreCandidate(edge, file),
    }))
    .filter((item) => item.score >= 48)
    .sort(
      (left, right) =>
        right.score - left.score
    );

  if (!ranked.length) {
    return null;
  }

  const best = ranked[0];
  const runnerUp = ranked[1];

  if (
    runnerUp &&
    best.score < 84 &&
    best.score - runnerUp.score < 8
  ) {
    return null;
  }

  const targetPath = normalizePath(
    best.file.path || best.file.name
  );

  return {
    targetFile: best.file,
    targetPath,
    replacement: makeRelativeReference(
      edge.sourcePath,
      targetPath,
      edge.reference
    ),
    score: best.score,
    confidence: confidenceFromScore(
      best.score
    ),
  };
}

export function applyRelationshipRepair(
  edge,
  repair,
  files = []
) {
  if (
    !edge ||
    !repair ||
    !Array.isArray(files)
  ) {
    return {
      files,
      changed: false,
      sourceFile: null,
    };
  }

  const sourceFile = files.find(
    (file) =>
      file.id === edge.sourceId ||
      normalizePath(
        file.path || file.name
      ).toLowerCase() ===
        normalizePath(edge.sourcePath).toLowerCase()
  );

  if (!sourceFile) {
    return {
      files,
      changed: false,
      sourceFile: null,
    };
  }

  const oldReference = edge.reference;
  const newReference = repair.replacement;

  let updatedContent = String(
    sourceFile.content || ""
  );

  if (
    edge.type === "css-url" ||
    edge.type === "css-import"
  ) {
    updatedContent = replaceCssReference(
      updatedContent,
      oldReference,
      newReference
    );
  } else {
    updatedContent = replaceQuotedReference(
      updatedContent,
      oldReference,
      newReference
    );
  }

  if (updatedContent === sourceFile.content) {
    return {
      files,
      changed: false,
      sourceFile,
    };
  }

  const nextFiles = files.map((file) =>
    file.id === sourceFile.id
      ? {
          ...file,
          content: updatedContent,
        }
      : file
  );

  return {
    files: nextFiles,
    changed: true,
    sourceFile: {
      ...sourceFile,
      content: updatedContent,
    },
  };
}
