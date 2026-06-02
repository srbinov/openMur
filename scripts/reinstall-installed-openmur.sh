#!/usr/bin/env bash
# Full reinstall of the packaged openMur .deb — no npm run dev / dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEB="${ROOT}/dist/openmur-1.7.2-linux-amd64.deb"
INSTALL_DIR="/opt/openMur"

echo "==> Stopping any running openMur processes…"
pkill -f '/opt/openMur/' 2>/dev/null || true
pkill -f "${ROOT}/node_modules/electron/dist/electron" 2>/dev/null || true
pkill -f "${ROOT}/resources/bin/whisper-server" 2>/dev/null || true
pkill -f "${ROOT}/resources/bin/linux-key-listener" 2>/dev/null || true
sleep 1

echo "==> Removing dev launchers (not the installed app)…"
rm -f "${HOME}/.local/share/applications/open-mur.desktop"
rm -f "${HOME}/.config/autostart/openmur-dictation.desktop"
rm -f "${HOME}/.config/autostart/srbwhispr-dictation.desktop"
update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true

echo "==> Uninstalling old packages…"
sudo apt-get purge -y open-mur open-whispr srbwhispr 2>/dev/null || true
sudo rm -rf /opt/openMur /opt/openmur /usr/local/bin/openmur 2>/dev/null || true

echo "==> Resetting app config (keeps downloaded Whisper models in ~/.cache/openmur)…"
rm -rf "${HOME}/.config/openmur"
rm -rf "${HOME}/.config/open-mur"
rm -f "${HOME}/.config/openmur-flags.conf" "${HOME}/.config/open-mur-flags.conf"

echo "==> Building fresh .deb (renderer + pack, no dev server)…"
cd "${ROOT}"
npm run sync:icons
npm run build:local:deb

if [[ ! -f "${DEB}" ]]; then
  echo "ERROR: Expected ${DEB} — build may have used a different version."
  ls -la "${ROOT}/dist/"*.deb 2>/dev/null || true
  exit 1
fi

echo "==> Installing ${DEB}…"
sudo dpkg -i "${DEB}"
sudo apt-get install -f -y

echo "==> Fixing Electron sandbox (required for launch from app menu)…"
if [[ -f "${INSTALL_DIR}/chrome-sandbox" ]]; then
  sudo chown root:root "${INSTALL_DIR}/chrome-sandbox"
  sudo chmod 4755 "${INSTALL_DIR}/chrome-sandbox"
fi
if [[ -x "${INSTALL_DIR}/openmur" ]]; then
  sudo ln -sf "${INSTALL_DIR}/openmur" /usr/local/bin/openmur
fi

echo ""
echo "Done. IMPORTANT:"
echo "  1. Remove the old openMur icon from your dash/taskbar (right-click → Unpin)."
echo "  2. Open the app once from the app menu: Applications → openMur"
echo "  3. Pin it again from the running app or menu."
echo ""
echo "Test from terminal:  /opt/openMur/openmur"
echo "Or:                openmur"
