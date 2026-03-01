#!/bin/bash
# Automated Backup Script for EDU Platform
# Can be run manually or via cron

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/eduvoice/backups}"
PROJECT_DIR="${PROJECT_DIR:-/home/eduvoice/untilIwin}"
RETENTION_DAYS=${RETENTION_DAYS:-30}
S3_BUCKET="${S3_BUCKET:-}"  # Optional: AWS S3 bucket for remote backups

# Create backup directories
mkdir -p "$BACKUP_DIR/database"
mkdir -p "$BACKUP_DIR/media"
mkdir -p "$BACKUP_DIR/redis"
mkdir -p "$BACKUP_DIR/logs"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)

echo "=== Starting Backup: $TIMESTAMP ==="

# 1. Backup PostgreSQL Database
echo "Backing up PostgreSQL database..."
cd "$PROJECT_DIR"
docker-compose exec -T db pg_dump -U eduvoice_user eduvoice_db | gzip > "$BACKUP_DIR/database/postgres_${TIMESTAMP}.sql.gz"
echo "✓ PostgreSQL backup completed"

# 2. Backup SQLite Analytics DB
echo "Backing up SQLite analytics database..."
if [ -f "$PROJECT_DIR/backend/analytics.sqlite3" ]; then
    cp "$PROJECT_DIR/backend/analytics.sqlite3" "$BACKUP_DIR/database/analytics_${TIMESTAMP}.sqlite3"
    gzip "$BACKUP_DIR/database/analytics_${TIMESTAMP}.sqlite3"
    echo "✓ Analytics DB backup completed"
fi

# 3. Backup Redis Data
echo "Backing up Redis data..."
docker-compose exec -T redis redis-cli --rdb - > "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb"
gzip "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb"
echo "✓ Redis backup completed"

# 4. Backup Media Files
echo "Backing up media files..."
if [ -d "$PROJECT_DIR/backend/media" ]; then
    tar -czf "$BACKUP_DIR/media/media_${TIMESTAMP}.tar.gz" -C "$PROJECT_DIR/backend" media/
    echo "✓ Media files backup completed"
fi

# 5. Backup Logs
echo "Backing up logs..."
if [ -d "$PROJECT_DIR/backend/logs" ]; then
    tar -czf "$BACKUP_DIR/logs/logs_${TIMESTAMP}.tar.gz" -C "$PROJECT_DIR/backend" logs/
    echo "✓ Logs backup completed"
fi

# 6. Create backup manifest
echo "Creating backup manifest..."
cat > "$BACKUP_DIR/manifest_${TIMESTAMP}.txt" <<EOF
Backup Date: $DATE $TIMESTAMP
Project: EDU Platform
Components:
- PostgreSQL Database: postgres_${TIMESTAMP}.sql.gz
- Analytics Database: analytics_${TIMESTAMP}.sqlite3.gz
- Redis Data: redis_${TIMESTAMP}.rdb.gz
- Media Files: media_${TIMESTAMP}.tar.gz
- Logs: logs_${TIMESTAMP}.tar.gz

Backup Location: $BACKUP_DIR
Retention: $RETENTION_DAYS days
EOF

echo "✓ Manifest created"

# 7. Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
    echo "Uploading backups to S3..."
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/backups/$DATE/" \
        --exclude "*" \
        --include "*${TIMESTAMP}*"
    echo "✓ S3 upload completed"
fi

# 8. Cleanup old backups
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR/database" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/database" -name "*.sqlite3.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/redis" -name "*.rdb.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/media" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/logs" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "manifest_*.txt" -mtime +$RETENTION_DAYS -delete
echo "✓ Cleanup completed"

# 9. Calculate sizes
echo ""
echo "=== Backup Summary ==="
echo "Database backups: $(du -sh $BACKUP_DIR/database 2>/dev/null | cut -f1)"
echo "Media backups: $(du -sh $BACKUP_DIR/media 2>/dev/null | cut -f1)"
echo "Redis backups: $(du -sh $BACKUP_DIR/redis 2>/dev/null | cut -f1)"
echo "Total backup size: $(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)"
echo ""
echo "✓ Backup completed successfully: $TIMESTAMP"

exit 0
