module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  // Regression-prevention floors set at current measured coverage.
  // These lock in today's baseline; ratchet up as new tests land.
  coverageThreshold: {
    global: {
      branches: 27,
      functions: 58,
      lines: 45,
      statements: 46,
    },
  },
};
