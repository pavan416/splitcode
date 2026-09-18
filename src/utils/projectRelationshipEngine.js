// ==========================================================
// SplitCode V11.4 — Project Relationship Engine
// src/utils/projectRelationshipEngine.js
//
// Builds a file-to-file relationship graph for:
// - HTML href/src references
// - CSS @import and url(...)
// - JS/JSX/TS/TSX import/export/require/dynamic import
//
// It reports resolved links, missing local references,
// external references, inbound/outbound counts and orphaned files.
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
  return normalizePath(path).toLowerCase();
}

function getDirectory(path = "") {
  const clean = normalizePath(path);
  const index = clean.lastIndexOf("/");

  return index >= 0
    ? clean.slice(0, index)
    : "";
}

function stripQueryAndHash(value = "") {
  return String(value)
    .split("#")[0]
    .split("?")[0]
    .trim();
}

function isExternalReference(reference = "") {
  const value = String(reference).trim();

  return (
    !value ||
    /^https?:\/\//i.test(value) ||
    /^\/\//.test(value) ||
    /^data:/i.test(value) ||
    /^mailto:/i.test(value) ||
    /^tel:/i.test(value) ||
    /^javascript:/i.test(value) ||
    /^blob:/i.test(value) ||
    /^#/.test(value)
  );
}

function isPackageImport(reference = "") {
  const value = String(reference).trim();

  return (
    value &&
    !value.startsWith(".") &&
    !value.startsWith("/") &&
    !value.startsWith("#")
  );
}

