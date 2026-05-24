#!/bin/bash
# setup-ssl.sh — Obtener certificado SSL con Let's Encrypt para contai.innovatio-it.com
# Prerrequisito: DNS A record apuntando al IP del VPS, Nginx configurado
set -e

DOMAIN="contai.innovatio-it.com"

read -p "Email para notificaciones de renovación: " EMAIL

echo ""
echo ">>> Obteniendo certificado SSL para $DOMAIN..."

sudo certbot --nginx \
  -d "$DOMAIN" \
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
