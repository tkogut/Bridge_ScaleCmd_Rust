#!/bin/bash

# ScaleIT Bridge Production Deployment Script
# Version: 3.1.0
# Description: Automated deployment script for ScaleIT Bridge application

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/scaleit-bridge-deploy.log"
BACKUP_DIR="/opt/scaleit-bridge/backups"
SERVICE_NAME="scaleit-bridge"
USER="scaleit"
GROUP="scaleit"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as the scaleit user."
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."

    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi

    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker service."
    fi

    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi

    # Check available disk space (minimum 2GB)
    available_space=$(df /opt | awk 'NR==2{print $4}')
    if [[ $available_space -lt 2097152 ]]; then # 2GB in KB
        warn "Less than 2GB disk space available. Deployment may fail."
    fi

    # Check if ports are available
    if netstat -tuln | grep -q ":8080 "; then
        warn "Port 8080 is already in use. This may cause conflicts."
    fi

    success "System requirements check completed."
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."

    local dirs=(
        "/opt/scaleit-bridge"
        "/opt/scaleit-bridge/config"
        "/opt/scaleit-bridge/logs"
        "/opt/scaleit-bridge/data"
        "$BACKUP_DIR"
        "/etc/scaleit-bridge"
    )

    for dir in "${dirs[@]}"; do
        sudo mkdir -p "$dir"
        sudo chown "$USER:$GROUP" "$dir"
        sudo chmod 755 "$dir"
    done

    success "Directories created successfully."
}

