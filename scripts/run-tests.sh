#!/bin/bash

# ScaleIT Bridge Test Runner Script
# Version: 3.1.0
# Description: Comprehensive test runner for all test suites

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/test-results/test-run-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Create test results directory
setup_test_environment() {
    log "Setting up test environment..."

    mkdir -p "$PROJECT_ROOT/test-results"
    mkdir -p "$PROJECT_ROOT/coverage"
    mkdir -p "$PROJECT_ROOT/playwright-report"

    # Create test config if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/config/test-devices.json" ]]; then
        cp "$PROJECT_ROOT/src-rust/config/devices.json" "$PROJECT_ROOT/config/test-devices.json"
        log "Created test configuration file"
    fi

    success "Test environment setup complete"
}

# Check prerequisites
check_prerequisites() {
    log "Checking test prerequisites..."

    # Check Rust
    if ! command -v cargo &> /dev/null; then
        error "Rust/Cargo not found. Please install Rust."
        return 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js not found. Please install Node.js."
        return 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm not found. Please install npm."
        return 1
    fi

    # Check if dependencies are installed
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        warn "Node.js dependencies not found. Installing..."
        cd "$PROJECT_ROOT"
        npm ci
    fi

    # Check Rust dependencies
    cd "$PROJECT_ROOT/src-rust"
    if [[ ! -d "target" ]]; then
        warn "Rust dependencies not built. Building..."
        cargo build --tests
    fi

    success "Prerequisites check passed"
}

# Run Rust backend unit tests
run_backend_unit_tests() {
    log "Running backend unit tests..."

    cd "$PROJECT_ROOT/src-rust"

    local test_output
    if test_output=$(cargo test --lib --verbose --no-fail-fast 2>&1); then
        success "Backend unit tests passed"
        echo "$test_output" | grep -E "test result:|running" | tee -a "$LOG_FILE"

        # Extract test count
        local passed=$(echo "$test_output" | grep -o "[0-9]* passed" | head -1 | cut -d' ' -f1)
        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | head -1 | cut -d' ' -f1)

        PASSED_TESTS=$((PASSED_TESTS + ${passed:-0}))
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-0}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${passed:-0} + ${failed:-0}))

        return 0
    else
        error "Backend unit tests failed"
        echo "$test_output" | tee -a "$LOG_FILE"

        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | head -1 | cut -d' ' -f1)
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-1}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${failed:-1}))

        return 1
    fi
}

# Run Rust backend integration tests
run_backend_integration_tests() {
    log "Running backend integration tests..."

    cd "$PROJECT_ROOT/src-rust"

    local test_output
    if test_output=$(cargo test --test '*' --verbose --no-fail-fast 2>&1); then
        success "Backend integration tests passed"
        echo "$test_output" | grep -E "test result:|running" | tee -a "$LOG_FILE"

        local passed=$(echo "$test_output" | grep -o "[0-9]* passed" | head -1 | cut -d' ' -f1)
        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | head -1 | cut -d' ' -f1)

        PASSED_TESTS=$((PASSED_TESTS + ${passed:-0}))
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-0}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${passed:-0} + ${failed:-0}))

        return 0
    else
        error "Backend integration tests failed"
        echo "$test_output" | tee -a "$LOG_FILE"

        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | head -1 | cut -d' ' -f1)
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-1}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${failed:-1}))

        return 1
    fi
}

# Run frontend unit tests
run_frontend_unit_tests() {
    log "Running frontend unit tests..."

    cd "$PROJECT_ROOT"

    local test_output
    if test_output=$(npm run test:run 2>&1); then
        success "Frontend unit tests passed"
        echo "$test_output" | tail -20 | tee -a "$LOG_FILE"

        # Extract test count (Vitest format)
        local passed=$(echo "$test_output" | grep -o "[0-9]* passed" | tail -1 | cut -d' ' -f1)
        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | tail -1 | cut -d' ' -f1)

        PASSED_TESTS=$((PASSED_TESTS + ${passed:-0}))
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-0}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${passed:-0} + ${failed:-0}))

        return 0
    else
        error "Frontend unit tests failed"
        echo "$test_output" | tail -20 | tee -a "$LOG_FILE"

        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | tail -1 | cut -d' ' -f1)
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-1}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${failed:-1}))

        return 1
    fi
}

