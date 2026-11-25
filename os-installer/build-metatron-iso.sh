#!/usr/bin/env bash
# =============================================================================
# METATRON OS — Generatore Immagine ISO Avviabile da Chiavetta USB (Debian 12)
# Eseguire su una macchina Linux Debian/Ubuntu (o WSL2 con live-build):
#   sudo bash os-installer/build-metatron-iso.sh
# Output: ./metatron-os-amd64.iso
# =============================================================================
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Errore: esegui questo script come root (sudo bash os-installer/build-metatron-iso.sh)."
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/iso-build-work"
OUTPUT_ISO="${PROJECT_ROOT}/metatron-os-amd64.iso"

echo "============================================================"
echo "  METATRON OS — Builder ISO Bootable (Debian Bookworm amd64)"
echo "============================================================"

echo "[1/5] Installazione live-build e dipendenze ISO..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y live-build debootstrap squashfs-tools xorriso syslinux-common isolinux rsync

echo "[2/5] Preparazione workspace live-build..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

lb config \
  --distribution bookworm \
  --architectures amd64 \
  --binary-images iso-hybrid \
  --debian-installer live \
  --iso-application "METATRON Server OS" \
  --iso-publisher "METATRON" \
  --iso-volume "METATRON_OS" \
  --bootappend-live "boot=live components quiet splash hostname=metatron username=metatron" \
  --archive-areas "main contrib non-free-firmware"

echo "[3/5] Selezione pacchetti OS minimale + Kiosk + Rete..."
mkdir -p config/package-lists
cat > config/package-lists/metatron.list.chroot <<'EOF'
sudo
curl
ca-certificates
gnupg
rsync
ufw
avahi-daemon
openssh-server
network-manager
xserver-xorg
x11-xserver-utils
xinit
openbox
chromium
unclutter
EOF

echo "[4/5] Inclusione sorgenti METATRON e hook di configurazione chroot..."
mkdir -p config/includes.chroot/opt/metatron-src
rsync -a \
  --exclude node_modules \
  --exclude .git \
  --exclude iso-build-work \
  --exclude dist \
  --exclude data \
  --exclude "*.iso" \
  "${PROJECT_ROOT}/" config/includes.chroot/opt/metatron-src/

mkdir -p config/hooks/live
cat > config/hooks/live/0900-install-metatron.hook.chroot <<'EOF'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# Installa Node.js 20 LTS dentro l'immagine ISO
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update -y
apt-get install -y nodejs

# Esegue l'installer METATRON in modalita OS Kiosk + Server
bash /opt/metatron-src/os-installer/install-metatron-os.sh --kiosk
rm -rf /opt/metatron-src
apt-get clean
EOF
chmod +x config/hooks/live/0900-install-metatron.hook.chroot

echo "[5/5] Compilazione immagine ISO avviabile (richiede alcuni minuti)..."
lb build

ISO_GENERATED="$(find "${BUILD_DIR}" -maxdepth 1 -name '*.iso' | head -n 1)"
if [[ -z "${ISO_GENERATED}" ]]; then
  echo "Errore: immagine ISO non generata. Controlla i log di live-build."
  exit 1
fi

mv "${ISO_GENERATED}" "${OUTPUT_ISO}"
echo ""
echo "============================================================"
echo "  ISO METATRON OS generata con successo!"
echo "  File: ${OUTPUT_ISO}"
echo "  Scrivibile su chiavetta USB con Rufus / BalenaEtcher / dd."
echo "============================================================"
