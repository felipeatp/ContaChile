#!/bin/bash
# setup-nginx.sh — Configurar Nginx para ContAI (contai.innovatio-it.com)
# Ejecutar después de setup-vps.sh
set -e

DOMAIN="contai.innovatio-it.com"

echo ">>> Configurando Nginx para $DOMAIN..."

# Copiar configuración
sudo cp /opt/contai/nginx/contai.conf /etc/nginx/sites-available/contai

# Activar el sitio
sudo ln -sf /etc/nginx/sites-available/contai /etc/nginx/sites-enabled/contai

# Desactivar sitio por defecto si existe
[ -f /etc/nginx/sites-enabled/default ] && sudo rm /etc/nginx/sites-enabled/default

# Crear directorio para Certbot ACME challenge
sudo mkdir -p /var/www/certbot

# Validar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx

echo ""
echo "✅ Nginx configurado para $DOMAIN"
echo "   Siguiente paso: bash /opt/contai/scripts/setup-ssl.sh"
