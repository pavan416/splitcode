// ==========================================================
// SplitCode V8
// Advanced Project Repair Engine
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
  const normalized =
    normalizePath(path);

  return (
    normalized
      .split("/")
      .pop() || ""
  );
}

function getDirectory(path = "") {
  const normalized =
    normalizePath(path);

  const index =
    normalized.lastIndexOf("/");

  if (index === -1) {
    return "";
  }

  return normalized.slice(
    0,
    index
  );
}

function removeExtension(fileName = "") {
  const index =
    fileName.lastIndexOf(".");

  if (index <= 0) {
    return fileName;
  }

  return fileName.slice(
    0,
    index
  );
}

function resolvePath(
  baseFilePath,
  reference
) {
  if (!reference) {
    return "";
  }

  const cleanReference =
    reference
      .split("#")[0]
      .split("?")[0];

  if (
    cleanReference.startsWith("/")
  ) {
    return normalizePath(
      cleanReference.slice(1)
    );
  }

  const baseDirectory =
    getDirectory(
      baseFilePath
    );

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

function relativePath(
  fromFilePath,
  toFilePath
) {
  const fromDirectory =
    getDirectory(
      fromFilePath
    );

  const fromParts =
    fromDirectory
      .split("/")
      .filter(Boolean);

  const toParts =
    normalizePath(
      toFilePath
    )
      .split("/")
      .filter(Boolean);

  let common = 0;

  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] ===
      toParts[common]
  ) {
    common += 1;
  }

  const upParts =
    fromParts
      .slice(common)
      .map(() => "..");

  const downParts =
    toParts.slice(common);

  let result = [
    ...upParts,
    ...downParts,
  ].join("/");

  if (!result) {
    result = "./";
  }

  return result;
}

// ==========================================================
// SCORING
// ==========================================================

function scoreCandidate(
  issue,
  candidate
) {
  if (
    !issue?.reference ||
    !candidate?.path
  ) {
    return 0;
  }

  const reference =
    issue.reference
      .split("?")[0]
      .split("#")[0];

  const expectedPath =
    resolvePath(
      issue.file || "",
      reference
    );

  const expectedName =
    getFileName(
      expectedPath
    ).toLowerCase();

  const candidateName =
    getFileName(
      candidate.path
    ).toLowerCase();

  const expectedBase =
    removeExtension(
      expectedName
    ).toLowerCase();

  const candidateBase =
    removeExtension(
      candidateName
    ).toLowerCase();

  let score = 0;

  // Exact filename match.
  if (
    candidateName ===
    expectedName
  ) {
    score += 70;
  }

  // Same base name.
  if (
    candidateBase ===
      expectedBase &&
    candidateName !==
      expectedName
  ) {
    score += 45;
  }

  // Partial filename similarity.
  if (
    expectedBase &&
    candidateBase &&
    (
      candidateBase.includes(
        expectedBase
      ) ||
      expectedBase.includes(
        candidateBase
      )
    )
  ) {
    score += 20;
  }

  // Same extension.
  const expectedExtension =
    expectedName.includes(".")
      ? expectedName
          .split(".")
          .pop()
      : "";

  const candidateExtension =
    candidateName.includes(".")
      ? candidateName
          .split(".")
          .pop()
      : "";

  if (
    expectedExtension &&
    expectedExtension ===
      candidateExtension
  ) {
    score += 15;
  }

  // Directory similarity.
  const expectedDirectory =
    getDirectory(
      expectedPath
    ).toLowerCase();

  const candidateDirectory =
    getDirectory(
      candidate.path
    ).toLowerCase();

  if (
    expectedDirectory &&
    candidateDirectory ===
      expectedDirectory
  ) {
    score += 20;
  }

  return score;
}

// ==========================================================
// FIND REPAIR CANDIDATES
// ==========================================================

export function findRepairCandidates(
  issue,
  files = []
) {
  if (
    !issue ||
    !issue.reference ||
    !issue.file
  ) {
    return [];
  }

  if (
    ![
      "missing-reference",
      "missing-asset",
      "missing-import",
    ].includes(issue.type)
  ) {
    return [];
  }

  const candidates =
    files
      .filter(
        (file) =>
          file.path !==
          issue.file
      )
      .map((file) => ({
        file,
        score:
          scoreCandidate(
            issue,
            file
          ),
      }))
      .filter(
        (candidate) =>
          candidate.score >= 40
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );

  return candidates.slice(
    0,
    3
  );
}

// ==========================================================
// BEST REPAIR
// ==========================================================

export function getBestRepair(
  issue,
  files = []
) {
  const candidates =
    findRepairCandidates(
      issue,
      files
    );

  if (!candidates.length) {
    return null;
  }

  const best =
    candidates[0];

  let confidence = "low";

  if (best.score >= 85) {
    confidence = "high";
  } else if (
    best.score >= 60
  ) {
    confidence = "medium";
  }

  return {
    targetFile:
      best.file,

    score:
      best.score,

    confidence,

    replacement:
      relativePath(
        issue.file,
        best.file.path
      ),
  };
}