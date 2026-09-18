import {
  useEffect,
  useMemo,
  useState,
} from "react";

import JSZip from "jszip";

import "./App.css";

import FileExplorer
  from "./components/FileExplorer";

import CodeEditor
  from "./components/CodeEditor";

import {
  parseProject,
  findMainHTMLFile,
  updateProjectFile,
} from "./utils/codeParser";

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

  <title>SplitCode V5.1</title>

  <link
    rel="stylesheet"
    href="css/style.css"
  >
</head>

<body>

  <div class="card">

    <span class="badge">
      SPLITCODE V5.1
    </span>

    <h1>
      Multi-file editing.
    </h1>

    <p>
      Open multiple project files
      using editor tabs.
    </p>

    <button id="testButton">
      Test JavaScript
    </button>

  </div>

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

  font-family:
    Arial,
    sans-serif;
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

    alert(
      "SplitCode V5.1 works!"
    );

  });
\`\`\`

\`\`\`javascript filename="js/utils.js"
function getProjectName() {
  return "SplitCode V5.1";
}

console.log(
  getProjectName()
);
\`\`\`

\`\`\`json filename="data/project.json"
{
  "name": "SplitCode",
  "version": "5.1",
  "editor": "Monaco"
}
\`\`\`

\`\`\`markdown filename="README.md"
# SplitCode V5.1

Multi-file project editor.
\`\`\``;

