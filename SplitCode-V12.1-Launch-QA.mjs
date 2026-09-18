// ==========================================================
// SplitCode V12.1 — Launch QA
//
// Store this file here:
// C:\Users\DELL\Documents\SplitCode\SplitCode-V12.1-Launch-QA.mjs
//
// Run:
// node SplitCode-V12.1-Launch-QA.mjs
// ==========================================================

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

let passed = 0;
let failed = 0;

async function exists(relativePath) {
  try {
    await fs.access(
      path.join(root, relativePath)
    );
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return fs.readFile(
    path.join(root, relativePath),
    "utf8"
  );
}

function check(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${label}`);
  }
}

console.log("");
console.log("SplitCode V12.1 Launch QA");
console.log("=========================");
console.log(`Project: ${root}`);
console.log("");

const requiredFiles = [
  "index.html",
  "package.json",
  "src/App.jsx",
  "src/App.css",
  "public/splitcode-logo.svg",
  "public/favicon.svg",
  "public/favicon-32.png",
  "public/favicon-192.png",
  "public/favicon-512.png",
  "public/apple-touch-icon.png",
  "public/site.webmanifest",
  "public/splitcode-social-preview.png",
];

for (const file of requiredFiles) {
  check(
    await exists(file),
    `Required file: ${file}`
  );
}

if (await exists("index.html")) {
  const html = await read("index.html");

  check(
    html.includes(
      "SplitCode — Turn AI Code Into Real Projects"
    ),
    "Production page title"
  );

  check(
    html.includes('name="description"'),
    "SEO description"
  );

  check(
    html.includes('property="og:title"') &&
      html.includes('property="og:description"'),
    "Open Graph metadata"
  );

  check(
    html.includes('name="twitter:card"'),
    "Twitter card metadata"
  );

  check(
    html.includes('rel="manifest"') &&
      html.includes('/site.webmanifest'),
    "Web manifest linked"
  );

  check(
    html.includes('/favicon.svg'),
    "SVG favicon linked"
  );

  check(
    html.includes('/apple-touch-icon.png'),
    "Apple touch icon linked"
  );

  check(
    html.includes('/splitcode-social-preview.png'),
    "Social preview linked"
  );

  check(
    html.includes('src="/src/main.jsx"'),
    "Vite app entry preserved"
  );
}

if (await exists("src/App.jsx")) {
  const app = await read("src/App.jsx");

  check(
    app.includes('src="/splitcode-logo.svg"'),
    "Exact SplitCode logo used in UI"
  );

  check(
    app.includes("Project Health & Repair Center"),
    "Project Health preserved"
  );

  check(
    app.includes("Export Preflight"),
    "Export Preflight preserved"
  );
}

if (await exists("src/App.css")) {
  const css = await read("src/App.css");

  check(
    css.includes(
      "SPLITCODE V11.9.5 — FULL RESPONSIVE SYSTEM"
    ),
    "Responsive system preserved"
  );

  check(
    css.includes(
      "SPLITCODE V11.9.6 — MOBILE CTA ALIGNMENT FIX"
    ),
    "Mobile CTA fix preserved"
  );

  check(
    css.includes(
      "SPLITCODE V12.1 — EXACT BRAND ASSETS"
    ),
    "V12.1 branding styles present"
  );
}

if (await exists("public/site.webmanifest")) {
  const manifestText =
    await read("public/site.webmanifest");

  let manifest = null;

  try {
    manifest = JSON.parse(
      manifestText
    );
  } catch {
    manifest = null;
  }

  check(
    Boolean(manifest),
    "Web manifest is valid JSON"
  );

  if (manifest) {
    check(
      manifest.name === "SplitCode",
      "Manifest app name"
    );

    const iconSources =
      Array.isArray(manifest.icons)
        ? manifest.icons.map(
            (icon) => icon.src
          )
        : [];

    check(
      iconSources.includes("/favicon.svg") &&
        iconSources.includes("/favicon-192.png") &&
        iconSources.includes("/favicon-512.png"),
      "Manifest icon set"
    );
  }
}

console.log("");
console.log("-------------------------");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("-------------------------");

if (failed > 0) {
  console.log("");
  console.log(
    "V12.1 LAUNCH QA FAILED. Fix the failed checks before deployment."
  );
  process.exitCode = 1;
} else {
  console.log("");
  console.log(
    "V12.1 LAUNCH QA PASSED."
  );
  console.log(
    "Production build is ready for deployment."
  );
}
