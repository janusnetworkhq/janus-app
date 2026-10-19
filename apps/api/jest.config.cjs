/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }] },
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  testEnvironment: "node",
};
