#!/usr/bin/env bash
# One-time setup of a fresh Oracle Cloud Ubuntu server. Run on the server:  ./deploy/oracle/setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "→ Updating the system"
sudo apt-get update -y && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "→ Installing Docker (official install script)"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "→ Opening ports 80 and 443 (Oracle's Ubuntu image blocks them in iptables)"
for rule in "tcp --dport 80" "tcp --dport 443" "udp --dport 443"; do
  sudo iptables -C INPUT -p $rule -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p $rule -j ACCEPT
done
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent unattended-upgrades
sudo netfilter-persistent save

echo "→ Daily database + uploads backup at 03:30 (kept 14 days in $ROOT/backups)"
mkdir -p "$ROOT/backups"
( crontab -l 2>/dev/null | grep -v 'deploy/oracle/backup.sh' ; echo "30 3 * * * $ROOT/deploy/oracle/backup.sh >> $HOME/briefluence-backup.log 2>&1" ) | crontab -

echo
echo "Done. Log out and back in (so Docker works without sudo), then continue with step 6 of docs/oracle-deploy.md."
