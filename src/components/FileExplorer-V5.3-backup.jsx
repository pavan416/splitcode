import { useEffect, useState } from "react";

function getFileIcon(file) {
  const extension = file.name
    .split(".")
    .pop()
    .toLowerCase();

  const icons = {
    html: "◇",
    htm: "◇",
    css: "#",
    js: "JS",
    jsx: "JSX",
    ts: "TS",
    tsx: "TSX",
    json: "{}",
    md: "M",
    txt: "T",
  };

  return icons[extension] || "•";
}

function buildTree(files, folders = []) {
  const root = {};

  // Create explicit folders first.
  folders.forEach((folderPath) => {
    const parts = folderPath
      .split("/")
      .filter(Boolean);

    let current = root;

    parts.forEach((part) => {
      if (!current[part]) {
        current[part] = {};
      }

      current = current[part];
    });
  });

  // Then place files into the tree.
  files.forEach((file) => {
    const parts = file.path
      .split("/")
      .filter(Boolean);

    let current = root;

    parts.forEach((part, index) => {
      const isFile =
        index === parts.length - 1;

      if (isFile) {
        current[part] = {
          __file: file,
        };
      } else {
        if (!current[part]) {
          current[part] = {};
        }

        current = current[part];
      }
    });
  });

  return root;
}

function TreeLevel({
  tree,
  activeFileId,
  onSelectFile,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
  collapsedFolders,
  toggleFolder,
  parentPath = "",
  depth = 0,
}) {
  const entries =
    Object.entries(tree);

  const folderEntries = entries
    .filter(([, value]) => !value.__file)
    .sort(([a], [b]) =>
      a.localeCompare(b)
    );

  const fileEntries = entries
    .filter(([, value]) => value.__file)
    .sort(([a], [b]) =>
      a.localeCompare(b)
    );

  return (
    <>
      {folderEntries.map(
        ([folderName, children]) => {
          const folderPath =
            parentPath
              ? `${parentPath}/${folderName}`
              : folderName;

          const isCollapsed =
            collapsedFolders.has(
              folderPath
            );

          return (
            <div
              key={folderPath}
              className="explorerTreeGroup"
            >
              <div className="explorerFolderRow">

                <button
                  type="button"
                  className="fileExplorerFolder"
                  style={{
                    paddingLeft:
                      `${10 + depth * 14}px`,
                  }}
                  onClick={() =>
                    toggleFolder(
                      folderPath
                    )
                  }
                  title={folderPath}
                >
                  <span className="folderArrow">
                    {isCollapsed
                      ? "▸"
                      : "▾"}
                  </span>

                  <span className="folderIcon">
                    ▰
                  </span>

                  <span className="folderName">
                    {folderName}
                  </span>
                </button>

                <div className="explorerRowActions">
                  <button
                    type="button"
                    title="Rename folder"
                    onClick={() =>
                      onRenameFolder(
                        folderPath
                      )
                    }
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    title="Delete folder"
                    onClick={() =>
                      onDeleteFolder(
                        folderPath
                      )
                    }
                  >
                    ×
                  </button>
                </div>

              </div>

              {!isCollapsed && (
                <TreeLevel
                  tree={children}
                  activeFileId={
                    activeFileId
                  }
                  onSelectFile={
                    onSelectFile
                  }
                  onRenameFile={
                    onRenameFile
                  }
                  onDeleteFile={
                    onDeleteFile
                  }
                  onRenameFolder={
                    onRenameFolder
                  }
                  onDeleteFolder={
                    onDeleteFolder
                  }
                  collapsedFolders={
                    collapsedFolders
                  }
                  toggleFolder={
                    toggleFolder
                  }
                  parentPath={
                    folderPath
                  }
                  depth={
                    depth + 1
                  }
                />
              )}
            </div>
          );
        }
      )}

      {fileEntries.map(
        ([filename, value]) => {
          const file =
            value.__file;

          const isActive =
            file.id ===
            activeFileId;

          return (
            <div
              key={file.id}
              className={
                isActive
                  ? "explorerFileRow activeExplorerRow"
                  : "explorerFileRow"
              }
            >
              <button
                type="button"
                className="fileExplorerFile"
                style={{
                  paddingLeft:
                    `${14 + depth * 14}px`,
                }}
                onClick={() =>
                  onSelectFile(
                    file.id
                  )
                }
                title={file.path}
              >
                <span
                  className={`fileTypeIcon ${file.language}`}
                >
                  {getFileIcon(file)}
                </span>

                <span className="fileName">
                  {filename}
                </span>
              </button>

              <div className="explorerRowActions">
                <button
                  type="button"
                  title="Rename file"
                  onClick={() =>
                    onRenameFile(
                      file.id
                    )
                  }
                >
                  ✎
                </button>

                <button
                  type="button"
                  title="Delete file"
                  onClick={() =>
                    onDeleteFile(
                      file.id
                    )
                  }
                >
                  ×
                </button>
              </div>
            </div>
          );
        }
      )}
    </>
  );
}

function FileExplorer({
  files,
  folders = [],
  activeFileId,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
}) {
  const [
    collapsedFolders,
    setCollapsedFolders,
  ] = useState(new Set());

  useEffect(() => {
    setCollapsedFolders(
      new Set()
    );
  }, [files.length, folders.length]);

  function toggleFolder(
    folderPath
  ) {
    setCollapsedFolders(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(folderPath)
        ) {
          next.delete(
            folderPath
          );
        } else {
          next.add(
            folderPath
          );
        }

        return next;
      }
    );
  }

  const tree =
    buildTree(
      files,
      folders
    );

  return (
    <div className="fileExplorer">

      <div className="fileExplorerTitle">

        <span>
          PROJECT
        </span>

        <div className="explorerTopActions">

          <button
            type="button"
            onClick={
              onCreateFile
            }
            title="New file"
          >
            +F
          </button>

          <button
            type="button"
            onClick={
              onCreateFolder
            }
            title="New folder"
          >
            +D
          </button>

          <span className="fileCount">
            {files.length}
          </span>

        </div>

      </div>

      {files.length > 0 ||
      folders.length > 0 ? (

        <div className="fileExplorerTree">

          <TreeLevel
            tree={tree}
            activeFileId={
              activeFileId
            }
            onSelectFile={
              onSelectFile
            }
            onRenameFile={
              onRenameFile
            }
            onDeleteFile={
              onDeleteFile
            }
            onRenameFolder={
              onRenameFolder
            }
            onDeleteFolder={
              onDeleteFolder
            }
            collapsedFolders={
              collapsedFolders
            }
            toggleFolder={
              toggleFolder
            }
          />

        </div>

      ) : (

        <div className="fileExplorerEmpty">

          <strong>
            Empty project
          </strong>

          <span>
            Create a file or split
            source code.
          </span>

        </div>

      )}

    </div>
  );
}

export default FileExplorer;