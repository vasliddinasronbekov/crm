#!/bin/bash
# Automated Testing Script
# Runs all tests with coverage and generates reports

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR=$(dirname $(dirname $(realpath $0)))
BACKEND_DIR="$PROJECT_DIR/backend"

echo -e "${GREEN}=== Running Automated Tests ===${NC}"

# Setup environment
export DJANGO_SETTINGS_MODULE=edu_project.settings
export DATABASE_URL=sqlite:///test_db.sqlite3
export REDIS_URL=redis://localhost:6379/15
export SECRET_KEY=test-secret-key
export DEBUG=True

cd "$BACKEND_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run Django system checks
echo -e "\n${YELLOW}[1/5] Running Django system checks...${NC}"
python manage.py check --deploy

# Run migrations on test database
echo -e "\n${YELLOW}[2/5] Running test database migrations...${NC}"
python manage.py migrate --run-syncdb

# Run unit tests with coverage
echo -e "\n${YELLOW}[3/5] Running unit tests...${NC}"
pytest \
    --cov=. \
    --cov-report=html \
    --cov-report=term-missing \
    --cov-report=xml \
    --cov-config=.coveragerc \
    --junit-xml=test-results.xml \
    -v

# Run security checks
echo -e "\n${YELLOW}[4/5] Running security checks...${NC}"
if command -v bandit >/dev/null 2>&1; then
    bandit -r . -f json -o bandit-report.json || echo "Security issues found (non-blocking)"
else
    echo "Bandit not installed, skipping security scan"
fi

# Check code quality
echo -e "\n${YELLOW}[5/5] Checking code quality...${NC}"
if command -v flake8 >/dev/null 2>&1; then
    flake8 --max-line-length=120 --exclude=venv,migrations,static,media || echo "Code quality issues found (non-blocking)"
else
    echo "Flake8 not installed, skipping code quality check"
fi

# Generate coverage report summary
echo -e "\n${GREEN}=== Test Coverage Summary ===${NC}"
coverage report --skip-empty

# Check coverage threshold
COVERAGE_THRESHOLD=70
COVERAGE_PERCENT=$(coverage report --skip-empty | grep TOTAL | awk '{print $4}' | sed 's/%//')

if [ -n "$COVERAGE_PERCENT" ]; then
    if (( $(echo "$COVERAGE_PERCENT < $COVERAGE_THRESHOLD" | bc -l) )); then
        echo -e "${RED}Warning: Coverage ($COVERAGE_PERCENT%) is below threshold ($COVERAGE_THRESHOLD%)${NC}"
    else
        echo -e "${GREEN}✓ Coverage ($COVERAGE_PERCENT%) meets threshold ($COVERAGE_THRESHOLD%)${NC}"
    fi
fi

# Display results location
echo -e "\n${GREEN}=== Test Results ===${NC}"
echo "HTML Coverage Report: file://$BACKEND_DIR/htmlcov/index.html"
echo "XML Coverage Report: $BACKEND_DIR/coverage.xml"
echo "Test Results (JUnit): $BACKEND_DIR/test-results.xml"

echo -e "\n${GREEN}✓ All tests completed!${NC}"

exit 0
