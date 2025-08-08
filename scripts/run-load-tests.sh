#!/bin/bash

# Load testing script for Passage Planner API
# Requires k6 to be installed: https://k6.io/docs/getting-started/installation/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-https://api.helmwise.co}"
API_KEY="${API_KEY:-}"
OUTPUT_DIR="load-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}Starting Passage Planner Load Tests${NC}"
echo "Base URL: $BASE_URL"
echo "Timestamp: $TIMESTAMP"
echo ""

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local scenario=$3
    
    echo -e "${YELLOW}Running $test_name...${NC}"
    
    if [ -z "$scenario" ]; then
        k6 run \
            -e BASE_URL="$BASE_URL" \
            -e API_KEY="$API_KEY" \
            --out json="$OUTPUT_DIR/${test_name}_${TIMESTAMP}.json" \
            --summary-export="$OUTPUT_DIR/${test_name}_${TIMESTAMP}_summary.json" \
            "$test_file"
    else
        k6 run \
            -e BASE_URL="$BASE_URL" \
            -e API_KEY="$API_KEY" \
            --out json="$OUTPUT_DIR/${test_name}_${TIMESTAMP}.json" \
            --summary-export="$OUTPUT_DIR/${test_name}_${TIMESTAMP}_summary.json" \
            --scenario-executor="$scenario" \
            "$test_file"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name completed successfully${NC}"
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        exit 1
    fi
    
    echo ""
}

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API_KEY environment variable is required${NC}"
    echo "Usage: API_KEY=your_api_key ./scripts/run-load-tests.sh"
    exit 1
fi

# Run different test scenarios
echo -e "${GREEN}1. Standard Load Test${NC}"
echo "This test simulates normal user behavior with gradual ramp-up"
run_test "standard_load" "tests/load/passage-planning-load.js"

echo -e "${GREEN}2. Spike Test${NC}"
echo "This test simulates sudden spike in traffic"
k6 run \
    -e BASE_URL="$BASE_URL" \
    -e API_KEY="$API_KEY" \
    --out json="$OUTPUT_DIR/spike_test_${TIMESTAMP}.json" \
    --summary-export="$OUTPUT_DIR/spike_test_${TIMESTAMP}_summary.json" \
    -u 500 -d 2m \
    tests/load/passage-planning-load.js \
    --scenario spikeTest

echo -e "${GREEN}3. Stress Test${NC}"
echo "This test pushes the system to its limits"
k6 run \
    -e BASE_URL="$BASE_URL" \
    -e API_KEY="$API_KEY" \
    --out json="$OUTPUT_DIR/stress_test_${TIMESTAMP}.json" \
    --summary-export="$OUTPUT_DIR/stress_test_${TIMESTAMP}_summary.json" \
    -u 50 -d 5m \
    tests/load/passage-planning-load.js \
    --scenario stressTest

echo -e "${GREEN}4. Soak Test${NC}"
echo "This test runs for extended period to detect memory leaks"
k6 run \
    -e BASE_URL="$BASE_URL" \
    -e API_KEY="$API_KEY" \
    --out json="$OUTPUT_DIR/soak_test_${TIMESTAMP}.json" \
    --summary-export="$OUTPUT_DIR/soak_test_${TIMESTAMP}_summary.json" \
    -u 100 -d 30m \
    tests/load/passage-planning-load.js

# Generate HTML report
echo -e "${YELLOW}Generating HTML report...${NC}"
if command -v k6-reporter &> /dev/null; then
    k6-reporter "$OUTPUT_DIR/standard_load_${TIMESTAMP}.json" \
        --output "$OUTPUT_DIR/load_test_report_${TIMESTAMP}.html"
    echo -e "${GREEN}✓ HTML report generated: $OUTPUT_DIR/load_test_report_${TIMESTAMP}.html${NC}"
else
    echo -e "${YELLOW}k6-reporter not found. Install it to generate HTML reports.${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}Load Testing Complete!${NC}"
echo "Results saved in: $OUTPUT_DIR"
echo ""
echo "Key files:"
echo "  - Standard load test: $OUTPUT_DIR/standard_load_${TIMESTAMP}_summary.json"
echo "  - Spike test: $OUTPUT_DIR/spike_test_${TIMESTAMP}_summary.json"
echo "  - Stress test: $OUTPUT_DIR/stress_test_${TIMESTAMP}_summary.json"
echo "  - Soak test: $OUTPUT_DIR/soak_test_${TIMESTAMP}_summary.json"

# Check if any tests failed
if ls "$OUTPUT_DIR"/*_${TIMESTAMP}_summary.json 1> /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}Checking test thresholds...${NC}"
    
    failed=0
    for summary in "$OUTPUT_DIR"/*_${TIMESTAMP}_summary.json; do
        if grep -q '"passes":false' "$summary"; then
            echo -e "${RED}✗ $(basename $summary) has failing thresholds${NC}"
            failed=1
        fi
    done
    
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed their thresholds${NC}"
    else
        echo -e "${RED}Some tests failed their thresholds. Review the results for details.${NC}"
        exit 1
    fi
fi 