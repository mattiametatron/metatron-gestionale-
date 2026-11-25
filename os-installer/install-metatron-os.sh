#!/usr/bin/env bash
# =============================================================================
# METATRON Server OS — Bare-Metal & Kiosk Installer (Debian 12 / Ubuntu 22-24)
# Uso:
#   sudo bash install-metatron-os.sh             # Modalita Server (Headless/LAN)
#   sudo bash install-metatron-os.sh --kiosk     # Modalita OS Desktop Kiosk (Monitor locale)
# =============================================================================
set -euo pipefail

KIOSK_MODE="false"
APP_PORT="${METATRON_PORT:-3000}"
INSTALL_DIR="/opt/metatron-os"
DATA_DIR="/var/lib/metatron"
SERVICE_USER="metatron"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --kiosk) KIOSK_MODE="true" ;;
    --port=*) APP_PORT="${arg#*=}" ;;
    *) echo "Opzione sconosciuta: $arg"; exit 1 ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Errore: esegui questo script come root (sudo bash install-metatron-os.sh)."
  exit 1
fi

echo "============================================================"
echo "  METATRON Server OS — Installazione di sistema"
echo "  Modalita Kiosk locale: ${KIOSK_MODE}"
echo "  Porta HTTP/WebSocket : ${APP_PORT}"
echo "============================================================"

echo "[1/7] Aggiornamento pacchetti base di sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg rsync ufw avahi-daemon

echo "[2/7] Verifica / installazione Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi

echo "[3/7] Creazione utente di sistema '${SERVICE_USER}' e directory dati..."
if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${SERVICE_USER}" --shell /bin/bash "${SERVICE_USER}"
fi
mkdir -p "${INSTALL_DIR}" "${DATA_DIR}"

echo "[4/7] Copia file applicativi e build di produzione..."
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude data \
  --exclude dist \
  "${SOURCE_DIR}/" "${INSTALL_DIR}/"

cd "${INSTALL_DIR}"
npm install --legacy-peer-deps --no-audit --no-fund
npm run build

# Collega la directory dati persistente in /var/lib/metatron
rm -rf "${INSTALL_DIR}/data"
ln -sfn "${DATA_DIR}" "${INSTALL_DIR}/data"

if [[ ! -f "${DATA_DIR}/.env" ]]; then
  cat > "${DATA_DIR}/.env" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
# Imposta un codice segreto robusto per la registrazione account Direzione:
# EMPLOYER_ACCESS_CODE=CAMBIA_QUESTO_CODICE_DIREZIONE
EOF
  chmod 600 "${DATA_DIR}/.env"
fi

chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}" "${DATA_DIR}"

echo "[5/7] Installazione servizio systemd (metatron-os.service)..."
cat > /etc/systemd/system/metatron-os.service <<EOF
[Unit]
Description=METATRON Server OS Core Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=-${DATA_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${DATA_DIR} ${INSTALL_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now metatron-os.service

echo "[6/7] Configurazione hostname mDNS (metatron.local) e firewall UFW..."
hostnamectl set-hostname metatron || true
systemctl enable --now avahi-daemon || true
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

if [[ "${KIOSK_MODE}" == "true" ]]; then
  echo "[7/7] Configurazione avvio automatico grafico a tutto schermo (Kiosk OS)..."
  apt-get install -y --no-install-recommends xserver-xorg x11-xserver-utils xinit openbox chromium unclutter

  mkdir -p "/home/${SERVICE_USER}/.config/openbox"
  cat > "/home/${SERVICE_USER}/.xinitrc" <<EOF
#!/usr/bin/env bash
xset s off
xset -dpms
xset s noblank
unclutter -idle 3 -root &
exec openbox-session
EOF
  chmod +x "/home/${SERVICE_USER}/.xinitrc"

  cat > "/home/${SERVICE_USER}/.config/openbox/autostart" <<EOF
# Attende che il core METATRON risponda su localhost
until curl -sf http://127.0.0.1:${APP_PORT}/api/auth/status >/dev/null; do
  sleep 1
done
chromium \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --app="http://127.0.0.1:${APP_PORT}" &
EOF
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "/home/${SERVICE_USER}"

  mkdir -p /etc/systemd/system/getty@tty1.service.d
  cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${SERVICE_USER} --noclear %I \$TERM
EOF

  cat >> "/home/${SERVICE_USER}/.bash_profile" <<'EOF'
if [[ -z "${DISPLAY:-}" ]] && [[ "$(tty)" == "/dev/tty1" ]]; then
  exec startx
fi
EOF
  chown "${SERVICE_USER}:${SERVICE_USER}" "/home/${SERVICE_USER}/.bash_profile"
  systemctl daemon-reload
else
  echo "[7/7] Modalita server headless completata."
fi

LAN_IP="$(hostname -I | awk '{print $1}')"
echo ""
echo "============================================================"
echo "  METATRON Server OS installato correttamente!"
echo "  Accesso rete locale : http://${LAN_IP:-localhost}:${APP_PORT}"
echo "  Hostname mDNS       : http://metatron.local:${APP_PORT}"
echo "  Stato servizio      : systemctl status metatron-os"
echo "  Dati persistenti    : ${DATA_DIR}"
echo "============================================================"
