import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

import "./App.css";

import FileExplorer from "./components/FileExplorer";
import CodeEditor from "./components/CodeEditor";

import {
  parseProject,
  findMainHTMLFile,
  updateProjectFile,
} from "./utils/codeParser";

import {
  updateProjectReferences,
} from "./utils/referenceManager";

// ==========================================================
// STARTER PROJECT
// ==========================================================

const starterCode = `Here is my project:

\`\`\`html filename="index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>SplitCode V5.3</title>

  <link
    rel="stylesheet"
    href="css/style.css"
  >
</head>

<body>

  <main class="card">
    <span class="badge">
      SPLITCODE V5.3
    </span>

    <h1>
      Smart project management.
    </h1>

    <p>
      Rename project files without breaking references.
    </p>

    <button id="testButton">
      Test JavaScript
    </button>
  </main>

  <script src="js/app.js"></script>

</body>
</html>
\`\`\`

\`\`\`css filename="css/style.css"
body {
  margin: 0;
  min-height: 100vh;

  display: grid;
  place-items: center;

  background: #080b12;
  color: white;

  font-family: Arial, sans-serif;
}

.card {
  width: min(420px, 80%);
  padding: 45px;

  background: #111722;

  border: 1px solid #283246;
  border-radius: 20px;

  text-align: center;
}

.badge {
  color: #8290ff;
  font-size: 11px;
  letter-spacing: 0.15em;
}

h1 {
  margin: 15px 0;
  font-size: 36px;
}

p {
  color: #9aa4b5;
  line-height: 1.6;
}

button {
  margin-top: 15px;
  padding: 12px 18px;

  border: 0;
  border-radius: 8px;

  cursor: pointer;
}
\`\`\`

\`\`\`javascript filename="js/app.js"
document
  .getElementById("testButton")
  .addEventListener("click", () => {
    alert("SplitCode V5.3 works!");
  });
\`\`\`

\`\`\`javascript filename="js/utils.js"
function getProjectName() {
  return "SplitCode V5.3";
}

console.log(getProjectName());
\`\`\`

\`\`\`json filename="data/project.json"
{
  "name": "SplitCode",
  "version": "5.3",
  "editor": "Monaco",
  "smartReferences": true
}
\`\`\`

\`\`\`markdown filename="README.md"
# SplitCode V5.3

Smart multi-file project manager.
\`\`\``;

// ==========================================================
// PATH HELPERS
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

function getFileName(path = "") {
  return normalizePath(path).split("/").pop() || "";
}

function getDirectory(path = "") {
  const normalized = normalizePath(path);

  const index = normalized.lastIndexOf("/");

  if (index === -1) {
    return "";
  }

  return normalized.slice(0, index);
}

function languageFromFilename(path = "") {
  const lower = path.toLowerCase();

  if (
    lower.endsWith(".html") ||
    lower.endsWith(".htm")
  ) {
    return "html";
  }

  if (lower.endsWith(".css")) {
    return "css";
  }

  if (
    lower.endsWith(".js") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs")
  ) {
    return "javascript";
  }

  if (lower.endsWith(".jsx")) {
    return "jsx";
  }

  if (lower.endsWith(".tsx")) {
    return "tsx";
  }

  if (lower.endsWith(".ts")) {
    return "typescript";
  }

  if (lower.endsWith(".json")) {
    return "json";
  }

  if (lower.endsWith(".md")) {
    return "markdown";
  }

  return "text";
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

function defaultContentForFile(path) {
  const language = languageFromFilename(path);

  if (language === "html") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>New Page</title>
</head>

<body>

</body>
</html>`;
  }

  if (language === "css") {
    return `/* Add styles here */`;
  }

  if (
    language === "javascript" ||
    language === "jsx"
  ) {
    return `// Add JavaScript here`;
  }

  if (
    language === "typescript" ||
    language === "tsx"
  ) {
    return `// Add TypeScript here`;
  }

  if (language === "json") {
    return `{

}`;
  }

  if (language === "markdown") {
    return `# New Document`;
  }

  return "";
}