# Run frontend tests with coverage
run_frontend_coverage() {
    log "Running frontend tests with coverage..."

    cd "$PROJECT_ROOT"

    if npm run test:coverage; then
        success "Frontend coverage tests passed"

        # Display coverage summary
        if [[ -f "coverage/coverage-summary.json" ]]; then
            info "Coverage summary:"
            cat coverage/coverage-summary.json | jq -r '.total | "Lines: \(.lines.pct)% | Statements: \(.statements.pct)% | Functions: \(.functions.pct)% | Branches: \(.branches.pct)%"' 2>/dev/null || true
        fi

        return 0
    else
        error "Frontend coverage tests failed"
        return 1
    fi
}

# Start backend for E2E tests
start_test_backend() {
    log "Starting backend for E2E tests..."

    cd "$PROJECT_ROOT/src-rust"

    # Build backend if not exists
    if [[ ! -f "target/release/scaleit-bridge" ]]; then
        log "Building backend for E2E tests..."
        cargo build --release
    fi

    # Start backend in background
    RUST_LOG=info CONFIG_PATH="../config/test-devices.json" \
        cargo run &

    local backend_pid=$!
    echo $backend_pid > "$PROJECT_ROOT/test-results/backend.pid"

    # Wait for backend to be ready
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            success "Backend is ready for E2E tests"
            return 0
        fi

        log "Waiting for backend... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    error "Backend failed to start within expected time"
    stop_test_backend
    return 1
}

# Stop test backend
stop_test_backend() {
    log "Stopping test backend..."

    if [[ -f "$PROJECT_ROOT/test-results/backend.pid" ]]; then
        local backend_pid=$(cat "$PROJECT_ROOT/test-results/backend.pid")
        if kill -0 "$backend_pid" 2>/dev/null; then
            kill "$backend_pid"
            log "Backend stopped (PID: $backend_pid)"
        fi
        rm -f "$PROJECT_ROOT/test-results/backend.pid"
    fi

    # Kill any remaining scaleit-bridge processes
    pkill -f "scaleit-bridge" || true
}

# Run E2E tests
run_e2e_tests() {
    log "Running E2E tests..."

    cd "$PROJECT_ROOT"

    # Build frontend for E2E tests
    if [[ ! -d "dist" ]] || [[ "src" -nt "dist" ]]; then
        log "Building frontend for E2E tests..."
        npm run build
    fi

    # Start backend
    if ! start_test_backend; then
        return 1
    fi

    # Run E2E tests
    local test_output
    local test_result=0

    if test_output=$(npm run test:e2e 2>&1); then
        success "E2E tests passed"

        # Extract test count (Playwright format)
        local passed=$(echo "$test_output" | grep -o "[0-9]* passed" | tail -1 | cut -d' ' -f1)
        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | tail -1 | cut -d' ' -f1)
        local skipped=$(echo "$test_output" | grep -o "[0-9]* skipped" | tail -1 | cut -d' ' -f1)

        PASSED_TESTS=$((PASSED_TESTS + ${passed:-0}))
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-0}))
        SKIPPED_TESTS=$((SKIPPED_TESTS + ${skipped:-0}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${passed:-0} + ${failed:-0} + ${skipped:-0}))

    else
        error "E2E tests failed"
        echo "$test_output" | tail -50 | tee -a "$LOG_FILE"

        local failed=$(echo "$test_output" | grep -o "[0-9]* failed" | tail -1 | cut -d' ' -f1)
        FAILED_TESTS=$((FAILED_TESTS + ${failed:-1}))
        TOTAL_TESTS=$((TOTAL_TESTS + ${failed:-1}))

        test_result=1
    fi

    # Always stop backend
    stop_test_backend

    return $test_result
}

# Run linting and code quality checks
run_linting() {
    log "Running linting and code quality checks..."

    local lint_passed=0

    # Frontend linting
    cd "$PROJECT_ROOT"
    if npm run lint; then
        success "Frontend linting passed"
    else
        error "Frontend linting failed"
        lint_passed=1
    fi

    # Rust formatting check
    cd "$PROJECT_ROOT/src-rust"
    if cargo fmt -- --check; then
        success "Rust formatting check passed"
    else
        error "Rust formatting check failed"
        lint_passed=1
    fi

    # Rust clippy
    if cargo clippy --all-targets --all-features -- -D warnings; then
        success "Rust clippy check passed"
    else
        error "Rust clippy check failed"
        lint_passed=1
    fi

    return $lint_passed
}

