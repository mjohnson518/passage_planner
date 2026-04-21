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
  // Phase 4.4 supplemental coverage (audit-logger-extra.test.ts +
  // safety-index-extra.test.ts) raised global safety coverage from
  // 89/82/93/90 → 95/89/99/95.
  coverageThreshold: {
    global: {
      branches: 89,
      functions: 99,
      lines: 95,
      statements: 95,
    },
  },
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
