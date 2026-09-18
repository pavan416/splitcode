// ==========================================================
// SplitCode V11.9 — Final QA & Stability Suite
//
// Put this file in:
//   C:\Users\DELL\Documents\SplitCode\
//
// Run:
//   node SplitCode-V11.9-QA.mjs
//
// No external package is required.
// ==========================================================

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const UTILS = path.join(SRC, "utils");

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, name, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }

  failed += 1;
  failures.push({
    name,
    detail,
  });

  console.error(
    `FAIL  ${name}${detail ? ` — ${detail}` : ""}`
  );
}

async function exists(relativePath) {
  try {
    await fs.access(
      path.join(ROOT, relativePath)
    );
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return fs.readFile(
    path.join(ROOT, relativePath),
    "utf8"
  );
}

async function importLocal(relativePath) {
  const absolute =
    path.join(ROOT, relativePath);

  return import(
    `${pathToFileURL(absolute).href}?qa=${Date.now()}`
  );
}

console.log("");
console.log("SplitCode V11.9 Final QA");
console.log("=========================");
console.log(`Project: ${ROOT}`);
console.log("");

// ----------------------------------------------------------
// A. Required project structure
// ----------------------------------------------------------

const requiredFiles = [
  "package.json",
  "src/App.jsx",
  "src/App.css",
  "src/components/CodeEditor.jsx",
  "src/components/FileExplorer.jsx",
  "src/utils/codeParser.js",
  "src/utils/frameworkDetector.js",
  "src/utils/previewManager.js",
  "src/utils/projectRelationshipEngine.js",
  "src/utils/relationshipRepair.js",
  "src/utils/projectHealth.js",
  "src/utils/exportReadiness.js",
  "src/utils/exportDocumentation.js",
  "src/utils/projectDiagnostics.js",
  "src/utils/projectRepair.js",
  "src/utils/projectStorage.js",
  "src/utils/referenceManager.js",
  "src/utils/projectImporter.js",
];

for (const file of requiredFiles) {
  ok(
    await exists(file),
    `Required file: ${file}`
  );
}

// ----------------------------------------------------------
// B. App integration/static stability checks
// ----------------------------------------------------------

const app = await read("src/App.jsx");

ok(
  !app.includes("SplitCode V6") &&
  !app.includes("SPLITCODE V6") &&
  !app.includes('"version": "6.0"'),
  "No stale V6 starter labels"
);

ok(
  app.includes("detectProjectFramework"),
  "Framework detection integrated"
);

ok(
  app.includes("getProjectPreviewPlan"),
  "Framework-aware preview integrated"
);

ok(
  app.includes("analyzeProjectRelationships"),
  "Relationship engine integrated"
);

ok(
  app.includes("getRelationshipRepair") &&
  app.includes("applyRelationshipRepair"),
  "Relationship repair integrated"
);

ok(
  app.includes("getProjectHealthSummary") &&
  app.includes("Project Health & Repair Center"),
  "Project Health integrated"
);

ok(
  app.includes("getExportReadiness") &&
  app.includes("Export Preflight"),
  "Export preflight integrated"
);

ok(
  app.includes("generateExportDocumentation") &&
  app.includes("Export Documentation"),
  "Export documentation integrated"
);

ok(
  app.includes("async function performZipDownload()") &&
  app.includes("async function downloadZip()") &&
  app.includes("exportReadiness.canExportCleanly"),
  "ZIP export remains behind preflight gate"
);

ok(
  !app.includes("confirmText:") &&
  !app.includes("cancelText:"),
  "Custom dialog uses current API"
);

ok(
  app.includes("splitActiveHtmlFile"),
  "HTML splitting preserved"
);

// ----------------------------------------------------------
// C. Load browser-independent utilities
// ----------------------------------------------------------

const parser =
  await importLocal(
    "src/utils/codeParser.js"
  );

const framework =
  await importLocal(
    "src/utils/frameworkDetector.js"
  );

const preview =
  await importLocal(
    "src/utils/previewManager.js"
  );

const relationships =
  await importLocal(
    "src/utils/projectRelationshipEngine.js"
  );

const repairs =
  await importLocal(
    "src/utils/relationshipRepair.js"
  );

const health =
  await importLocal(
    "src/utils/projectHealth.js"
  );

const readiness =
  await importLocal(
    "src/utils/exportReadiness.js"
  );

const documentation =
  await importLocal(
    "src/utils/exportDocumentation.js"
  );

// ----------------------------------------------------------
// D. Parser QA
// ----------------------------------------------------------

const parsedStatic =
  parser.parseProject(`
### index.html

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <script src="js/app.js"></script>
</body>
</html>
\`\`\`

### css/style.css

\`\`\`css
body { margin: 0; }
\`\`\`

### js/app.js

\`\`\`javascript
console.log("ok");
\`\`\`
  `);

ok(
  parsedStatic.files?.some(
    (file) =>
      file.path === "index.html"
  ) &&
  parsedStatic.files?.some(
    (file) =>
      file.path === "css/style.css"
  ) &&
  parsedStatic.files?.some(
    (file) =>
      file.path === "js/app.js"
  ),
  "Parser: nearby filename headings"
);

const parsedDuplicate =
  parser.parseProject(`
\`\`\`javascript filename="app.js"
console.log("one");
\`\`\`

\`\`\`javascript filename="app.js"
console.log("two");
\`\`\`
  `);

ok(
  parsedDuplicate.files?.some(
    (file) =>
      file.path === "app.js"
  ) &&
  parsedDuplicate.files?.some(
    (file) =>
      file.path === "app-2.js"
  ),
  "Parser: duplicate filename protection"
);

const parsedUnnamed =
  parser.parseProject(`
\`\`\`html
<!doctype html><html><body></body></html>
\`\`\`

\`\`\`css
body { color: black; }
\`\`\`

\`\`\`javascript
console.log("unnamed");
\`\`\`
  `);

ok(
  parsedUnnamed.files?.some(
    (file) =>
      file.path === "index.html"
  ) &&
  parsedUnnamed.files?.some(
    (file) =>
      file.path === "style.css"
  ) &&
  parsedUnnamed.files?.some(
    (file) =>
      file.path === "script.js"
  ),
  "Parser: unnamed AI code blocks"
);

// ----------------------------------------------------------
// E. Framework detection QA
// ----------------------------------------------------------

const vanillaInfo =
  framework.detectProjectFramework([
    {
      path: "index.html",
      content: "<html></html>",
      language: "html",
    },
    {
      path: "style.css",
      content: "body{}",
      language: "css",
    },
    {
      path: "script.js",
      content: "console.log('x')",
      language: "javascript",
    },
  ]);

ok(
  vanillaInfo.framework === "vanilla",
  "Framework: plain HTML/CSS/JS"
);

const reactFiles = [
  {
    path: "package.json",
    content: JSON.stringify({
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
      devDependencies: {
        vite: "^7.0.0",
      },
      scripts: {
        dev: "vite",
      },
    }),
    language: "json",
  },
  {
    path: "src/App.jsx",
    content:
      'import React from "react"; export default function App(){ return <main/>; }',
    language: "jsx",
  },
  {
    path: "vite.config.js",
    content: "export default {}",
    language: "javascript",
  },
];

const reactInfo =
  framework.detectProjectFramework(
    reactFiles
  );

ok(
  reactInfo.framework === "react" &&
  reactInfo.buildTool === "Vite",
  "Framework: React + Vite"
);

const nextInfo =
  framework.detectProjectFramework([
    {
      path: "package.json",
      content: JSON.stringify({
        dependencies: {
          next: "^15.0.0",
          react: "^19.0.0",
        },
      }),
      language: "json",
    },
    {
      path: "app/page.tsx",
      content:
        "export default function Page(){ return <main/>; }",
      language: "tsx",
    },
  ]);

ok(
  nextInfo.framework === "next",
  "Framework: Next.js"
);

const angularInfo =
  framework.detectProjectFramework([
    {
      path: "angular.json",
      content: "{}",
      language: "json",
    },
    {
      path: "src/app/app.component.ts",
      content:
        "@Component({}) export class AppComponent {}",
      language: "typescript",
    },
  ]);

ok(
  angularInfo.framework === "angular",
  "Framework: Angular"
);

// ----------------------------------------------------------
// F. Preview QA
// ----------------------------------------------------------

const staticPlan =
  preview.getProjectPreviewPlan(
    parsedStatic.files,
    framework.detectProjectFramework(
      parsedStatic.files
    )
  );

ok(
  staticPlan.mode === "live" &&
  staticPlan.canPreview === true,
  "Preview: static project is browser-ready"
);

const reactPlan =
  preview.getProjectPreviewPlan(
    reactFiles,
    reactInfo
  );

ok(
  reactPlan.mode === "runtime" &&
  reactPlan.runCommand === "npm run dev",
  "Preview: React/Vite requires runtime"
);

const noEntryPlan =
  preview.getProjectPreviewPlan(
    [
      {
        path: "notes.txt",
        content: "hello",
        language: "text",
      },
    ],
    {
      framework: "unknown",
      label: "Custom Project",
    }
  );

ok(
  noEntryPlan.mode === "unavailable",
  "Preview: missing entry point"
);

// ----------------------------------------------------------
// G. Relationship graph + repair QA
// ----------------------------------------------------------

const relationshipFiles = [
  {
    id: "html",
    path: "index.html",
    language: "html",
    content:
      '<link rel="stylesheet" href="css/styles.css"><script src="js/app.js"></script>',
  },
  {
    id: "css",
    path: "css/style.css",
    language: "css",
    content: "body{}",
  },
  {
    id: "js",
    path: "js/app.js",
    language: "javascript",
    content: "console.log('ok')",
  },
];

const graph =
  relationships.analyzeProjectRelationships(
    relationshipFiles
  );

ok(
  graph.missingCount === 1 &&
  graph.resolvedCount === 1,
  "Relationships: resolved + broken links"
);

const brokenEdge =
  graph.missing[0];

const repair =
  repairs.getRelationshipRepair(
    brokenEdge,
    relationshipFiles
  );

ok(
  Boolean(repair) &&
  repair.targetPath ===
    "css/style.css",
  "Repair: likely existing file suggested"
);

const repaired =
  repairs.applyRelationshipRepair(
    brokenEdge,
    repair,
    relationshipFiles
  );

ok(
  repaired.changed === true &&
  repaired.files[0].content.includes(
    'href="css/style.css"'
  ),
  "Repair: broken reference rewritten safely"
);

// ----------------------------------------------------------
// H. Project Health + Export Readiness QA
// ----------------------------------------------------------

const healthySummary =
  health.getProjectHealthSummary({
    files:
      parsedStatic.files,
    diagnostics: {
      errors: 0,
      warnings: 0,
    },
    relationships: {
      missingCount: 0,
      orphanedCount: 0,
    },
    framework:
      vanillaInfo,
    previewPlan:
      staticPlan,
    relationshipRepairs: {},
  });

ok(
  healthySummary.status ===
    "Healthy",
  "Health: healthy project"
);

const runtimeHealth =
  health.getProjectHealthSummary({
    files:
      reactFiles,
    diagnostics: {
      errors: 0,
      warnings: 0,
    },
    relationships: {
      missingCount: 0,
      orphanedCount: 0,
    },
    framework:
      reactInfo,
    previewPlan:
      reactPlan,
    relationshipRepairs: {},
  });

ok(
  runtimeHealth.status ===
    "Runtime required",
  "Health: framework runtime state"
);

const ready =
  readiness.getExportReadiness({
    files:
      parsedStatic.files,
    diagnostics: {
      errors: 0,
      warnings: 0,
    },
    relationships: {
      missingCount: 0,
      orphanedCount: 0,
    },
    framework:
      vanillaInfo,
    previewPlan:
      staticPlan,
    projectHealth:
      healthySummary,
  });

ok(
  ready.status === "ready",
  "Export: clean static project ready"
);

const review =
  readiness.getExportReadiness({
    files:
      reactFiles,
    diagnostics: {
      errors: 0,
      warnings: 0,
    },
    relationships: {
      missingCount: 0,
      orphanedCount: 0,
    },
    framework:
      reactInfo,
    previewPlan:
      reactPlan,
    projectHealth:
      runtimeHealth,
  });

ok(
  review.status === "review",
  "Export: framework runtime requires review"
);

const blocked =
  readiness.getExportReadiness({
    files:
      relationshipFiles,
    diagnostics: {
      errors: 1,
      warnings: 0,
    },
    relationships:
      graph,
    framework:
      vanillaInfo,
    previewPlan:
      staticPlan,
    projectHealth: {
      safeFixCount:
        repair?.confidence === "high"
          ? 1
          : 0,
      reviewFixCount: 0,
    },
  });

ok(
  blocked.status === "blocked",
  "Export: broken project blocked"
);

// ----------------------------------------------------------
// I. Export Documentation QA
// ----------------------------------------------------------

const docsPlan =
  documentation.getExportDocumentationPlan([
    {
      path:
        "SPLITCODE-EXPORT-REPORT.md",
      content:
        "# Existing report",
    },
    {
      path:
        "index.html",
      content:
        "<title>QA Project</title>",
    },
  ]);

ok(
  docsPlan.reportPath ===
    "SPLITCODE-EXPORT-REPORT-2.md",
  "Docs: report filename collision protection"
);

const generatedDocs =
  documentation.generateExportDocumentation({
    files: [
      {
        path:
          "SPLITCODE-EXPORT-REPORT.md",
        content:
          "# Existing report",
      },
      {
        path:
          "index.html",
        content:
          "<title>QA Project</title>",
      },
    ],
    framework:
      vanillaInfo,
    previewPlan:
      staticPlan,
    projectHealth:
      healthySummary,
    exportReadiness:
      ready,
    diagnostics: {
      issues: [],
    },
    relationships: {
      missing: [],
      orphaned: [],
    },
    generatedAt:
      "2026-09-19T00:00:00.000Z",
  });

const generatedReadme =
  generatedDocs.documents.find(
    (document) =>
      document.kind ===
      "readme"
  );

ok(
  generatedReadme?.content.includes(
    "SPLITCODE-EXPORT-REPORT-2.md"
  ),
  "Docs: README points to actual collision-safe report"
);

const preservedReadme =
  documentation.generateExportDocumentation({
    files: [
      {
        path: "README.md",
        content: "# User README",
      },
      {
        path: "index.html",
        content:
          "<title>Project</title>",
      },
    ],
    framework:
      vanillaInfo,
    previewPlan:
      staticPlan,
    projectHealth:
      healthySummary,
    exportReadiness:
      ready,
  });

ok(
  !preservedReadme.documents.some(
    (document) =>
      document.kind === "readme"
  ),
  "Docs: existing README preserved"
);

// ----------------------------------------------------------
// Final result
// ----------------------------------------------------------

console.log("");
console.log("-------------------------");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("-------------------------");

if (failed > 0) {
  console.log("");
  console.log("Failed checks:");

  failures.forEach(
    ({ name, detail }) => {
      console.log(
        `- ${name}${detail ? `: ${detail}` : ""}`
      );
    }
  );

  console.log("");
  console.log(
    "V11.9 QA FAILED. Do not move to V12 until these checks are fixed."
  );

  process.exitCode = 1;
} else {
  console.log("");
  console.log(
    "V11.9 QA PASSED. Next, run: npm run build"
  );
  console.log(
    "If the production build also passes, SplitCode is ready for V12 launch work."
  );
}
