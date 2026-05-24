#!/bin/bash
# setup-nginx.sh — Configurar Nginx para ContaChile
# Ejecutar después de setup-vps.sh
set -e

echo ">>> Configurando Nginx para ContaChile..."

read -p "Tu dominio (ej: contachile.cl, sin www): " DOMAIN

# Copiar configuración y reemplazar placeholder
sudo cp /opt/contachile/nginx/contachile.conf /etc/nginx/sites-available/contachile
sudo sed -i "s/TU_DOMINIO.cl/$DOMAIN/g" /etc/nginx/sites-available/contachile

# Activar el sitio
sudo ln -sf /etc/nginx/sites-available/contachile /etc/nginx/sites-enabled/contachile

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
echo "   Siguiente paso: bash /opt/contachile/scripts/setup-ssl.sh"
