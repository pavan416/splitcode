// ==========================================================
// SplitCode V11.2 — Framework Detection
// src/utils/frameworkDetector.js
//
// Detects project/framework type from imported/generated files.
// No API and no network connection required.
// ==========================================================

function normalizePath(path = "") {
  return String(path)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function getFile(files, wantedPath) {
  const target = normalizePath(wantedPath);

  return (
    files.find(
      (file) =>
        normalizePath(file.path || file.name) === target
    ) || null
  );
}

function hasFile(files, test) {
  return files.some((file) => {
    const path = normalizePath(file.path || file.name);

    if (typeof test === "string") {
      return path === normalizePath(test);
    }

    return test.test(path);
  });
}

function safeParseJson(content = "") {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readPackageJson(files) {
  const packageFile =
    getFile(files, "package.json");

  if (!packageFile) {
    return null;
  }

  return safeParseJson(
    packageFile.content
  );
}

function collectDependencies(packageJson) {
  if (!packageJson) {
    return new Set();
  }

  const groups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];

  const values = [];

  groups.forEach((group) => {
    if (!group || typeof group !== "object") {
      return;
    }

    values.push(
      ...Object.keys(group)
    );
  });

  return new Set(
    values.map((item) =>
      item.toLowerCase()
    )
  );
}

function hasDependency(dependencies, name) {
  return dependencies.has(
    name.toLowerCase()
  );
}

function hasDependencyPrefix(
  dependencies,
  prefix
) {
  const normalizedPrefix =
    prefix.toLowerCase();

  return [...dependencies].some(
    (dependency) =>
      dependency.startsWith(
        normalizedPrefix
      )
  );
}

function contentIncludes(
  files,
  expression
) {
  return files.some((file) =>
    expression.test(
      String(file.content || "")
    )
  );
}

function addEvidence(
  evidence,
  value
) {
  if (
    value &&
    !evidence.includes(value)
  ) {
    evidence.push(value);
  }
}

function getTypeScriptState(files, dependencies) {
  const hasTypeScriptFiles =
    hasFile(
      files,
      /\.(?:ts|tsx)$/
    );

  const hasTsConfig =
    hasFile(
      files,
      /(^|\/)tsconfig(?:\.[^/]+)?\.json$/
    );

  const hasTypeScriptDependency =
    hasDependency(
      dependencies,
      "typescript"
    );

  return (
    hasTypeScriptFiles ||
    hasTsConfig ||
    hasTypeScriptDependency
  );
}

function detectBuildTool(files, dependencies) {
  if (
    hasDependency(dependencies, "vite") ||
    hasFile(files, /(^|\/)vite\.config\.(?:js|mjs|cjs|ts|mts|cts)$/)
  ) {
    return "Vite";
  }

  if (
    hasDependency(dependencies, "webpack") ||
    hasFile(files, /(^|\/)webpack\.config\.(?:js|cjs|mjs|ts)$/)
  ) {
    return "Webpack";
  }

  if (
    hasDependency(dependencies, "parcel")
  ) {
    return "Parcel";
  }

  if (
    hasDependency(dependencies, "astro") ||
    hasFile(files, /(^|\/)astro\.config\.(?:js|mjs|ts)$/)
  ) {
    return "Astro";
  }

  return "";
}

function detectStyling(files, dependencies) {
  const styling = [];

  if (
    hasDependency(dependencies, "tailwindcss") ||
    hasFile(files, /(^|\/)tailwind\.config\.(?:js|cjs|mjs|ts)$/) ||
    contentIncludes(
      files,
      /@tailwind\s+(?:base|components|utilities)|@import\s+["']tailwindcss["']/i
    )
  ) {
    styling.push("Tailwind CSS");
  }

  if (
    hasDependency(dependencies, "sass") ||
    hasFile(files, /\.(?:scss|sass)$/)
  ) {
    styling.push("Sass");
  }

  if (
    hasDependency(dependencies, "styled-components")
  ) {
    styling.push("Styled Components");
  }

  return styling;
}

function detectReact(files, dependencies) {
  if (
    hasDependency(dependencies, "react") ||
    hasDependency(dependencies, "react-dom")
  ) {
    return true;
  }

  if (
    hasFile(files, /\.(?:jsx|tsx)$/) &&
    contentIncludes(
      files,
      /(?:from\s+["']react["']|React\.|useState\s*\(|useEffect\s*\(|createRoot\s*\()/m
    )
  ) {
    return true;
  }

  return contentIncludes(
    files,
    /createRoot\s*\(|ReactDOM\.render\s*\(/m
  );
}

function detectVue(files, dependencies) {
  return (
    hasDependency(dependencies, "vue") ||
    hasFile(files, /\.vue$/) ||
    contentIncludes(
      files,
      /createApp\s*\(\s*App\s*\)|from\s+["']vue["']/m
    )
  );
}

function detectAngular(files, dependencies) {
  return (
    hasDependencyPrefix(
      dependencies,
      "@angular/"
    ) ||
    hasFile(files, /(^|\/)angular\.json$/) ||
    contentIncludes(
      files,
      /@Component\s*\(|platformBrowserDynamic\s*\(|bootstrapApplication\s*\(/m
    )
  );
}

function detectSvelte(files, dependencies) {
  return (
    hasDependency(dependencies, "svelte") ||
    hasDependencyPrefix(
      dependencies,
      "@sveltejs/"
    ) ||
    hasFile(files, /\.svelte$/) ||
    hasFile(files, /(^|\/)svelte\.config\.(?:js|cjs|mjs|ts)$/)
  );
}

function detectNext(files, dependencies) {
  return (
    hasDependency(dependencies, "next") ||
    hasFile(files, /(^|\/)next\.config\.(?:js|cjs|mjs|ts)$/) ||
    hasFile(files, /(^|\/)pages\/_app\.(?:js|jsx|ts|tsx)$/) ||
    hasFile(files, /(^|\/)app\/(?:page|layout)\.(?:js|jsx|ts|tsx)$/)
  );
}

function detectNuxt(files, dependencies) {
  return (
    hasDependency(dependencies, "nuxt") ||
    hasFile(files, /(^|\/)nuxt\.config\.(?:js|mjs|ts)$/)
  );
}

function detectAstro(files, dependencies) {
  return (
    hasDependency(dependencies, "astro") ||
    hasFile(files, /\.astro$/) ||
    hasFile(files, /(^|\/)astro\.config\.(?:js|mjs|ts)$/)
  );
}

function detectPlainWeb(files) {
  const html =
    hasFile(files, /\.html?$/);

  const css =
    hasFile(
      files,
      /\.(?:css|scss|sass)$/
    );

  const javascript =
    hasFile(
      files,
      /\.(?:js|mjs|cjs)$/
    );

  return {
    html,
    css,
    javascript,
  };
}

export function detectProjectFramework(files = []) {
  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {
    return {
      framework: "none",
      label: "No project",
      stackSummary: "No project detected",
      buildTool: "",
      language: "",
      styling: [],
      confidence: "none",
      evidence: [],
    };
  }

  const packageJson =
    readPackageJson(files);

  const dependencies =
    collectDependencies(
      packageJson
    );

  const evidence = [];

  const usesTypeScript =
    getTypeScriptState(
      files,
      dependencies
    );

  const buildTool =
    detectBuildTool(
      files,
      dependencies
    );

  const styling =
    detectStyling(
      files,
      dependencies
    );

  const isNext =
    detectNext(
      files,
      dependencies
    );

  const isNuxt =
    detectNuxt(
      files,
      dependencies
    );

  const isAngular =
    detectAngular(
      files,
      dependencies
    );

  const isSvelte =
    detectSvelte(
      files,
      dependencies
    );

  const isAstro =
    detectAstro(
      files,
      dependencies
    );

  const isVue =
    detectVue(
      files,
      dependencies
    );

  const isReact =
    detectReact(
      files,
      dependencies
    );

  let framework = "vanilla";
  let label = "HTML / CSS / JS";
  let confidence = "medium";

  if (isNext) {
    framework = "next";
    label = "Next.js";
    confidence = "high";
    addEvidence(
      evidence,
      "Next.js project markers detected"
    );
  } else if (isNuxt) {
    framework = "nuxt";
    label = "Nuxt";
    confidence = "high";
    addEvidence(
      evidence,
      "Nuxt project markers detected"
    );
  } else if (isAngular) {
    framework = "angular";
    label = "Angular";
    confidence = "high";
    addEvidence(
      evidence,
      "Angular project markers detected"
    );
  } else if (isSvelte) {
    framework = "svelte";
    label = hasDependencyPrefix(
      dependencies,
      "@sveltejs/kit"
    )
      ? "SvelteKit"
      : "Svelte";
    confidence = "high";
    addEvidence(
      evidence,
      `${label} project markers detected`
    );
  } else if (isAstro) {
    framework = "astro";
    label = "Astro";
    confidence = "high";
    addEvidence(
      evidence,
      "Astro project markers detected"
    );
  } else if (isVue) {
    framework = "vue";
    label = "Vue";
    confidence = "high";
    addEvidence(
      evidence,
      "Vue project markers detected"
    );
  } else if (isReact) {
    framework = "react";
    label = "React";
    confidence =
      hasDependency(
        dependencies,
        "react"
      )
        ? "high"
        : "medium";
    addEvidence(
      evidence,
      "React syntax or dependencies detected"
    );
  } else {
    const plain =
      detectPlainWeb(
        files
      );

    if (
      plain.html ||
      plain.css ||
      plain.javascript
    ) {
      framework = "vanilla";

      const parts = [];

      if (plain.html) {
        parts.push("HTML");
      }

      if (plain.css) {
        parts.push("CSS");
      }

      if (plain.javascript) {
        parts.push("JS");
      }

      label =
        parts.join(" / ") ||
        "Web Project";

      addEvidence(
        evidence,
        "Standard web files detected"
      );
    } else {
      framework = "unknown";
      label = "Custom Project";
      confidence = "low";
      addEvidence(
        evidence,
        "No known framework markers found"
      );
    }
  }

  if (packageJson) {
    addEvidence(
      evidence,
      "package.json detected"
    );
  }

  if (buildTool) {
    addEvidence(
      evidence,
      `${buildTool} detected`
    );
  }

  if (usesTypeScript) {
    addEvidence(
      evidence,
      "TypeScript detected"
    );
  }

  const stack = [
    label,
    usesTypeScript &&
    !label.includes(
      "TypeScript"
    )
      ? "TypeScript"
      : "",
    buildTool,
    ...styling,
  ].filter(Boolean);

  return {
    framework,
    label,
    stackSummary:
      stack.join(" + "),
    buildTool,
    language:
      usesTypeScript
        ? "TypeScript"
        : "JavaScript",
    styling,
    confidence,
    evidence,
  };
}
