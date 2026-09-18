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

import {
  importProjectFiles,
  getSupportedAcceptString,
} from "./utils/projectImporter";

import {
  diagnoseProject,
} from "./utils/projectDiagnostics";

import {
  saveProjectState,
  loadProjectState,
  clearSavedProject,
} from "./utils/projectStorage";

import {
  getBestRepair,
} from "./utils/projectRepair";

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

  <title>SplitCode V6</title>

  <link
    rel="stylesheet"
    href="css/style.css"
  >
</head>

<body>

  <main class="card">
    <span class="badge">
      SPLITCODE V6
    </span>

    <h1>
      Smart project diagnostics.
    </h1>

    <p>
      Build, inspect and export your project.
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
    alert("SplitCode V6 works!");
  });
\`\`\`

\`\`\`javascript filename="js/utils.js"
function getProjectName() {
  return "SplitCode V6";
}

console.log(getProjectName());
\`\`\`

\`\`\`json filename="data/project.json"
{
  "name": "SplitCode",
  "version": "6.0",
  "editor": "Monaco",
  "smartReferences": true,
  "diagnostics": true
}
\`\`\`

\`\`\`markdown filename="README.md"
# SplitCode V6

Smart multi-file project manager with project diagnostics.
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

  const [storageReady, setStorageReady] = useState(false);

  // ========================================================
// V7 RESTORE LOCAL PROJECT
// ========================================================

useEffect(() => {
  const savedProject =
    loadProjectState();

  if (savedProject) {
    const restoredFiles =
      Array.isArray(savedProject.files)
        ? savedProject.files
        : [];

    const restoredFolders =
      Array.isArray(savedProject.folders)
        ? savedProject.folders
        : [];

    const validFileIds =
      new Set(
        restoredFiles.map(
          (file) => file.id
        )
      );

    const restoredOpenFileIds =
      Array.isArray(
        savedProject.openFileIds
      )
        ? savedProject.openFileIds.filter(
            (id) =>
              validFileIds.has(id)
          )
        : [];

    let restoredActiveFileId =
      savedProject.activeFileId;

    if (
      !validFileIds.has(
        restoredActiveFileId
      )
    ) {
      restoredActiveFileId =
        restoredOpenFileIds[0] ||
        restoredFiles[0]?.id ||
        null;
    }

    setInputCode(
      typeof savedProject.inputCode ===
        "string"
        ? savedProject.inputCode
        : ""
    );

    setFiles(
      restoredFiles
    );

    setFolders(
      restoredFolders
    );

    setActiveFileId(
      restoredActiveFileId
    );

    if (
      restoredActiveFileId &&
      !restoredOpenFileIds.includes(
        restoredActiveFileId
      )
    ) {
      restoredOpenFileIds.push(
        restoredActiveFileId
      );
    }

    setOpenFileIds(
      restoredOpenFileIds
    );

    setMessage(
      "Previous project restored."
    );
  }

  setStorageReady(true);
}, []);

// ========================================================
// V7 AUTO SAVE LOCAL PROJECT
// ========================================================

useEffect(() => {
  if (!storageReady) {
    return;
  }

  const timer =
    setTimeout(() => {
      saveProjectState({
        inputCode,
        files,
        folders,
        activeFileId,
        openFileIds,
      });
    }, 500);

  return () => {
    clearTimeout(timer);
  };
}, [
  storageReady,
  inputCode,
  files,
  folders,
  activeFileId,
  openFileIds,
]);

  // ========================================================
  // V6 DIAGNOSTICS
  // ========================================================

  const diagnostics = useMemo(() => {
    return diagnoseProject(files);
  }, [files]);

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

    const referenceResult =
      updateProjectReferences(
        files,
        oldPath,
        newPath
      );

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
  // V5.4 PROJECT IMPORT
  // ========================================================

  async function handleProjectImport(fileList) {
    if (!fileList || !fileList.length) {
      return;
    }

    setMessage(
      "Importing project..."
    );

    try {
      const result =
        await importProjectFiles(
          fileList
        );

      if (!result.files.length) {
        setMessage(
          result.message
        );

        return;
      }

      setFiles(
        result.files
      );

      setFolders(
        result.folders
      );

      const mainHTML =
        findMainHTMLFile(
          result.files
        );

      const firstFile =
        mainHTML ||
        result.files[0];

      setActiveFileId(
        firstFile.id
      );

      setOpenFileIds([
        firstFile.id,
      ]);

      setMessage(
        result.message
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to import this project."
      );
    }
  }

  function handleProjectFilesInput(event) {
    const selectedFiles =
      event.target.files;

    handleProjectImport(
      selectedFiles
    );

    event.target.value = "";
  }

  function handleProjectFolderInput(event) {
    const selectedFiles =
      event.target.files;

    handleProjectImport(
      selectedFiles
    );

    event.target.value = "";
  }

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

  function handleFileInput(event) {
    const file =
      event.target.files?.[0];

    handleFile(file);

    event.target.value =
      "";
  }

  function handleDragOver(event) {
    event.preventDefault();

    setDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();

    setDragging(false);
  }

  function handleDrop(event) {
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
  const hasProjectData =
    inputCode.trim() ||
    files.length ||
    folders.length;

  if (hasProjectData) {
    const confirmed =
      window.confirm(
        "Start a new project? Your current locally saved project will be cleared."
      );

    if (!confirmed) {
      return;
    }
  }

  clearSavedProject();

  setInputCode("");

  setFiles([]);
  setFolders([]);

  setActiveFileId(null);
  setOpenFileIds([]);

  setPreview("");

  setMessage(
    "New project started."
  );
}

  // ========================================================
  // V6 OPEN DIAGNOSTIC FILE
  // ========================================================

  function openDiagnosticFile(issue) {
    if (!issue.file) {
      return;
    }

    const targetFile =
      files.find(
        (file) =>
          file.path ===
          issue.file
      );

    if (!targetFile) {
      return;
    }

    openFile(
      targetFile.id
    );

    setMessage(
      `Opened ${targetFile.path}`
    );
  }

  // ========================================================
// V6.1 QUICK FIX HELPERS
// ========================================================

const nonCreatableAssetExtensions = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".webm",
  ".mov",
  ".pdf",
];

function isCreatableDiagnosticFile(path = "") {
  const cleanPath = path
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();

  return !nonCreatableAssetExtensions.some(
    (extension) =>
      cleanPath.endsWith(extension)
  );
}

function resolveDiagnosticReference(issue) {
  if (
    !issue.file ||
    !issue.reference
  ) {
    return "";
  }

  return resolvePath(
    issue.file,
    issue.reference
  );
}

function canQuickFixIssue(issue) {
  if (
    ![
      "missing-reference",
      "missing-asset",
      "missing-import",
    ].includes(issue.type)
  ) {
    return false;
  }

  const targetPath =
    resolveDiagnosticReference(issue);

  if (!targetPath) {
    return false;
  }

  return isCreatableDiagnosticFile(
    targetPath
  );
}

function quickFixDiagnostic(issue) {
  const targetPath =
    normalizePath(
      resolveDiagnosticReference(
        issue
      )
    );

  if (!targetPath) {
    setMessage(
      "Unable to determine the missing file path."
    );

    return;
  }

  if (
    !isCreatableDiagnosticFile(
      targetPath
    )
  ) {
    setMessage(
      `${targetPath} is a binary/media asset. Import the real file instead.`
    );

    return;
  }

  const existingFile =
    files.find(
      (file) =>
        normalizePath(
          file.path
        ).toLowerCase() ===
        targetPath.toLowerCase()
    );

  if (existingFile) {
    openFile(
      existingFile.id
    );

    setMessage(
      `${targetPath} already exists.`
    );

    return;
  }

  const newFile = {
    id: createFileId(),

    path: targetPath,

    name:
      getFileName(
        targetPath
      ),

    language:
      languageFromFilename(
        targetPath
      ),

    content:
      defaultContentForFile(
        targetPath
      ),
  };

  setFiles((current) => [
    ...current,
    newFile,
  ]);

  const directory =
    getDirectory(
      targetPath
    );

  if (directory) {
    setFolders((current) =>
      ensureFolderParents(
        current,
        directory
      )
    );
  }

  openFile(
    newFile.id
  );

  setMessage(
    `Created missing file: ${targetPath}`
  );
}

// ========================================================
// V8 SMART REFERENCE REPAIR
// ========================================================

function repairDiagnosticReference(issue) {
  const repair =
    getBestRepair(
      issue,
      files
    );

  if (!repair) {
    setMessage(
      "No suitable existing file was found."
    );

    return;
  }

  const sourceFile =
    files.find(
      (file) =>
        file.path === issue.file
    );

  if (!sourceFile) {
    setMessage(
      "Unable to find the source file."
    );

    return;
  }

  const oldReference =
    issue.reference;

  const newReference =
    repair.replacement;

  let updatedContent =
    sourceFile.content;

  // ----------------------------------------
  // HTML
  // ----------------------------------------

  if (
    sourceFile.language ===
    "html"
  ) {
    const pattern =
      /\b(src|href)=["']([^"']+)["']/gi;

    updatedContent =
      sourceFile.content.replace(
        pattern,
        (
          fullMatch,
          attribute,
          reference
        ) => {
          if (
            reference !==
            oldReference
          ) {
            return fullMatch;
          }

          return `${attribute}="${newReference}"`;
        }
      );
  }

  // ----------------------------------------
  // CSS
  // ----------------------------------------

  else if (
    sourceFile.language ===
    "css"
  ) {
    const pattern =
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

    updatedContent =
      sourceFile.content.replace(
        pattern,
        (
          fullMatch,
          quote,
          reference
        ) => {
          if (
            reference !==
            oldReference
          ) {
            return fullMatch;
          }

          const outputQuote =
            quote || "";

          return `url(${outputQuote}${newReference}${outputQuote})`;
        }
      );
  }

  // ----------------------------------------
  // JS / JSX / TS / TSX
  // ----------------------------------------

  else if (
    [
      "javascript",
      "jsx",
      "typescript",
      "tsx",
    ].includes(
      sourceFile.language
    )
  ) {
    updatedContent =
      sourceFile.content
        .split(oldReference)
        .join(newReference);
  }

  if (
    updatedContent ===
    sourceFile.content
  ) {
    setMessage(
      "SplitCode found a possible file, but could not safely update this reference."
    );

    return;
  }

  setFiles((current) =>
    current.map((file) => {
      if (
        file.id !==
        sourceFile.id
      ) {
        return file;
      }

      return {
        ...file,
        content:
          updatedContent,
      };
    })
  );

  openFile(
    sourceFile.id
  );

  setMessage(
    `Fixed reference: ${oldReference} → ${newReference}`
  );
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
            edit them with Monaco,
            diagnose structural problems
            and export a complete project.
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

        {/* V5.4 PROJECT IMPORT */}

        <section className="projectImportSection">

          <div className="projectImportInfo">

            <div className="projectImportIcon">
              ◫
            </div>

            <div>

              <strong>
                Import Existing Project
              </strong>

              <span>
                Open multiple project files or an entire folder.
              </span>

            </div>

          </div>

          <div className="projectImportActions">

            <label className="projectImportButton">

              Import Files

              <input
                type="file"
                multiple
                accept={
                  getSupportedAcceptString()
                }
                onChange={
                  handleProjectFilesInput
                }
                hidden
              />

            </label>

            <label className="projectImportButton primaryImportButton">

              Import Folder

              <input
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                onChange={
                  handleProjectFolderInput
                }
                hidden
              />

            </label>

          </div>

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

                  {openFiles.length > 0 ? (

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
                              (event) =>
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
                        {activeFile.path}
                      </span>

                      <span className="v4LanguageBadge">
                        {activeFile.language}
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
                      ? `${files.length} files • ${folders.length} folders • Smart References • Diagnostics • Smart Repair • Auto Preview`
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

        {/* ==========================================
            V6 PROJECT DIAGNOSTICS
        ========================================== */}

        <section className="diagnosticsSection">

          <div className="diagnosticsHeader">

            <div>

              <span className="step">
                04
              </span>

              Project Diagnostics

            </div>

            <span className="diagnosticsScanCount">
              {diagnostics.filesScanned} files scanned
            </span>

          </div>

          {!files.length ? (

            <div className="diagnosticsEmpty">

              <strong>
                No project loaded
              </strong>

              <span>
                Split or import a project to run diagnostics.
              </span>

            </div>

          ) : diagnostics.issues.length === 0 ? (

            <div className="diagnosticsHealthy">

              <div className="diagnosticsHealthyIcon">
                ✓
              </div>

              <div>

                <strong>
                  Project looks healthy
                </strong>

                <span>
                  No structural problems were detected.
                </span>

              </div>

            </div>

          ) : (

            <>

              <div className="diagnosticsSummary">

                <div className="diagnosticStat">

                  <strong>
                    {diagnostics.issues.length}
                  </strong>

                  <span>
                    Issues
                  </span>

                </div>

                <div className="diagnosticStat diagnosticErrorStat">

                  <strong>
                    {diagnostics.errors}
                  </strong>

                  <span>
                    Errors
                  </span>

                </div>

                <div className="diagnosticStat diagnosticWarningStat">

                  <strong>
                    {diagnostics.warnings}
                  </strong>

                  <span>
                    Warnings
                  </span>

                </div>

              </div>

              <div className="diagnosticsList">

                {diagnostics.issues.map(
                  (issue) => {

    const repair =
      getBestRepair(
        issue,
        files
      );

    return (

    <button
                      key={
                        issue.id
                      }
                      type="button"
                      className={`diagnosticItem ${
                        issue.severity ===
                        "error"
                          ? "diagnosticError"
                          : "diagnosticWarning"
                      }`}
                      onClick={() =>
                        openDiagnosticFile(
                          issue
                        )
                      }
                    >

                      <div className="diagnosticSeverityIcon">

                        {issue.severity ===
                        "error"
                          ? "!"
                          : "⚠"}

                      </div>

                      <div className="diagnosticContent">

                        <strong>
                          {issue.message}
                        </strong>

                        {issue.file && (

                          <span>
                            {issue.file}
                          </span>

                        )}

                        {issue.reference && (

                          <code>
                            {issue.reference}
                          </code>

                        )}

                        {repair && (

                          <div className="repairSuggestion">

                            <span>
                              Possible match
                            </span>

                            <strong>
                              {repair.targetFile.path}
                            </strong>

                            <small
                              className={`repairConfidence repairConfidence-${repair.confidence}`}
                            >
                              {repair.confidence} confidence
                            </small>

                          </div>

                        )}

                      </div>

                      <div className="diagnosticActions">

  {repair && (

    <button
      type="button"
      className="diagnosticRepairButton"
      onClick={(event) => {
        event.stopPropagation();

        repairDiagnosticReference(
          issue
        );
      }}
    >
      Fix Reference
    </button>

  )}

  {canQuickFixIssue(issue) && (

    <button
      type="button"
      className="diagnosticFixButton"
      onClick={(event) => {
        event.stopPropagation();

        quickFixDiagnostic(
          issue
        );
      }}
    >
      + Create Missing File
    </button>

  )}

  {issue.file && (

    <span className="diagnosticOpen">
      Open →
    </span>

  )}

</div>

                    </button>

                  );
                }
                )}

              </div>

            </>

          )}

        </section>

      </main>

      <footer>

        <strong>
          SplitCode
        </strong>

        <span>
          V8 Smart Repair
        </span>

      </footer>

    </div>
  );
}

export default App;