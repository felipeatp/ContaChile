#!/bin/bash
# deploy.sh — Deploy / redeploy ContAI en el VPS
# Ejecutar desde /opt/contai
set -e

cd /opt/contai

echo "=============================="
echo " ContAI — Deploy"
echo "=============================="

# ── Verificar .env.production ──────────────────────────────────────────────
if [ ! -f .env.production ]; then
  echo "❌ No se encontró .env.production"
  echo "   Copia .env.production.example y completa los valores:"
  echo "   cp .env.production.example .env.production && nano .env.production"
  exit 1
fi

# ── Pull últimos cambios ──────────────────────────────────────────────────
echo ""
echo ">>> Actualizando código..."
git pull origin main

# ── Build imágenes ────────────────────────────────────────────────────────
echo ""
echo ">>> Construyendo imágenes Docker..."
docker compose -f docker-compose.prod.yml build

# ── Levantar servicios ────────────────────────────────────────────────────
echo ""
echo ">>> Levantando servicios..."
docker compose -f docker-compose.prod.yml up -d

# Esperar que la DB esté lista
echo ">>> Esperando que PostgreSQL esté listo..."
sleep 5

# ── Migraciones Prisma ────────────────────────────────────────────────────
echo ""
echo ">>> Ejecutando migraciones de base de datos..."
docker compose -f docker-compose.prod.yml exec -T api \
  sh -c "cd /app/apps/api && node_modules/.bin/prisma migrate deploy" || \
  echo "⚠️  Migraciones fallaron o no hay nuevas migraciones"

# ── Estado final ──────────────────────────────────────────────────────────
echo ""
echo ">>> Estado de servicios:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=============================="
echo " ✅ Deploy completo"
echo "=============================="
echo ""
echo "Comandos útiles:"
echo "  Logs API:  docker compose -f docker-compose.prod.yml logs -f api"
echo "  Logs Web:  docker compose -f docker-compose.prod.yml logs -f web"
echo "  Reiniciar: docker compose -f docker-compose.prod.yml restart"
