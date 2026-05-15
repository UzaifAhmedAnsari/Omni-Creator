# Docker Setup Guide

Complete guide to running OmniCreator with Docker, including PostgreSQL.

## Prerequisites

- **Docker** 20.10+
- **Docker Compose** 2.0+
- At least 4GB RAM allocated to Docker

## Quick Start (Development)

### 1. Start Everything

```bash
# Using docker-compose directly
docker-compose -f docker-compose.dev.yml up

# Or using make
make dev
```

This starts:
- PostgreSQL on `localhost:5432`
- API Server on `localhost:5000`
- Web Frontend on `localhost:3000`

### 2. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api
- **Database**: `postgresql://omnicreator:password123@localhost:5432/omnicreator`

---

## Available Services

### PostgreSQL
- Image: `postgres:16-alpine`
- Container: `omnicreator-postgres-dev`
- Port: `5432`
- Credentials:
  - User: `omnicreator`
  - Password: `password123`
  - Database: `omnicreator`

### API Server
- Container: `omnicreator-api-dev`
- Port: `5000`
- Hot reload enabled (watches `apps/api/src`)
- Health check: GET `/api/health`

### Web Frontend
- Container: `omnicreator-web-dev`
- Port: `3000`
- Hot reload enabled (watches `apps/web/src`)
- Nginx reverse proxy with gzip compression

---

## Common Tasks

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f web
docker-compose -f docker-compose.dev.yml logs -f postgres
```

### Database Operations

```bash
# Connect to PostgreSQL shell
docker exec -it omnicreator-postgres-dev psql -U omnicreator -d omnicreator

# Run migrations
docker-compose -f docker-compose.dev.yml exec api pnpm --filter @workspace/db run push

# Reset database
docker exec -it omnicreator-postgres-dev psql -U omnicreator -d omnicreator -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### Rebuild Images

```bash
# Development
docker-compose -f docker-compose.dev.yml build --no-cache

# Production
docker-compose build --no-cache
```

### Stop Services

```bash
# Development
docker-compose -f docker-compose.dev.yml down

# Production
docker-compose down

# Remove volumes (deletes data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose down -v
```

### Enter a Container

```bash
# API container
docker exec -it omnicreator-api-dev sh

# Web container
docker exec -it omnicreator-web-dev sh

# PostgreSQL container
docker exec -it omnicreator-postgres-dev sh
```

---

## Environment Configuration

### Development (.env.development)

```env
NODE_ENV=development
DB_USER=omnicreator
DB_PASSWORD=password123
DB_NAME=omnicreator
DB_PORT=5432
API_PORT=5000
WEB_PORT=3000
SESSION_SECRET=dev-secret-key-change-in-production
VITE_API_URL=http://localhost:5000/api
```

### Production (.env.production)

```env
NODE_ENV=production
DB_USER=omnicreator
DB_PASSWORD=CHANGE_THIS_IN_PRODUCTION
DB_NAME=omnicreator
DB_PORT=5432
API_PORT=5000
WEB_PORT=3000
SESSION_SECRET=GENERATE_SECURE_SECRET
VITE_API_URL=https://yourdomain.com/api
REPLIT_AUTH_CLIENT_ID=your_production_id
REPLIT_AUTH_CLIENT_SECRET=your_production_secret
```

---

## Production Deployment

### 1. Update Environment Variables

Edit `.env.production` with your actual values:

```bash
# Generate a secure session secret
openssl rand -base64 32

# Update database password
DB_PASSWORD=your_secure_password

# Set production API URL
VITE_API_URL=https://yourdomain.com/api

# Add Replit Auth credentials
REPLIT_AUTH_CLIENT_ID=your_id
REPLIT_AUTH_CLIENT_SECRET=your_secret
```

### 2. Build Production Images

```bash
docker-compose build --no-cache
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Check Status

```bash
docker-compose ps
docker-compose logs -f
```

---

## Docker Compose Files

### `docker-compose.dev.yml`

Development configuration with:
- Hot reload (mounted volumes)
- Exposed ports for debugging
- Development-friendly logging

```bash
docker-compose -f docker-compose.dev.yml up
```

### `docker-compose.yml`

Production configuration with:
- Optimized images (multi-stage builds)
- No mounted volumes
- Production optimizations

```bash
docker-compose up -d
```

---

## Dockerfiles

### Dockerfile.api

Multi-stage build for Express API:
1. **Builder stage**: Install deps, run typecheck, build
2. **Production stage**: Minimal runtime image

### Dockerfile.web

Multi-stage build for React frontend:
1. **Builder stage**: Install deps, build with Vite
2. **Production stage**: Nginx with gzip compression

---

## Troubleshooting

### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL container is running:

```bash
docker-compose -f docker-compose.dev.yml ps
# postgres should show "Up" status

# If not, restart
docker-compose -f docker-compose.dev.yml restart postgres
```

### Port Already in Use

```
ERROR: for postgres  Cannot start service postgres: 
Ports are not available: exposing port 5432 tcp
```

**Solution**: Change port in `.env.development`:

```env
DB_PORT=5433  # Use 5433 instead of 5432
```

### API Cannot Connect to Database

Check the DATABASE_URL format:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Inside Docker: `postgres` is the hostname (not `localhost`)

### Web Frontend Cannot Reach API

Check `VITE_API_URL` environment variable:

- Development: `http://localhost:5000/api`
- Production: `https://yourdomain.com/api`

### Container Crashes on Startup

```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs api

# Common issues:
# - DATABASE_URL not set
# - Port conflicts
# - Missing NODE_ENV
```

---

## Performance Tips

### Reduce Build Time

```bash
# Use Docker buildkit (faster builds)
DOCKER_BUILDKIT=1 docker-compose build

# Cache layers by installing dependencies first
```

### Optimize Database

```sql
-- Create indexes for common queries
CREATE INDEX idx_workspaces_org_id ON workspaces(org_id);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);
```

### Frontend Caching

Nginx caches static assets for 1 year. Update cache headers in `nginx.conf`:

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Using Make Commands

If you have `make` installed (comes with most Unix/Linux systems):

```bash
# View all available commands
make help

# Development
make dev          # Start dev environment
make dev-build    # Build dev images
make dev-logs     # View logs
make dev-down     # Stop dev environment

# Production
make prod         # Start production
make prod-build   # Build production images
make prod-down    # Stop production

# Database
make db-shell     # Connect to PostgreSQL
make db-reset     # Reset database

# Cleanup
make clean        # Remove all containers, volumes, images
```

---

## Next Steps

1. ✅ Docker setup complete
2. Start services: `make dev` or `docker-compose -f docker-compose.dev.yml up`
3. Access frontend at http://localhost:3000
4. Configure AI providers in Settings
5. Add authentication credentials

For more info, see [README.md](README.md)
