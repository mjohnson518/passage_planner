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
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(@modelcontextprotocol)/)"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "coverage",
  // Regression-prevention floors set at current measured coverage.
  // These lock in today's baseline; ratchet up as new tests land.
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 82,
      lines: 80,
      statements: 76,
    },
  },
  testTimeout: 10000,
};
