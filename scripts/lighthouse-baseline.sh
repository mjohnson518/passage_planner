#!/usr/bin/env bash
#
# lighthouse-baseline.sh — Run Lighthouse audits on key public routes
#
# Usage:
#   cd passage-planner && bash scripts/lighthouse-baseline.sh
#
# Prerequisites:
#   - Dev server running on port 3000 (npm run dev:frontend)
#   - Chrome/Chromium installed
#   - npx available
#
# Output:
#   - JSON + HTML reports in passage-planner/lighthouse-reports/
#

set -euo pipefail

BASE_URL="${LIGHTHOUSE_BASE_URL:-http://localhost:3000}"
REPORT_DIR="$(dirname "$0")/../lighthouse-reports"

# Routes to audit
ROUTES=(
  "/"
  "/login"
  "/pricing"
  "/api-docs"
)

# Create report directory
mkdir -p "$REPORT_DIR"

echo "=== Lighthouse Baseline Capture ==="
echo "Base URL: $BASE_URL"
echo "Reports: $REPORT_DIR"
echo ""

# Check if dev server is running
if ! curl -s --head "$BASE_URL" > /dev/null 2>&1; then
  echo "ERROR: Dev server not reachable at $BASE_URL"
  echo "Start it with: cd passage-planner && npm run dev:frontend"
  exit 1
fi

for route in "${ROUTES[@]}"; do
  # Create safe filename from route
  if [ "$route" = "/" ]; then
    name="landing"
  else
    name="${route:1}"        # Remove leading slash
    name="${name//\//-}"     # Replace slashes with dashes
  fi

  echo "--- Auditing: $route → $name ---"

  npx lighthouse "${BASE_URL}${route}" \
    --output=json,html \
    --output-path="$REPORT_DIR/$name" \
    --chrome-flags="--headless --no-sandbox" \
    --only-categories=performance,accessibility,best-practices,seo \
    --quiet \
    2>&1 || echo "  WARNING: Lighthouse failed for $route"

  echo ""
done

echo "=== Baseline Complete ==="
echo ""
echo "Reports saved to: $REPORT_DIR/"
echo "View HTML reports in your browser, e.g.:"
echo "  open $REPORT_DIR/landing.report.html"
echo ""

# Print summary scores if jq is available
if command -v jq &> /dev/null; then
  echo "=== Score Summary ==="
  printf "%-20s %8s %8s %8s %8s\n" "Route" "Perf" "A11y" "BP" "SEO"
  printf "%-20s %8s %8s %8s %8s\n" "----" "----" "----" "----" "----"

  for route in "${ROUTES[@]}"; do
    if [ "$route" = "/" ]; then
      name="landing"
    else
      name="${route:1}"
      name="${name//\//-}"
    fi

    json_file="$REPORT_DIR/$name.report.json"
    if [ -f "$json_file" ]; then
      perf=$(jq -r '.categories.performance.score * 100 | floor' "$json_file")
      a11y=$(jq -r '.categories.accessibility.score * 100 | floor' "$json_file")
      bp=$(jq -r '.categories["best-practices"].score * 100 | floor' "$json_file")
      seo=$(jq -r '.categories.seo.score * 100 | floor' "$json_file")
      printf "%-20s %7s%% %7s%% %7s%% %7s%%\n" "$route" "$perf" "$a11y" "$bp" "$seo"
    fi
  done
fi