function resolveRelativePath(
  sourcePath,
  reference
) {
  const raw =
    stripQueryAndHash(reference);

  if (!raw) {
    return "";
  }

  if (raw.startsWith("/")) {
    return normalizePath(
      raw.slice(1)
    );
  }

  const directory =
    getDirectory(sourcePath);

  const parts = [
    ...directory.split("/"),
    ...raw.split("/"),
  ].filter(Boolean);

  const resolved = [];

  parts.forEach((part) => {
    if (
      part === "." ||
      part === ""
    ) {
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

function getLineNumber(
  content,
  index
) {
  if (
    typeof index !== "number" ||
    index < 0
  ) {
    return 1;
  }

  return (
    String(content)
      .slice(0, index)
      .split("\n").length
  );
}

function addReference(
  references,
  {
    type,
    reference,
    index,
    content,
  }
) {
  const value =
    String(reference || "").trim();

  if (!value) {
    return;
  }

  references.push({
    type,
    reference: value,
    line: getLineNumber(
      content,
      index
    ),
  });
}

function extractHtmlReferences(
  content
) {
  const references = [];
  const source = String(content || "");

  const attributePattern =
    /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

  let match;

  while (
    (match =
      attributePattern.exec(
        source
      )) !== null
  ) {
    addReference(
      references,
      {
        type: "html",
        reference: match[1],
        index: match.index,
        content: source,
      }
    );
  }

  return references;
}

function extractCssReferences(
  content
) {
  const references = [];
  const source = String(content || "");

  const importPattern =
    /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/gi;

  const urlPattern =
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

  let match;

  while (
    (match =
      importPattern.exec(
        source
      )) !== null
  ) {
    addReference(
      references,
      {
        type: "css-import",
        reference: match[1],
        index: match.index,
        content: source,
      }
    );
  }

  while (
    (match =
      urlPattern.exec(
        source
      )) !== null
  ) {
    addReference(
      references,
      {
        type: "css-url",
        reference: match[1],
        index: match.index,
        content: source,
      }
    );
  }

  return references;
}

function extractJsReferences(
  content
) {
  const references = [];
  const source = String(content || "");

  const patterns = [
    {
      type: "js-import",
      regex:
        /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    },
    {
      type: "js-dynamic-import",
      regex:
        /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    },
    {
      type: "js-export",
      regex:
        /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g,
    },
    {
      type: "js-require",
      regex:
        /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    },
  ];

  patterns.forEach(
    ({ type, regex }) => {
      let match;

      while (
        (match =
          regex.exec(
            source
          )) !== null
      ) {
        addReference(
          references,
          {
            type,
            reference: match[1],
            index: match.index,
            content: source,
          }
        );
      }
    }
  );

  return references;
}

function getFileReferences(file) {
  const path =
    file.path ||
    file.name ||
    "";

  const language =
    String(
      file.language || ""
    ).toLowerCase();

  const extension =
    path
      .split(".")
      .pop()
      ?.toLowerCase() || "";

  if (
    language === "html" ||
    ["html", "htm"].includes(
      extension
    )
  ) {
    return extractHtmlReferences(
      file.content
    );
  }

  if (
    ["css", "scss", "sass"].includes(
      language
    ) ||
    ["css", "scss", "sass"].includes(
      extension
    )
  ) {
    return extractCssReferences(
      file.content
    );
  }

  if (
    [
      "javascript",
      "jsx",
      "typescript",
      "tsx",
    ].includes(language) ||
    [
      "js",
      "mjs",
      "cjs",
      "jsx",
      "ts",
      "tsx",
    ].includes(extension)
  ) {
    return extractJsReferences(
      file.content
    );
  }

  return [];
}

function candidatePaths(
  resolvedPath
) {
  const path =
    normalizePath(
      resolvedPath
    );

  if (!path) {
    return [];
  }

  const extensionMatch =
    /\.[a-z0-9]+$/i.test(
      path
    );

  const candidates = [
    path,
  ];

  if (!extensionMatch) {
    [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".json",
      ".css",
      ".scss",
      ".html",
    ].forEach((extension) => {
      candidates.push(
        `${path}${extension}`
      );
    });

    [
      "index.js",
      "index.jsx",
      "index.ts",
      "index.tsx",
      "index.html",
    ].forEach((fileName) => {
      candidates.push(
        `${path}/${fileName}`
      );
    });
  }

  return [
    ...new Set(
      candidates.map(
        normalizePath
      )
    ),
  ];
}

function buildFileMap(files) {
  const map = new Map();

  files.forEach((file) => {
    const path =
      normalizePath(
        file.path ||
        file.name ||
        ""
      );

    if (!path) {
      return;
    }

    map.set(
      path.toLowerCase(),
      file
    );
  });

  return map;
}

function findResolvedFile(
  fileMap,
  resolvedPath
) {
  const candidates =
    candidatePaths(
      resolvedPath
    );

  for (
    const candidate
    of candidates
  ) {
    const file =
      fileMap.get(
        candidate.toLowerCase()
      );

    if (file) {
      return {
        file,
        resolvedPath:
          normalizePath(
            file.path ||
            file.name
          ),
      };
    }
  }

  return {
    file: null,
    resolvedPath:
      normalizePath(
        resolvedPath
      ),
  };
}

function isEntryLikeFile(
  file
) {
  const path =
    lowerPath(
      file.path ||
      file.name
    );

  const name =
    path
      .split("/")
      .pop();

  return (
    [
      "index.html",
      "package.json",
      "readme.md",
      "vite.config.js",
      "vite.config.ts",
      "next.config.js",
      "next.config.mjs",
      "angular.json",
      "tsconfig.json",
    ].includes(name) ||
    /(^|\/)(?:app|pages)\/(?:page|layout)\.(?:js|jsx|ts|tsx)$/.test(
      path
    )
  );
}

export function analyzeProjectRelationships(
  files = []
) {
  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {
    return {
      edges: [],
      resolved: [],
      missing: [],
      external: [],
      orphaned: [],
      nodes: [],
      totalReferences: 0,
      resolvedCount: 0,
      missingCount: 0,
      externalCount: 0,
      orphanedCount: 0,
    };
  }

  const fileMap =
    buildFileMap(files);

  const edges = [];

  files.forEach((file) => {
    const sourcePath =
      normalizePath(
        file.path ||
        file.name
      );

    const references =
      getFileReferences(file);

    references.forEach(
      (referenceInfo) => {
        const reference =
          referenceInfo.reference;

        if (
          isExternalReference(
            reference
          )
        ) {
          edges.push({
            id:
              `${file.id || sourcePath}-${referenceInfo.type}-${referenceInfo.line}-${reference}`,
            sourceId:
              file.id || "",
            sourcePath,
            targetId: "",
            targetPath: reference,
            reference,
            type:
              referenceInfo.type,
            line:
              referenceInfo.line,
            status:
              "external",
          });

          return;
        }

        if (
          referenceInfo.type.startsWith(
            "js-"
          ) &&
          isPackageImport(
            reference
          )
        ) {
          edges.push({
            id:
              `${file.id || sourcePath}-${referenceInfo.type}-${referenceInfo.line}-${reference}`,
            sourceId:
              file.id || "",
            sourcePath,
            targetId: "",
            targetPath: reference,
            reference,
            type:
              referenceInfo.type,
            line:
              referenceInfo.line,
            status:
              "external",
          });

          return;
        }

        const requestedPath =
          resolveRelativePath(
            sourcePath,
            reference
          );

        const match =
          findResolvedFile(
            fileMap,
            requestedPath
          );

        edges.push({
          id:
            `${file.id || sourcePath}-${referenceInfo.type}-${referenceInfo.line}-${reference}`,
          sourceId:
            file.id || "",
          sourcePath,
          targetId:
            match.file?.id || "",
          targetPath:
            match.resolvedPath,
          reference,
          type:
            referenceInfo.type,
          line:
            referenceInfo.line,
          status:
            match.file
              ? "resolved"
              : "missing",
        });
      }
    );
  });

  const resolved =
    edges.filter(
      (edge) =>
        edge.status ===
        "resolved"
    );

  const missing =
    edges.filter(
      (edge) =>
        edge.status ===
        "missing"
    );

  const external =
    edges.filter(
      (edge) =>
        edge.status ===
        "external"
    );

  const inboundMap =
    new Map();

  const outboundMap =
    new Map();

  files.forEach((file) => {
    inboundMap.set(
      file.id,
      0
    );

    outboundMap.set(
      file.id,
      0
    );
  });

  resolved.forEach((edge) => {
    if (
      edge.sourceId &&
      outboundMap.has(
        edge.sourceId
      )
    ) {
      outboundMap.set(
        edge.sourceId,
        outboundMap.get(
          edge.sourceId
        ) + 1
      );
    }

    if (
      edge.targetId &&
      inboundMap.has(
        edge.targetId
      )
    ) {
      inboundMap.set(
        edge.targetId,
        inboundMap.get(
          edge.targetId
        ) + 1
      );
    }
  });

  const nodes =
    files.map((file) => ({
      id: file.id,
      path:
        normalizePath(
          file.path ||
          file.name
        ),
      language:
        file.language ||
        "text",
      inbound:
        inboundMap.get(
          file.id
        ) || 0,
      outbound:
        outboundMap.get(
          file.id
        ) || 0,
    }));

  const orphaned =
    nodes.filter((node) => {
      const file =
        files.find(
          (item) =>
            item.id === node.id
        );

      return (
        node.inbound === 0 &&
        !isEntryLikeFile(
          file || node
        )
      );
    });

  return {
    edges,
    resolved,
    missing,
    external,
    orphaned,
    nodes,
    totalReferences:
      edges.length,
    resolvedCount:
      resolved.length,
    missingCount:
      missing.length,
    externalCount:
      external.length,
    orphanedCount:
      orphaned.length,
  };
}
