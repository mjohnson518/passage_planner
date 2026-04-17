module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
        useESM: false,
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(@modelcontextprotocol|uuid)/)"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  coveragePathIgnorePatterns: ["if \\(require\\.main === module\\)"],
  coverageDirectory: "coverage",
  // Regression-prevention floors set at current measured coverage.
  // These lock in today's baseline; ratchet up as new tests land.
  // Adaptive emergency-guidance and extended audit-log paths added since
  // the 92% peak brought statements and branches down.
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 78,
      lines: 79,
      statements: 78,
    },
  },
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
