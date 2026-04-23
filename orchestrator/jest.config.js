module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@modelcontextprotocol|@turf|concaveman|rbush|uuid|geolib)/)",
  ],
  moduleNameMapper: {
    "^uuid$": require.resolve("uuid"),
    // Mock agent modules to avoid ESM transformation issues (from Orchestrator.ts)
    "^../../agents/weather/src/WeatherAgent$":
      "<rootDir>/src/__mocks__/WeatherAgent.ts",
    "^../../agents/tidal/src/TidalAgent$":
      "<rootDir>/src/__mocks__/TidalAgent.ts",
    "^../../agents/route/src/RouteAgent$":
      "<rootDir>/src/__mocks__/RouteAgent.ts",
    // Mock agent modules from test files
    "^../../../agents/weather/src/WeatherAgent$":
      "<rootDir>/src/__mocks__/WeatherAgent.ts",
    "^../../../agents/tidal/src/TidalAgent$":
      "<rootDir>/src/__mocks__/TidalAgent.ts",
    "^../../../agents/route/src/RouteAgent$":
      "<rootDir>/src/__mocks__/RouteAgent.ts",
    // Mock BaseAgent
    "^../../agents/base/BaseAgent$": "<rootDir>/src/__mocks__/BaseAgent.ts",
  },
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "coverage",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  testTimeout: 10000,
  // Conservative regression-prevention floor. The orchestrator is the
  // integration layer wiring all agents together — GDPR endpoints, passage
  // persistence, webhook idempotency, and agent dispatch all live here. Set
  // the floor low enough not to block the first post-ratchet CI run; raise
  // once a measured baseline is captured.
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 60,
      statements: 60,
    },
  },
};
