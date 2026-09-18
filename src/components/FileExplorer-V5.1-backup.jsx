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

function buildTree(files) {
  const root = {};

  files.forEach((file) => {
    const parts = file.path.split("/");
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
  collapsedFolders,
  toggleFolder,
  parentPath = "",
  depth = 0,
}) {
  const entries =
    Object.entries(tree);

  const folders = entries
    .filter(([, value]) => !value.__file)
    .sort(([a], [b]) =>
      a.localeCompare(b)
    );

  const files = entries
    .filter(([, value]) => value.__file)
    .sort(([a], [b]) =>
      a.localeCompare(b)
    );

  return (
    <>
      {folders.map(
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
            <div key={folderPath}>

              <button
                type="button"
                className="fileExplorerFolder"
                style={{
                  paddingLeft:
                    `${12 + depth * 16}px`,
                }}
                onClick={() =>
                  toggleFolder(
                    folderPath
                  )
                }
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

              {!isCollapsed && (
                <TreeLevel
                  tree={children}
                  activeFileId={
                    activeFileId
                  }
                  onSelectFile={
                    onSelectFile
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

      {files.map(
        ([filename, value]) => {
          const file =
            value.__file;

          const isActive =
            file.id ===
            activeFileId;

          return (
            <button
              key={file.id}
              type="button"
              className={
                isActive
                  ? "fileExplorerFile activeFile"
                  : "fileExplorerFile"
              }
              style={{
                paddingLeft:
                  `${16 + depth * 16}px`,
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
          );
        }
      )}
    </>
  );
}

function FileExplorer({
  files,
  activeFileId,
  onSelectFile,
}) {
  const [
    collapsedFolders,
    setCollapsedFolders,
  ] = useState(new Set());

  useEffect(() => {
    setCollapsedFolders(
      new Set()
    );
  }, [files.length]);

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
    buildTree(files);

  return (
    <div className="fileExplorer">

      <div className="fileExplorerTitle">

        <span>
          PROJECT
        </span>

        <span className="fileCount">
          {files.length}
        </span>

      </div>

      {files.length > 0 ? (

        <div className="fileExplorerTree">

          <TreeLevel
            tree={tree}
            activeFileId={
              activeFileId
            }
            onSelectFile={
              onSelectFile
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
          No project files yet.
        </div>

      )}

    </div>
  );
}

export default FileExplorer;