/** @type {import("eslint").Linter.Config} */
export default {
  root: false,
  ignorePatterns: ["dist", "node_modules", ".next", ".expo"],
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
  },
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    eqeqeq: ["error", "always"],
  },
};
