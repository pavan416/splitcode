import { useEffect, useState } from "react";
import JSZip from "jszip";
import "./App.css";

const starterCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SplitCode Demo</title>

  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #111827;
      color: white;
      font-family: Arial, sans-serif;
    }

    .card {
      padding: 40px;
      background: #1f2937;
      border-radius: 20px;
      text-align: center;
    }

    button {
      padding: 12px 20px;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }
  </style>
</head>

<body>

  <div class="card">
    <h1>SplitCode V3</h1>
    <p>Edit your generated files and see the preview update.</p>
    <button id="helloBtn">Test JavaScript</button>
  </div>

  <script>
    document
      .getElementById("helloBtn")
      .addEventListener("click", function () {
        alert("JavaScript is working!");
      });
  </script>

</body>
</html>`;

function App() {
  const [inputCode, setInputCode] = useState(starterCode);

  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");

  const [activeTab, setActiveTab] = useState("html");

  const [preview, setPreview] = useState("");

  const [message, setMessage] = useState("");

  const [dragging, setDragging] = useState(false);

  // ========================================================
  // AUTOMATIC PREVIEW
  // ========================================================

  useEffect(() => {
    if (!htmlCode) {
      setPreview("");
      return;
    }

    const timer = setTimeout(() => {
      createPreview(
        htmlCode,
        cssCode,
        jsCode
      );
    }, 250);

    return () => clearTimeout(timer);
  }, [htmlCode, cssCode, jsCode]);

  // ========================================================
  // SPLITTING ENGINE
  // ========================================================

  function splitCode() {
    if (!inputCode.trim()) {
      setMessage("Paste or upload some code first.");
      return;
    }

    try {
      const source = inputCode.trim();

      let extractedHTML = "";
      let extractedCSS = "";
      let extractedJS = "";

      // ====================================================
      // DETECT MARKDOWN / AI CODE BLOCKS
      // ====================================================

      const codeBlockRegex =
        /```([a-zA-Z0-9+#.-]*)\s*\n([\s\S]*?)```/g;

      const blocks = [...source.matchAll(codeBlockRegex)];

      if (blocks.length > 0) {
        let recognizedBlocks = 0;

        blocks.forEach((block) => {
          const language = block[1]
            .toLowerCase()
            .trim();

          const code = block[2].trim();

          if (
            language === "html" ||
            language === "htm"
          ) {
            extractedHTML +=
              (extractedHTML ? "\n\n" : "") +
              code;

            recognizedBlocks++;
          }

          else if (language === "css") {
            extractedCSS +=
              (extractedCSS ? "\n\n" : "") +
              code;

            recognizedBlocks++;
          }

          else if (
            language === "js" ||
            language === "javascript"
          ) {
            extractedJS +=
              (extractedJS ? "\n\n" : "") +
              code;

            recognizedBlocks++;
          }
        });

        if (recognizedBlocks > 0) {
          buildProject(
            extractedHTML,
            extractedCSS,
            extractedJS
          );

          setMessage(
            `AI code detected — ${recognizedBlocks} code block${
              recognizedBlocks === 1 ? "" : "s"
            } separated successfully.`
          );

          return;
        }
      }

      // ====================================================
      // NORMAL HTML
      // ====================================================

      const parser = new DOMParser();

      const doc = parser.parseFromString(
        source,
        "text/html"
      );

      // ====================================================
      // EXTRACT CSS
      // ====================================================

      const styleElements = Array.from(
        doc.querySelectorAll("style")
      );

      extractedCSS = styleElements
        .map((style) => style.textContent.trim())
        .filter(Boolean)
        .join("\n\n");

      styleElements.forEach((style) => {
        style.remove();
      });

      // ====================================================
      // EXTRACT JAVASCRIPT
      // ====================================================

      const scriptElements = Array.from(
        doc.querySelectorAll(
          "script:not([src])"
        )
      );

      extractedJS = scriptElements
        .map((script) => script.textContent.trim())
        .filter(Boolean)
        .join("\n\n");

      scriptElements.forEach((script) => {
        script.remove();
      });

      // ====================================================
      // HTML
      // ====================================================

      extractedHTML =
        "<!DOCTYPE html>\n" +
        doc.documentElement.outerHTML;

      buildProject(
        extractedHTML,
        extractedCSS,
        extractedJS
      );

      setMessage(
        "HTML document separated successfully."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to separate this code."
      );
    }
  }

  // ========================================================
  // BUILD PROJECT
  // ========================================================

  function buildProject(html, css, js) {
    let finalHTML = (html || "").trim();
    let finalCSS = (css || "").trim();
    let finalJS = (js || "").trim();

    // ====================================================
    // CREATE BASIC HTML IF NECESSARY
    // ====================================================

    if (!finalHTML) {
      finalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>SplitCode Project</title>
</head>

<body>

</body>
</html>`;
    }

    // ====================================================
    // HTML FRAGMENT -> FULL DOCUMENT
    // ====================================================

    if (!/<html[\s>]/i.test(finalHTML)) {
      finalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>SplitCode Project</title>
</head>

<body>

${finalHTML}

</body>
</html>`;
    }

    const parser = new DOMParser();

    const doc = parser.parseFromString(
      finalHTML,
      "text/html"
    );

    // ====================================================
    // EXTRACT ANY REMAINING CSS
    // ====================================================

    const embeddedStyles = Array.from(
      doc.querySelectorAll("style")
    );

    if (embeddedStyles.length > 0) {
      const extraCSS = embeddedStyles
        .map((style) => style.textContent.trim())
        .filter(Boolean)
        .join("\n\n");

      if (extraCSS) {
        finalCSS = finalCSS
          ? `${finalCSS}\n\n${extraCSS}`
          : extraCSS;
      }

      embeddedStyles.forEach((style) => {
        style.remove();
      });
    }

    // ====================================================
    // EXTRACT ANY REMAINING JS
    // ====================================================

    const embeddedScripts = Array.from(
      doc.querySelectorAll(
        "script:not([src])"
      )
    );

    if (embeddedScripts.length > 0) {
      const extraJS = embeddedScripts
        .map((script) => script.textContent.trim())
        .filter(Boolean)
        .join("\n\n");

      if (extraJS) {
        finalJS = finalJS
          ? `${finalJS}\n\n${extraJS}`
          : extraJS;
      }

      embeddedScripts.forEach((script) => {
        script.remove();
      });
    }

    // ====================================================
    // ADD style.css
    // ====================================================

    if (
      finalCSS &&
      !doc.querySelector(
        'link[href="style.css"]'
      )
    ) {
      const link =
        doc.createElement("link");

      link.rel = "stylesheet";
      link.href = "style.css";

      doc.head.appendChild(link);
    }

    // ====================================================
    // ADD script.js
    // ====================================================

    if (
      finalJS &&
      !doc.querySelector(
        'script[src="script.js"]'
      )
    ) {
      const script =
        doc.createElement("script");

      script.src = "script.js";

      doc.body.appendChild(script);
    }

    const outputHTML =
      "<!DOCTYPE html>\n" +
      doc.documentElement.outerHTML;

    setHtmlCode(outputHTML);
    setCssCode(finalCSS);
    setJsCode(finalJS);

    setActiveTab("html");
  }

  // ========================================================
  // PREVIEW
  // ========================================================

  function createPreview(html, css, js) {
    let previewHTML = html;

    // Remove SplitCode generated external stylesheet

    previewHTML = previewHTML.replace(
      /<link[^>]*href=["']style\.css["'][^>]*>/gi,
      ""
    );

    // Remove SplitCode generated script

    previewHTML = previewHTML.replace(
      /<script[^>]*src=["']script\.js["'][^>]*><\/script>/gi,
      ""
    );

    // Inject current CSS

    if (css) {
      if (
        /<\/head>/i.test(previewHTML)
      ) {
        previewHTML = previewHTML.replace(
          /<\/head>/i,
          `<style>${css}</style></head>`
        );
      } else {
        previewHTML =
          `<style>${css}</style>` +
          previewHTML;
      }
    }

    // Inject current JS

    if (js) {
      if (
        /<\/body>/i.test(previewHTML)
      ) {
        previewHTML = previewHTML.replace(
          /<\/body>/i,
          `<script>${js}<\/script></body>`
        );
      } else {
        previewHTML +=
          `<script>${js}<\/script>`;
      }
    }

    setPreview(previewHTML);
  }

  // ========================================================
  // FILE UPLOAD
  // ========================================================

  function handleFile(file) {
    if (!file) {
      return;
    }

    const allowedExtensions = [
      ".html",
      ".htm",
      ".txt",
      ".md",
    ];

    const filename =
      file.name.toLowerCase();

    const validFile =
      allowedExtensions.some(
        (extension) =>
          filename.endsWith(extension)
      );

    if (!validFile) {
      setMessage(
        "Please upload an HTML, HTM, TXT or Markdown file."
      );

      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const content =
        event.target.result;

      setInputCode(content);

      setMessage(
        `${file.name} loaded successfully. Click Split Code.`
      );
    };

    reader.onerror = () => {
      setMessage(
        "Unable to read this file."
      );
    };

    reader.readAsText(file);
  }

  function handleFileInput(event) {
    const file =
      event.target.files?.[0];

    handleFile(file);

    event.target.value = "";
  }

  // ========================================================
  // DRAG & DROP
  // ========================================================

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
      event.dataTransfer.files?.[0];

    handleFile(file);
  }

  // ========================================================
  // OUTPUT EDITOR
  // ========================================================

  function updateCurrentCode(value) {
    if (activeTab === "html") {
      setHtmlCode(value);
    }

    else if (activeTab === "css") {
      setCssCode(value);
    }

    else {
      setJsCode(value);
    }
  }

  // ========================================================
  // COPY
  // ========================================================

  async function copyCode(code) {
    if (!code) {
      setMessage(
        "Nothing to copy yet."
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        code
      );

      setMessage(
        "Copied to clipboard."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to copy automatically."
      );
    }
  }

  // ========================================================
  // DOWNLOAD FILE
  // ========================================================

  function downloadFile(
    filename,
    content,
    type
  ) {
    if (!content) {
      setMessage(
        `No ${filename} content available.`
      );

      return;
    }

    const blob = new Blob(
      [content],
      {
        type,
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    setMessage(
      `${filename} downloaded.`
    );
  }

  // ========================================================
  // DOWNLOAD ZIP
  // ========================================================

  async function downloadZip() {
    if (!htmlCode) {
      setMessage(
        "Split your code before downloading."
      );

      return;
    }

    try {
      const zip =
        new JSZip();

      zip.file(
        "index.html",
        htmlCode
      );

      if (cssCode) {
        zip.file(
          "style.css",
          cssCode
        );
      }

      if (jsCode) {
        zip.file(
          "script.js",
          jsCode
        );
      }

      const blob =
        await zip.generateAsync({
          type: "blob",
        });

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

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
        "Unable to create ZIP."
      );
    }
  }

  // ========================================================
  // RESET
  // ========================================================

  function resetTool() {
    setInputCode("");

    setHtmlCode("");
    setCssCode("");
    setJsCode("");

    setPreview("");

    setMessage("");

    setActiveTab("html");
  }

  // ========================================================
  // CURRENT TAB INFORMATION
  // ========================================================

  const currentCode =
    activeTab === "html"
      ? htmlCode
      : activeTab === "css"
      ? cssCode
      : jsCode;

  const currentFilename =
    activeTab === "html"
      ? "index.html"
      : activeTab === "css"
      ? "style.css"
      : "script.js";

  const currentType =
    activeTab === "html"
      ? "text/html"
      : activeTab === "css"
      ? "text/css"
      : "text/javascript";

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="app">

      {/* NAVBAR */}

      <nav className="navbar">

        <div className="logo">

          <div className="logoIcon">
            &lt;/&gt;
          </div>

          <div>
            <span>Split</span>Code
          </div>

        </div>

        <div className="navBadge">
          Runs locally in your browser
        </div>

      </nav>

      {/* MAIN */}

      <main className="container">

        {/* HERO */}

        <section className="hero">

          <div className="eyebrow">
            FRONTEND DEVELOPER TOOL
          </div>

          <h1>
            Turn mixed code into
            <span>
              {" "}clean project files.
            </span>
          </h1>

          <p>
            Paste AI-generated code or upload
            a file. SplitCode separates HTML,
            CSS and JavaScript into editable
            project files with instant preview.
          </p>

        </section>

        {/* UPLOAD */}

        <section
          className={
            dragging
              ? "uploadZone uploadDragging"
              : "uploadZone"
          }
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
              onChange={handleFileInput}
              hidden
            />

          </label>

        </section>

        {/* WORKSPACE */}

        <section className="workspace">

          {/* INPUT */}

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
                onClick={resetTool}
              >
                Clear
              </button>

            </div>

            <textarea
              className="codeInput"
              value={inputCode}
              onChange={(event) =>
                setInputCode(
                  event.target.value
                )
              }
              spellCheck="false"
              placeholder="Paste HTML, CSS, JavaScript or AI-generated code here..."
            />

            <div className="actionRow">

              <span className="status">
                {message}
              </span>

              <button
                className="primaryButton"
                onClick={splitCode}
              >
                Split Code

                <span>
                  →
                </span>

              </button>

            </div>

          </div>

          {/* OUTPUT */}

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
                onClick={downloadZip}
              >
                Download ZIP
              </button>

            </div>

            {/* TABS */}

            <div className="tabs">

              <button
                className={
                  activeTab === "html"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("html")
                }
              >
                <span
                  className="htmlDot"
                />

                index.html
              </button>

              <button
                className={
                  activeTab === "css"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("css")
                }
              >
                <span
                  className="cssDot"
                />

                style.css
              </button>

              <button
                className={
                  activeTab === "js"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("js")
                }
              >
                <span
                  className="jsDot"
                />

                script.js
              </button>

            </div>

            {/* EDITABLE OUTPUT */}

            <textarea
              className="codeOutput"
              value={currentCode}
              onChange={(event) =>
                updateCurrentCode(
                  event.target.value
                )
              }
              spellCheck="false"
              placeholder="Your separated code will appear here..."
            />

            <div className="outputActions">

              <span className="editStatus">
                Editable • Auto Preview
              </span>

              <button
                onClick={() =>
                  copyCode(
                    currentCode
                  )
                }
              >
                Copy
              </button>

              <button
                onClick={() =>
                  downloadFile(
                    currentFilename,
                    currentCode,
                    currentType
                  )
                }
              >
                Download
              </button>

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
              Updates automatically
            </span>

          </div>

          {preview ? (

            <iframe
              title="SplitCode Preview"
              srcDoc={preview}
              sandbox="allow-scripts"
              className="previewFrame"
            />

          ) : (

            <div className="emptyPreview">

              <div>

                <strong>
                  Nothing to preview yet
                </strong>

                <p>
                  Paste or upload code and
                  click Split Code.
                </p>

              </div>

            </div>

          )}

        </section>

      </main>

      {/* FOOTER */}

      <footer>

        <strong>
          SplitCode
        </strong>

        <span>
          HTML • CSS • JavaScript
        </span>

      </footer>

    </div>
  );
}

export default App;