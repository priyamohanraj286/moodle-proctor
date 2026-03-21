# Deployment Guide

Complete guide for deploying the Moodle Proctor system to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security Hardening](#security-hardening)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** 18.x or higher
- **PostgreSQL** 15.x or higher
- **Python** 3.9+ (for AI service)
- **Docker** & Docker Compose (optional but recommended)
- **Git**

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB

**Recommended:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/moodle-proctor.git
cd moodle-proctor
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

**Manual Proctoring (Electron):**
```bash
cd ../manual_proctoring
npm install
```

### 3. Start Services

**Using Docker Compose (Recommended):**

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
cd backend
npm run migrate

# Seed database (optional, for development)
npm run seed

# Start backend
npm run dev
```

**Manual Setup:**

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database
createdb proctor_db

# Run migrations
cd backend
npm run migrate

# Start backend
npm run dev
```

### 4. Environment Variables

Copy the example environment files:

```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env.local
```

Update with your configuration (see [Environment Configuration](#environment-configuration)).

### 5. Start Development Servers

**Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:3000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000 (same port, use different domain in production)
```

**AI Proctoring Service:**
```bash
cd ai_proctoring
python main.py
# Runs on ws://localhost:8000/proctor
```

**Manual Proctoring (Electron):**
```bash
cd manual_proctoring
npm start
```

---

## Production Deployment

### Option 1: Docker Deployment (Recommended)

#### Build Docker Images

```bash
# Backend
cd backend
docker build -t moodle-proctor-backend:latest .

# Frontend
cd ../frontend
docker build -t moodle-proctor-frontend:latest .

# AI Service
cd ../ai_proctoring
docker build -t moodle-proctor-ai:latest .
```

#### Deploy with Docker Compose

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=3
```

#### Production Docker Compose Example

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: proctor_db
      POSTGRES_USER: proctor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U proctor"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: moodle-proctor-backend:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://proctor:${DB_PASSWORD}@postgres:5432/proctor_db
      JWT_SECRET: ${JWT_SECRET}
      AI_SERVICE_URL: ws://ai-service:8000/proctor
    ports:
      - "3000:3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: moodle-proctor-frontend:latest
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_BACKEND_URL: https://backend.yourdomain.com
    ports:
      - "80:3000"
    restart: unless-stopped

  ai-service:
    image: moodle-proctor-ai:latest
    ports:
      - "8000:8000"
    restart: unless-stopped
    environment:
      PYTHONUNBUFFERED: 1

  nginx:
    image: nginx:alpine
    depends_on:
      - backend
      - frontend
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    restart: unless-stopped

volumes:
  postgres_data:
```

### Option 2: Traditional Deployment

#### Backend (Node.js)

```bash
# Build
cd backend
npm run build

# Start with PM2
pm2 start npm --name "proctor-backend" -- start

# Or using systemd
sudo systemctl start proctor-backend
```

**PM2 Ecosystem File:**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'proctor-backend',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Start with:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Frontend (Next.js)

```bash
cd frontend
npm run build

# Start with PM2
pm2 start npm --name "proctor-frontend" -- start

# Or export static and serve with nginx
npm run build
npm run export
# Serve 'out' directory with nginx
```

#### AI Service (Python)

```bash
cd ai_proctoring

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start with systemd
sudo systemctl start proctor-ai
```

**systemd service file:**

`/etc/systemd/system/proctor-ai.service`:

```ini
[Unit]
Description=Moodle Proctor AI Service
After=network.target

[Service]
Type=simple
User=proctor
WorkingDirectory=/var/www/proctoring/ai_proctoring
Environment="PATH=/var/www/proctoring/ai_proctoring/venv/bin"
ExecStart=/var/www/proctoring/ai_proctoring/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Environment Configuration

### Backend Environment Variables

Create `.env` in the backend directory:

```bash
# Application
NODE_ENV=production
APP_NAME=moodle-proctor
VERSION=1.0.0

# Server
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://proctor:PASSWORD@localhost:5432/proctor_db
DB_POOL_MIN=2
DB_POOL_MAX=10

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# AI Service
AI_SERVICE_URL=ws://localhost:8000/proctor

# Security
FRAME_SIGNATURE_SECRET=your-frame-signing-secret
FRAME_SIGNATURE_MAX_AGE=5000
VIOLATION_AUTO_SUBMIT_THRESHOLD=15

# WebSocket
WS_PORT=3001
WS_HEARTBEAT_INTERVAL=30000

# SSE
SSE_HEARTBEAT_INTERVAL=15000

# Proctoring
PROCTORING_STRICTNESS=medium

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/proctor/backend.log
```

### Frontend Environment Variables

Create `.env.local` in the frontend directory:

```bash
# Backend API
NEXT_PUBLIC_BACKEND_URL=https://backend.yourdomain.com

# Moodle (optional)
MOODLE_BASE_URL=https://moodle.yourdomain.com
MOODLE_SERVICE=moodle_mobile_app

# Node
NODE_ENV=production
```

### AI Service Environment Variables

```bash
# AI Model
MODEL_PATH=/models
CONFIDENCE_THRESHOLD=0.7

# Server
HOST=0.0.0.0
PORT=8000

# Logging
LOG_LEVEL=INFO
```

---

## Database Setup

### PostgreSQL Configuration

**postgresql.conf:**

```ini
# Connection Settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

### Create Database

```bash
# Create user
sudo -u postgres createuser proctor --pwprompt

# Create database
sudo -u postgres createdb -O proctor proctor_db

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE proctor_db TO proctor;"
```

### Run Migrations

```bash
cd backend
npm run migrate
```

### Seed Initial Data

```bash
cd backend
npm run seed
```

### Backup Database

```bash
# Backup
pg_dump -h localhost -U proctor proctor_db > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U proctor proctor_db < backup_20240115.sql
```

---

## Monitoring & Logging

### Application Logging

**Backend logs:**
```bash
tail -f /var/log/proctor/backend.log
```

**PostgreSQL logs:**
```bash
tail -f /var/lib/postgresql/data/pg_log/postgresql-*.log
```

### Health Checks

**Backend:**
```bash
curl http://localhost:3000/health
```

**Database:**
```bash
pg_isready -h localhost -U proctor
```

### Metrics Collection

Use Prometheus + Grafana for monitoring:

**prometheus.yml:**
```yaml
scrape_configs:
  - job_name: 'proctor-backend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Log Aggregation

Use ELK Stack or similar:

```bash
# Filebeat configuration
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/proctor/*.log
  fields:
    service: proctor-backend
```

---

## Security Hardening

### TLS/SSL

**Generate SSL certificates:**

```bash
# Let's Encrypt (recommended)
sudo certbot --nginx -d yourdomain.com

# Or self-signed for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/proctor.key \
  -out /etc/ssl/certs/proctor.crt
```

**Nginx configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/proctor.crt;
    ssl_certificate_key /etc/ssl/private/proctor.key;

    # Modern SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### Rate Limiting

Nginx rate limiting:

```nginx
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    limit_req_status 429;
}

server {
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://backend;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

---

## Backup & Recovery

### Automated Backups

**Backup script:**

`/usr/local/bin/backup-proctor.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/proctor"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump -h localhost -U proctor proctor_db | gzip > \
  $BACKUP_DIR/db_$DATE.sql.gz

# File backup
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/proctoring/uploads

# Keep last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

**Cron job:**

```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-proctor.sh
```

### Recovery

**Restore database:**

```bash
gunzip < backup_20240115.sql.gz | psql -h localhost -U proctor proctor_db
```

**Restore files:**

```bash
tar -xzf files_20240115.tar.gz -C /
```

---

## Troubleshooting

### Backend Issues

**Backend won't start:**

```bash
# Check logs
pm2 logs proctor-backend

# Check port availability
netstat -tlnp | grep :3000

# Check database connection
psql -h localhost -U proctor -d proctor_db -c "SELECT 1;"
```

**Database connection failed:**

```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check connection string
echo $DATABASE_URL

# Test connection
psql -h localhost -U proctor -d proctor_db
```

### Frontend Issues

**Build fails:**

```bash
# Clear cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### AI Service Issues

**AI service not responding:**

```bash
# Check Python environment
python --version
pip list | grep fastapi

# Check logs
journalctl -u proctor-ai -f

# Restart service
sudo systemctl restart proctor-ai
```

### Performance Issues

**Slow API response:**

```bash
# Check database query performance
psql -h localhost -U proctor -d proctor_db
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

# Check slow queries
tail -f /var/log/postgresql/postgresql-slow.log
```

**High memory usage:**

```bash
# Check Node.js memory
node --max-old-space-size=4096 dist/index.js

# Check PM2 memory
pm2 monit
```

---

## Scaling

### Horizontal Scaling

**Multiple backend instances:**

```bash
# Start 4 instances
pm2 start ecosystem.config.js --instances 4

# Or use Docker
docker-compose up -d --scale backend=4
```

**Load balancing with Nginx:**

```nginx
upstream backend {
    least_conn;
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
    server backend4:3000;
}

server {
    location /api/ {
        proxy_pass http://backend;
    }
}
```

### Database Scaling

**Connection pooling:**

Use PgBouncer for connection pooling:

```bash
# Install PgBouncer
sudo apt-get install pgbouncer

# Configure
# /etc/pgbouncer/pgbouncer.ini
[databases]
proctor_db = host=localhost port=5432 dbname=proctor_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## Maintenance

### Updates

**Update backend:**

```bash
cd backend
git pull
npm install
npm run build
pm2 restart proctor-backend
```

**Database migrations:**

```bash
cd backend
npm run migrate
```

### Log Rotation

`/etc/logrotate.d/proctor`:

```
/var/log/proctor/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 proctor proctor
    sharedscripts
    postrotate
        pm2 reload proctor-backend
    endscript
}
```

---

## Health Monitoring

### Monitoring Dashboard

Set up a monitoring dashboard with:

- **Grafana** for visualization
- **Prometheus** for metrics
- **AlertManager** for alerts

**Key metrics to monitor:**
- Request rate
- Response time
- Error rate
- Database connections
- CPU/memory usage
- Active WebSocket connections
- AI service availability

### Alerting

**Critical alerts:**
- Backend down
- Database connection lost
- Disk space > 80%
- Error rate > 5%
- Response time > 2s

**Warning alerts:**
- High memory usage
- Slow database queries
- AI service degraded

---

## Performance Tuning

### Database

**Vacuum and analyze:**

```bash
psql -h localhost -U proctor -d proctor_db -c "VACUUM ANALYZE;"
```

**Reindex:**

```bash
psql -h localhost -U proctor -d proctor_db -c "REINDEX DATABASE proctor_db;"
```

### Backend

**Node.js cluster mode:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    instances: 'max',
    exec_mode: 'cluster'
  }]
};
```

---

## Support

**Documentation:**
- [API Documentation](./API_DOCUMENTATION.md)
- [Testing Guide](./TESTING.md)
- [Frontend Integration](./frontend/FRONTEND_INTEGRATION.md)

**Issues:**
- GitHub Issues: [Project Issues]
- Email: support@yourdomain.com

---

## Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database created and migrated
- [ ] Seed data loaded (if needed)
- [ ] Firewall rules configured
- [ ] Monitoring set up
- [ ] Backup scripts configured
- [ ] Log rotation configured
- [ ] Health checks configured

### Post-Deployment

- [ ] Verify all services running
- [ ] Test authentication flow
- [ ] Test exam start/submit
- [ ] Test violation detection
- [ ] Test SSE real-time updates
- [ ] Test WebSocket connection
- [ ] Load test API endpoints
- [ ] Verify backup works
- [ ] Check monitoring dashboards
- [ ] Verify SSL certificate

---

## Appendix

### Useful Commands

```bash
# Check all services
docker-compose ps

# View logs for all services
docker-compose logs -f

# Restart service
docker-compose restart backend

# Scale service
docker-compose up -d --scale backend=3

# Database backup
pg_dump -h localhost -U proctor proctor_db > backup.sql

# Database restore
psql -h localhost -U proctor proctor_db < backup.sql

# Check disk space
df -h

# Check memory
free -h

# Check processes
top
```

### Port Reference

| Service | Port | Protocol |
|---------|------|----------|
| Backend API | 3000 | HTTP |
| WebSocket | 3001 | WebSocket |
| Frontend | 3000 | HTTP |
| PostgreSQL | 5432 | TCP |
| AI Service | 8000 | WebSocket |
| Nginx | 80, 443 | HTTP |

---

**Last Updated:** 2024-01-15

**Version:** 1.0.0
