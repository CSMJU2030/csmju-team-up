export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: { "^.+\.tsx?$": ["ts-jest", { useESM: true, tsconfig: "./tsconfig.json" }] },
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  moduleNameMapper: { "^(\.{1,2}/.*)\.js$": "$1" },
};