function App() {
  const [
    inputCode,
    setInputCode,
  ] = useState(
    starterCode
  );

  const [
    files,
    setFiles,
  ] = useState([]);

  const [
    activeFileId,
    setActiveFileId,
  ] = useState(null);

  const [
    openFileIds,
    setOpenFileIds,
  ] = useState([]);

  const [
    preview,
    setPreview,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    dragging,
    setDragging,
  ] = useState(false);

  // ======================================================
  // ACTIVE FILE
  // ======================================================

  const activeFile =
    useMemo(() => {
      return (
        files.find(
          (file) =>
            file.id ===
            activeFileId
        ) || null
      );
    }, [
      files,
      activeFileId,
    ]);

  // ======================================================
  // OPEN FILE OBJECTS
  // ======================================================

  const openFiles =
    useMemo(() => {
      return openFileIds
        .map((id) =>
          files.find(
            (file) =>
              file.id === id
          )
        )
        .filter(Boolean);
    }, [
      openFileIds,
      files,
    ]);

  // ======================================================
  // OPEN FILE
  // ======================================================

  function openFile(
    fileId
  ) {
    setActiveFileId(
      fileId
    );

    setOpenFileIds(
      (current) => {
        if (
          current.includes(
            fileId
          )
        ) {
          return current;
        }

        return [
          ...current,
          fileId,
        ];
      }
    );
  }

  // ======================================================
  // CLOSE TAB
  // ======================================================

  function closeTab(
    event,
    fileId
  ) {
    event.stopPropagation();

    setOpenFileIds(
      (current) => {
        const index =
          current.indexOf(
            fileId
          );

        const next =
          current.filter(
            (id) =>
              id !== fileId
          );

        if (
          activeFileId ===
          fileId
        ) {
          if (
            next.length === 0
          ) {
            setActiveFileId(
              null
            );
          } else {
            const nextIndex =
              Math.min(
                index,
                next.length - 1
              );

            setActiveFileId(
              next[nextIndex]
            );
          }
        }

        return next;
      }
    );
  }

  // ======================================================
  // SPLIT PROJECT
  // ======================================================

  function splitCode() {
    const result =
      parseProject(
        inputCode
      );

    if (
      !result.files.length
    ) {
      setFiles([]);

      setActiveFileId(
        null
      );

      setOpenFileIds([]);

      setPreview("");

      setMessage(
        result.message
      );

      return;
    }

    setFiles(
      result.files
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
  }

  // ======================================================
  // EDIT FILE
  // ======================================================

  function editActiveFile(
    content
  ) {
    if (
      !activeFileId
    ) {
      return;
    }

    setFiles(
      (currentFiles) =>
        updateProjectFile(
          currentFiles,
          activeFileId,
          content
        )
    );
  }

  // ======================================================
  // PATH HELPERS
  // ======================================================

  function normalizePath(
    path
  ) {
    return path
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "")
      .replace(/\/+/g, "/");
  }

  function dirname(
    path
  ) {
    const normalized =
      normalizePath(path);

    const index =
      normalized.lastIndexOf(
        "/"
      );

    if (
      index === -1
    ) {
      return "";
    }

    return normalized.slice(
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

    if (
      /^(https?:)?\/\//i.test(
        reference
      ) ||
      /^data:/i.test(
        reference
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
      dirname(
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

    parts.forEach(
      (part) => {
        if (
          part === "."
        ) {
          return;
        }

        if (
          part === ".."
        ) {
          resolved.pop();

          return;
        }

        resolved.push(
          part
        );
      }
    );

    return resolved.join(
      "/"
    );
  }

  function findProjectFile(
    path
  ) {
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

  // ======================================================
  // LIVE PREVIEW
  // ======================================================

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
          /^(https?:)?\/\//i.test(
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

    // LOCAL JS

    html = html.replace(
      /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi,

      (
        fullMatch,
        before,
        src
      ) => {
        if (
          /^(https?:)?\/\//i.test(
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
<\/script>`;
        }

        return fullMatch;
      }
    );

    setPreview(html);
  }

  useEffect(() => {
    if (
      !files.length
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
      clearTimeout(
        timer
      );
  }, [files]);

  // ======================================================
  // FILE UPLOAD
  // ======================================================

  function handleFile(
    file
  ) {
    if (!file) {
      return;
    }

    const allowed = [
      ".html",
      ".htm",
      ".txt",
      ".md",
    ];

    const filename =
      file.name.toLowerCase();

    const valid =
      allowed.some(
        (extension) =>
          filename.endsWith(
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
      event.target
        .files?.[0];

    handleFile(
      file
    );

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

    handleFile(
      file
    );
  }

  // ======================================================
  // COPY
  // ======================================================

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
      console.error(
        error
      );

      setMessage(
        "Unable to copy automatically."
      );
    }
  }

  // ======================================================
  // DOWNLOAD FILE
  // ======================================================

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

    URL.revokeObjectURL(
      url
    );

    setMessage(
      `${activeFile.name} downloaded.`
    );
  }

  // ======================================================
  // DOWNLOAD ZIP
  // ======================================================

  async function downloadZip() {
    if (
      !files.length
    ) {
      setMessage(
        "Split your code before downloading."
      );

      return;
    }

    try {
      const zip =
        new JSZip();

      files.forEach(
        (file) => {
          zip.file(
            file.path,
            file.content
          );
        }
      );

      const blob =
        await zip.generateAsync(
          {
            type: "blob",
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
        "splitcode-project.zip";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );

      setMessage(
        `${files.length} project files downloaded as ZIP.`
      );
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        "Unable to create project ZIP."
      );
    }
  }

  // ======================================================
  // CLEAR
  // ======================================================

  function clearProject() {
    setInputCode("");

    setFiles([]);

    setActiveFileId(
      null
    );

    setOpenFileIds([]);

    setPreview("");

    setMessage("");
  }

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="app">

      <nav className="navbar">

        <div className="logo">

          <div className="logoIcon">
            &lt;/&gt;
          </div>

          <div>
            <span>
              Split
            </span>
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
            Paste AI-generated code,
            organize project files and
            edit them using a professional
            browser-based code editor.
          </p>

        </section>

        {/* UPLOAD */}

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

        {/* WORKSPACE */}

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

                <span>
                  →
                </span>

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
                files={
                  files
                }
                activeFileId={
                  activeFileId
                }
                onSelectFile={
                  openFile
                }
              />

              <div className="projectEditorMain">

                {/* OPEN FILE TABS */}

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
                            {
                              file.name
                            }
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

                {/* FILE HEADER */}

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

                {/* MONACO */}

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
                      ? `${openFiles.length} open • Monaco • Auto Preview`
                      : `${files.length} files`}

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
              Multi-file preview
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
                  Select or generate a
                  project containing an
                  HTML file.
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
          Multi-File Project Engine
        </span>

      </footer>

    </div>
  );
}

export default App;