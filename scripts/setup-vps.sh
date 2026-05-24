#!/bin/bash
# setup-vps.sh — Configuración inicial del VPS (ejecutar una sola vez)
# Ubuntu 22.04+ recomendado
set -e

echo "=============================="
echo " ContaChile — Setup VPS"
echo "=============================="

# ── Docker ─────────────────────────────────────────────────────────────────
echo ""
echo ">>> Instalando Docker..."
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# ── Nginx ───────────────────────────────────────────────────────────────────
echo ""
echo ">>> Instalando Nginx..."
sudo apt-get install -y -qq nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ── Certbot ─────────────────────────────────────────────────────────────────
echo ""
echo ">>> Instalando Certbot..."
sudo apt-get install -y -qq certbot python3-certbot-nginx

# ── Git ─────────────────────────────────────────────────────────────────────
echo ""
echo ">>> Instalando Git..."
sudo apt-get install -y -qq git

# ── Clonar repo ──────────────────────────────────────────────────────────────
echo ""
read -p "URL del repositorio git (ej: git@github.com:usuario/contachile.git): " REPO_URL
sudo git clone "$REPO_URL" /opt/contachile
sudo chown -R $USER:$USER /opt/contachile

# ── .env.production ──────────────────────────────────────────────────────────
echo ""
echo ">>> Copiando plantilla de variables de entorno..."
cp /opt/contachile/.env.production.example /opt/contachile/.env.production

echo ""
echo "=============================="
echo " Setup completo"
echo "=============================="
echo ""
echo "Próximos pasos:"
echo "  1. Editar secrets:  nano /opt/contachile/.env.production"
echo "  2. Configurar Nginx: bash /opt/contachile/scripts/setup-nginx.sh"
echo "  3. Obtener SSL:      bash /opt/contachile/scripts/setup-ssl.sh"
echo "  4. Primer deploy:    bash /opt/contachile/scripts/deploy.sh"
echo ""
echo "IMPORTANTE: cierra esta sesión SSH y vuelve a conectarte"
echo "para que el grupo 'docker' tome efecto en tu usuario."
