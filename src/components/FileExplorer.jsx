import { useEffect, useMemo, useState } from "react";

function normalizeTreePath(value = "") {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

function getDirectory(value = "") {
  const path = normalizeTreePath(value);
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function getFileLabel(filename = "") {
  const lower = filename.toLowerCase();
  const extension = lower.includes(".") ? lower.split(".").pop() : "";

  if (["html", "htm"].includes(extension)) return { label: "HTML", tone: "html" };
  if (extension === "css") return { label: "CSS", tone: "css" };
  if (["scss", "sass"].includes(extension)) return { label: "SCSS", tone: "css" };
  if (extension === "less") return { label: "LESS", tone: "css" };
  if (["js", "mjs", "cjs"].includes(extension)) return { label: "JS", tone: "javascript" };
  if (extension === "jsx") return { label: "JSX", tone: "jsx" };
  if (extension === "ts") return { label: "TS", tone: "typescript" };
  if (extension === "tsx") return { label: "TSX", tone: "tsx" };
  if (["json", "jsonc"].includes(extension)) return { label: "JSON", tone: "json" };
  if (["md", "mdx"].includes(extension)) return { label: "MD", tone: "markdown" };
  if (extension === "svg") return { label: "SVG", tone: "svg" };
  if (extension === "vue") return { label: "VUE", tone: "vue" };
  if (extension === "svelte") return { label: "SV", tone: "svelte" };
  if (extension === "astro") return { label: "AST", tone: "astro" };
  if (extension === "py") return { label: "PY", tone: "python" };
  if (extension === "java") return { label: "JAVA", tone: "java" };
  if (extension === "sql") return { label: "SQL", tone: "sql" };
  if (extension === "xml") return { label: "XML", tone: "xml" };
  if (["yml", "yaml"].includes(extension)) return { label: "YML", tone: "yaml" };
  if (extension === "env" || lower.startsWith(".env")) return { label: "ENV", tone: "env" };
  if (lower === "dockerfile") return { label: "DKR", tone: "docker" };

  return {
    label: extension ? extension.slice(0, 4).toUpperCase() : "FILE",
    tone: "generic",
  };
}

function buildTree(files = [], folders = []) {
  const root = {
    name: "Main",
    path: "",
    folders: new Map(),
    files: [],
  };

  function ensureFolder(folderPath = "") {
    const normalized = normalizeTreePath(folderPath);
    if (!normalized) return root;

    let current = root;
    let currentPath = "";

    normalized
      .split("/")
      .filter(Boolean)
      .forEach((segment) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        if (!current.folders.has(segment)) {
          current.folders.set(segment, {
            name: segment,
            path: currentPath,
            folders: new Map(),
            files: [],
          });
        }

        current = current.folders.get(segment);
      });

    return current;
  }

  folders.forEach((folderPath) => ensureFolder(folderPath));

  files.forEach((file) => {
    const path = normalizeTreePath(file.path || file.name);
    const directory = getDirectory(path);
    const parent = ensureFolder(directory);

    parent.files.push({
      ...file,
      path,
      name: file.name || path.split("/").pop() || path,
    });
  });

  function sortNode(node) {
    node.sortedFolders = Array.from(node.folders.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    node.sortedFiles = [...node.files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    node.sortedFolders.forEach(sortNode);
    return node;
  }

  return sortNode(root);
}

export default function FileExplorer({
  files = [],
  folders = [],
  activeFileId = null,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
  onMoveFile,
}) {
  const tree = useMemo(() => buildTree(files, folders), [files, folders]);

  const allFolderPaths = useMemo(() => {
    const paths = [];

    function visit(node) {
      node.sortedFolders?.forEach((folder) => {
        paths.push(folder.path);
        visit(folder);
      });
    }

    visit(tree);
    return paths;
  }, [tree]);

  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [draggedFileId, setDraggedFileId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  useEffect(() => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      allFolderPaths.forEach((path) => next.add(path));
      return next;
    });
  }, [allFolderPaths]);

  function toggleFolder(path) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startFileDrag(event, fileId) {
    setDraggedFileId(fileId);
    event.dataTransfer.effectAllowed = "move";

    try {
      event.dataTransfer.setData("application/x-splitcode-file", String(fileId));
      event.dataTransfer.setData("text/plain", String(fileId));
    } catch {
      // Custom drag formats are optional.
    }
  }

  function finishFileDrag() {
    setDraggedFileId(null);
    setDropTarget(null);
  }

  function allowFolderDrop(event, folderPath) {
    if (!draggedFileId) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(folderPath || "__root__");
  }

  function dropFile(event, folderPath) {
    if (!draggedFileId || !onMoveFile) return;

    event.preventDefault();
    event.stopPropagation();
    onMoveFile(draggedFileId, normalizeTreePath(folderPath));
    finishFileDrag();
  }

  function stopDropHighlight(event, folderPath) {
    event.stopPropagation();
    const key = folderPath || "__root__";
    if (dropTarget === key) setDropTarget(null);
  }

  function FolderGlyph({ open = false }) {
    return (
      <span
        className={open ? "scTreeFolderGlyph isOpen" : "scTreeFolderGlyph"}
        aria-hidden="true"
      />
    );
  }

  function renderFile(file) {
    const fileType = getFileLabel(file.path || file.name);
    const isActive = file.id === activeFileId;
    const isDragging = file.id === draggedFileId;

    return (
      <div
        key={file.id}
        className={`explorerFileRow scTreeFileRow${
          isActive ? " activeExplorerRow" : ""
        }${isDragging ? " isDragging" : ""}`}
      >
        <button
          type="button"
          draggable
          aria-grabbed={isDragging}
          className={isActive ? "fileExplorerFile activeFile" : "fileExplorerFile"}
          onClick={() => onSelectFile?.(file.id)}
          onDragStart={(event) => startFileDrag(event, file.id)}
          onDragEnd={finishFileDrag}
          title={`${file.path}\nDrag to a folder to move`}
        >
          <span
            className={`fileTypeIcon scTreeTypeLabel ${fileType.tone}`}
            aria-hidden="true"
          >
            {fileType.label}
          </span>

          <span className="fileName">{file.name}</span>
        </button>

        <div className="explorerRowActions">
          <button
            type="button"
            onClick={() => onRenameFile?.(file.id)}
            aria-label={`Rename ${file.name}`}
            title="Rename"
          >
            <i className="bi bi-pencil" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteFile?.(file.id)}
            aria-label={`Delete ${file.name}`}
            title="Delete"
          >
            <i className="bi bi-trash3" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  function renderFolder(folder) {
    const open = expandedFolders.has(folder.path);
    const isDropTarget = dropTarget === folder.path;

    return (
      <div key={folder.path} className="scTreeFolderBranch">
        <div
          className={`explorerFolderRow scTreeFolderRow${
            isDropTarget ? " isDropTarget" : ""
          }`}
          onDragOver={(event) => allowFolderDrop(event, folder.path)}
          onDragEnter={(event) => allowFolderDrop(event, folder.path)}
          onDragLeave={(event) => stopDropHighlight(event, folder.path)}
          onDrop={(event) => dropFile(event, folder.path)}
        >
          <button
            type="button"
            className="fileExplorerFolder"
            onClick={() => toggleFolder(folder.path)}
            title={folder.path}
          >
            <i
              className={open ? "bi bi-chevron-down folderArrow" : "bi bi-chevron-right folderArrow"}
              aria-hidden="true"
            />
            <FolderGlyph open={open} />
            <span className="folderName">{folder.name}</span>

            {isDropTarget ? (
              <span className="scTreeDropHint">Move here</span>
            ) : draggedFileId ? (
              <span className="scTreeDragGuide">Drop</span>
            ) : null}
          </button>

          <div className="explorerRowActions">
            <button
              type="button"
              onClick={() => onRenameFolder?.(folder.path)}
              aria-label={`Rename ${folder.name}`}
              title="Rename folder"
            >
              <i className="bi bi-pencil" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteFolder?.(folder.path)}
              aria-label={`Delete ${folder.name}`}
              title="Delete folder"
            >
              <i className="bi bi-trash3" aria-hidden="true" />
            </button>
          </div>
        </div>

        {open ? (
          <div className="scTreeChildren">
            {folder.sortedFolders.map((childFolder) => renderFolder(childFolder))}
            {folder.sortedFiles.map((file) => renderFile(file))}

            {!folder.sortedFolders.length && !folder.sortedFiles.length ? (
              <div className="scTreeEmptyFolder">Empty folder</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const rootIsDropTarget = dropTarget === "__root__";

  return (
    <div className="fileExplorer scProfessionalTree">
      <div className="fileExplorerTree scTreeRoot">
        <div
          className={`scTreeRootRow${rootIsDropTarget ? " isDropTarget" : ""}`}
          onDragOver={(event) => allowFolderDrop(event, "")}
          onDragEnter={(event) => allowFolderDrop(event, "")}
          onDragLeave={(event) => stopDropHighlight(event, "")}
          onDrop={(event) => dropFile(event, "")}
        >
          <span className="scTreeRootChevron" aria-hidden="true">
            <i className="bi bi-chevron-down" />
          </span>
          <FolderGlyph open />
          <strong>Main</strong>

          {rootIsDropTarget ? (
            <span className="scTreeDropHint">Move to root</span>
          ) : draggedFileId ? (
            <span className="scTreeDragGuide">Drop on a folder</span>
          ) : null}
        </div>

        <div className="scTreeRootChildren">
          {tree.sortedFolders.map((folder) => renderFolder(folder))}
          {tree.sortedFiles.map((file) => renderFile(file))}
        </div>

        {!files.length && !folders.length ? (
          <div className="fileExplorerEmpty">
            <strong>No files yet</strong>
            <span>Create a file, create a folder, or import a project.</span>

            <div className="scTreeEmptyActions">
              <button type="button" onClick={onCreateFile}>+ File</button>
              <button type="button" onClick={onCreateFolder}>+ Folder</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
