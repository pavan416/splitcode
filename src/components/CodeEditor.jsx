import Editor from "@monaco-editor/react";

function getMonacoLanguage(language, filename = "") {
  const lang = (language || "").toLowerCase();
  const name = filename.toLowerCase();

  if (lang === "html" || name.endsWith(".html") || name.endsWith(".htm")) {
    return "html";
  }

  if (lang === "css" || name.endsWith(".css")) {
    return "css";
  }

  if (
    lang === "javascript" ||
    lang === "js" ||
    name.endsWith(".js") ||
    name.endsWith(".mjs") ||
    name.endsWith(".cjs")
  ) {
    return "javascript";
  }

  if (lang === "typescript" || lang === "ts" || name.endsWith(".ts")) {
    return "typescript";
  }

  if (lang === "jsx" || name.endsWith(".jsx")) {
    return "javascript";
  }

  if (lang === "tsx" || name.endsWith(".tsx")) {
    return "typescript";
  }

  if (lang === "json" || name.endsWith(".json")) {
    return "json";
  }

  if (lang === "markdown" || lang === "md" || name.endsWith(".md")) {
    return "markdown";
  }

  return "plaintext";
}

function CodeEditor({
  file,
  onChange,
  onCursorChange,
}) {
  if (!file) {
    return (
      <div className="monacoEmptyState">
        <div>
          <div className="monacoEmptyIcon">
            &lt;/&gt;
          </div>

          <strong>
            Select a project file
          </strong>

          <p>
            Choose a file from the Project
            Explorer to start editing.
          </p>
        </div>
      </div>
    );
  }

  const language = getMonacoLanguage(
    file.language,
    file.path
  );

  function handleEditorMount(editor) {
    const updateCursor = () => {
      if (typeof onCursorChange !== "function") {
        return;
      }

      const position = editor.getPosition();

      onCursorChange({
        line: position?.lineNumber || 1,
        column: position?.column || 1,
      });
    };

    updateCursor();

    editor.onDidChangeCursorPosition((event) => {
      if (typeof onCursorChange !== "function") {
        return;
      }

      onCursorChange({
        line: event.position.lineNumber,
        column: event.position.column,
      });
    });

    // V10.5: keep Monaco's native search/replace shortcuts available
    // and add a safe Format Document shortcut.
    editor.addAction({
      id: "splitcode-format-document",
      label: "Format Document",
      keybindings: [
        2048 | 1024 | 36,
      ],
      run: async () => {
        const action = editor.getAction("editor.action.formatDocument");

        if (action) {
          await action.run();
        }
      },
    });

    editor.focus();
  }

  return (
    <div className="monacoEditorWrapper">
      <Editor
        height="540px"
        language={language}
        value={file.content}
        theme="vs-dark"
        path={file.path}
        onMount={handleEditorMount}
        onChange={(value) => {
          onChange(value ?? "");
        }}
        loading={
          <div className="monacoLoading">
            Loading editor...
          </div>
        }
        options={{
          automaticLayout: true,

          minimap: {
            enabled: false,
          },

          fontSize: 13,

          lineHeight: 21,

          fontFamily:
            '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',

          fontLigatures: true,

          lineNumbers: "on",

          lineNumbersMinChars: 3,

          glyphMargin: false,

          folding: true,

          foldingHighlight: true,

          showFoldingControls: "mouseover",

          scrollBeyondLastLine: false,

          wordWrap: "off",
          wrappingIndent: "same",

          tabSize: 2,

          insertSpaces: true,

          detectIndentation: true,

          renderWhitespace: "selection",

          renderLineHighlight: "line",

          cursorBlinking: "smooth",

          cursorSmoothCaretAnimation: "on",

          smoothScrolling: true,

          mouseWheelZoom: true,

          stickyScroll: {
            enabled: false,
          },

          links: true,

          occurrencesHighlight: "singleFile",

          selectionHighlight: true,

          matchBrackets: "always",

          formatOnPaste: true,

          formatOnType: true,

          bracketPairColorization: {
            enabled: true,
          },

          guides: {
            bracketPairs: true,
            indentation: true,
          },

          padding: {
            top: 14,
            bottom: 14,
          },

          overviewRulerBorder: false,

          hideCursorInOverviewRuler: true,

          scrollbar: {
            verticalScrollbarSize: 9,
            horizontalScrollbarSize: 9,
            useShadows: false,
          },

          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: "never",
            seedSearchStringFromSelection: "selection",
          },
        }}
      />
    </div>
  );
}

export default CodeEditor;
