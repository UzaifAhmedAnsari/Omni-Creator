.PHONY: help dev prod build up down logs clean docker-build

help:
	@echo "OmniCreator Docker Commands"
	@echo "============================"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start development environment with hot reload"
	@echo "  make dev-build        - Build development images (with cache)"
	@echo "  make dev-logs         - View development logs"
	@echo "  make dev-down         - Stop development environment"
	@echo ""
	@echo "Production:"
	@echo "  make prod             - Start production environment"
	@echo "  make prod-build       - Build production images"
	@echo "  make prod-logs        - View production logs"
	@echo "  make prod-down        - Stop production environment"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell         - Connect to PostgreSQL shell (dev)"
	@echo "  make db-reset         - Reset database (dev)"
	@echo ""
	@echo "Utilities:"
	@echo "  make build            - Build all images"
	@echo "  make clean            - Remove all containers, volumes, and images"
	@echo "  make logs             - View all logs (current environment)"
	@echo ""

# Development targets
dev: .env.development
	docker-compose -f docker-compose.dev.yml up

dev-build:
	docker-compose -f docker-compose.dev.yml build

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

dev-down:
	docker-compose -f docker-compose.dev.yml down

# Production targets
prod: .env.production
	docker-compose up -d

prod-build:
	docker-compose build --no-cache

prod-logs:
	docker-compose logs -f

prod-down:
	docker-compose down

# Database targets
db-shell:
	docker exec -it omnicreator-postgres-dev psql -U omnicreator -d omnicreator

db-reset:
	docker-compose -f docker-compose.dev.yml exec -T postgres psql -U omnicreator -d omnicreator -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# General targets
build: dev-build prod-build

clean:
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose down -v
	docker image prune -af

logs:
	docker-compose logs -f

.env.development:
	@echo "Creating .env.development..."
	@cp .env.development .env.development || echo ".env.development already exists"

.env.production:
	@echo "Creating .env.production..."
	@cp .env.production .env.production || echo ".env.production already exists"
