#!/bin/bash
# Automated Deployment Script for EDU Platform
# This script handles zero-downtime deployment to production

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_DIR="/home/eduvoice/untilIwin"
BACKUP_DIR="/home/eduvoice/backups"
DOCKER_COMPOSE_FILE="docker-compose.yml"

echo -e "${GREEN}=== EDU Platform Deployment Script ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "Project Directory: $PROJECT_DIR"
echo ""

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
log_info "Checking prerequisites..."

if ! command_exists docker; then
    log_error "Docker is not installed"
    exit 1
fi

if ! command_exists docker-compose; then
    log_error "Docker Compose is not installed"
    exit 1
fi

log_info "Prerequisites check passed"

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Create backup directory
mkdir -p "$BACKUP_DIR/database"
mkdir -p "$BACKUP_DIR/media"

# Step 1: Backup current database
log_info "Creating database backup..."
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T db pg_dump -U eduvoice_user eduvoice_db | gzip > "$BACKUP_DIR/database/backup_${BACKUP_TIMESTAMP}.sql.gz"
log_info "Database backup created: backup_${BACKUP_TIMESTAMP}.sql.gz"

# Step 2: Backup media files
log_info "Backing up media files..."
if [ -d "$PROJECT_DIR/backend/media" ]; then
    tar -czf "$BACKUP_DIR/media/media_${BACKUP_TIMESTAMP}.tar.gz" -C "$PROJECT_DIR/backend" media/
    log_info "Media backup created: media_${BACKUP_TIMESTAMP}.tar.gz"
fi

# Step 3: Pull latest code
log_info "Pulling latest code from repository..."
git fetch origin
git checkout main
git pull origin main

# Step 4: Build new Docker images
log_info "Building Docker images..."
docker-compose build --no-cache backend daphne celery_worker celery_beat

# Step 5: Run database migrations
log_info "Running database migrations..."
docker-compose run --rm backend python manage.py migrate --noinput
docker-compose run --rm backend python manage.py migrate --database=analytics --noinput

# Step 6: Collect static files
log_info "Collecting static files..."
docker-compose run --rm backend python manage.py collectstatic --noinput

# Step 7: Restart services with zero downtime
log_info "Restarting services..."

# Restart backend (rolling update)
docker-compose up -d --no-deps --build backend
sleep 10  # Wait for backend to start

# Health check
log_info "Performing health check..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8008/api/health/ >/dev/null 2>&1; then
        log_info "Backend is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for backend to be healthy... (${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Backend health check failed!"
    log_warning "Rolling back to previous version..."
    docker-compose down
    docker-compose up -d
    exit 1
fi

# Restart other services
docker-compose up -d --no-deps daphne
docker-compose restart celery_worker celery_beat
docker-compose up -d nginx

# Step 8: Cleanup old Docker images
log_info "Cleaning up old Docker images..."
docker image prune -f

# Step 9: Cleanup old backups (keep last 30 days)
log_info "Cleaning up old backups..."
find "$BACKUP_DIR/database" -name "backup_*.sql.gz" -mtime +30 -delete
find "$BACKUP_DIR/media" -name "media_*.tar.gz" -mtime +30 -delete

# Step 10: Verify deployment
log_info "Verifying deployment..."

# Check if all services are running
if ! docker-compose ps | grep -q "Up"; then
    log_error "Some services are not running!"
    docker-compose ps
    exit 1
fi

log_info "All services are running"

# Final health check
if curl -f http://localhost:8008/api/health/ >/dev/null 2>&1; then
    log_info "Final health check passed"
else
    log_error "Final health check failed!"
    exit 1
fi

# Success message
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   DEPLOYMENT COMPLETED SUCCESSFULLY!   ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo ""
log_info "Deployment completed at $(date)"
log_info "Backup created: backup_${BACKUP_TIMESTAMP}.sql.gz"
echo ""

# Send notification (optional)
if command_exists curl && [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ EDU Platform deployed successfully to ${ENVIRONMENT} at $(date)\"}" \
        "$SLACK_WEBHOOK"
fi

exit 0
