# ScaleIT Bridge - Testing and Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Testing Strategy](#testing-strategy)
3. [Running Tests](#running-tests)
4. [Test Coverage](#test-coverage)
5. [Deployment Options](#deployment-options)
6. [Production Deployment](#production-deployment)
7. [Docker Deployment](#docker-deployment)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide covers the comprehensive testing strategy and deployment procedures for ScaleIT Bridge v3.1.0. The project includes both Rust backend and React frontend components with full test coverage and automated deployment capabilities.

## Testing Strategy

### Test Pyramid

```
    ┌─────────────────┐
    │   E2E Tests     │  ← Full application flow
    │    (Playwright) │
    ├─────────────────┤
    │ Integration     │  ← API endpoints, component interaction
    │ Tests           │
    ├─────────────────┤
    │   Unit Tests    │  ← Individual functions, components
    │  (Rust + Jest)  │
    └─────────────────┘
```

### Test Types

1. **Backend Tests (Rust)**
   - Unit tests for business logic
   - Integration tests for API endpoints
   - Device adapter tests
   - Error handling tests
   - Configuration tests

2. **Frontend Tests (React/TypeScript)**
   - Component unit tests
   - API service tests
   - User interaction tests
   - State management tests

3. **End-to-End Tests (Playwright)**
   - Full application workflows
   - Cross-browser testing
   - Performance testing
   - Accessibility testing

4. **Code Quality**
   - Linting (ESLint, Clippy)
   - Formatting (Prettier, rustfmt)
   - Security scanning
   - Dependency auditing

## Running Tests

### Prerequisites

```bash
# System requirements
- Node.js 18+
- Rust 1.75+
- Docker & Docker Compose
- Git

# Install dependencies
npm ci
cd src-rust && cargo build --tests
```

### Quick Test Commands

```bash
# Run all tests
./scripts/run-tests.sh

# Run specific test suites
./scripts/run-tests.sh backend          # Backend tests only
./scripts/run-tests.sh frontend         # Frontend tests only
./scripts/run-tests.sh e2e              # E2E tests only
./scripts/run-tests.sh lint             # Linting only

# Individual commands
npm run test                            # Frontend unit tests
npm run test:coverage                   # Frontend with coverage
npm run test:e2e                        # E2E tests
cd src-rust && cargo test              # Backend tests
```

### Backend Testing

#### Unit Tests
```bash
cd src-rust
cargo test --lib                       # Library tests
cargo test --test device_test          # Device manager tests
cargo test --test api_test             # API tests
cargo test --test integration_test     # Integration tests
```

#### With Coverage
```bash
cargo install cargo-tarpaulin
cargo tarpaulin --out html --output-dir ../coverage
```

### Frontend Testing

#### Unit Tests
```bash
npm run test                           # Interactive mode
npm run test:run                       # Single run
npm run test:ui                        # Test UI
```

#### Component Tests
```bash
# Test specific components
npm test -- DeviceList
npm test -- ScaleOperationsPanel
npm test -- BridgeStatusCard
```

#### API Tests
```bash
npm test -- api.test.ts
```

### End-to-End Testing

#### Basic E2E Tests
```bash
npm run test:e2e                       # All browsers
npx playwright test --project=chromium # Chromium only
npx playwright test --ui                # Interactive mode
```

#### Advanced E2E Options
```bash
# Test specific features
npx playwright test --grep "scale operations"
npx playwright test --grep "device management"

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

## Test Coverage

### Coverage Targets

- **Backend**: > 85% line coverage
- **Frontend**: > 80% line coverage
- **E2E**: > 90% critical user journeys

### Coverage Reports

```bash
# Generate all coverage reports
./scripts/run-tests.sh frontend-coverage

# View coverage reports
open coverage/index.html               # Frontend
open coverage/tarpaulin-report.html    # Backend
```

### Coverage Analysis

```bash
# Frontend coverage breakdown
npm run test:coverage -- --reporter=text-summary

# Backend coverage with details
cd src-rust
cargo tarpaulin --out text --verbose
```

## Deployment Options

### 1. Docker Deployment (Recommended)
- Containerized application
- Easy scaling and management
- Consistent environment

### 2. Native Binary Deployment
- Direct installation on host
- Better performance
- Traditional systemd service

### 3. Cloud Deployment
- Kubernetes clusters
- Docker Swarm
- Cloud platforms (AWS, GCP, Azure)

## Production Deployment

### Automated Deployment

```bash
# Full production deployment
sudo ./scripts/deploy.sh

# Deployment options
./scripts/deploy.sh deploy             # Full deployment
./scripts/deploy.sh start              # Start services
./scripts/deploy.sh stop               # Stop services
./scripts/deploy.sh status             # Check status
./scripts/deploy.sh health             # Health check
```

### Manual Deployment Steps

#### 1. Prepare Environment
```bash
# Create user and directories
sudo useradd -r -s /bin/false scaleit
sudo mkdir -p /opt/scaleit-bridge/{config,logs,data}
sudo chown scaleit:scaleit /opt/scaleit-bridge
```

#### 2. Build Application
```bash
# Build backend
cd src-rust
cargo build --release

# Build frontend
cd ..
npm run build
```

#### 3. Deploy Files
```bash
# Copy application files
sudo cp -r dist /opt/scaleit-bridge/web
sudo cp src-rust/target/release/scaleit-bridge /opt/scaleit-bridge/bin/
sudo cp -r config /opt/scaleit-bridge/
```

#### 4. Setup Service
```bash
# Create systemd service
sudo cp scripts/scaleit-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scaleit-bridge
sudo systemctl start scaleit-bridge
```

### Configuration

#### Production Config (`/opt/scaleit-bridge/config/devices.json`)
```json
{
  "devices": {
    "C320_PROD": {
      "name": "Production C320 Scale",
      "manufacturer": "Rinstrum",
      "model": "C320",
      "protocol": "RINCMD",
      "connection": {
        "connection_type": "Tcp",
        "host": "192.168.1.254",
        "port": 4001,
        "timeout_ms": 3000
      },
      "commands": {
        "readGross": "20050026",
        "readNet": "20050025",
        "tare": "21120008:0C",
        "zero": "21120008:0B"
      },
      "enabled": true
    }
  }
}
```

## Docker Deployment

### Development Environment

```bash
# Start development stack
docker-compose --profile dev up -d

# Services included:
# - scaleit-bridge: Main application
# - frontend-dev: Vite dev server (hot reload)
# - backend-dev: Cargo watch (hot reload)
```

### Production Environment

```bash
# Start production stack
docker-compose --profile production up -d

# Services included:
# - scaleit-bridge: Main application
# - nginx: Reverse proxy
# - redis: Caching and sessions
# - postgres: Database and logging
```

### Docker Commands

```bash
# Build images
docker-compose build

# View logs
docker-compose logs -f scaleit-bridge

# Scale services
docker-compose up -d --scale scaleit-bridge=3

# Update service
docker-compose pull scaleit-bridge
docker-compose up -d scaleit-bridge

# Backup data
docker run --rm -v scaleit_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz -C /data .
```

### Docker Health Checks

```bash
# Check container health
docker ps --filter "name=scaleit-bridge"
docker inspect scaleit-bridge | jq '.[0].State.Health'

# Manual health check
curl -f http://localhost:8080/health
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically:

1. **Code Quality**: Linting, formatting, security scans
2. **Testing**: Unit, integration, and E2E tests
3. **Building**: Multi-platform binaries and Docker images
4. **Deployment**: Automatic deployment to staging/production
5. **Monitoring**: Performance testing and reporting

### Workflow Triggers

- **Push to main**: Full pipeline with production deployment
- **Push to develop**: Full pipeline with staging deployment
- **Pull requests**: Testing and code quality checks
- **Tags**: Release creation and distribution
- **Schedule**: Daily security and dependency scans

### Pipeline Status

```bash
# Check pipeline status
gh workflow list
gh run list --workflow=ci-cd.yml

# Download artifacts
gh run download <run-id>
```

## Monitoring and Logging

### Application Monitoring

#### Health Endpoints
```bash
curl http://localhost:8080/health        # Service health
curl http://localhost:8080/devices       # Device status
```

#### Metrics Collection
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards
- **Loki**: Log aggregation and analysis

#### Key Metrics
- Request latency and throughput
- Device connection status
- Error rates and types
- Memory and CPU usage

### Log Management

#### Log Locations
```bash
# Application logs
/opt/scaleit-bridge/logs/scaleit-bridge.log

# System logs
journalctl -u scaleit-bridge -f

# Docker logs
docker logs -f scaleit-bridge
```

#### Log Levels
- **ERROR**: Critical errors requiring attention
- **WARN**: Warning conditions
- **INFO**: General information
- **DEBUG**: Detailed debugging information

#### Log Rotation
```bash
# Configured in /etc/logrotate.d/scaleit-bridge
# Daily rotation with 30 days retention
# Compressed archives
```

## Troubleshooting

### Common Issues

#### Test Failures

```bash
# Backend test failures
cd src-rust && cargo test -- --nocapture  # Verbose output
cargo test --test integration_test       # Specific test file

# Frontend test failures
npm test -- --reporter=verbose           # Detailed output
npm test -- --run --reporter=verbose     # Single run with details

# E2E test failures
npx playwright test --debug              # Debug mode
npx playwright test --trace=on           # With traces
```

#### Deployment Issues

```bash
# Check service status
sudo systemctl status scaleit-bridge
journalctl -u scaleit-bridge --since="1 hour ago"

# Check Docker containers
docker ps -a
docker logs scaleit-bridge
docker exec -it scaleit-bridge /bin/sh

# Check ports and connections
netstat -tlnp | grep :8080
curl -v http://localhost:8080/health
```

#### Performance Issues

```bash
# Check resource usage
docker stats scaleit-bridge
top -p $(pgrep scaleit-bridge)

# Profile application
cd src-rust && cargo build --release
perf record -g ./target/release/scaleit-bridge
perf report

# Monitor network connections
ss -tuln | grep :8080
tcpdump -i any port 8080
```

### Debug Information

#### Collect Debug Info
```bash
# System information
uname -a
docker version
docker-compose version

# Application information
curl http://localhost:8080/health
docker inspect scaleit-bridge

# Log collection
journalctl -u scaleit-bridge --since="24 hours ago" > debug_logs.txt
docker logs scaleit-bridge > docker_logs.txt
```

#### Common Solutions

1. **Port conflicts**: Check and change ports in configuration
2. **Permission issues**: Ensure correct user/group ownership
3. **Memory issues**: Increase Docker memory limits
4. **Network issues**: Check firewall and routing rules
5. **Configuration errors**: Validate JSON configuration files

### Support Resources

- **Documentation**: `/opt/scaleit-bridge/docs/`
- **Configuration**: `/opt/scaleit-bridge/config/`
- **Logs**: `/opt/scaleit-bridge/logs/`
- **GitHub Issues**: https://github.com/scaleit/bridge-rust/issues
- **Community**: https://github.com/scaleit/bridge-rust/discussions

---

## Quick Reference

### Essential Commands

```bash
# Testing
./scripts/run-tests.sh                  # Run all tests
npm test                                # Frontend tests
cd src-rust && cargo test              # Backend tests

# Deployment
./scripts/deploy.sh                     # Deploy to production
docker-compose up -d                    # Start with Docker

# Monitoring
curl http://localhost:8080/health       # Health check
sudo systemctl status scaleit-bridge   # Service status
docker logs -f scaleit-bridge          # Container logs

# Maintenance
sudo systemctl restart scaleit-bridge  # Restart service
docker-compose restart                  # Restart containers
./scripts/deploy.sh backup             # Create backup
```

### Configuration Files

- `config/devices.json` - Device configurations
- `docker-compose.yml` - Container orchestration
- `.github/workflows/ci-cd.yml` - CI/CD pipeline
- `scripts/deploy.sh` - Deployment automation
- `scripts/run-tests.sh` - Test automation

---

**Last Updated**: November 30, 2025  
**Version**: 3.1.0  
**Maintained by**: ScaleIT Team