// ==========================================================
// APP
// ==========================================================

function App() {
  const [inputCode, setInputCode] = useState(starterCode);

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);

  const [activeFileId, setActiveFileId] = useState(null);
  const [openFileIds, setOpenFileIds] = useState([]);

  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  // ========================================================
  // ACTIVE FILE
  // ========================================================

  const activeFile = useMemo(() => {
    return (
      files.find(
        (file) => file.id === activeFileId
      ) || null
    );
  }, [files, activeFileId]);

  // ========================================================
  // OPEN FILES
  // ========================================================

  const openFiles = useMemo(() => {
    return openFileIds
      .map((id) =>
        files.find(
          (file) => file.id === id
        )
      )
      .filter(Boolean);
  }, [openFileIds, files]);

  // ========================================================
  // FOLDER DISCOVERY
  // ========================================================

  function collectFoldersFromFiles(projectFiles) {
    const discovered = new Set();

    projectFiles.forEach((file) => {
      const parts = normalizePath(file.path)
        .split("/")
        .filter(Boolean);

      parts.pop();

      let current = "";

      parts.forEach((part) => {
        current = current
          ? `${current}/${part}`
          : part;

        discovered.add(current);
      });
    });

    return [...discovered];
  }

  function ensureFolderParents(currentFolders, folderPath) {
    const next = new Set(currentFolders);

    const parts = normalizePath(folderPath)
      .split("/")
      .filter(Boolean);

    let current = "";

    parts.forEach((part) => {
      current = current
        ? `${current}/${part}`
        : part;

      next.add(current);
    });

    return [...next];
  }

  // ========================================================
  // PATH CHECKS
  // ========================================================

  function filePathExists(path, ignoreFileId = null) {
    const normalized =
      normalizePath(path).toLowerCase();

    return files.some((file) => {
      return (
        file.id !== ignoreFileId &&
        normalizePath(file.path).toLowerCase() ===
          normalized
      );
    });
  }

  function folderPathExists(path, ignoreFolder = "") {
    const normalized =
      normalizePath(path).toLowerCase();

    const ignored =
      normalizePath(ignoreFolder).toLowerCase();

    return folders.some((folder) => {
      const current =
        normalizePath(folder).toLowerCase();

      return (
        current === normalized &&
        current !== ignored
      );
    });
  }

  // ========================================================
  // OPEN FILE
  // ========================================================

  function openFile(fileId) {
    setActiveFileId(fileId);

    setOpenFileIds((current) => {
      if (current.includes(fileId)) {
        return current;
      }

      return [...current, fileId];
    });
  }

  // ========================================================
  // CLOSE TAB
  // ========================================================

  function closeTab(event, fileId) {
    event.stopPropagation();

    setOpenFileIds((current) => {
      const index =
        current.indexOf(fileId);

      const next =
        current.filter(
          (id) => id !== fileId
        );

      if (activeFileId === fileId) {
        if (next.length > 0) {
          const nextIndex =
            Math.min(
              index,
              next.length - 1
            );

          setActiveFileId(
            next[nextIndex]
          );
        } else {
          setActiveFileId(null);
        }
      }

      return next;
    });
  }

  // ========================================================
  // SPLIT PROJECT
  // ========================================================

  function splitCode() {
    const result =
      parseProject(inputCode);

    if (!result.files.length) {
      setFiles([]);
      setFolders([]);

      setActiveFileId(null);
      setOpenFileIds([]);

      setPreview("");
      setMessage(result.message);

      return;
    }

    const generatedFiles =
      result.files.map((file) => {
        const path =
          normalizePath(file.path);

        return {
          ...file,
          path,
          name:
            getFileName(path),
        };
      });

    setFiles(generatedFiles);

    setFolders(
      collectFoldersFromFiles(
        generatedFiles
      )
    );

    const mainHTML =
      findMainHTMLFile(
        generatedFiles
      );

    const firstFile =
      mainHTML ||
      generatedFiles[0];

    setActiveFileId(
      firstFile.id
    );

    setOpenFileIds([
      firstFile.id,
    ]);

    setMessage(
      result.message
    );
  }

  // ========================================================
  // EDIT ACTIVE FILE
  // ========================================================

  function editActiveFile(content) {
    if (!activeFileId) {
      return;
    }

    setFiles((currentFiles) =>
      updateProjectFile(
        currentFiles,
        activeFileId,
        content
      )
    );
  }

  // ========================================================
  // CREATE FILE
  // ========================================================

  function createFile() {
    const requested =
      window.prompt(
        `Enter the new file path.

Examples:
about.html
css/mobile.css
js/main.js`
      );

    if (requested === null) {
      return;
    }

    const path =
      normalizePath(requested);

    if (!path) {
      setMessage(
        "File path cannot be empty."
      );

      return;
    }

    if (!getFileName(path)) {
      setMessage(
        "Enter a valid filename."
      );

      return;
    }

    if (filePathExists(path)) {
      setMessage(
        `${path} already exists.`
      );

      return;
    }

    const file = {
      id: createFileId(),
      path,
      name:
        getFileName(path),
      language:
        languageFromFilename(
          path
        ),
      content:
        defaultContentForFile(
          path
        ),
    };

    setFiles((current) => [
      ...current,
      file,
    ]);

    const directory =
      getDirectory(path);

    if (directory) {
      setFolders((current) =>
        ensureFolderParents(
          current,
          directory
        )
      );
    }

    openFile(file.id);

    setMessage(
      `${path} created.`
    );
  }

  // ========================================================
  // CREATE FOLDER
  // ========================================================

  function createFolder() {
    const requested =
      window.prompt(
        `Enter the new folder path.

Examples:
assets
components
pages/admin`
      );

    if (requested === null) {
      return;
    }

    const path =
      normalizePath(requested);

    if (!path) {
      setMessage(
        "Folder path cannot be empty."
      );

      return;
    }

    if (
      folderPathExists(path)
    ) {
      setMessage(
        `${path} already exists.`
      );

      return;
    }

    setFolders((current) =>
      ensureFolderParents(
        current,
        path
      )
    );

    setMessage(
      `${path} folder created.`
    );
  }

  // ========================================================
  // RENAME FILE + SMART REFERENCE UPDATE
  // ========================================================

  function renameFile(fileId) {
    const file =
      files.find(
        (item) =>
          item.id === fileId
      );

    if (!file) {
      return;
    }

    const requested =
      window.prompt(
        "Rename file or change its path:",
        file.path
      );

    if (requested === null) {
      return;
    }

    const oldPath =
      normalizePath(file.path);

    const newPath =
      normalizePath(requested);

    if (!newPath) {
      setMessage(
        "File path cannot be empty."
      );

      return;
    }

    if (
      oldPath === newPath
    ) {
      return;
    }

    if (
      filePathExists(
        newPath,
        fileId
      )
    ) {
      setMessage(
        `${newPath} already exists.`
      );

      return;
    }

    // First update references while all files still use old paths.
    const referenceResult =
      updateProjectReferences(
        files,
        oldPath,
        newPath
      );

    // Then rename the actual file.
    const renamedFiles =
      referenceResult.files.map(
        (item) => {
          if (
            item.id !== fileId
          ) {
            return item;
          }

          return {
            ...item,
            path: newPath,
            name:
              getFileName(
                newPath
              ),
            language:
              languageFromFilename(
                newPath
              ),
          };
        }
      );

    setFiles(renamedFiles);

    const directory =
      getDirectory(newPath);

    if (directory) {
      setFolders((current) =>
        ensureFolderParents(
          current,
          directory
        )
      );
    }

    if (
      referenceResult.totalUpdates >
      0
    ) {
      setMessage(
        `Renamed ${oldPath} → ${newPath} • Updated ${referenceResult.totalUpdates} reference${
          referenceResult.totalUpdates === 1
            ? ""
            : "s"
        } in ${referenceResult.changedFiles.length} file${
          referenceResult.changedFiles.length === 1
            ? ""
            : "s"
        }.`
      );
    } else {
      setMessage(
        `Renamed ${oldPath} → ${newPath}. No references needed updating.`
      );
    }
  }

  // ========================================================
  // DELETE FILE
  // ========================================================

  function deleteFile(fileId) {
    const file =
      files.find(
        (item) =>
          item.id === fileId
      );

    if (!file) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${file.path}"?`
      );

    if (!confirmed) {
      return;
    }

    const remaining =
      files.filter(
        (item) =>
          item.id !== fileId
      );

    setFiles(remaining);

    setOpenFileIds((current) =>
      current.filter(
        (id) => id !== fileId
      )
    );

    if (
      activeFileId === fileId
    ) {
      const nextFile =
        remaining[0] || null;

      setActiveFileId(
        nextFile?.id || null
      );

      if (nextFile) {
        setOpenFileIds(
          (current) => {
            if (
              current.includes(
                nextFile.id
              )
            ) {
              return current;
            }

            return [
              ...current,
              nextFile.id,
            ];
          }
        );
      }
    }

    setMessage(
      `${file.path} deleted.`
    );
  }

  // ========================================================
  // RENAME FOLDER + SMART REFERENCES
  // ========================================================

  function renameFolder(oldFolderPath) {
    const requested =
      window.prompt(
        "Rename folder:",
        oldFolderPath
      );

    if (requested === null) {
      return;
    }

    const oldNormalized =
      normalizePath(
        oldFolderPath
      );

    const newFolderPath =
      normalizePath(
        requested
      );

    if (!newFolderPath) {
      setMessage(
        "Folder path cannot be empty."
      );

      return;
    }

    if (
      oldNormalized ===
      newFolderPath
    ) {
      return;
    }

    if (
      folderPathExists(
        newFolderPath,
        oldNormalized
      )
    ) {
      setMessage(
        `${newFolderPath} already exists.`
      );

      return;
    }

    const affectedFiles =
      files.filter((file) =>
        file.path.startsWith(
          `${oldNormalized}/`
        )
      );

    const movedPaths =
      affectedFiles.map(
        (file) => {
          const suffix =
            file.path.slice(
              oldNormalized.length
            );

          return {
            id: file.id,
            oldPath: file.path,
            newPath:
              normalizePath(
                `${newFolderPath}${suffix}`
              ),
          };
        }
      );

    // Check collisions before changing anything.
    const hasCollision =
      movedPaths.some(
        (move) =>
          files.some(
            (other) =>
              other.id !==
                move.id &&
              normalizePath(
                other.path
              ).toLowerCase() ===
                move.newPath.toLowerCase()
          )
      );

    if (hasCollision) {
      setMessage(
        "Folder rename would overwrite an existing file."
      );

      return;
    }

    // ------------------------------------------------------
    // UPDATE REFERENCES FOR EVERY FILE BEING MOVED
    // ------------------------------------------------------

    let workingFiles = files;

    let totalReferenceUpdates = 0;

    const changedReferenceFiles =
      new Set();

    movedPaths.forEach(
      (move) => {
        const result =
          updateProjectReferences(
            workingFiles,
            move.oldPath,
            move.newPath
          );

        workingFiles =
          result.files;

        totalReferenceUpdates +=
          result.totalUpdates;

        result.changedFiles.forEach(
          (changedFile) => {
            changedReferenceFiles.add(
              changedFile.path
            );
          }
        );
      }
    );

    // ------------------------------------------------------
    // MOVE THE FILE PATHS
    // ------------------------------------------------------

    const movedFiles =
      workingFiles.map(
        (file) => {
          const move =
            movedPaths.find(
              (item) =>
                item.id === file.id
            );

          if (!move) {
            return file;
          }

          return {
            ...file,
            path:
              move.newPath,
            name:
              getFileName(
                move.newPath
              ),
            language:
              languageFromFilename(
                move.newPath
              ),
          };
        }
      );

    setFiles(movedFiles);

    // ------------------------------------------------------
    // RENAME FOLDER TREE
    // ------------------------------------------------------

    setFolders((current) => {
      const next = new Set();

      current.forEach(
        (folder) => {
          const normalized =
            normalizePath(
              folder
            );

          if (
            normalized ===
              oldNormalized ||
            normalized.startsWith(
              `${oldNormalized}/`
            )
          ) {
            const suffix =
              normalized.slice(
                oldNormalized.length
              );

            next.add(
              normalizePath(
                `${newFolderPath}${suffix}`
              )
            );
          } else {
            next.add(
              normalized
            );
          }
        }
      );

      return ensureFolderParents(
        [...next],
        newFolderPath
      );
    });

    if (
      totalReferenceUpdates > 0
    ) {
      setMessage(
        `Renamed ${oldNormalized} → ${newFolderPath} • Moved ${movedPaths.length} file${
          movedPaths.length === 1
            ? ""
            : "s"
        } • Updated ${totalReferenceUpdates} reference${
          totalReferenceUpdates === 1
            ? ""
            : "s"
        } in ${changedReferenceFiles.size} file${
          changedReferenceFiles.size === 1
            ? ""
            : "s"
        }.`
      );
    } else {
      setMessage(
        `Renamed ${oldNormalized} → ${newFolderPath} • Moved ${movedPaths.length} file${
          movedPaths.length === 1
            ? ""
            : "s"
        }.`
      );
    }
  }

  // ========================================================
  // DELETE FOLDER
  // ========================================================

  function deleteFolder(folderPath) {
    const normalized =
      normalizePath(
        folderPath
      );

    const containedFiles =
      files.filter(
        (file) =>
          file.path.startsWith(
            `${normalized}/`
          )
      );

    const warning =
      containedFiles.length > 0
        ? `Delete "${normalized}" and ${containedFiles.length} file(s) inside it?`
        : `Delete empty folder "${normalized}"?`;

    const confirmed =
      window.confirm(warning);

    if (!confirmed) {
      return;
    }

    const removedIds =
      new Set(
        containedFiles.map(
          (file) => file.id
        )
      );

    const remainingFiles =
      files.filter(
        (file) =>
          !removedIds.has(
            file.id
          )
      );

    setFiles(
      remainingFiles
    );

    setFolders((current) =>
      current.filter(
        (folder) => {
          const value =
            normalizePath(
              folder
            );

          return (
            value !==
              normalized &&
            !value.startsWith(
              `${normalized}/`
            )
          );
        }
      )
    );

    setOpenFileIds(
      (current) =>
        current.filter(
          (id) =>
            !removedIds.has(
              id
            )
        )
    );

    if (
      removedIds.has(
        activeFileId
      )
    ) {
      const nextFile =
        remainingFiles[0] ||
        null;

      setActiveFileId(
        nextFile?.id ||
          null
      );

      if (nextFile) {
        setOpenFileIds(
          (current) => {
            if (
              current.includes(
                nextFile.id
              )
            ) {
              return current;
            }

            return [
              ...current,
              nextFile.id,
            ];
          }
        );
      }
    }

    setMessage(
      `${normalized} deleted.`
    );
  }

  // ========================================================
  // PREVIEW PATH RESOLUTION
  // ========================================================

  function resolvePath(
    baseFilePath,
    reference
  ) {
    if (!reference) {
      return "";
    }

    if (
      /^https?:/i.test(
        reference
      ) ||
      /^data:/i.test(
        reference
      ) ||
      reference.startsWith(
        "//"
      )
    ) {
      return reference;
    }

    const cleanReference =
      reference
        .split("#")[0]
        .split("?")[0];

    if (
      cleanReference.startsWith(
        "/"
      )
    ) {
      return normalizePath(
        cleanReference.slice(
          1
        )
      );
    }

    const baseDirectory =
      getDirectory(
        baseFilePath
      );

    const parts = [
      ...baseDirectory.split(
        "/"
      ),
      ...cleanReference.split(
        "/"
      ),
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

  function findProjectFile(path) {
    const normalized =
      normalizePath(path);

    return (
      files.find(
        (file) =>
          normalizePath(
            file.path
          ) ===
          normalized
      ) || null
    );
  }

  // ========================================================
  // LIVE PREVIEW
  // ========================================================

  function buildPreview() {
    const htmlFile =
      findMainHTMLFile(
        files
      );

    if (!htmlFile) {
      setPreview("");
      return;
    }

    let html =
      htmlFile.content;

    // LOCAL CSS

    html = html.replace(
      /<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
      (
        fullMatch,
        before,
        href
      ) => {
        if (
          /^https?:/i.test(
            href
          ) ||
          href.startsWith(
            "//"
          ) ||
          /^data:/i.test(
            href
          )
        ) {
          return fullMatch;
        }

        const resolved =
          resolvePath(
            htmlFile.path,
            href
          );

        const cssFile =
          findProjectFile(
            resolved
          );

        if (
          cssFile &&
          cssFile.language ===
            "css"
        ) {
          return `<style data-splitcode-file="${cssFile.path}">
${cssFile.content}
</style>`;
        }

        return fullMatch;
      }
    );

    // LOCAL JAVASCRIPT

    html = html.replace(
      /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi,
      (
        fullMatch,
        before,
        src
      ) => {
        if (
          /^https?:/i.test(
            src
          ) ||
          src.startsWith(
            "//"
          ) ||
          /^data:/i.test(
            src
          )
        ) {
          return fullMatch;
        }

        const resolved =
          resolvePath(
            htmlFile.path,
            src
          );

        const jsFile =
          findProjectFile(
            resolved
          );

        if (
          jsFile &&
          [
            "javascript",
            "jsx",
            "typescript",
            "tsx",
          ].includes(
            jsFile.language
          )
        ) {
          return `<script data-splitcode-file="${jsFile.path}">
${jsFile.content}
</script>`;
        }

        return fullMatch;
      }
    );

    setPreview(html);
  }

  useEffect(() => {
    if (!files.length) {
      setPreview("");
      return;
    }

    const timer =
      setTimeout(
        buildPreview,
        250
      );

    return () =>
      clearTimeout(timer);
  }, [files]);

  // ========================================================
  // FILE UPLOAD
  // ========================================================

  function handleFile(file) {
    if (!file) {
      return;
    }

    const allowed = [
      ".html",
      ".htm",
      ".txt",
      ".md",
    ];

    const lowerName =
      file.name.toLowerCase();

    const valid =
      allowed.some(
        (extension) =>
          lowerName.endsWith(
            extension
          )
      );

    if (!valid) {
      setMessage(
        "Upload an HTML, HTM, TXT or Markdown file."
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      (event) => {
        setInputCode(
          event.target.result
        );

        setMessage(
          `${file.name} loaded. Click Split Project.`
        );
      };

    reader.onerror =
      () => {
        setMessage(
          "Unable to read this file."
        );
      };

    reader.readAsText(
      file
    );
  }

  function handleFileInput(
    event
  ) {
    const file =
      event.target.files?.[0];

    handleFile(file);

    event.target.value =
      "";
  }

  function handleDragOver(
    event
  ) {
    event.preventDefault();

    setDragging(true);
  }

  function handleDragLeave(
    event
  ) {
    event.preventDefault();

    setDragging(false);
  }

  function handleDrop(
    event
  ) {
    event.preventDefault();

    setDragging(false);

    const file =
      event.dataTransfer
        .files?.[0];

    handleFile(file);
  }

  // ========================================================
  // COPY
  // ========================================================

  async function copyActiveFile() {
    if (!activeFile) {
      setMessage(
        "Select a project file first."
      );

      return;
    }

    try {
      await navigator
        .clipboard
        .writeText(
          activeFile.content
        );

      setMessage(
        `${activeFile.name} copied.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to copy automatically."
      );
    }
  }

  // ========================================================
  // DOWNLOAD ACTIVE FILE
  // ========================================================

  function downloadActiveFile() {
    if (!activeFile) {
      setMessage(
        "Select a project file first."
      );

      return;
    }

    const blob =
      new Blob(
        [
          activeFile.content,
        ],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      activeFile.name;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setMessage(
      `${activeFile.name} downloaded.`
    );
  }

  // ========================================================
  // DOWNLOAD ZIP
  // ========================================================

  async function downloadZip() {
    if (
      !files.length &&
      !folders.length
    ) {
      setMessage(
        "Create or split a project before downloading."
      );

      return;
    }

    try {
      const zip =
        new JSZip();

      folders.forEach(
        (folder) => {
          zip.folder(
            normalizePath(
              folder
            )
          );
        }
      );

      files.forEach(
        (file) => {
          zip.file(
            normalizePath(
              file.path
            ),
            file.content
          );
        }
      );

      const blob =
        await zip.generateAsync({
          type: "blob",
        });

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
      );

      link.href = url;
      link.download =
        "splitcode-project.zip";

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setMessage(
        "Project ZIP downloaded."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to create project ZIP."
      );
    }
  }

  // ========================================================
  // CLEAR
  // ========================================================

  function clearProject() {
    setInputCode("");

    setFiles([]);
    setFolders([]);

    setActiveFileId(null);
    setOpenFileIds([]);

    setPreview("");
    setMessage("");
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="app">

      <nav className="navbar">

        <div className="logo">

          <div className="logoIcon">
            &lt;/&gt;
          </div>

          <div>
            <span>Split</span>
            Code
          </div>

        </div>

        <div className="navBadge">
          Runs locally in your browser
        </div>

      </nav>

      <main className="container">

        <section className="hero">

          <div className="eyebrow">
            AI CODE → REAL PROJECT
          </div>

          <h1>
            Turn mixed code into
            <span>
              {" "}
              real project files.
            </span>
          </h1>

          <p>
            Split AI-generated code,
            organize project files,
            edit them with Monaco and
            export a complete project.
          </p>

        </section>

        <section
          className={
            dragging
              ? "uploadZone uploadDragging"
              : "uploadZone"
          }
          onDragOver={
            handleDragOver
          }
          onDragLeave={
            handleDragLeave
          }
          onDrop={
            handleDrop
          }
        >

          <div className="uploadIcon">
            ↑
          </div>

          <div className="uploadText">

            <strong>
              Drop a code file here
            </strong>

            <span>
              HTML, HTM, TXT or Markdown
            </span>

          </div>

          <label className="uploadButton">

            Browse File

            <input
              type="file"
              accept=".html,.htm,.txt,.md"
              onChange={
                handleFileInput
              }
              hidden
            />

          </label>

        </section>

        <section className="workspace">

          {/* SOURCE */}

          <div className="panel">

            <div className="panelHeader">

              <div>
                <span className="step">
                  01
                </span>

                Source Code
              </div>

              <button
                className="textButton"
                onClick={
                  clearProject
                }
              >
                Clear
              </button>

            </div>

            <textarea
              className="codeInput"
              value={
                inputCode
              }
              onChange={
                (event) =>
                  setInputCode(
                    event.target
                      .value
                  )
              }
              spellCheck="false"
              placeholder="Paste AI-generated code here..."
            />

            <div className="actionRow">

              <span className="status">
                {message}
              </span>

              <button
                className="primaryButton"
                onClick={
                  splitCode
                }
              >
                Split Project

                <span>→</span>
              </button>

            </div>

          </div>

          {/* PROJECT */}

          <div className="panel">

            <div className="panelHeader">

              <div>
                <span className="step">
                  02
                </span>

                Project Files
              </div>

              <button
                className="downloadAll"
                onClick={
                  downloadZip
                }
              >
                Download ZIP
              </button>

            </div>

            <div className="projectEditor">

              <FileExplorer
                files={files}
                folders={folders}
                activeFileId={
                  activeFileId
                }
                onSelectFile={
                  openFile
                }
                onCreateFile={
                  createFile
                }
                onCreateFolder={
                  createFolder
                }
                onRenameFile={
                  renameFile
                }
                onDeleteFile={
                  deleteFile
                }
                onRenameFolder={
                  renameFolder
                }
                onDeleteFolder={
                  deleteFolder
                }
              />

              <div className="projectEditorMain">

                <div className="editorTabs">

                  {openFiles.length >
                  0 ? (

                    openFiles.map(
                      (file) => (

                        <button
                          key={
                            file.id
                          }
                          type="button"
                          className={
                            file.id ===
                            activeFileId
                              ? "editorTab activeEditorTab"
                              : "editorTab"
                          }
                          onClick={() =>
                            openFile(
                              file.id
                            )
                          }
                          title={
                            file.path
                          }
                        >

                          <span className="editorTabName">
                            {file.name}
                          </span>

                          <span
                            className="editorTabClose"
                            onClick={
                              (
                                event
                              ) =>
                                closeTab(
                                  event,
                                  file.id
                                )
                            }
                          >
                            ×
                          </span>

                        </button>

                      )
                    )

                  ) : (

                    <div className="editorTabsEmpty">
                      No open files
                    </div>

                  )}

                </div>

                <div className="v4EditorHeader">

                  {activeFile ? (
                    <>

                      <span
                        className="v4EditorFilename"
                        title={
                          activeFile.path
                        }
                      >
                        {
                          activeFile.path
                        }
                      </span>

                      <span className="v4LanguageBadge">
                        {
                          activeFile.language
                        }
                      </span>

                    </>
                  ) : (

                    <span className="v4EditorFilename">
                      Select a file
                    </span>

                  )}

                </div>

                <CodeEditor
                  file={
                    activeFile
                  }
                  onChange={
                    editActiveFile
                  }
                />

                <div className="outputActions">

                  <span className="editStatus">

                    {activeFile
                      ? `${files.length} files • ${folders.length} folders • Smart References • Auto Preview`
                      : "No file selected"}

                  </span>

                  <button
                    onClick={
                      copyActiveFile
                    }
                    disabled={
                      !activeFile
                    }
                  >
                    Copy
                  </button>

                  <button
                    onClick={
                      downloadActiveFile
                    }
                    disabled={
                      !activeFile
                    }
                  >
                    Download
                  </button>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* PREVIEW */}

        <section className="previewSection">

          <div className="previewHeader">

            <div>
              <span className="step">
                03
              </span>

              Live Preview
            </div>

            <span>
              Smart multi-file preview
            </span>

          </div>

          {preview ? (

            <iframe
              title="SplitCode Preview"
              srcDoc={
                preview
              }
              sandbox="allow-scripts"
              className="previewFrame"
            />

          ) : (

            <div className="emptyPreview">

              <div>

                <strong>
                  Nothing to preview
                </strong>

                <p>
                  Add an HTML file to
                  generate a live preview.
                </p>

              </div>

            </div>

          )}

        </section>

      </main>

      <footer>

        <strong>
          SplitCode
        </strong>

        <span>
          V5.3 Smart References
        </span>

      </footer>

    </div>
  );
}

export default App;