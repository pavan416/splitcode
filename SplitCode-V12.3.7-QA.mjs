// SplitCode V12.3.7 — Flow + Explorer static QA
// Put in project root and run:
// node SplitCode-V12.3.7-QA.mjs

import fs from "node:fs/promises";

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${label}`);
  }
}

const app = await fs.readFile("src/App.jsx", "utf8");
const css = await fs.readFile("src/App.css", "utf8");
const explorer = await fs.readFile(
  "src/components/FileExplorer.jsx",
  "utf8"
);

check(
  app.includes('className="scProcessFlow"'),
  "New homepage process flow markup"
);

check(
  app.includes("splitcodeProcessGradient"),
  "Process SVG gradient"
);

check(
  app.includes("scProcessStep-4"),
  "All four process steps"
);

check(
  !app.includes('className="scDarkSteps" id="features"'),
  "Old four-card flow removed"
);

check(
  app.includes("function moveFileToFolder"),
  "File move handler preserved"
);

check(
  app.includes("onMoveFile={moveFileToFolder}"),
  "File move wired to explorer"
);

check(
  explorer.includes("draggable"),
  "Explorer files draggable"
);

check(
  explorer.includes("scTreeRootChildren"),
  "Nested project tree"
);

check(
  explorer.includes("Move here"),
  "Folder drop state"
);

check(
  css.includes("TRUE PROCESS FLOW + IDE-LIKE FILE TREE"),
  "V12.3.7 CSS present"
);

check(
  css.includes("@keyframes scProcessDash"),
  "Process-line animation"
);

check(
  css.includes("scTreeDragGuide"),
  "Drag guidance styling"
);

console.log("");
console.log("-------------------------");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("-------------------------");

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("");
  console.log("V12.3.7 STATIC QA PASSED.");
  console.log("Next: npm run build");
}
