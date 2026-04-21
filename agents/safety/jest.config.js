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
  // Phase 4.4 + 4.5 supplemental coverage (audit-logger-extra.test.ts,
  // safety-index-extra.test.ts, weather-pattern-analyzer-extra.test.ts)
  // raised global safety coverage from 89/82/93/90 → 96/91/99/96 — all
  // four dimensions now clear the CLAUDE.md 90% safety-critical target.
  coverageThreshold: {
    global: {
      branches: 91,
      functions: 99,
      lines: 96,
      statements: 96,
    },
  },
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