# Generate test report
generate_test_report() {
    log "Generating test report..."

    local report_file="$PROJECT_ROOT/test-results/test-report-$(date +%Y%m%d_%H%M%S).txt"

    cat << EOF > "$report_file"
ScaleIT Bridge Test Report
Generated: $(date)
=======================================

Test Summary:
  Total Tests: $TOTAL_TESTS
  Passed:      $PASSED_TESTS
  Failed:      $FAILED_TESTS
  Skipped:     $SKIPPED_TESTS

Pass Rate: $(( TOTAL_TESTS > 0 ? (PASSED_TESTS * 100) / TOTAL_TESTS : 0 ))%

Test Suites Run:
- Backend Unit Tests
- Backend Integration Tests
- Frontend Unit Tests
- Frontend Coverage Tests
- E2E Tests
- Linting & Code Quality

Detailed Logs: $LOG_FILE
Coverage Reports: $PROJECT_ROOT/coverage/
Playwright Report: $PROJECT_ROOT/playwright-report/

EOF

    success "Test report generated: $report_file"
    cat "$report_file"
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."

    # Stop any running backend
    stop_test_backend

    # Clean up temporary files
    rm -f "$PROJECT_ROOT/test-results/backend.pid"

    success "Cleanup completed"
}

# Signal handlers for cleanup
trap cleanup EXIT INT TERM

# Main test runner function
run_all_tests() {
    log "Starting comprehensive test suite..."

    setup_test_environment
    check_prerequisites

    local overall_result=0

    # Run linting first (fast feedback)
    if ! run_linting; then
        warn "Linting failed, but continuing with tests..."
    fi

    # Backend tests
    if ! run_backend_unit_tests; then
        overall_result=1
    fi

    if ! run_backend_integration_tests; then
        overall_result=1
    fi

    # Frontend tests
    if ! run_frontend_unit_tests; then
        overall_result=1
    fi

    if ! run_frontend_coverage; then
        overall_result=1
    fi

    # E2E tests (most expensive, run last)
    if ! run_e2e_tests; then
        overall_result=1
    fi

    generate_test_report

    if [[ $overall_result -eq 0 ]]; then
        success "🎉 All tests passed!"
    else
        error "❌ Some tests failed. Check the report for details."
    fi

    return $overall_result
}

# Run specific test suite
run_specific_test() {
    local test_type="$1"

    setup_test_environment
    check_prerequisites

    case "$test_type" in
        "backend-unit")
            run_backend_unit_tests
            ;;
        "backend-integration")
            run_backend_integration_tests
            ;;
        "backend")
            run_backend_unit_tests && run_backend_integration_tests
            ;;
        "frontend-unit")
            run_frontend_unit_tests
            ;;
        "frontend-coverage")
            run_frontend_coverage
            ;;
        "frontend")
            run_frontend_unit_tests && run_frontend_coverage
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "lint")
            run_linting
            ;;
        *)
            error "Unknown test type: $test_type"
            return 1
            ;;
    esac
}

# Show usage
usage() {
    echo "Usage: $0 [TEST_TYPE]"
    echo
    echo "Test Types:"
    echo "  all                 Run all tests (default)"
    echo "  backend            Run all backend tests"
    echo "  backend-unit       Run backend unit tests only"
    echo "  backend-integration Run backend integration tests only"
    echo "  frontend           Run all frontend tests"
    echo "  frontend-unit      Run frontend unit tests only"
    echo "  frontend-coverage  Run frontend tests with coverage"
    echo "  e2e                Run E2E tests only"
    echo "  lint               Run linting and code quality checks"
    echo
    echo "Options:"
    echo "  -h, --help         Show this help message"
    echo "  -v, --verbose      Enable verbose output"
    echo "  --no-cleanup       Skip cleanup on exit"
    echo
    echo "Examples:"
    echo "  $0                 # Run all tests"
    echo "  $0 backend         # Run only backend tests"
    echo "  $0 e2e            # Run only E2E tests"
    echo "  $0 lint           # Run only linting"
    echo
    echo "Environment Variables:"
    echo "  SKIP_E2E=1         Skip E2E tests"
    echo "  VERBOSE=1          Enable verbose output"
    echo "  NO_COVERAGE=1      Skip coverage tests"
}

# Parse command line arguments
VERBOSE=false
NO_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            shift
            ;;
        *)
            TEST_TYPE="$1"
            shift
            ;;
    esac
done

# Enable verbose output if requested
if [[ "$VERBOSE" == "true" ]] || [[ "${VERBOSE:-}" == "1" ]]; then
    set -x
fi

# Disable cleanup if requested
if [[ "$NO_CLEANUP" == "true" ]]; then
    trap - EXIT
fi

# Run tests
if [[ "${TEST_TYPE:-all}" == "all" ]]; then
    run_all_tests
else
    run_specific_test "${TEST_TYPE:-all}"
fi
