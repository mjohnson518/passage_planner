module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts', // Exclude barrel exports
    '!src/testing/**', // Exclude test utilities
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85
    },
    // Stricter thresholds for critical services
    './src/services/NOAAWeatherService.ts': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    },
    './src/services/NOAATidalService.ts': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    },
    './src/services/noaa-api-client.ts': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    }
  },
  moduleNameMapper: {
    '^@passage-planner/shared$': '<rootDir>/src/index.ts',
    '^@passage-planner/shared/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/testing/jest.setup.ts'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  }
};

