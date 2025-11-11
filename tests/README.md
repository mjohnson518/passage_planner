# Helmwise Test Suite

This directory contains all testing infrastructure and test files for the Helmwise passage planning system.

## Directory Structure

```
tests/
├── integration/          # Integration test files and docker-compose configs
│   ├── docker-compose.yml            # Development docker-compose configuration
│   ├── docker-compose.prod.yml       # Production docker-compose configuration
│   ├── agent-communication.test.ts   # Agent communication integration tests
│   ├── passage-planning-e2e.test.ts  # End-to-end passage planning tests
│   └── production-resilience.test.ts # Production resilience tests
├── scripts/             # Test scripts and utilities
│   ├── test-api.js                   # API endpoint testing script
│   ├── test-direct-integration.js    # Direct integration testing script
│   ├── test-full-integration.js      # Full system integration testing
│   ├── test-parallel-no-redis.js     # Parallel execution tests without Redis
│   ├── test-real-tides.js            # Real tidal data integration tests
│   ├── test-real-weather.js          # Real weather data integration tests
│   ├── test-resilience-simple.js     # Simple resilience testing
│   ├── test-route-calculation.js     # Route calculation accuracy tests
│   ├── test-server.js                # Server functionality tests
│   ├── test-tides-simple.js          # Simple tidal calculation tests
│   └── test-output.log               # Test execution logs
├── config/              # Test configuration files
│   ├── package-lock 2.json           # Legacy package-lock files
│   ├── package-lock 3.json
│   └── package-lock 4.json
├── e2e/                 # End-to-end tests
│   ├── auth.spec.ts                  # Authentication flow tests
│   └── passage-planning.spec.ts      # Full passage planning workflow tests
├── load/                # Load testing scripts
│   └── artillery-config.js           # Artillery load testing configuration
└── agents/              # Agent-specific tests
    └── weather-agent.test.ts         # Weather agent unit tests
```

## Running Tests

### All Tests

```bash
npm test
```

### Frontend Tests

```bash
npm run test:frontend
```

### Backend Tests

```bash
npm run test:backend
```

### Integration Tests

```bash
npm run test:integration
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Load Tests

```bash
npm run test:load
```

## Test Scripts

The `scripts/` directory contains standalone test scripts that can be run individually for debugging or specific testing scenarios:

```bash
# Test API endpoints
node tests/scripts/test-api.js

# Test route calculations
node tests/scripts/test-route-calculation.js

# Test weather integration
node tests/scripts/test-real-weather.js

# Test tidal predictions
node tests/scripts/test-real-tides.js
```

## Docker Compose Configurations

The `integration/` directory contains docker-compose files for running the full stack:

```bash
# Start development environment
npm run docker:up
# or
docker-compose -f tests/integration/docker-compose.yml up -d

# Start production environment
docker-compose -f tests/integration/docker-compose.prod.yml up -d

# Stop environment
npm run docker:down
# or
docker-compose -f tests/integration/docker-compose.yml down
```

## Test Coverage Requirements

- **Overall codebase**: ≥85% coverage
- **Safety-critical code**: ≥90% coverage (agents/safety, route calculations, weather interpretation)
- **Business logic**: ≥85% coverage
- **API endpoints**: ≥80% coverage

## Writing Tests

### Unit Tests

Place unit tests alongside the code they test with a `.test.ts` or `.spec.ts` extension.

### Integration Tests

Place integration tests in `tests/integration/` for cross-component or cross-service tests.

### E2E Tests

Place end-to-end tests in `tests/e2e/` using Playwright for browser-based testing.

### Load Tests

Place load testing configurations in `tests/load/` using Artillery or similar tools.

## Safety-Critical Testing

For maritime safety, extra scrutiny is required for:
- `agents/safety/src/` - Safety decision logic
- `agents/weather/src/` - Weather interpretation
- `agents/route/src/` - Route calculations
- `agents/tidal/src/` - Tidal predictions

These areas require:
- ≥90% test coverage
- Edge case testing
- Real-world data validation
- Conservative safety margins
- Fail-safe error handling

## Continuous Integration

All tests run automatically on:
- Pull requests
- Commits to main branch
- Nightly builds

CI pipeline includes:
- Linting and type checking
- Unit and integration tests
- E2E tests
- Load testing (on schedule)
- Coverage reporting
- Performance benchmarking

