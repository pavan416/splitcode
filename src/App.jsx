import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";

import FileExplorer from "./components/FileExplorer";
import CodeEditor from "./components/CodeEditor";
import ProjectHome from "./components/ProjectHome";

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
  importDroppedProject,
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

import {
  detectProjectFramework,
} from "./utils/frameworkDetector";

import {
  getProjectPreviewPlan,
} from "./utils/previewManager";

import {
  analyzeProjectRelationships,
} from "./utils/projectRelationshipEngine";

import {
  getRelationshipRepair,
  applyRelationshipRepair,
} from "./utils/relationshipRepair";

import {
  getProjectHealthSummary,
} from "./utils/projectHealth";

import {
  getExportReadiness,
} from "./utils/exportReadiness";

import {
  getExportDocumentationPlan,
  generateExportDocumentation,
} from "./utils/exportDocumentation";

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

  <title>SplitCode Starter</title>

  <link
    rel="stylesheet"
    href="css/style.css"
  >
</head>

<body>

  <main class="card">
    <span class="badge">
      SPLITCODE
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
    alert("SplitCode starter works!");
  });
\`\`\`

\`\`\`javascript filename="js/utils.js"
function getProjectName() {
  return "SplitCode Starter";
}

console.log(getProjectName());
\`\`\`

\`\`\`json filename="data/project.json"
{
  "name": "SplitCode",
  "version": "1.0",
  "editor": "Monaco",
  "smartReferences": true,
  "diagnostics": true
}
\`\`\`

\`\`\`markdown filename="README.md"
# SplitCode Starter Project

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
  const fileName = getFileName(lower);

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

  if (
    lower.endsWith(".vue") ||
    lower.endsWith(".svelte") ||
    lower.endsWith(".astro")
  ) {
    return "html";
  }

  if (
    fileName === "dockerfile" ||
    fileName === "makefile" ||
    fileName.startsWith(".env")
  ) {
    return "text";
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
  const [inputCode, setInputCode] = useState("");

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);

  const [activeFileId, setActiveFileId] = useState(null);
  const [openFileIds, setOpenFileIds] = useState([]);

  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  // V10.1 workspace usability
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(230);
  const [resizingExplorer, setResizingExplorer] = useState(false);
  const [previewViewport, setPreviewViewport] = useState("desktop");
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [editorCursor, setEditorCursor] = useState({ line: 1, column: 1 });
  const [fileSearch, setFileSearch] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [startMode, setStartMode] = useState("choices");
  const [workspaceTab, setWorkspaceTab] = useState("code");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const dialogResolverRef = useRef(null);
  const dialogInputRef = useRef(null);

  const [storageReady, setStorageReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved");

  // ========================================================
  // V10.3 EDITOR PRODUCTIVITY
  // ========================================================

  function getFileLanguage(fileName = "") {
    const lower = fileName.toLowerCase();
    const ext = lower.split(".").pop();

    if (lower.endsWith(".component.ts")) return "Angular TypeScript";
    if (lower.endsWith(".component.html")) return "Angular Template";
    if (lower.endsWith(".component.scss")) return "Angular SCSS";

    const languages = {
      html: "HTML",
      htm: "HTML",
      css: "CSS",
      scss: "SCSS",
      sass: "Sass",
      less: "Less",
      js: "JavaScript",
      mjs: "JavaScript Module",
      cjs: "CommonJS",
      jsx: "React JSX",
      ts: "TypeScript",
      tsx: "React TSX",
      vue: "Vue",
      svelte: "Svelte",
      astro: "Astro",
      json: "JSON",
      jsonc: "JSON with Comments",
      md: "Markdown",
      mdx: "MDX",
      txt: "Plain Text",
      svg: "SVG",
      xml: "XML",
      yaml: "YAML",
      yml: "YAML",
      toml: "TOML",
      graphql: "GraphQL",
      gql: "GraphQL",
      prisma: "Prisma",
      py: "Python",
      java: "Java",
      cs: "C#",
      go: "Go",
      rs: "Rust",
      php: "PHP",
      rb: "Ruby",
      sh: "Shell",
      ps1: "PowerShell",
      sql: "SQL",
    };

    if (fileName === "Dockerfile") return "Dockerfile";
    if (fileName === "Makefile") return "Makefile";

    return languages[ext] || (ext ? ext.toUpperCase() : "Text");
  }

  function getFileIcon(fileName = "") {
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (["html", "htm", "vue", "svelte", "astro"].includes(ext)) {
      return "bi-filetype-html";
    }

    if (["css", "scss", "sass", "less"].includes(ext)) {
      return "bi-filetype-css";
    }

    if (["js", "jsx", "mjs", "cjs"].includes(ext)) {
      return "bi-filetype-js";
    }

    if (["ts", "tsx"].includes(ext)) return "bi-file-earmark-code";
    if (["json", "jsonc"].includes(ext)) return "bi-braces";
    if (["md", "mdx"].includes(ext)) return "bi-markdown";
    if (["svg"].includes(ext)) return "bi-filetype-svg";

    return "bi-file-earmark-code";
  }


  // ========================================================
  // V10.11 CUSTOM DIALOG SYSTEM
  // Replaces browser prompt() and confirm().
  // ========================================================

  function resolveDialog(result) {
    const resolver = dialogResolverRef.current;

    dialogResolverRef.current = null;
    setDialog(null);

    if (typeof resolver === "function") {
      resolver(result);
    }
  }

  function showPrompt({
    title,
    description = "",
    label = "Value",
    value = "",
    placeholder = "",
    examples = [],
    confirmLabel = "Continue",
    icon = "bi-pencil",
  }) {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;

      setDialog({
        type: "prompt",
        title,
        description,
        label,
        value,
        placeholder,
        examples,
        confirmLabel,
        icon,
        danger: false,
      });
    });
  }

  function showConfirm({
    title,
    description = "",
    confirmLabel = "Confirm",
    icon = "bi-exclamation-triangle",
    danger = false,
  }) {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;

      setDialog({
        type: "confirm",
        title,
        description,
        confirmLabel,
        icon,
        danger,
      });
    });
  }

  function cancelDialog() {
    if (!dialog) {
      return;
    }

    resolveDialog(
      dialog.type === "confirm"
        ? false
        : null
    );
  }

  function submitDialog(event) {
    event?.preventDefault();

    if (!dialog) {
      return;
    }

    if (dialog.type === "prompt") {
      resolveDialog(dialog.value);
      return;
    }

    resolveDialog(true);
  }

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    function handleDialogKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();

        resolveDialog(
          dialog.type === "confirm"
            ? false
            : null
        );
      }
    }

    window.addEventListener(
      "keydown",
      handleDialogKeyDown
    );

    if (
      dialog.type === "prompt" &&
      dialogInputRef.current
    ) {
      window.setTimeout(() => {
        dialogInputRef.current?.focus();
        dialogInputRef.current?.select();
      }, 0);
    }

    return () => {
      window.removeEventListener(
        "keydown",
        handleDialogKeyDown
      );
    };
  }, [dialog?.type]);


  // ========================================================
  // V10.1 RESIZABLE EXPLORER + SAVE SHORTCUT
  // ========================================================

  useEffect(() => {
    if (!resizingExplorer) return undefined;

    function handleMouseMove(event) {
      const workspace = document.querySelector(".projectEditor");
      if (!workspace) return;

      const rect = workspace.getBoundingClientRect();
      const nextWidth = Math.min(
        380,
        Math.max(170, event.clientX - rect.left)
      );
      setExplorerWidth(nextWidth);
    }

    function handleMouseUp() {
      setResizingExplorer(false);
    }

    document.body.classList.add("scIsResizing");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.classList.remove("scIsResizing");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingExplorer]);

  useEffect(() => {
    function handleSaveShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (view === "workspace") {
          saveCurrentProjectNow();
          setMessage("Project saved locally.");
        }
      }
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  });

  // ========================================================
  // V12.3 SAFE FILE DRAGGING
  // ========================================================

  useEffect(() => {
    function hasFiles(event) {
      return Array.from(event.dataTransfer?.types || []).includes("Files");
    }

    function preventBrowserFileNavigation(event) {
      if (hasFiles(event)) {
        event.preventDefault();
      }
    }

    function clearDragState(event) {
      if (hasFiles(event)) {
        event.preventDefault();
        setDragging(false);
      }
    }

    window.addEventListener("dragover", preventBrowserFileNavigation);
    window.addEventListener("drop", clearDragState);

    return () => {
      window.removeEventListener("dragover", preventBrowserFileNavigation);
      window.removeEventListener("drop", clearDragState);
    };
  }, []);

  useEffect(() => {
    function closeWorkspaceMenu(event) {
      if (
        workspaceMenuOpen &&
        !event.target.closest(".scWorkspaceMenuWrap")
      ) {
        setWorkspaceMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeWorkspaceMenu);

    return () => {
      window.removeEventListener("pointerdown", closeWorkspaceMenu);
    };
  }, [workspaceMenuOpen]);

  // ========================================================
  // V9 PRODUCT NAVIGATION
  // ========================================================

  const [view, setView] = useState("home");
  const [savedProject, setSavedProject] = useState(null);

  const savedProjectInfo = useMemo(() => {
    if (!savedProject) {
      return null;
    }

    return {
      fileCount: Array.isArray(savedProject.files)
        ? savedProject.files.length
        : 0,
      savedAt: savedProject.savedAt || null,
    };
  }, [savedProject]);

  // ========================================================
// V9 LOAD SAVED PROJECT METADATA
// Home opens first. The saved project is restored only
// when the user chooses Continue Project.
// ========================================================

useEffect(() => {
  const saved = loadProjectState();

  setSavedProject(saved);
  setStorageReady(true);
}, []);

// ========================================================
// V7 AUTO SAVE LOCAL PROJECT
// ========================================================

useEffect(() => {
  if (
    !storageReady ||
    view !== "workspace"
  ) {
    return;
  }

  setSaveStatus("saving");

  const timer = setTimeout(() => {
    const nextState = {
      inputCode,
      files,
      folders,
      activeFileId,
      openFileIds,
    };

    const saved =
      saveProjectState(nextState);

    if (saved) {
      setSavedProject({
        ...nextState,
        version: 7,
        savedAt: Date.now(),
      });

      setSaveStatus("saved");
    } else {
      setSaveStatus("error");
    }
  }, 500);

  return () => {
    clearTimeout(timer);
  };
}, [
  storageReady,
  view,
  inputCode,
  files,
  folders,
  activeFileId,
  openFileIds,
]);

  // ========================================================
  // V9 HOME / WORKSPACE ACTIONS
  // ========================================================

  function startNewProject() {
    setInputCode("");
    setFiles([]);
    setFolders([]);
    setActiveFileId(null);
    setOpenFileIds([]);
    setPreview("");
    setMessage("");
    setSourceFileName("");
    setStartMode("choices");
    setWorkspaceTab("code");
    setSourceCollapsed(false);
    setView("workspace");
  }

  function continueSavedProject() {
    const saved = loadProjectState();

    if (!saved) {
      setSavedProject(null);
      setMessage("No locally saved project was found.");
      return;
    }

    const restoredFiles = Array.isArray(saved.files)
      ? saved.files
      : [];

    const restoredFolders = Array.isArray(saved.folders)
      ? saved.folders
      : [];

    const validFileIds = new Set(
      restoredFiles.map((file) => file.id)
    );

    const restoredOpenFileIds = Array.isArray(saved.openFileIds)
      ? saved.openFileIds.filter((id) => validFileIds.has(id))
      : [];

    let restoredActiveFileId = saved.activeFileId;

    if (!validFileIds.has(restoredActiveFileId)) {
      restoredActiveFileId =
        restoredOpenFileIds[0] ||
        restoredFiles[0]?.id ||
        null;
    }

    if (
      restoredActiveFileId &&
      !restoredOpenFileIds.includes(restoredActiveFileId)
    ) {
      restoredOpenFileIds.push(restoredActiveFileId);
    }

    setInputCode(
      typeof saved.inputCode === "string"
        ? saved.inputCode
        : ""
    );
    setFiles(restoredFiles);
    setFolders(restoredFolders);
    setActiveFileId(restoredActiveFileId);
    setOpenFileIds(restoredOpenFileIds);
    setSavedProject(saved);
    setMessage("Saved project restored.");
    setStartMode("choices");
    setWorkspaceTab("code");
    setSourceCollapsed(true);
    setView("workspace");
  }

  function saveCurrentProjectNow() {
    const nextState = {
      inputCode,
      files,
      folders,
      activeFileId,
      openFileIds,
    };

    const saved = saveProjectState(nextState);

    if (saved) {
      setSavedProject({
        ...nextState,
        version: 7,
        savedAt: Date.now(),
      });
      setSaveStatus("saved");
    } else {
      setSaveStatus("error");
    }
  }

  function goHome() {
    if (view === "workspace") {
      saveCurrentProjectNow();
    }
    setView("home");
  }

  // ========================================================
  // V6 DIAGNOSTICS
  // ========================================================

  const diagnostics = useMemo(() => {
    return diagnoseProject(files);
  }, [files]);

  // ========================================================
  // V11.2 FRAMEWORK DETECTION
  // ========================================================

  const projectFramework = useMemo(() => {
    return detectProjectFramework(files);
  }, [files]);

  const previewPlan = useMemo(() => {
    return getProjectPreviewPlan(
      files,
      projectFramework
    );
  }, [files, projectFramework]);

  // ========================================================
  // V11.4 PROJECT RELATIONSHIPS
  // ========================================================

  const projectRelationships = useMemo(() => {
    return analyzeProjectRelationships(
      files
    );
  }, [files]);

  const relationshipRepairs = useMemo(() => {
    const repairs = {};

    projectRelationships.missing.forEach((edge) => {
      const repair =
        getRelationshipRepair(
          edge,
          files
        );

      if (repair) {
        repairs[edge.id] = repair;
      }
    });

    return repairs;
  }, [
    projectRelationships,
    files,
  ]);

  // ========================================================
  // V11.6 PROJECT HEALTH
  // ========================================================

  const projectHealth = useMemo(() => {
    return getProjectHealthSummary({
      files,
      diagnostics,
      relationships:
        projectRelationships,
      framework:
        projectFramework,
      previewPlan,
      relationshipRepairs,
    });
  }, [
    files,
    diagnostics,
    projectRelationships,
    projectFramework,
    previewPlan,
    relationshipRepairs,
  ]);

  // ========================================================
  // V11.7 EXPORT READINESS
  // ========================================================

  const exportReadiness = useMemo(() => {
    return getExportReadiness({
      files,
      diagnostics,
      relationships:
        projectRelationships,
      framework:
        projectFramework,
      previewPlan,
      projectHealth,
    });
  }, [
    files,
    diagnostics,
    projectRelationships,
    projectFramework,
    previewPlan,
    projectHealth,
  ]);

  // ========================================================
  // V11.8 EXPORT DOCUMENTATION
  // ========================================================

  const exportDocumentationPlan = useMemo(() => {
    return getExportDocumentationPlan(
      files
    );
  }, [files]);

  // ========================================================
  // V9 WORKSPACE STATUS
  // ========================================================

  const workspaceHealth = useMemo(() => {
    if (!files.length) {
      return {
        label: "No project",
        tone: "neutral",
        icon: "•",
      };
    }

    if (diagnostics.errors > 0) {
      return {
        label: `${diagnostics.errors} ${
          diagnostics.errors === 1 ? "Error" : "Errors"
        }`,
        tone: "error",
        icon: "!",
      };
    }

    if (diagnostics.warnings > 0) {
      return {
        label: `${diagnostics.warnings} ${
          diagnostics.warnings === 1 ? "Warning" : "Warnings"
        }`,
        tone: "warning",
        icon: "⚠",
      };
    }

    return {
      label: "Healthy",
      tone: "healthy",
      icon: "✓",
    };
  }, [
    files.length,
    diagnostics.errors,
    diagnostics.warnings,
  ]);

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


  const filteredFiles = useMemo(() => {
    const query = fileSearch.trim().toLowerCase();

    if (!query) {
      return files;
    }

    return files.filter((file) =>
      normalizePath(file.path || file.name)
        .toLowerCase()
        .includes(query)
    );
  }, [files, fileSearch]);

  const filteredFolders = useMemo(() => {
    const query = fileSearch.trim().toLowerCase();

    if (!query) {
      return folders;
    }

    return folders.filter((folder) => {
      const normalizedFolder = normalizePath(folder).toLowerCase();

      if (normalizedFolder.includes(query)) {
        return true;
      }

      return filteredFiles.some((file) =>
        normalizePath(file.path)
          .toLowerCase()
          .startsWith(`${normalizedFolder}/`)
      );
    });
  }, [folders, filteredFiles, fileSearch]);

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
    setWorkspaceTab("code");

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
  // V10.12 SINGLE-FILE HTML SPLITTER
  // Converts one standalone HTML document into real project
  // files while preserving external references.
  // ========================================================

  function looksLikeStandaloneHtml(source = "") {
    const value = source.trim();

    if (!value || value.includes("```")) {
      return false;
    }

    return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(
      value
    );
  }

  function splitStandaloneHtmlDocument(
    source,
    preferredHtmlName = "index.html"
  ) {
    let html = source;

    const styleBlocks = [];
    const scriptBlocks = [];
    let usesModuleScript = false;

    html = html.replace(
      /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
      (fullMatch, attributes = "", content = "") => {
        const hasMediaAttribute =
          /\bmedia\s*=/i.test(attributes);

        if (hasMediaAttribute) {
          return fullMatch;
        }

        if (content.trim()) {
          styleBlocks.push(content.trim());
        }

        return "";
      }
    );

    html = html.replace(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
      (fullMatch, attributes = "", content = "") => {
        if (/\bsrc\s*=/i.test(attributes)) {
          return fullMatch;
        }

        const typeMatch =
          attributes.match(
            /\btype\s*=\s*["']([^"']+)["']/i
          );

        const scriptType =
          typeMatch?.[1]?.toLowerCase() || "";

        const isJavaScriptType =
          !scriptType ||
          scriptType === "module" ||
          scriptType === "text/javascript" ||
          scriptType === "application/javascript";

        if (!isJavaScriptType) {
          return fullMatch;
        }

        if (scriptType === "module") {
          usesModuleScript = true;
        }

        if (content.trim()) {
          scriptBlocks.push(content.trim());
        }

        return "";
      }
    );

    if (styleBlocks.length > 0) {
      const stylesheetTag =
        '  <link rel="stylesheet" href="style.css">';

      if (/<\/head>/i.test(html)) {
        html = html.replace(
          /<\/head>/i,
          `${stylesheetTag}\n</head>`
        );
      } else {
        html =
          `${stylesheetTag}\n${html}`;
      }
    }

    if (scriptBlocks.length > 0) {
      const scriptTag =
        usesModuleScript
          ? '  <script type="module" src="script.js"></script>'
          : '  <script src="script.js"></script>';

      if (/<\/body>/i.test(html)) {
        html = html.replace(
          /<\/body>/i,
          `${scriptTag}\n</body>`
        );
      } else {
        html =
          `${html}\n${scriptTag}`;
      }
    }

    const requestedHtmlName =
      normalizePath(preferredHtmlName);

    const htmlName =
      /\.(html?|HTML?)$/.test(requestedHtmlName)
        ? requestedHtmlName
        : "index.html";

    const generatedFiles = [
      {
        id: createFileId(),
        path: htmlName,
        name: getFileName(htmlName),
        language: "html",
        content: html.trim(),
      },
    ];

    if (styleBlocks.length > 0) {
      generatedFiles.push({
        id: createFileId(),
        path: "style.css",
        name: "style.css",
        language: "css",
        content: `${styleBlocks.join("\\n\\n")}\\n`,
      });
    }

    if (scriptBlocks.length > 0) {
      generatedFiles.push({
        id: createFileId(),
        path: "script.js",
        name: "script.js",
        language: "javascript",
        content: `${scriptBlocks.join("\\n\\n")}\\n`,
      });
    }

    return {
      files: generatedFiles,
      message:
        generatedFiles.length > 1
          ? `Split standalone HTML into ${generatedFiles.length} project files.`
          : `Converted ${htmlName} into a SplitCode project file.`,
    };
  }


  function applySplitResult(
    result,
    fallbackMessage = "Project split successfully."
  ) {
    if (!result?.files?.length) {
      setMessage(
        result?.message ||
        "SplitCode could not detect project files in this source."
      );
      return false;
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
      firstFile?.id || null
    );

    setOpenFileIds(
      firstFile
        ? [firstFile.id]
        : []
    );

    setPreview("");
    setSourceCollapsed(true);
    setStartMode("choices");
    setWorkspaceTab("code");
    setSourceFileName("");

    setMessage(
      result.message ||
      fallbackMessage
    );

    return true;
  }

  function hasSplittableInlineCode(content = "") {
    const hasInlineStyle =
      /<style\b[^>]*>[\s\S]*?<\/style>/i.test(
        content
      );

    const hasInlineScript =
      /<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/i.test(
        content
      );

    return (
      hasInlineStyle ||
      hasInlineScript
    );
  }

  function createUniqueSiblingPath(
    sourcePath,
    preferredName,
    reservedPaths = []
  ) {
    const directory =
      getDirectory(sourcePath);

    const dotIndex =
      preferredName.lastIndexOf(".");

    const baseName =
      dotIndex > 0
        ? preferredName.slice(0, dotIndex)
        : preferredName;

    const extension =
      dotIndex > 0
        ? preferredName.slice(dotIndex)
        : "";

    const reserved =
      new Set(
        reservedPaths.map((path) =>
          normalizePath(path).toLowerCase()
        )
      );

    let index = 1;

    while (true) {
      const fileName =
        index === 1
          ? `${baseName}${extension}`
          : `${baseName}-${index}${extension}`;

      const candidate =
        normalizePath(
          directory
            ? `${directory}/${fileName}`
            : fileName
        );

      const existsInProject =
        files.some(
          (file) =>
            file.id !== activeFile?.id &&
            normalizePath(file.path).toLowerCase() ===
              candidate.toLowerCase()
        );

      if (
        !existsInProject &&
        !reserved.has(
          candidate.toLowerCase()
        )
      ) {
        return candidate;
      }

      index += 1;
    }
  }

  function splitActiveHtmlFile() {
    if (
      !activeFile ||
      activeFile.language !== "html"
    ) {
      setMessage(
        "Select an HTML file first."
      );
      return;
    }

    if (
      !hasSplittableInlineCode(
        activeFile.content
      )
    ) {
      setMessage(
        "No inline CSS or JavaScript was found in this HTML file."
      );
      return;
    }

    const result =
      splitStandaloneHtmlDocument(
        activeFile.content,
        activeFile.path || activeFile.name || "index.html"
      );

    const splitHtml =
      result.files.find(
        (file) =>
          file.language === "html"
      );

    const splitCss =
      result.files.find(
        (file) =>
          file.language === "css"
      );

    const splitJs =
      result.files.find(
        (file) =>
          file.language === "javascript"
      );

    if (
      !splitHtml ||
      (!splitCss && !splitJs)
    ) {
      setMessage(
        "SplitCode could not safely separate inline code from this HTML file."
      );
      return;
    }

    const reservedPaths = [];

    const cssPath =
      splitCss
        ? createUniqueSiblingPath(
            activeFile.path,
            "style.css",
            reservedPaths
          )
        : "";

    if (cssPath) {
      reservedPaths.push(cssPath);
    }

    const jsPath =
      splitJs
        ? createUniqueSiblingPath(
            activeFile.path,
            "script.js",
            reservedPaths
          )
        : "";

    if (jsPath) {
      reservedPaths.push(jsPath);
    }

    let nextHtmlContent =
      splitHtml.content;

    if (splitCss && cssPath) {
      nextHtmlContent =
        nextHtmlContent.replace(
          /href=["']style\.css["']/i,
          `href="${getFileName(cssPath)}"`
        );
    }

    if (splitJs && jsPath) {
      nextHtmlContent =
        nextHtmlContent.replace(
          /src=["']script\.js["']/i,
          `src="${getFileName(jsPath)}"`
        );
    }

    const createdFiles = [];

    if (splitCss && cssPath) {
      createdFiles.push({
        ...splitCss,
        id: createFileId(),
        path: cssPath,
        name: getFileName(cssPath),
      });
    }

    if (splitJs && jsPath) {
      createdFiles.push({
        ...splitJs,
        id: createFileId(),
        path: jsPath,
        name: getFileName(jsPath),
      });
    }

    const nextFiles =
      files.map((file) => {
        if (file.id !== activeFile.id) {
          return file;
        }

        return {
          ...file,
          content: nextHtmlContent,
        };
      });

    nextFiles.push(
      ...createdFiles
    );

    setFiles(nextFiles);

    setFolders(
      collectFoldersFromFiles(
        nextFiles
      )
    );

    setOpenFileIds((current) => {
      const next =
        new Set(current);

      next.add(activeFile.id);

      createdFiles.forEach(
        (file) =>
          next.add(file.id)
      );

      return [...next];
    });

    setActiveFileId(
      activeFile.id
    );

    setPreview("");

    const createdNames =
      createdFiles.map(
        (file) => file.path
      );

    setMessage(
      `Separated inline code from ${activeFile.name}: ${createdNames.join(", ")}`
    );
  }


  // ========================================================
  // SPLIT PROJECT
  // ========================================================

  function splitCode() {
    const result =
      looksLikeStandaloneHtml(inputCode)
        ? splitStandaloneHtmlDocument(
            inputCode,
            sourceFileName || "index.html"
          )
        : parseProject(inputCode);

    const applied =
      applySplitResult(result);

    if (applied) {
      setInputCode(inputCode);
    }
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

  async function createFile() {
    const requested =
      await showPrompt({
        title: "Create new file",
        description:
          "Add a file to your project. Include folders in the path when needed.",
        label: "File path",
        placeholder: "components/navbar.jsx",
        examples: [
          "about.html",
          "css/mobile.css",
          "js/main.js",
        ],
        confirmLabel: "Create File",
        icon: "bi-file-earmark-plus",
      });

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

  async function createFolder() {
    const requested =
      await showPrompt({
        title: "Create new folder",
        description:
          "Create a folder or a nested folder path inside your project.",
        label: "Folder path",
        placeholder: "components/navigation",
        examples: [
          "assets",
          "components",
          "pages/admin",
        ],
        confirmLabel: "Create Folder",
        icon: "bi-folder-plus",
      });

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

  async function renameFile(fileId) {
    const file =
      files.find(
        (item) =>
          item.id === fileId
      );

    if (!file) {
      return;
    }

    const requested =
      await showPrompt({
        title: "Rename file",
        description:
          "Change the filename or move it by editing the full project path.",
        label: "File path",
        value: file.path,
        placeholder: "components/navbar.jsx",
        confirmLabel: "Rename File",
        icon: "bi-pencil",
      });

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
  // V12.3.6 MOVE FILE TO FOLDER
  // ========================================================

  function moveFileToFolder(fileId, targetFolderPath = "") {
    const file = files.find((item) => item.id === fileId);

    if (!file) {
      return;
    }

    const oldPath = normalizePath(file.path);
    const targetFolder = normalizePath(targetFolderPath);
    const filename = getFileName(oldPath);

    const newPath = normalizePath(
      targetFolder ? `${targetFolder}/${filename}` : filename
    );

    if (!newPath || oldPath === newPath) {
      return;
    }

    if (filePathExists(newPath, fileId)) {
      setMessage(`${newPath} already exists.`);
      return;
    }

    const referenceResult = updateProjectReferences(
      files,
      oldPath,
      newPath
    );

    const movedFiles = referenceResult.files.map((item) => {
      if (item.id !== fileId) {
        return item;
      }

      return {
        ...item,
        path: newPath,
        name: getFileName(newPath),
        language: languageFromFilename(newPath),
      };
    });

    setFiles(movedFiles);

    if (targetFolder) {
      setFolders((current) =>
        ensureFolderParents(current, targetFolder)
      );
    }

    if (referenceResult.totalUpdates > 0) {
      setMessage(
        `Moved ${oldPath} → ${newPath} • Updated ${referenceResult.totalUpdates} reference${
          referenceResult.totalUpdates === 1 ? "" : "s"
        }.`
      );
    } else {
      setMessage(`Moved ${oldPath} → ${newPath}.`);
    }
  }

  // ========================================================
  // DELETE FILE
  // ========================================================

  async function deleteFile(fileId) {
    const file =
      files.find(
        (item) =>
          item.id === fileId
      );

    if (!file) {
      return;
    }

    const confirmed =
      await showConfirm({
        title: "Delete file?",
        description:
          `"${file.path}" will be removed from this project. This action cannot be undone.`,
        confirmLabel: "Delete File",
        icon: "bi-trash3",
        danger: true,
      });

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

  async function renameFolder(oldFolderPath) {
    const requested =
      await showPrompt({
        title: "Rename folder",
        description:
          "Rename this folder or change its project path. SplitCode will update moved file references where possible.",
        label: "Folder path",
        value: oldFolderPath,
        placeholder: "components/navigation",
        confirmLabel: "Rename Folder",
        icon: "bi-folder",
      });

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

  async function deleteFolder(folderPath) {
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
      await showConfirm({
        title:
          containedFiles.length > 0
            ? "Delete folder and files?"
            : "Delete folder?",
        description: warning,
        confirmLabel: "Delete Folder",
        icon: "bi-folder-x",
        danger: true,
      });

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
    if (!previewPlan.canPreview) {
      setPreview("");
      return;
    }

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

  function openPreviewInNewTab() {
    if (!previewPlan.canPreview) {
      setMessage(
        previewPlan.description
      );
      return;
    }

    if (!preview) {
      setMessage("Nothing to preview yet.");
      return;
    }

    const blob = new Blob(
      [preview],
      { type: "text/html;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  }

  useEffect(() => {
    if (
      !files.length ||
      !previewPlan.canPreview
    ) {
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
  }, [
    files,
    previewPlan.canPreview,
  ]);

  // ========================================================
  // V10.13 SMART SINGLE HTML IMPORT
  // One HTML file is immediately separated into HTML/CSS/JS
  // when inline style/script blocks are present.
  // ========================================================

  async function importSingleHtmlAsSplitProject(file) {
    try {
      const source =
        await file.text();

      setInputCode(source);
      setSourceFileName(file.name);

      if (!looksLikeStandaloneHtml(source)) {
        handleFile(file);
        return;
      }

      const result =
        splitStandaloneHtmlDocument(
          source,
          file.name
        );

      const applied =
        applySplitResult(
          result,
          `${file.name} imported.`
        );

      if (applied) {
        setView("workspace");

        if (result.files.length > 1) {
          setMessage(
            `${file.name} imported and automatically separated into ${result.files.length} files.`
          );
        } else {
          setMessage(
            `${file.name} imported as one HTML file because no inline CSS or JavaScript was found.`
          );
        }
      }
    } catch (error) {
      console.error(error);

      setMessage(
        `Unable to read ${file.name}.`
      );
    }
  }

  // ========================================================
  // V12.3 PROJECT IMPORT
  // ========================================================

  function applyImportedProjectResult(result) {
    if (!result?.files?.length) {
      setMessage(
        result?.message ||
          "No readable project files were found."
      );
      return;
    }

    if (
      result.files.length === 1 &&
      result.files[0].language === "html" &&
      hasSplittableInlineCode(
        result.files[0].content
      )
    ) {
      const htmlFile =
        result.files[0];

      const splitResult =
        splitStandaloneHtmlDocument(
          htmlFile.content,
          htmlFile.path || htmlFile.name || "index.html"
        );

      const applied =
        applySplitResult(
          splitResult,
          `${htmlFile.name || "HTML file"} imported and separated.`
        );

      if (applied) {
        setView("workspace");
        setStartMode("choices");
        setWorkspaceTab("code");
        setSourceCollapsed(true);

        setMessage(
          `${htmlFile.name || "HTML file"} imported and automatically separated into ${splitResult.files.length} files.`
        );
      }

      return;
    }

    setFiles(result.files);
    setFolders(result.folders || []);

    const mainHTML =
      findMainHTMLFile(
        result.files
      );

    const preferredFile =
      mainHTML ||
      result.files.find((file) =>
        /(^|\/)src\/(App|app)\.(tsx|jsx|ts|js)$/i.test(file.path)
      ) ||
      result.files.find((file) =>
        /(^|\/)src\/(main|index)\.(tsx|jsx|ts|js)$/i.test(file.path)
      ) ||
      result.files[0];

    setActiveFileId(
      preferredFile.id
    );

    setOpenFileIds([
      preferredFile.id,
    ]);

    setSourceCollapsed(true);
    setStartMode("choices");
    setWorkspaceTab("code");
    setView("workspace");
    setMessage(result.message);
  }

  async function handleProjectImport(fileList) {
    if (!fileList || !fileList.length) {
      return;
    }

    setMessage("Importing project...");

    try {
      const result =
        await importProjectFiles(
          fileList
        );

      applyImportedProjectResult(result);
    } catch (error) {
      console.error(error);
      setMessage("Unable to import this project.");
    }
  }

  function isSplitSourceFile(file) {
    if (!file?.name) {
      return false;
    }

    const lowerName =
      file.name.toLowerCase();

    return [".txt", ".md"].some((extension) =>
      lowerName.endsWith(extension)
    );
  }

  function handleProjectFilesInput(event) {
    const selectedFiles =
      event.target.files;

    if (selectedFiles?.length === 1) {
      const file =
        selectedFiles[0];

      const lowerName =
        file.name.toLowerCase();

      if (
        lowerName.endsWith(".html") ||
        lowerName.endsWith(".htm")
      ) {
        importSingleHtmlAsSplitProject(
          file
        );
      } else if (
        isSplitSourceFile(file)
      ) {
        handleFile(file);
      } else {
        handleProjectImport(
          selectedFiles
        );
      }
    } else {
      handleProjectImport(
        selectedFiles
      );
    }

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

  async function handleProjectDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);
    setMessage("Reading dropped project...");

    try {
      const result =
        await importDroppedProject(
          event.dataTransfer
        );

      applyImportedProjectResult(result);
    } catch (error) {
      console.error(error);
      setMessage(
        "Unable to read the dropped files or folder."
      );
    }
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

        setSourceFileName(
          file.name
        );

        setSourceCollapsed(false);
        setView("workspace");

        setMessage(
          `${file.name} loaded as source. Click Split Project to convert it into project files.`
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

  async function performZipDownload() {
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

      // V11.8 — generate export-only documentation.
      // Existing README files are never overwritten.
      const exportDocumentation =
        generateExportDocumentation({
          files,
          framework:
            projectFramework,
          previewPlan,
          projectHealth,
          exportReadiness,
          diagnostics,
          relationships:
            projectRelationships,
          generatedAt:
            new Date().toISOString(),
        });

      exportDocumentation.documents.forEach(
        (document) => {
          zip.file(
            normalizePath(
              document.path
            ),
            document.content
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
        `Project ZIP downloaded with ${exportDocumentationPlan.generatedFileCount} SplitCode documentation file${
          exportDocumentationPlan.generatedFileCount === 1
            ? ""
            : "s"
        }.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to create project ZIP."
      );
    }
  }

  // ========================================================
  // V11.7 EXPORT PREFLIGHT GATE
  // ========================================================

  function scrollToExportPreflight() {
    document
      .getElementById(
        "splitcode-export-preflight"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

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

    if (
      exportReadiness.canExportCleanly
    ) {
      await performZipDownload();
      return;
    }

    const blockingText =
      exportReadiness.blockerCount > 0
        ? `${exportReadiness.blockerCount} blocking check${
            exportReadiness.blockerCount === 1
              ? ""
              : "s"
          } failed.`
        : `${exportReadiness.warningCount} warning${
            exportReadiness.warningCount === 1
              ? ""
              : "s"
          } should be reviewed.`;

    const confirmed =
      await showConfirm({
        title:
          exportReadiness.status === "blocked"
            ? "Export with unresolved issues?"
            : "Export after review?",
        description:
          `${blockingText} ${exportReadiness.summary}`,
        confirmLabel:
          exportReadiness.status === "blocked"
            ? "Export Anyway"
            : "Export ZIP",
        icon:
          exportReadiness.status === "blocked"
            ? "bi-shield-exclamation"
            : "bi-clipboard-check",
        danger:
          exportReadiness.status === "blocked",
      });

    if (!confirmed) {
      scrollToExportPreflight();
      return;
    }

    await performZipDownload();
  }

  // ========================================================
  // CLEAR
  // ========================================================

  async function clearProject() {
  const hasProjectData =
    inputCode.trim() ||
    files.length ||
    folders.length;

  if (hasProjectData) {
    const confirmed =
      await showConfirm({
        title: "Clear current project?",
        description:
          "Your current locally saved SplitCode project will be cleared before starting over.",
        confirmLabel: "Clear Project",
        icon: "bi-arrow-counterclockwise",
        danger: true,
      });

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

  setSavedProject(null);

  setMessage("Project cleared.");
  setStartMode("choices");
  setWorkspaceTab("code");
  setWorkspaceMenuOpen(false);
  setSourceCollapsed(false);
  setView("home");
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
  // V11.5 RELATIONSHIP-AWARE QUICK FIXES
  // ========================================================

  function relationshipEdgeToIssue(edge) {
    let type =
      "missing-reference";

    if (
      edge.type?.startsWith(
        "js-"
      )
    ) {
      type =
        "missing-import";
    } else if (
      edge.type ===
      "css-url"
    ) {
      type =
        "missing-asset";
    }

    return {
      id:
        `relationship-${edge.id}`,
      type,
      severity:
        "error",
      file:
        edge.sourcePath,
      reference:
        edge.reference,
      message:
        `Missing local reference: ${edge.reference}`,
    };
  }

  function repairRelationshipReference(edge) {
    const repair =
      relationshipRepairs[
        edge.id
      ];

    if (!repair) {
      setMessage(
        "No safe existing-file match was found for this reference."
      );
      return;
    }

    const result =
      applyRelationshipRepair(
        edge,
        repair,
        files
      );

    if (!result.changed) {
      setMessage(
        "SplitCode found a possible match, but could not safely rewrite this reference."
      );
      return;
    }

    setFiles(
      result.files
    );

    if (
      result.sourceFile?.id
    ) {
      openFile(
        result.sourceFile.id
      );
    }

    setMessage(
      `Fixed relationship: ${edge.reference} → ${repair.replacement}`
    );
  }

  function createRelationshipMissingFile(edge) {
    quickFixDiagnostic(
      relationshipEdgeToIssue(
        edge
      )
    );
  }

  // ========================================================
  // V11.6 PROJECT HEALTH & REPAIR CENTER
  // ========================================================

  function scrollToProjectIssues() {
    setWorkspaceTab("issues");

    window.setTimeout(() => {
      document
        .getElementById("splitcode-diagnostics")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  async function fixAllSafeIssues() {
    const seen =
      new Set();

    const safeEdges =
      projectRelationships.missing
        .filter((edge) => {
          const repair =
            relationshipRepairs[
              edge.id
            ];

          if (
            !repair ||
            repair.confidence !==
              "high"
          ) {
            return false;
          }

          const key =
            `${edge.sourceId}|${edge.type}|${edge.reference}`;

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        });

    if (!safeEdges.length) {
      setMessage(
        "No high-confidence automatic repairs are available."
      );
      return;
    }

    const confirmed =
      await showConfirm({
        title:
          "Fix all safe issues?",
        description:
          `SplitCode will update ${safeEdges.length} high-confidence broken reference${
            safeEdges.length === 1
              ? ""
              : "s"
          }. Medium/low-confidence matches, missing assets and orphaned files will be left for manual review.`,
        confirmLabel:
          `Fix ${safeEdges.length}`,
        icon:
          "bi-stars",
        danger:
          false,
      });

    if (!confirmed) {
      return;
    }

    let nextFiles =
      files;

    let fixedCount = 0;

    let firstChangedFileId =
      null;

    safeEdges.forEach((edge) => {
      const repair =
        relationshipRepairs[
          edge.id
        ];

      const result =
        applyRelationshipRepair(
          edge,
          repair,
          nextFiles
        );

      if (!result.changed) {
        return;
      }

      nextFiles =
        result.files;

      fixedCount += 1;

      if (
        !firstChangedFileId &&
        result.sourceFile?.id
      ) {
        firstChangedFileId =
          result.sourceFile.id;
      }
    });

    if (!fixedCount) {
      setMessage(
        "No references were changed. Review the suggested repairs manually."
      );
      return;
    }

    setFiles(
      nextFiles
    );

    if (firstChangedFileId) {
      openFile(
        firstChangedFileId
      );
    }

    setMessage(
      `Fixed ${fixedCount} high-confidence reference${
        fixedCount === 1
          ? ""
          : "s"
      }. Review the remaining issues manually.`
    );
  }

  // ========================================================
  // V12.3 SIMPLIFIED START / WORKSPACE ACTIONS
  // ========================================================

  function openStartPanel(mode = "choices") {
    setStartMode(mode);
    setSourceCollapsed(false);
    setWorkspaceMenuOpen(false);
  }

  function clearSourceCode() {
    setInputCode("");
    setSourceFileName("");
    setMessage("Pasted source cleared.");
  }

  function openEmptyWorkspace() {
    setInputCode("");
    setFiles([]);
    setFolders([]);
    setActiveFileId(null);
    setOpenFileIds([]);
    setPreview("");
    setSourceFileName("");
    setMessage(
      "Empty workspace ready. Create a file or folder from Project Files."
    );
    setStartMode("choices");
    setWorkspaceTab("code");
    setSourceCollapsed(true);
    setView("workspace");
  }

  // ========================================================
  // UI
  // ========================================================

  if (view === "home") {
    return (
      <div className="app scHomePage scCortexHome">
        <nav className="navbar scHomeNav scCortexNav">
          <button
            type="button"
            className="scBrandButton"
            onClick={() => setView("home")}
            aria-label="SplitCode home"
          >
            <img
              src={`${import.meta.env.BASE_URL}splitcode-logo.svg`}
              alt="SplitCode"
              className="scBrandLogoImage"
            />
          </button>

          <div className="scCortexNavLinks">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <span className="scLocalPill">
              <i className="bi bi-shield-check" aria-hidden="true" />
              Runs locally
            </span>
          </div>

          <div className="scCortexNavActions">
            <label className="scNavSecondary">
              Open project
              <input
                type="file"
                multiple
                accept={getSupportedAcceptString()}
                onChange={handleProjectFilesInput}
                hidden
              />
            </label>

            <button
              type="button"
              className="scNavPrimary"
              onClick={startNewProject}
            >
              Start building
            </button>
          </div>
        </nav>

        <main className="scCortexMain">
          <section className="scCortexHero">
            <div className="scHeroGlow scHeroGlowOne" />
            <div className="scHeroGlow scHeroGlowTwo" />

            <div className="scCortexHeroContent">
              <div className="scHeroEyebrow">
                <i className="bi bi-stars" aria-hidden="true" />
                AI CODE → REAL PROJECT
              </div>

              <h1>
                Turn AI Code Into
                <span> Real Projects.</span>
              </h1>

              <p>
                SplitCode organizes messy AI-generated code into structured files,
                checks references, repairs common issues and prepares your project
                for export.
              </p>

              <div className="scCortexHeroActions">
                <button
                  type="button"
                  className="scPrimaryCta"
                  onClick={startNewProject}
                >
                  Start building
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </button>

                <a className="scSecondaryCta" href="#how-it-works">
                  See how it works
                </a>
              </div>

              <div className="scCortexMeta">
                <span><i className="bi bi-shield-check" /> Local processing</span>
                <span><i className="bi bi-cpu" /> No AI API required</span>
                <span><i className="bi bi-file-earmark-zip" /> ZIP export</span>
              </div>
            </div>

            <div className="scProductStage" aria-label="SplitCode workspace preview">
              <div className="scProductWindow">
                <div className="scProductTopbar">
                  <div className="scMiniBrand">
                    <span className="scMiniLogo"><i className="bi bi-code-slash" /></span>
                    <strong>SplitCode</strong>
                  </div>
                  <div className="scMiniTopActions">
                    <span>Project</span>
                    <span>Diagnostics</span>
                    <span className="scMiniExport">Export ZIP</span>
                  </div>
                </div>

                <div className="scProductBody">
                  <aside className="scMockExplorer">
                    <div className="scMockSectionTitle">PROJECT</div>
                    <div className="scMockFile active">
                      <i className="bi bi-filetype-html" /> index.html
                    </div>
                    <div className="scMockFile">
                      <i className="bi bi-filetype-css" /> style.css
                    </div>
                    <div className="scMockFile">
                      <i className="bi bi-filetype-js" /> script.js
                    </div>
                    <div className="scMockFolder">
                      <i className="bi bi-folder2" /> assets
                    </div>
                  </aside>

                  <div className="scMockEditor">
                    <div className="scMockTabs">
                      <span className="active"><i className="bi bi-filetype-html" /> index.html</span>
                      <span><i className="bi bi-filetype-css" /> style.css</span>
                    </div>
                    <div className="scMockCode">
                      <div><b>1</b><code><em>&lt;!DOCTYPE</em> html&gt;</code></div>
                      <div><b>2</b><code><em>&lt;html</em> lang=<mark>"en"</mark>&gt;</code></div>
                      <div><b>3</b><code>  <em>&lt;head&gt;</em></code></div>
                      <div><b>4</b><code>    <em>&lt;title&gt;</em>SplitCode<em>&lt;/title&gt;</em></code></div>
                      <div><b>5</b><code>    <em>&lt;link</em> rel=<mark>"stylesheet"</mark> href=<mark>"style.css"</mark>&gt;</code></div>
                      <div><b>6</b><code>  <em>&lt;/head&gt;</em></code></div>
                      <div><b>7</b><code>  <em>&lt;body&gt;</em></code></div>
                      <div><b>8</b><code>    <em>&lt;main</em> class=<mark>"app"</mark>&gt;</code></div>
                      <div><b>9</b><code>      Your project is ready.</code></div>
                      <div><b>10</b><code>    <em>&lt;/main&gt;</em></code></div>
                    </div>
                    <div className="scMockStatus">
                      <span><i className="bi bi-check-circle-fill" /> References valid</span>
                      <span>Ln 8, Col 12</span>
                    </div>
                  </div>

                  <aside className="scMockPreview">
                    <div className="scMockPreviewTitle">
                      <span>Preview</span>
                      <i className="bi bi-arrow-clockwise" />
                    </div>
                    <div className="scMockBrowser">
                      <div className="scMockBrowserBar">
                        <i></i><i></i><i></i>
                        <span>localhost</span>
                      </div>
                      <div className="scMockSite">
                        <div className="scMockSiteBadge">SPLITCODE</div>
                        <strong>Project ready.</strong>
                        <p>Structured. Checked. Exportable.</p>
                        <button type="button" tabIndex="-1">Launch project</button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </section>

          <section className="scCortexDark" id="how-it-works">
            <div className="scDarkIntro">
              <h2>
                Built for the way
                <span> AI generates code today.</span>
              </h2>
              <p>
                Stop manually creating files and chasing broken paths.
                SplitCode turns generated output into a project you can actually work with.
              </p>
            </div>

            <div className="scProcessFlow" id="features">
              <svg
                className="scProcessFlowSvg"
                viewBox="0 0 1000 430"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="splitcodeProcessGradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0%" stopColor="#3366FF" stopOpacity="0.55" />
                    <stop offset="45%" stopColor="#5C8BFF" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#3366FF" stopOpacity="0.55" />
                  </linearGradient>

                  <filter
                    id="splitcodeProcessGlow"
                    x="-20%"
                    y="-40%"
                    width="140%"
                    height="180%"
                  >
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  className="scProcessFlowShadow"
                  d="M125 238 C220 238 275 128 375 128 S525 248 625 248 S775 138 875 138"
                />

                <path
                  className="scProcessFlowTrack"
                  d="M125 238 C220 238 275 128 375 128 S525 248 625 248 S775 138 875 138"
                  stroke="url(#splitcodeProcessGradient)"
                  filter="url(#splitcodeProcessGlow)"
                />
              </svg>

              <div className="scProcessGrid">
                <article className="scProcessStep scProcessStep-1">
                  <span className="scProcessNumber" aria-hidden="true">01</span>

                  <div className="scProcessNode">
                    <i className="bi bi-braces" aria-hidden="true" />
                  </div>

                  <div className="scProcessCopy">
                    <small>STEP 01</small>
                    <h3>Paste messy code</h3>
                    <p>
                      Bring output from ChatGPT, Claude, Gemini or another coding assistant.
                    </p>
                  </div>
                </article>

                <article className="scProcessStep scProcessStep-2">
                  <span className="scProcessNumber" aria-hidden="true">02</span>

                  <div className="scProcessNode">
                    <i className="bi bi-folder2-open" aria-hidden="true" />
                  </div>

                  <div className="scProcessCopy">
                    <small>STEP 02</small>
                    <h3>Build the structure</h3>
                    <p>
                      Split code into real files and manage the project from one workspace.
                    </p>
                  </div>
                </article>

                <article className="scProcessStep scProcessStep-3">
                  <span className="scProcessNumber" aria-hidden="true">03</span>

                  <div className="scProcessNode">
                    <i className="bi bi-activity" aria-hidden="true" />
                  </div>

                  <div className="scProcessCopy">
                    <small>STEP 03</small>
                    <h3>Check & repair</h3>
                    <p>
                      Find broken references, inspect issues and repair common project problems.
                    </p>
                  </div>
                </article>

                <article className="scProcessStep scProcessStep-4">
                  <span className="scProcessNumber" aria-hidden="true">04</span>

                  <div className="scProcessNode">
                    <i className="bi bi-file-earmark-zip" aria-hidden="true" />
                  </div>

                  <div className="scProcessCopy">
                    <small>STEP 04</small>
                    <h3>Preview & export</h3>
                    <p>
                      Review the result in the browser and download the organized project as ZIP.
                    </p>
                  </div>
                </article>
              </div>
            </div>

            <div className="scDarkBottom">
              <div>
                <small>YOUR CODE STAYS WITH YOU</small>
                <strong>Browser-based. Local-first. No AI API required.</strong>
              </div>

              <div className="scDarkActions">
                {savedProject ? (
                  <button
                    type="button"
                    className="scDarkSecondary"
                    onClick={continueSavedProject}
                  >
                    <i className="bi bi-clock-history" />
                    Continue project
                  </button>
                ) : null}

                <button
                  type="button"
                  className="scDarkPrimary"
                  onClick={startNewProject}
                >
                  Start building
                  <i className="bi bi-arrow-right" />
                </button>
              </div>
            </div>
          </section>
        </main>

        <footer className="scHomeFooter scCortexFooter">
          <div className="scFooterInner">
            <div className="scFooterBrandBlock">
              <div className="scFooterBrand">
                <span className="scFooterLogoPlate">
                  <img
                    src={`${import.meta.env.BASE_URL}splitcode-logo.svg`}
                    alt="SplitCode"
                    className="scFooterBrandImage"
                  />
                </span>
              </div>

              <p>
                Turn AI-generated code into structured, reviewable and export-ready
                projects directly in your browser.
              </p>

              <div className="scFooterTrust">
                <span>
                  <i className="bi bi-shield-check" aria-hidden="true" />
                  Local-first
                </span>

                <span>
                  <i className="bi bi-browser-chrome" aria-hidden="true" />
                  Browser-based
                </span>

                <span>
                  <i className="bi bi-cpu" aria-hidden="true" />
                  No AI API required
                </span>
              </div>
            </div>

            <div className="scFooterColumns">
              <nav className="scFooterColumn" aria-label="Product">
                <strong>Product</strong>

                <a href="#how-it-works">
                  How it works
                </a>

                <a href="#features">
                  Features
                </a>

                <button
                  type="button"
                  onClick={startNewProject}
                >
                  Start building
                </button>
              </nav>

              <div className="scFooterColumn">
                <strong>Designed for</strong>

                <span>AI-generated code</span>
                <span>Project cleanup</span>
                <span>Repair & export</span>
              </div>

              <div className="scFooterColumn">
                <strong>Principles</strong>

                <span>Your code stays with you</span>
                <span>No forced cloud upload</span>
                <span>Export when you are ready</span>
              </div>
            </div>
          </div>

          <div className="scFooterBottom">
            <span>
              © {new Date().getFullYear()} SplitCode. Built for turning AI output
              into working projects.
            </span>

            <button
              type="button"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                })
              }
            >
              Back to top
              <i className="bi bi-arrow-up" aria-hidden="true" />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="app scFinalWorkspacePage">
      <header className="scFinalHeader">
        <div className="scFinalHeaderInner">
          <div className="scFinalBrandGroup">
            <button
              type="button"
              className="scFinalBrand"
              onClick={goHome}
              aria-label="SplitCode home"
            >
              <img
                src={`${import.meta.env.BASE_URL}splitcode-logo.svg`}
                alt="SplitCode"
                className="scFinalBrandLogoImage"
              />
            </button>

            <span className="scFinalHeaderDivider" />

            <div className="scFinalWorkspaceTitle">
              <strong>Project Workspace</strong>
              <span>Build, repair, preview and export your project</span>
            </div>
          </div>

          <div className="scFinalHeaderActions">
            <div className={`scFinalSaveStatus scFinalSaveStatus-${saveStatus}`}>
              {saveStatus === "saving" ? (
                <>
                  <span className="scFinalStatusDot isSaving" />
                  Saving...
                </>
              ) : saveStatus === "error" ? (
                <>
                  <span className="scFinalStatusDot isError" />
                  Save failed
                </>
              ) : (
                <>
                  <span className="scFinalStatusDot" />
                  Saved locally
                </>
              )}
            </div>

            <button
              type="button"
              className="scFinalHeaderButton"
              onClick={() => {
                setWorkspaceTab("export");
                setWorkspaceMenuOpen(false);
              }}
            >
              <i className="bi bi-download" aria-hidden="true" />
              Export
            </button>

            <div className="scWorkspaceMenuWrap">
              <button
                type="button"
                className="scFinalIconButton scWorkspaceMenuTrigger"
                onClick={() =>
                  setWorkspaceMenuOpen((value) => !value)
                }
                aria-label="More project actions"
                aria-expanded={workspaceMenuOpen}
                title="More project actions"
              >
                <i className="bi bi-three-dots" aria-hidden="true" />
              </button>

              {workspaceMenuOpen ? (
                <div className="scWorkspaceMenu">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      saveCurrentProjectNow();
                      setMessage("Project saved locally.");
                    }}
                  >
                    <i className="bi bi-floppy" aria-hidden="true" />
                    Save Project
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      goHome();
                    }}
                  >
                    <i className="bi bi-house" aria-hidden="true" />
                    Back to Home
                  </button>

                  <button
                    type="button"
                    className="isDanger"
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      clearProject();
                    }}
                  >
                    <i className="bi bi-trash3" aria-hidden="true" />
                    Clear Project
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="scFinalContainer">
        {!sourceCollapsed ? (
          <section className="scSimpleStartPanel scV123StartPanel">
            <div className="scSimpleStartHeader">
              <div>
                <span className="scSimpleStartIcon">
                  <i
                    className={
                      startMode === "paste"
                        ? "bi bi-stars"
                        : startMode === "import"
                          ? "bi bi-folder2-open"
                          : "bi bi-grid"
                    }
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <strong>
                    {startMode === "paste"
                      ? "Paste AI Code"
                      : startMode === "import"
                        ? "Import Project"
                        : "What do you want to do?"}
                  </strong>

                  <span>
                    {startMode === "paste"
                      ? "Paste one AI response and SplitCode will turn it into project files."
                      : startMode === "import"
                        ? "Import files or a complete project folder. Framework source files stay editable."
                        : "Choose one clear starting action. You can switch later without losing your current project."}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="scFinalIconButton"
                onClick={() => setSourceCollapsed(true)}
                aria-label="Close start panel"
                title="Close"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {startMode === "choices" ? (
              <div className="scV123ChoiceGrid">
                <button
                  type="button"
                  className="scV123ChoiceCard"
                  onClick={() => setStartMode("paste")}
                >
                  <span className="scV123ChoiceIcon isPrimary">
                    <i className="bi bi-stars" aria-hidden="true" />
                  </span>
                  <strong>Paste AI Code</strong>
                  <p>
                    Turn code from ChatGPT, Claude, Gemini or another AI assistant into real files.
                  </p>
                  <span className="scV123ChoiceAction">
                    Paste code
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </span>
                </button>

                <button
                  type="button"
                  className="scV123ChoiceCard"
                  onClick={() => setStartMode("import")}
                >
                  <span className="scV123ChoiceIcon">
                    <i className="bi bi-folder2-open" aria-hidden="true" />
                  </span>
                  <strong>Import Project</strong>
                  <p>
                    Import HTML, React, Angular, Vue, Svelte, TypeScript or another source project.
                  </p>
                  <span className="scV123ChoiceAction">
                    Import files or folder
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </span>
                </button>

                <div className="scV123ChoiceCard scV123CreateCard">
                  <span className="scV123ChoiceIcon">
                    <i className="bi bi-file-earmark-plus" aria-hidden="true" />
                  </span>
                  <strong>
                    {files.length ? "Create New" : "Start Empty"}
                  </strong>
                  <p>
                    {files.length
                      ? "Add a new file or folder to the current project."
                      : "Open a blank workspace and create only the files you need."}
                  </p>

                  <div className="scV123CreateActions">
                    {files.length ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSourceCollapsed(true);
                            createFile();
                          }}
                        >
                          New File
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSourceCollapsed(true);
                            createFolder();
                          }}
                        >
                          New Folder
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={openEmptyWorkspace}
                      >
                        Open Empty Workspace
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {startMode === "paste" ? (
              <section className="scSimplePasteCard scV123FocusedCard">
                <div className="scV123FocusedTop">
                  <button
                    type="button"
                    className="scV123BackButton"
                    onClick={() => setStartMode("choices")}
                  >
                    <i className="bi bi-arrow-left" aria-hidden="true" />
                    All options
                  </button>

                  <button
                    type="button"
                    className="scV123ClearButton"
                    onClick={clearSourceCode}
                    disabled={!inputCode && !sourceFileName}
                  >
                    <i className="bi bi-eraser" aria-hidden="true" />
                    Clear Code
                  </button>
                </div>

                <textarea
                  value={inputCode}
                  onChange={(event) => {
                    setInputCode(event.target.value);
                    setSourceFileName("");
                  }}
                  spellCheck="false"
                  placeholder="Paste AI-generated code here..."
                />

                <div className="scSimplePasteFooter">
                  <span>
                    {sourceFileName
                      ? `${sourceFileName} · ready to split`
                      : inputCode.trim()
                        ? `${inputCode.split("\n").length} lines ready`
                        : "Paste HTML, CSS, JavaScript, React, TypeScript and more"}
                  </span>

                  <button
                    type="button"
                    className="scFinalPrimaryButton"
                    onClick={splitCode}
                    disabled={!inputCode.trim()}
                  >
                    Split into Project
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </button>
                </div>
              </section>
            ) : null}

            {startMode === "import" ? (
              <section
                className={
                  dragging
                    ? "scSimpleImportCard scV123FocusedCard isDragging"
                    : "scSimpleImportCard scV123FocusedCard"
                }
                onDragEnter={handleDragOver}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleProjectDrop}
              >
                <div className="scV123FocusedTop">
                  <button
                    type="button"
                    className="scV123BackButton"
                    onClick={() => setStartMode("choices")}
                  >
                    <i className="bi bi-arrow-left" aria-hidden="true" />
                    All options
                  </button>
                </div>

                <div className="scSimpleImportVisual">
                  <span>
                    <i className="bi bi-folder2-open" aria-hidden="true" />
                  </span>
                </div>

                <div className="scSimpleImportCopy">
                  <strong>
                    {dragging
                      ? "Drop project here"
                      : "Drop files or a project folder"}
                  </strong>

                  <p>
                    Browser navigation is blocked while dragging files over SplitCode.
                    React, Angular, Vue, Svelte, Astro, JSX, TSX, TypeScript,
                    SCSS, JSON and configuration files are imported as readable source.
                  </p>
                </div>

                <div className="scSimpleImportActions">
                  <label className="scSimpleImportButton">
                    <i className="bi bi-files" aria-hidden="true" />
                    Choose File(s)
                    <input
                      type="file"
                      multiple
                      accept={getSupportedAcceptString()}
                      onChange={handleProjectFilesInput}
                      hidden
                    />
                  </label>

                  <label className="scSimpleImportButton isPrimary">
                    <i className="bi bi-folder2-open" aria-hidden="true" />
                    Choose Folder
                    <input
                      type="file"
                      multiple
                      webkitdirectory=""
                      directory=""
                      onChange={handleProjectFolderInput}
                      hidden
                    />
                  </label>
                </div>

                <small className="scSimpleImportNote">
                  Heavy generated folders such as node_modules, dist, build and .git are ignored automatically.
                </small>
              </section>
            ) : null}

            {message ? (
              <div className="scSimpleStartMessage">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>{message}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="scFinalWorkspaceGrid">
          <aside className="scFinalSidebar">
            <div className="scFinalSidebarHeader">
              <div className="scFinalSidebarTitleRow">
                <div className="scFinalSidebarTitle">
                  <i className="bi bi-folder2" aria-hidden="true" />
                  <strong>Project Files</strong>
                </div>

                <div
                  className="scFinalSidebarActions scV123SidebarActions scCleanCreateActions"
                  aria-label="Create project item"
                >
                  <button
                    type="button"
                    onClick={createFile}
                    title="Create new file"
                  >
                    <span className="scCleanCreatePlus" aria-hidden="true">+</span>
                    <span>File</span>
                  </button>

                  <span className="scCleanCreateDivider" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={createFolder}
                    title="Create new folder"
                  >
                    <span className="scCleanCreatePlus" aria-hidden="true">+</span>
                    <span>Folder</span>
                  </button>
                </div>
              </div>

              <div className="scFinalStats">
                <div>
                  <strong>{files.length}</strong>
                  <span>{files.length === 1 ? "File" : "Files"}</span>
                </div>

                <div>
                  <strong>{folders.length}</strong>
                  <span>{folders.length === 1 ? "Folder" : "Folders"}</span>
                </div>

                <div className={`scFinalHealth scFinalHealth-${workspaceHealth.tone}`}>
                  <strong>
                    <span>{workspaceHealth.icon}</span>
                    {workspaceHealth.label}
                  </strong>
                  <span>
                    {workspaceHealth.tone === "healthy"
                      ? "No issues"
                      : "Review project"}
                  </span>
                </div>
              </div>

              {files.length > 0 ? (
                <div
                  className="scFrameworkDetector"
                  title={projectFramework.evidence.join(" • ")}
                >
                  <span className="scFrameworkDetectorIcon">
                    <i className="bi bi-boxes" aria-hidden="true" />
                  </span>

                  <span className="scFrameworkDetectorText">
                    <small>Detected stack</small>
                    <strong>{projectFramework.stackSummary}</strong>
                  </span>

                  <span
                    className={`scFrameworkConfidence is-${projectFramework.confidence}`}
                  >
                    {projectFramework.confidence}
                  </span>
                </div>
              ) : null}

              <label className="scFinalSearch">
                <i className="bi bi-search" aria-hidden="true" />
                <input
                  type="search"
                  value={fileSearch}
                  onChange={(event) => setFileSearch(event.target.value)}
                  placeholder="Search files..."
                />
                {fileSearch ? (
                  <button
                    type="button"
                    onClick={() => setFileSearch("")}
                    aria-label="Clear search"
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                ) : null}
              </label>
            </div>

            <div className="scFinalSidebarTree">
              <FileExplorer
                files={filteredFiles}
                folders={filteredFolders}
                activeFileId={activeFileId}
                onSelectFile={openFile}
                onCreateFile={createFile}
                onCreateFolder={createFolder}
                onRenameFile={renameFile}
                onDeleteFile={deleteFile}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
                onMoveFile={moveFileToFolder}
              />

              {fileSearch && filteredFiles.length === 0 ? (
                <div className="scFinalSearchEmpty">
                  <i className="bi bi-search" aria-hidden="true" />
                  <strong>No matching files</strong>
                  <span>Try another filename or path.</span>
                </div>
              ) : null}
            </div>

            <div className="scFinalSidebarHelp">
              <span className="scFinalHelpIcon">
                <i
                  className={
                    diagnostics.issues.length > 0
                      ? "bi bi-exclamation-circle"
                      : "bi bi-shield-check"
                  }
                  aria-hidden="true"
                />
              </span>

              <div>
                <strong>
                  {!files.length
                    ? "Project Diagnostics"
                    : diagnostics.issues.length > 0
                      ? "Project Issues"
                      : "Project Health"}
                </strong>

                <p>
                  {!files.length
                    ? "Load or split a project to inspect its structure."
                    : diagnostics.issues.length > 0
                      ? `${diagnostics.issues.length} issue${
                          diagnostics.issues.length === 1 ? "" : "s"
                        } need your attention.`
                      : "No structural issues detected. Checks run automatically."}
                </p>
              </div>

              <button
                type="button"
                disabled={!files.length}
                onClick={() => setWorkspaceTab("issues")}
              >
                {diagnostics.issues.length > 0
                  ? "Review Issues"
                  : "View Checks"}
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </aside>

          <div className={`scFinalMain scWorkspaceView-${workspaceTab}`}>
            <nav className="scWorkspaceTabs" aria-label="Workspace views">
              <button
                type="button"
                className={workspaceTab === "code" ? "isActive" : ""}
                onClick={() => setWorkspaceTab("code")}
              >
                <i className="bi bi-code-slash" aria-hidden="true" />
                Editor
              </button>

              <button
                type="button"
                className={workspaceTab === "preview" ? "isActive" : ""}
                onClick={() => setWorkspaceTab("preview")}
              >
                <i className="bi bi-play-circle" aria-hidden="true" />
                Preview
              </button>

              <button
                type="button"
                className={workspaceTab === "issues" ? "isActive" : ""}
                onClick={() => setWorkspaceTab("issues")}
              >
                <i className="bi bi-exclamation-circle" aria-hidden="true" />
                Issues
                {diagnostics.issues.length ? (
                  <span className="scWorkspaceTabBadge">
                    {diagnostics.issues.length}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className={workspaceTab === "relationships" ? "isActive" : ""}
                onClick={() => setWorkspaceTab("relationships")}
              >
                <i className="bi bi-diagram-3" aria-hidden="true" />
                Relationships
              </button>

              <button
                type="button"
                className={workspaceTab === "export" ? "isActive" : ""}
                onClick={() => setWorkspaceTab("export")}
              >
                <i className="bi bi-box-arrow-down" aria-hidden="true" />
                Export
              </button>
            </nav>

            <section className="scFinalEditorCard" id="splitcode-editor">
              <div className="scFinalTabsToolbar">
                <div className="scFinalTabsList">
                  {openFiles.length > 0 ? (
                    openFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={
                          file.id === activeFileId
                            ? "scFinalFileTab isActive"
                            : "scFinalFileTab"
                        }
                        onClick={() => openFile(file.id)}
                        title={file.path}
                      >
                        <i
                          className={`bi ${getFileIcon(file.path || file.name)}`}
                          aria-hidden="true"
                        />
                        <span>{file.name}</span>

                        <span
                          className="scFinalTabClose"
                          role="button"
                          tabIndex="0"
                          aria-label={`Close ${file.name}`}
                          onClick={(event) => closeTab(event, file.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              closeTab(event, file.id);
                            }
                          }}
                        >
                          ×
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="scFinalTabsEmpty">No open files</div>
                  )}

                  <button
                    type="button"
                    className="scFinalAddTab"
                    onClick={createFile}
                    title="Create file"
                    aria-label="Create file"
                  >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                  </button>
                </div>

                <div className="scFinalTabTools">
                  {activeFile ? (
                    <span className="scFinalLanguageBadge">
                      {getFileLanguage(activeFile.path || activeFile.name)}
                    </span>
                  ) : null}

                  {activeFile?.language === "html" &&
                  hasSplittableInlineCode(activeFile.content) ? (
                    <span className="scInlineDetectedBadge">
                      <i className="bi bi-diagram-3" aria-hidden="true" />
                      Inline code detected
                    </span>
                  ) : null}

                  <button
                    type="button"
                    className="scFinalIconButton"
                    onClick={copyActiveFile}
                    disabled={!activeFile}
                    title="Copy current file"
                    aria-label="Copy current file"
                  >
                    <i className="bi bi-copy" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="scFinalIconButton"
                    onClick={downloadActiveFile}
                    disabled={!activeFile}
                    title="Download current file"
                    aria-label="Download current file"
                  >
                    <i className="bi bi-download" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="scFinalEditorSurface">
                <CodeEditor
                  file={activeFile}
                  onChange={editActiveFile}
                  onCursorChange={setEditorCursor}
                />
              </div>

              <div className="scFinalEditorStatus">
                <div>
                  <span>Ln {editorCursor.line}, Col {editorCursor.column}</span>
                  <span>Spaces: 2</span>
                  <span>UTF-8</span>
                  <span>
                    {activeFile
                      ? getFileLanguage(activeFile.path || activeFile.name)
                      : "No file"}
                  </span>
                </div>

                <div>
                  <span
                    className={`scFinalEditorHealth scFinalEditorHealth-${workspaceHealth.tone}`}
                  />
                  <span>{workspaceHealth.label}</span>
                </div>
              </div>
            </section>

            <div className="scFinalEditorActions">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    saveCurrentProjectNow();
                    setMessage("Project saved locally.");
                  }}
                >
                  <i className="bi bi-floppy" aria-hidden="true" />
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => activeFile && renameFile(activeFile.id)}
                  disabled={!activeFile}
                >
                  <i className="bi bi-pencil" aria-hidden="true" />
                  Rename
                </button>

                <button
                  type="button"
                  className="isDanger"
                  onClick={() => activeFile && deleteFile(activeFile.id)}
                  disabled={!activeFile}
                >
                  <i className="bi bi-trash3" aria-hidden="true" />
                  Delete
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={copyActiveFile}
                  disabled={!activeFile}
                >
                  <i className="bi bi-copy" aria-hidden="true" />
                  Copy
                </button>

                <button
                  type="button"
                  onClick={downloadActiveFile}
                  disabled={!activeFile}
                >
                  <i className="bi bi-download" aria-hidden="true" />
                  Download file
                </button>

                {activeFile?.language === "html" &&
                hasSplittableInlineCode(activeFile.content) ? (
                  <button
                    type="button"
                    className="isSplitHtml"
                    onClick={splitActiveHtmlFile}
                    title="Extract inline CSS and JavaScript into separate project files"
                  >
                    <i className="bi bi-diagram-3" aria-hidden="true" />
                    Split HTML
                  </button>
                ) : null}

                <button
                  type="button"
                  className="isPrimary"
                  onClick={downloadZip}
                >
                  <i className="bi bi-file-earmark-zip" aria-hidden="true" />
                  Export ZIP
                </button>
              </div>
            </div>

            <nav className="scFinalWorkflow" aria-label="Project workflow">
              <button
                type="button"
                className="isActive"
                onClick={() =>
                  document
                    .getElementById("splitcode-editor")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <span>01</span>
                <div>
                  <strong>Code</strong>
                  <small>Edit your files</small>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("splitcode-diagnostics")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <span>02</span>
                <div>
                  <strong>Verify</strong>
                  <small>
                    {projectRelationships.missingCount > 0
                      ? `${projectRelationships.missingCount} missing link${
                          projectRelationships.missingCount === 1 ? "" : "s"
                        }`
                      : "Check links & issues"}
                  </small>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("splitcode-preview")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <span>03</span>
                <div>
                  <strong>Preview</strong>
                  <small>
                    {previewPlan.canPreview
                      ? "See your project live"
                      : "Framework-aware status"}
                  </small>
                </div>
              </button>

              <button
                type="button"
                onClick={downloadZip}
              >
                <span>04</span>
                <div>
                  <strong>Export</strong>
                  <small>
                    {exportReadiness.label}
                  </small>
                </div>
              </button>
            </nav>

            <section className="scFinalPreviewCard" id="splitcode-preview">
              <div className="scFinalPreviewHeader">
                <div className="scFinalPreviewTitle">
                  <span>
                    <i className="bi bi-eye" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>
                      {previewPlan.canPreview
                        ? "Live Preview"
                        : "Project Preview"}
                    </strong>
                    <small>
                      {previewPlan.canPreview
                        ? "Browser-ready multi-file preview"
                        : projectFramework.stackSummary}
                    </small>
                  </div>
                </div>

                <div className="scFinalPreviewActions">
                  <button
                    type="button"
                    className="scFinalPreviewTextButton"
                    onClick={openPreviewInNewTab}
                    disabled={
                      !preview ||
                      !previewPlan.canPreview
                    }
                  >
                    <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                    Open in new tab
                  </button>

                  <button
                    type="button"
                    className={
                      previewViewport === "desktop"
                        ? "scFinalViewportButton isActive"
                        : "scFinalViewportButton"
                    }
                    onClick={() => setPreviewViewport("desktop")}
                    disabled={!previewPlan.canPreview}
                    title="Desktop preview"
                    aria-label="Desktop preview"
                  >
                    <i className="bi bi-display" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={
                      previewViewport === "tablet"
                        ? "scFinalViewportButton isActive"
                        : "scFinalViewportButton"
                    }
                    onClick={() => setPreviewViewport("tablet")}
                    disabled={!previewPlan.canPreview}
                    title="Tablet preview"
                    aria-label="Tablet preview"
                  >
                    <i className="bi bi-tablet" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={
                      previewViewport === "mobile"
                        ? "scFinalViewportButton isActive"
                        : "scFinalViewportButton"
                    }
                    onClick={() => setPreviewViewport("mobile")}
                    disabled={!previewPlan.canPreview}
                    title="Mobile preview"
                    aria-label="Mobile preview"
                  >
                    <i className="bi bi-phone" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="scFinalViewportButton"
                    onClick={() => setPreviewRefreshKey((value) => value + 1)}
                    disabled={!previewPlan.canPreview}
                    title="Refresh preview"
                    aria-label="Refresh preview"
                  >
                    <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="scFinalPreviewCanvas">
                {previewPlan.canPreview && preview ? (
                  <iframe
                    key={previewRefreshKey}
                    title="SplitCode Preview"
                    srcDoc={preview}
                    sandbox="allow-scripts"
                    className="scFinalPreviewFrame"
                    style={{
                      width:
                        previewViewport === "desktop"
                          ? "100%"
                          : previewViewport === "tablet"
                            ? "768px"
                            : "390px",
                      maxWidth: "100%",
                    }}
                  />
                ) : previewPlan.mode === "runtime" ? (
                  <div className="scRuntimePreviewNotice">
                    <div className="scRuntimePreviewIcon">
                      <i className="bi bi-terminal" aria-hidden="true" />
                    </div>

                    <div className="scRuntimePreviewCopy">
                      <span className="scRuntimePreviewEyebrow">
                        Framework-aware preview
                      </span>

                      <strong>{previewPlan.label}</strong>

                      <p>
                        {previewPlan.description}
                      </p>

                      <div className="scRuntimePreviewMeta">
                        <span>
                          <small>Detected stack</small>
                          <strong>{projectFramework.stackSummary}</strong>
                        </span>

                        <span>
                          <small>Reason</small>
                          <strong>{previewPlan.reason}</strong>
                        </span>
                      </div>

                      {previewPlan.installCommand || previewPlan.runCommand ? (
                        <div className="scRuntimeCommands">
                          {previewPlan.installCommand ? (
                            <div>
                              <small>Install dependencies</small>
                              <code>{previewPlan.installCommand}</code>
                            </div>
                          ) : null}

                          {previewPlan.runCommand ? (
                            <div>
                              <small>Start project</small>
                              <code>{previewPlan.runCommand}</code>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="scRuntimePreviewActions">
                        <button
                          type="button"
                          onClick={downloadZip}
                        >
                          <i className="bi bi-file-earmark-zip" aria-hidden="true" />
                          Export project
                        </button>

                        <span>
                          SplitCode keeps the source intact instead of pretending
                          framework code can run as plain HTML.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="scFinalPreviewEmpty">
                    <span>
                      <i className="bi bi-window" aria-hidden="true" />
                    </span>
                    <strong>{previewPlan.label}</strong>
                    <p>{previewPlan.description}</p>
                  </div>
                )}
              </div>
            </section>

            <section
              className={`scHealthCenter is-${projectHealth.tone}`}
              id="splitcode-health"
            >
              <div className="scHealthCenterTop">
                <div className="scHealthIdentity">
                  <span className="scHealthIcon">
                    <i
                      className={
                        projectHealth.tone === "healthy"
                          ? "bi bi-shield-check"
                          : projectHealth.tone === "runtime"
                            ? "bi bi-terminal"
                            : projectHealth.tone === "warning"
                              ? "bi bi-exclamation-triangle"
                              : projectHealth.tone === "error"
                                ? "bi bi-shield-exclamation"
                                : "bi bi-heart-pulse"
                      }
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <span className="scHealthEyebrow">
                      Project Health & Repair Center
                    </span>

                    <strong>
                      {projectHealth.headline}
                    </strong>

                    <p>
                      {projectHealth.description}
                    </p>
                  </div>
                </div>

                <div className="scHealthStatusBlock">
                  <small>Status</small>
                  <strong>
                    {projectHealth.status}
                  </strong>
                  <span>
                    {projectHealth.frameworkLabel}
                  </span>
                </div>
              </div>

              <div className="scHealthMetrics">
                <div>
                  <span className="isError">
                    <i className="bi bi-x-circle" aria-hidden="true" />
                  </span>
                  <strong>{projectHealth.errors}</strong>
                  <small>Errors</small>
                </div>

                <div>
                  <span className="isWarning">
                    <i className="bi bi-exclamation-circle" aria-hidden="true" />
                  </span>
                  <strong>{projectHealth.warnings}</strong>
                  <small>Warnings</small>
                </div>

                <div>
                  <span className="isMissing">
                    <i className="bi bi-link-45deg" aria-hidden="true" />
                  </span>
                  <strong>{projectHealth.missing}</strong>
                  <small>Broken links</small>
                </div>

                <div>
                  <span className="isOrphaned">
                    <i className="bi bi-file-earmark-question" aria-hidden="true" />
                  </span>
                  <strong>{projectHealth.orphaned}</strong>
                  <small>Orphaned</small>
                </div>

                <div>
                  <span className="isSafe">
                    <i className="bi bi-magic" aria-hidden="true" />
                  </span>
                  <strong>{projectHealth.safeFixCount}</strong>
                  <small>Safe fixes</small>
                </div>
              </div>

              <div className="scHealthFooter">
                <div className="scHealthRuntimeInfo">
                  <span>
                    <i
                      className={
                        previewPlan.canPreview
                          ? "bi bi-play-circle"
                          : "bi bi-terminal"
                      }
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <small>Preview status</small>
                    <strong>{projectHealth.previewLabel}</strong>
                  </div>
                </div>

                <div className="scHealthActions">
                  {projectHealth.safeFixCount > 0 ? (
                    <button
                      type="button"
                      className="isPrimary"
                      onClick={fixAllSafeIssues}
                    >
                      <i className="bi bi-stars" aria-hidden="true" />
                      Fix All Safe Issues
                    </button>
                  ) : null}

                  {(projectHealth.issueCount > 0 ||
                    projectHealth.reviewFixCount > 0) ? (
                    <button
                      type="button"
                      onClick={scrollToProjectIssues}
                    >
                      <i className="bi bi-search" aria-hidden="true" />
                      Review Issues
                    </button>
                  ) : null}

                  {!projectHealth.issueCount &&
                  !projectHealth.runtimeRequired ? (
                    <span className="scHealthReady">
                      <i className="bi bi-check-lg" aria-hidden="true" />
                      Ready for export
                    </span>
                  ) : null}
                </div>
              </div>

              {projectHealth.safeFixCount > 0 ? (
                <div className="scHealthSafetyNote">
                  <i className="bi bi-shield-lock" aria-hidden="true" />
                  <span>
                    Automatic repair only applies high-confidence existing-file matches.
                    SplitCode does not auto-create missing media or apply uncertain repairs.
                  </span>
                </div>
              ) : null}
            </section>

            <section
              className={`scExportPreflight is-${exportReadiness.status}`}
              id="splitcode-export-preflight"
            >
              <div className="scExportPreflightHeader">
                <div className="scExportPreflightTitle">
                  <span>
                    <i
                      className={
                        exportReadiness.status === "ready"
                          ? "bi bi-check2-circle"
                          : exportReadiness.status === "review"
                            ? "bi bi-clipboard-check"
                            : "bi bi-shield-exclamation"
                      }
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <small>Export Preflight</small>
                    <strong>{exportReadiness.headline}</strong>
                    <p>{exportReadiness.summary}</p>
                  </div>
                </div>

                <div
                  className={`scExportPreflightBadge is-${exportReadiness.status}`}
                >
                  <i
                    className={
                      exportReadiness.status === "ready"
                        ? "bi bi-check-lg"
                        : exportReadiness.status === "review"
                          ? "bi bi-exclamation-lg"
                          : "bi bi-x-lg"
                    }
                    aria-hidden="true"
                  />
                  {exportReadiness.label}
                </div>
              </div>

              <div className="scExportPreflightChecks">
                {exportReadiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className={`scExportCheck is-${check.status}`}
                  >
                    <span className="scExportCheckIcon">
                      <i
                        className={
                          check.status === "pass"
                            ? "bi bi-check-lg"
                            : check.status === "warn"
                              ? "bi bi-exclamation-lg"
                              : "bi bi-x-lg"
                        }
                        aria-hidden="true"
                      />
                    </span>

                    <div>
                      <strong>{check.label}</strong>
                      <small>{check.detail}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="scExportDocumentation">
                <div className="scExportDocumentationTitle">
                  <span>
                    <i className="bi bi-file-earmark-text" aria-hidden="true" />
                  </span>

                  <div>
                    <strong>Export Documentation</strong>
                    <small>
                      Generated inside the ZIP without changing your editor files.
                    </small>
                  </div>
                </div>

                <div className="scExportDocumentationFiles">
                  <div>
                    <i
                      className={
                        exportDocumentationPlan.hasExistingReadme
                          ? "bi bi-shield-check"
                          : "bi bi-file-earmark-plus"
                      }
                      aria-hidden="true"
                    />

                    <span>
                      <small>README</small>
                      <strong>{exportDocumentationPlan.readmePath}</strong>
                    </span>

                    <em
                      className={
                        exportDocumentationPlan.hasExistingReadme
                          ? "isPreserved"
                          : "isGenerated"
                      }
                    >
                      {exportDocumentationPlan.hasExistingReadme
                        ? "Preserved"
                        : "Generated"}
                    </em>
                  </div>

                  <div>
                    <i className="bi bi-clipboard-data" aria-hidden="true" />

                    <span>
                      <small>Preflight report</small>
                      <strong>{exportDocumentationPlan.reportPath}</strong>
                    </span>

                    <em className="isGenerated">
                      Generated
                    </em>
                  </div>
                </div>
              </div>

              <div className="scExportPreflightFooter">
                <div className="scExportPreflightMeta">
                  <span>
                    <small>Project</small>
                    <strong>{exportReadiness.frameworkLabel}</strong>
                  </span>

                  <span>
                    <small>Blocking</small>
                    <strong>{exportReadiness.blockerCount}</strong>
                  </span>

                  <span>
                    <small>Warnings</small>
                    <strong>{exportReadiness.warningCount}</strong>
                  </span>
                </div>

                <div className="scExportPreflightActions">
                  {projectHealth.safeFixCount > 0 ? (
                    <button
                      type="button"
                      onClick={fixAllSafeIssues}
                    >
                      <i className="bi bi-stars" aria-hidden="true" />
                      Fix Safe Issues
                    </button>
                  ) : null}

                  {exportReadiness.status !== "ready" ? (
                    <button
                      type="button"
                      onClick={scrollToProjectIssues}
                    >
                      <i className="bi bi-search" aria-hidden="true" />
                      Review Issues
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="isPrimary"
                    onClick={downloadZip}
                    disabled={!files.length && !folders.length}
                  >
                    <i className="bi bi-file-earmark-zip" aria-hidden="true" />
                    {exportReadiness.status === "ready"
                      ? "Export ZIP"
                      : "Review & Export"}
                  </button>
                </div>
              </div>

              {exportReadiness.runtimeRequired ? (
                <div className="scExportRuntimeNote">
                  <i className="bi bi-terminal" aria-hidden="true" />
                  <span>
                    Framework source will be exported intact.
                    {previewPlan.installCommand
                      ? ` ${previewPlan.installCommand}`
                      : ""}
                    {previewPlan.runCommand
                      ? ` → ${previewPlan.runCommand}`
                      : ""}
                  </span>
                </div>
              ) : null}
            </section>

            <section
              className="scRelationshipPanel"
              id="splitcode-relationships"
            >
              <div className="scRelationshipHeader">
                <div>
                  <span className="scRelationshipIcon">
                    <i className="bi bi-diagram-3" aria-hidden="true" />
                  </span>

                  <div>
                    <strong>Project Relationships</strong>
                    <small>
                      {projectRelationships.totalReferences} references detected
                    </small>
                  </div>
                </div>

                <div className="scRelationshipSummary">
                  <span className="isResolved">
                    <strong>{projectRelationships.resolvedCount}</strong>
                    Connected
                  </span>

                  <span className="isMissing">
                    <strong>{projectRelationships.missingCount}</strong>
                    Missing
                  </span>

                  <span className="isOrphaned">
                    <strong>{projectRelationships.orphanedCount}</strong>
                    Orphaned
                  </span>
                </div>
              </div>

              {!files.length ? (
                <div className="scRelationshipEmpty">
                  <i className="bi bi-diagram-2" aria-hidden="true" />
                  <strong>No project loaded</strong>
                  <span>Load project files to map their relationships.</span>
                </div>
              ) : projectRelationships.totalReferences === 0 ? (
                <div className="scRelationshipEmpty">
                  <i className="bi bi-diagram-2" aria-hidden="true" />
                  <strong>No file references detected</strong>
                  <span>
                    SplitCode did not find local imports, hrefs, src references or CSS URLs.
                  </span>
                </div>
              ) : (
                <div className="scRelationshipBody">
                  <div className="scRelationshipConnections">
                    <div className="scRelationshipSectionTitle">
                      <strong>Connections</strong>
                      <span>
                        {projectRelationships.resolvedCount} resolved
                      </span>
                    </div>

                    {projectRelationships.resolved.length > 0 ? (
                      <div className="scRelationshipList">
                        {projectRelationships.resolved
                          .slice(0, 8)
                          .map((edge) => (
                            <button
                              type="button"
                              key={edge.id}
                              className="scRelationshipItem isResolved"
                              onClick={() => {
                                if (edge.sourceId) {
                                  openFile(edge.sourceId);
                                }
                              }}
                            >
                              <span className="scRelationshipSource">
                                {edge.sourcePath}
                              </span>

                              <i
                                className="bi bi-arrow-right"
                                aria-hidden="true"
                              />

                              <span className="scRelationshipTarget">
                                {edge.targetPath}
                              </span>

                              <small>Ln {edge.line}</small>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="scRelationshipMuted">
                        No resolved local file connections yet.
                      </p>
                    )}
                  </div>

                  <div className="scRelationshipProblems">
                    <div className="scRelationshipSectionTitle">
                      <strong>Needs attention</strong>
                      <span>
                        {Object.keys(relationshipRepairs).length} auto-fixable ·{" "}
                        {projectRelationships.missingCount +
                          projectRelationships.orphanedCount} items
                      </span>
                    </div>

                    {projectRelationships.missing.length > 0 ? (
                      <div className="scRelationshipIssueGroup">
                        <small>Missing references</small>

                        {projectRelationships.missing
                          .slice(0, 6)
                          .map((edge) => {
                            const repair =
                              relationshipRepairs[
                                edge.id
                              ];

                            const issue =
                              relationshipEdgeToIssue(
                                edge
                              );

                            return (
                              <div
                                key={edge.id}
                                className="scRelationshipIssue isMissing scRelationshipRepairItem"
                              >
                                <button
                                  type="button"
                                  className="scRelationshipIssueMain"
                                  onClick={() => {
                                    if (edge.sourceId) {
                                      openFile(edge.sourceId);
                                    }
                                  }}
                                >
                                  <span>
                                    <i
                                      className="bi bi-link-45deg"
                                      aria-hidden="true"
                                    />
                                  </span>

                                  <div>
                                    <strong>{edge.reference}</strong>
                                    <small>
                                      {edge.sourcePath} · line {edge.line}
                                    </small>

                                    {repair ? (
                                      <span className="scRelationshipSuggestion">
                                        Possible match:
                                        <b>{repair.targetPath}</b>
                                        <em
                                          className={`is-${repair.confidence}`}
                                        >
                                          {repair.confidence}
                                        </em>
                                      </span>
                                    ) : null}
                                  </div>
                                </button>

                                <div className="scRelationshipRepairActions">
                                  {repair ? (
                                    <button
                                      type="button"
                                      className="isRepair"
                                      onClick={() =>
                                        repairRelationshipReference(
                                          edge
                                        )
                                      }
                                    >
                                      <i
                                        className="bi bi-magic"
                                        aria-hidden="true"
                                      />
                                      Fix Reference
                                    </button>
                                  ) : null}

                                  {canQuickFixIssue(issue) ? (
                                    <button
                                      type="button"
                                      className="isCreate"
                                      onClick={() =>
                                        createRelationshipMissingFile(
                                          edge
                                        )
                                      }
                                    >
                                      <i
                                        className="bi bi-file-earmark-plus"
                                        aria-hidden="true"
                                      />
                                      Create File
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : null}

                    {projectRelationships.orphaned.length > 0 ? (
                      <div className="scRelationshipIssueGroup">
                        <small>Possible orphaned files</small>

                        {projectRelationships.orphaned
                          .slice(0, 6)
                          .map((node) => (
                            <button
                              type="button"
                              key={node.id}
                              className="scRelationshipIssue isOrphaned"
                              onClick={() => {
                                if (node.id) {
                                  openFile(node.id);
                                }
                              }}
                            >
                              <span>
                                <i
                                  className="bi bi-file-earmark"
                                  aria-hidden="true"
                                />
                              </span>

                              <div>
                                <strong>{node.path}</strong>
                                <small>No incoming local references detected</small>
                              </div>
                            </button>
                          ))}
                      </div>
                    ) : null}

                    {projectRelationships.missingCount === 0 &&
                    projectRelationships.orphanedCount === 0 ? (
                      <div className="scRelationshipHealthy">
                        <i className="bi bi-check-lg" aria-hidden="true" />
                        <div>
                          <strong>Relationship graph looks healthy</strong>
                          <small>No missing local references or orphaned files detected.</small>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            <section
              className="scFinalDiagnostics"
              id="splitcode-diagnostics"
            >
              <div className="scFinalDiagnosticsHeader">
                <div>
                  <span className="scFinalDiagnosticsIcon">
                    <i className="bi bi-activity" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Project Diagnostics</strong>
                    <small>{diagnostics.filesScanned} files scanned</small>
                  </div>
                </div>

                <div className="scFinalDiagnosticsSummary">
                  <span>
                    <strong>{diagnostics.errors}</strong>
                    Errors
                  </span>
                  <span>
                    <strong>{diagnostics.warnings}</strong>
                    Warnings
                  </span>
                </div>
              </div>

              {!files.length ? (
                <div className="scFinalDiagnosticsEmpty">
                  <i className="bi bi-folder2-open" aria-hidden="true" />
                  <strong>No project loaded</strong>
                  <span>Split or import a project to run diagnostics.</span>
                </div>
              ) : diagnostics.issues.length === 0 ? (
                <div className="scFinalDiagnosticsHealthy">
                  <span>
                    <i className="bi bi-check-lg" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Project looks healthy</strong>
                    <p>No structural problems were detected.</p>
                  </div>
                </div>
              ) : (
                <div className="scFinalDiagnosticsList">
                  {diagnostics.issues.map((issue) => {
                    const repair = getBestRepair(issue, files);

                    return (
                      <div
                        key={issue.id}
                        className={`scFinalDiagnosticItem ${
                          issue.severity === "error"
                            ? "isError"
                            : "isWarning"
                        }`}
                      >
                        <button
                          type="button"
                          className="scFinalDiagnosticMain"
                          onClick={() => openDiagnosticFile(issue)}
                        >
                          <span className="scFinalDiagnosticSeverity">
                            {issue.severity === "error" ? "!" : "⚠"}
                          </span>

                          <span className="scFinalDiagnosticCopy">
                            <strong>{issue.message}</strong>

                            {issue.file ? (
                              <span>{issue.file}</span>
                            ) : null}

                            {issue.reference ? (
                              <code>{issue.reference}</code>
                            ) : null}

                            {repair ? (
                              <small>
                                Possible match: {repair.targetFile.path} ·{" "}
                                {repair.confidence} confidence
                              </small>
                            ) : null}
                          </span>
                        </button>

                        <div className="scFinalDiagnosticActions">
                          {repair ? (
                            <button
                              type="button"
                              onClick={() => repairDiagnosticReference(issue)}
                            >
                              Fix Reference
                            </button>
                          ) : null}

                          {canQuickFixIssue(issue) ? (
                            <button
                              type="button"
                              onClick={() => quickFixDiagnostic(issue)}
                            >
                              Create File
                            </button>
                          ) : null}

                          {issue.file ? (
                            <button
                              type="button"
                              onClick={() => openDiagnosticFile(issue)}
                            >
                              Open File
                              <i className="bi bi-arrow-right" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>

      {dialog ? (
        <div
          className="scDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelDialog();
            }
          }}
        >
          <div
            className={
              dialog.danger
                ? "scDialogCard isDanger"
                : "scDialogCard"
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-dialog-title"
          >
            <form onSubmit={submitDialog}>
              <div className="scDialogHeader">
                <span className="scDialogIcon">
                  <i
                    className={`bi ${dialog.icon}`}
                    aria-hidden="true"
                  />
                </span>

                <div className="scDialogHeading">
                  <strong id="sc-dialog-title">
                    {dialog.title}
                  </strong>

                  {dialog.description ? (
                    <p>{dialog.description}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="scDialogClose"
                  onClick={cancelDialog}
                  aria-label="Close dialog"
                  title="Close"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>

              {dialog.type === "prompt" ? (
                <div className="scDialogBody">
                  <label
                    className="scDialogFieldLabel"
                    htmlFor="sc-dialog-input"
                  >
                    {dialog.label}
                  </label>

                  <div className="scDialogInputWrap">
                    <i
                      className="bi bi-folder2"
                      aria-hidden="true"
                    />

                    <input
                      id="sc-dialog-input"
                      ref={dialogInputRef}
                      type="text"
                      value={dialog.value}
                      placeholder={dialog.placeholder}
                      autoComplete="off"
                      spellCheck="false"
                      onChange={(event) =>
                        setDialog((current) =>
                          current
                            ? {
                                ...current,
                                value: event.target.value,
                              }
                            : current
                        )
                      }
                    />
                  </div>

                  {dialog.examples?.length ? (
                    <div className="scDialogExamples">
                      <span>Examples</span>

                      <div>
                        {dialog.examples.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() =>
                              setDialog((current) =>
                                current
                                  ? {
                                      ...current,
                                      value: example,
                                    }
                                  : current
                              )
                            }
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="scDialogConfirmBody">
                  <div className="scDialogConfirmNotice">
                    <i
                      className={
                        dialog.danger
                          ? "bi bi-exclamation-triangle"
                          : "bi bi-info-circle"
                      }
                      aria-hidden="true"
                    />

                    <span>
                      {dialog.danger
                        ? "Please confirm before continuing."
                        : "Confirm this action to continue."}
                    </span>
                  </div>
                </div>
              )}

              <div className="scDialogFooter">
                <span>
                  {dialog.type === "prompt"
                    ? "Press Enter to continue · Esc to cancel"
                    : "Press Esc to cancel"}
                </span>

                <div>
                  <button
                    type="button"
                    className="scDialogSecondary"
                    onClick={cancelDialog}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={
                      dialog.danger
                        ? "scDialogPrimary isDanger"
                        : "scDialogPrimary"
                    }
                  >
                    {dialog.confirmLabel}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;