# Backup existing installation
backup_existing() {
    log "Creating backup of existing installation..."

    if [[ -d "/opt/scaleit-bridge" ]]; then
        local backup_name="scaleit-bridge-backup-$(date +%Y%m%d_%H%M%S)"
        local backup_path="$BACKUP_DIR/$backup_name"

        sudo mkdir -p "$backup_path"
        sudo cp -r /opt/scaleit-bridge/* "$backup_path/" 2>/dev/null || true
        sudo tar -czf "$backup_path.tar.gz" -C "$BACKUP_DIR" "$backup_name"
        sudo rm -rf "$backup_path"

        # Keep only last 5 backups
        sudo find "$BACKUP_DIR" -name "scaleit-bridge-backup-*.tar.gz" -type f | \
            sort -r | tail -n +6 | sudo xargs rm -f

        success "Backup created: $backup_path.tar.gz"
    else
        log "No existing installation found. Skipping backup."
    fi
}

# Stop existing services
stop_services() {
    log "Stopping existing services..."

    # Stop Docker Compose services
    if [[ -f "/opt/scaleit-bridge/docker-compose.yml" ]]; then
        cd /opt/scaleit-bridge
        docker-compose down --timeout 30 || warn "Failed to stop some Docker services"
    fi

    # Stop systemd service if exists
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        sudo systemctl stop "$SERVICE_NAME"
        log "Stopped systemd service: $SERVICE_NAME"
    fi

    # Kill any remaining processes
    sudo pkill -f "scaleit-bridge" || true

    success "Services stopped successfully."
}

# Deploy application files
deploy_files() {
    log "Deploying application files..."

    # Copy application files
    sudo cp -r "$PROJECT_ROOT"/* "/opt/scaleit-bridge/"

    # Set proper ownership and permissions
    sudo chown -R "$USER:$GROUP" "/opt/scaleit-bridge"
    sudo chmod +x "/opt/scaleit-bridge/scripts/"*.sh
    sudo chmod +x "/opt/scaleit-bridge/src-rust/target/release/scaleit-bridge" 2>/dev/null || true

    # Copy configuration files
    if [[ -f "/opt/scaleit-bridge/config/devices.json" ]]; then
        log "Using existing configuration file."
    else
        sudo cp "/opt/scaleit-bridge/src-rust/config/devices.json" "/opt/scaleit-bridge/config/"
        warn "Using default configuration. Please update /opt/scaleit-bridge/config/devices.json"
    fi

    success "Application files deployed successfully."
}

# Build Docker images
build_images() {
    log "Building Docker images..."

    cd "/opt/scaleit-bridge"

    # Build production images
    docker-compose -f docker-compose.yml build --no-cache

    # Prune unused images to save space
    docker image prune -f

    success "Docker images built successfully."
}

# Setup systemd service
setup_systemd() {
    log "Setting up systemd service..."

    cat << EOF | sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null
[Unit]
Description=ScaleIT Bridge Service
Documentation=https://github.com/scaleit/bridge-rust
After=network.target docker.service
Requires=docker.service

[Service]
Type=forking
User=$USER
Group=$GROUP
WorkingDirectory=/opt/scaleit-bridge
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
ExecReload=/usr/bin/docker-compose restart
TimeoutStartSec=300
TimeoutStopSec=120
Restart=always
RestartSec=10

# Environment
Environment=COMPOSE_PROJECT_NAME=scaleit-bridge
Environment=COMPOSE_FILE=docker-compose.yml

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/opt/scaleit-bridge

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"

    success "Systemd service configured successfully."
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."

    cat << EOF | sudo tee "/etc/logrotate.d/scaleit-bridge" > /dev/null
/opt/scaleit-bridge/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 $USER $GROUP
    postrotate
        docker-compose -f /opt/scaleit-bridge/docker-compose.yml restart scaleit-bridge 2>/dev/null || true
    endscript
}

/var/log/scaleit-bridge-deploy.log {
    weekly
    missingok
    rotate 12
    compress
    delaycompress
    notifempty
    create 0644 root root
}
EOF

    success "Log rotation configured successfully."
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."

    if command -v ufw &> /dev/null; then
        sudo ufw allow 8080/tcp comment "ScaleIT Bridge API"
        sudo ufw allow 80/tcp comment "HTTP"
        sudo ufw allow 443/tcp comment "HTTPS"
        log "UFW rules added."
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-port=8080/tcp
        sudo firewall-cmd --permanent --add-port=80/tcp
        sudo firewall-cmd --permanent --add-port=443/tcp
        sudo firewall-cmd --reload
        log "Firewalld rules added."
    else
        warn "No firewall detected. Please configure firewall manually."
    fi

    success "Firewall configured successfully."
}

# Start services
start_services() {
    log "Starting services..."

    # Start systemd service
    sudo systemctl start "$SERVICE_NAME"

    # Wait for services to be ready
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:8080/health &> /dev/null; then
            success "ScaleIT Bridge is running and healthy!"
            break
        fi

        log "Waiting for service to be ready... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        error "Service failed to start within expected time. Check logs for details."
    fi

    # Show service status
    sudo systemctl status "$SERVICE_NAME" --no-pager
}

# Health check
health_check() {
    log "Performing health check..."

    # Test API endpoints
    local endpoints=(
        "http://localhost:8080/health"
        "http://localhost:8080/devices"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -f "$endpoint" &> /dev/null; then
            success "✓ $endpoint is responding"
        else
            error "✗ $endpoint is not responding"
        fi
    done

    # Check Docker containers
    if docker-compose -f /opt/scaleit-bridge/docker-compose.yml ps | grep -q "Up"; then
        success "✓ Docker containers are running"
    else
        error "✗ Docker containers are not running properly"
    fi

    success "Health check completed successfully!"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."

    # Remove temporary files
    sudo find /tmp -name "*scaleit*" -type f -mtime +1 -delete 2>/dev/null || true

    # Clean Docker system
    docker system prune -f --volumes

    success "Cleanup completed."
}

# Main deployment function
deploy() {
    log "Starting ScaleIT Bridge deployment..."

    check_root
    check_requirements
    setup_directories
    backup_existing
    stop_services
    deploy_files
    build_images
    setup_systemd
    setup_log_rotation
    configure_firewall
    start_services
    health_check
    cleanup

    success "🎉 ScaleIT Bridge deployment completed successfully!"

    echo
    echo "====================================="
    echo "  ScaleIT Bridge Deployment Summary"
    echo "====================================="
    echo "Service Status: $(systemctl is-active $SERVICE_NAME)"
    echo "API Endpoint: http://localhost:8080"
    echo "Health Check: http://localhost:8080/health"
    echo "Logs: /opt/scaleit-bridge/logs/"
    echo "Configuration: /opt/scaleit-bridge/config/devices.json"
    echo
    echo "Management Commands:"
    echo "  Start:   sudo systemctl start $SERVICE_NAME"
    echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
    echo "  Restart: sudo systemctl restart $SERVICE_NAME"
    echo "  Status:  sudo systemctl status $SERVICE_NAME"
    echo "  Logs:    journalctl -u $SERVICE_NAME -f"
    echo
    echo "For configuration changes, edit the devices.json file and restart the service."
    echo "====================================="
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  deploy              Full deployment (default)"
    echo "  start               Start services only"
    echo "  stop                Stop services only"
    echo "  restart             Restart services"
    echo "  status              Show service status"
    echo "  health              Perform health check"
    echo "  backup              Create backup only"
    echo "  cleanup             Cleanup only"
    echo "  logs                Show service logs"
    echo "  -h, --help          Show this help message"
    echo
    echo "Examples:"
    echo "  $0                  # Full deployment"
    echo "  $0 start            # Start services"
    echo "  $0 health           # Health check"
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        ;;
    status)
        sudo systemctl status "$SERVICE_NAME" --no-pager
        docker-compose -f /opt/scaleit-bridge/docker-compose.yml ps
        ;;
    health)
        health_check
        ;;
    backup)
        backup_existing
        ;;
    cleanup)
        cleanup
        ;;
    logs)
        journalctl -u "$SERVICE_NAME" -f
        ;;
    -h|--help)
        usage
        ;;
    *)
        echo "Unknown option: $1"
        usage
        exit 1
        ;;
esac
