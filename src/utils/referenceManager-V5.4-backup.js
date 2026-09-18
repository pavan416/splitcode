// ==========================================================
// SplitCode V5.3
// Smart Reference Manager
// ==========================================================

function normalizePath(path = "") {
  return path
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

  if (
    /^https?:/i.test(reference) ||
    /^data:/i.test(reference) ||
    reference.startsWith("//") ||
    reference.startsWith("#")
  ) {
    return reference;
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

function relativePath(fromFilePath, toFilePath) {
  const fromDirectory = getDirectory(fromFilePath);

  const fromParts = fromDirectory
    .split("/")
    .filter(Boolean);

  const toParts = normalizePath(toFilePath)
    .split("/")
    .filter(Boolean);

  let common = 0;

  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }

  const upParts = fromParts
    .slice(common)
    .map(() => "..");

  const downParts = toParts.slice(common);

  const result = [
    ...upParts,
    ...downParts,
  ].join("/");

  return result || "./";
}

function isExternalReference(reference = "") {
  return (
    /^https?:/i.test(reference) ||
    /^data:/i.test(reference) ||
    reference.startsWith("//") ||
    reference.startsWith("#")
  );
}

function preserveQueryAndHash(originalReference, newReference) {
  const match = originalReference.match(/([?#].*)$/);

  if (!match) {
    return newReference;
  }

  return `${newReference}${match[1]}`;
}

function updateHTMLReferences(
  content,
  htmlFilePath,
  oldPath,
  newPath
) {
  let updates = 0;

  const attributePattern =
    /\b(src|href)=["']([^"']+)["']/gi;

  const updatedContent = content.replace(
    attributePattern,
    (fullMatch, attribute, reference) => {
      if (isExternalReference(reference)) {
        return fullMatch;
      }

      const resolved = resolvePath(
        htmlFilePath,
        reference
      );

      if (
        normalizePath(resolved) !==
        normalizePath(oldPath)
      ) {
        return fullMatch;
      }

      let replacement = relativePath(
        htmlFilePath,
        newPath
      );

      replacement = preserveQueryAndHash(
        reference,
        replacement
      );

      updates += 1;

      return `${attribute}="${replacement}"`;
    }
  );

  return {
    content: updatedContent,
    updates,
  };
}

function updateCSSReferences(
  content,
  cssFilePath,
  oldPath,
  newPath
) {
  let updates = 0;

  const urlPattern =
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

  const updatedContent = content.replace(
    urlPattern,
    (fullMatch, quote, reference) => {
      if (isExternalReference(reference)) {
        return fullMatch;
      }

      const resolved = resolvePath(
        cssFilePath,
        reference
      );

      if (
        normalizePath(resolved) !==
        normalizePath(oldPath)
      ) {
        return fullMatch;
      }

      let replacement = relativePath(
        cssFilePath,
        newPath
      );

      replacement = preserveQueryAndHash(
        reference,
        replacement
      );

      updates += 1;

      const outputQuote = quote || "";

      return `url(${outputQuote}${replacement}${outputQuote})`;
    }
  );

  return {
    content: updatedContent,
    updates,
  };
}

function updateJSReferences(
  content,
  jsFilePath,
  oldPath,
  newPath
) {
  let updates = 0;

  const patterns = [
    /(import\s+[^'"]*?\s+from\s+)(['"])([^'"]+)\2/g,
    /(import\s*)(\()?\s*(['"])([^'"]+)\3\s*(\))?/g,
    /(require\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
  ];

  let updatedContent = content;

  patterns.forEach((pattern, patternIndex) => {
    updatedContent = updatedContent.replace(
      pattern,
      (...args) => {
        const fullMatch = args[0];

        let reference = "";
        let quote = '"';

        if (patternIndex === 0) {
          quote = args[2];
          reference = args[3];
        }

        if (patternIndex === 1) {
          quote = args[3];
          reference = args[4];
        }

        if (patternIndex === 2) {
          quote = args[2];
          reference = args[3];
        }

        if (
          !reference ||
          isExternalReference(reference)
        ) {
          return fullMatch;
        }

        const resolved = resolvePath(
          jsFilePath,
          reference
        );

        if (
          normalizePath(resolved) !==
          normalizePath(oldPath)
        ) {
          return fullMatch;
        }

        let replacement = relativePath(
          jsFilePath,
          newPath
        );

        if (
          !replacement.startsWith(".") &&
          !replacement.startsWith("/")
        ) {
          replacement = `./${replacement}`;
        }

        replacement = preserveQueryAndHash(
          reference,
          replacement
        );

        updates += 1;

        if (patternIndex === 0) {
          return `${args[1]}${quote}${replacement}${quote}`;
        }

        if (patternIndex === 1) {
          return `import(${quote}${replacement}${quote})`;
        }

        return `${args[1]}${quote}${replacement}${quote}${args[4]}`;
      }
    );
  });

  return {
    content: updatedContent,
    updates,
  };
}

// ==========================================================
// PUBLIC FUNCTION
// ==========================================================

export function updateProjectReferences(
  files,
  oldPath,
  newPath
) {
  let totalUpdates = 0;

  const changedFiles = [];

  const updatedFiles = files.map((file) => {
    let result = {
      content: file.content,
      updates: 0,
    };

    if (file.language === "html") {
      result = updateHTMLReferences(
        file.content,
        file.path,
        oldPath,
        newPath
      );
    }

    if (file.language === "css") {
      result = updateCSSReferences(
        file.content,
        file.path,
        oldPath,
        newPath
      );
    }

    if (
      [
        "javascript",
        "jsx",
        "typescript",
        "tsx",
      ].includes(file.language)
    ) {
      result = updateJSReferences(
        file.content,
        file.path,
        oldPath,
        newPath
      );
    }

    if (result.updates > 0) {
      totalUpdates += result.updates;

      changedFiles.push({
        path: file.path,
        updates: result.updates,
      });

      return {
        ...file,
        content: result.content,
      };
    }

    return file;
  });

  return {
    files: updatedFiles,
    totalUpdates,
    changedFiles,
  };
}