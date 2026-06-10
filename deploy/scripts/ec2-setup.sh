#!/usr/bin/env bash
set -euo pipefail

# Docker + Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
sudo apt-get install -y docker-compose-plugin

# Host Nginx + Certbot (TLS on the host, not in Compose — ADR-0008)
sudo apt-get install -y nginx certbot python3-certbot-nginx awscli

# App + backup dirs
mkdir -p /home/ubuntu/soliofit /home/ubuntu/backups

# Install the Nginx site config (operator edits server_name, then runs certbot --nginx)
sudo cp /home/ubuntu/soliofit/deploy/nginx/soliofit.conf /etc/nginx/sites-available/soliofit
sudo ln -sf /etc/nginx/sites-available/soliofit /etc/nginx/sites-enabled/soliofit
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Daily DB backup at 02:00
crontab -l 2>/dev/null | grep -q "backup-db.sh" || \
  ( crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/soliofit/deploy/scripts/backup-db.sh >> /var/log/soliofit-backup.log 2>&1" ) | crontab -

echo "EC2 setup complete. Log out and back in (or run 'newgrp docker') so the docker group takes effect. Next: edit server_name in the nginx site, run 'sudo certbot --nginx', add backend/.env + frontend env, then push to main."
