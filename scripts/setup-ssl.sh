#!/bin/bash
# setup-ssl.sh — Obtener certificado SSL con Let's Encrypt
# Prerrequisito: dominio apuntando al IP del VPS, Nginx configurado
set -e

read -p "Dominio principal (ej: contachile.cl): " DOMAIN
read -p "Email para notificaciones de renovación: " EMAIL

echo ""
echo ">>> Obteniendo certificado SSL para $DOMAIN y www.$DOMAIN..."

sudo certbot --nginx \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --redirect

echo ""
echo "✅ SSL configurado para $DOMAIN"
echo "   Certbot renueva automáticamente via systemd timer"
echo ""
echo "   Verificar renovación automática:"
echo "   sudo systemctl status certbot.timer"
echo "   sudo certbot renew --dry-run"
