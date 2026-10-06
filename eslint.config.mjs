import js from "@eslint/js";
import globals from "globals";

const forbidUnsafeHtml = [
  "error",
  {
    selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='innerHTML']",
    message: "Build DOM nodes or use textContent instead of writing innerHTML.",
  },
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.computed=true][left.property.value='innerHTML']",
    message: "Build DOM nodes or use textContent instead of writing innerHTML.",
  },
  {
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.property.name='insertAdjacentHTML']",
    message: "Build DOM nodes or use textContent instead of inserting HTML strings.",
  },
  {
    selector: "CallExpression[callee.object.name='document'][callee.property.name='write']",
    message: "Do not write HTML strings with document.write().",
  },
];

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".generated/**",
      "releases/**",
      "qa/framework-status-*/**/captures/**",
      "qa/framework-status-*/**/screenshots/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-restricted-syntax": forbidUnsafeHtml,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "webpack.config.js",
      "build/**/*.cjs",
      "config/**/*.cjs",
      "scripts/**/*.cjs",
      "qa/**/*.cjs",
    ],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["qa/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["eslint.config.mjs", "stylelint.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["qa/framework-status-2026-10-05/browser/visual-acceptance.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
