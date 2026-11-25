# METATRON Server OS — Guida Installazione & Creazione ISO Avviabile

Questo pacchetto consente di installare **METATRON** come vero sistema operativo su un PC, Mini-PC o Server aziendale (Debian 12 / Ubuntu Server 22.04–24.04), oppure di generare una **chiavetta USB avviabile (.iso)**.

---

## Opzione 1 — Installazione diretta su Server Linux (Consigliata)

Installa Debian 12 o Ubuntu Server minimale sul server, copia la cartella del progetto e lancia:

```bash
# Modalita Server aziendale (accessibile da tutta la rete locale su porta 3000)
sudo bash os-installer/install-metatron-os.sh

# OPPURE Modalita OS Desktop Kiosk (all'accensione parte METATRON a tutto schermo sul monitor)
sudo bash os-installer/install-metatron-os.sh --kiosk
```

Al termine:
- Accesso via rete locale: `http://metatron.local:3000` (oppure `http://<IP-DEL-SERVER>:3000`)
- I dati persistenti (commesse, magazzino, foto, file, calendari, backup) vengono salvati in `/var/lib/metatron`.
- Il servizio parte automaticamente ad ogni riavvio tramite `systemd` (`systemctl status metatron-os`).

---

## Opzione 2 — Creare il file `metatron-os-amd64.iso` avviabile da Chiavetta USB

Su un PC Linux Debian/Ubuntu (oppure Windows con WSL2 Ubuntu):

```bash
sudo bash os-installer/build-metatron-iso.sh
```

Lo script compila automaticamente `metatron-os-amd64.iso` basata su **Debian Bookworm + METATRON OS Kiosk + Installer grafico**.
Scrivi la ISO su una chiavetta USB con **Rufus** o **BalenaEtcher**, avvia il server da USB e installa METATRON OS su disco.

---

## Opzione 3 — Avvio rapido con Docker / Docker Compose

```bash
cd os-installer
EMPLOYER_ACCESS_CODE="TUO_CODICE_SEGRETO" docker compose up -d --build
```
