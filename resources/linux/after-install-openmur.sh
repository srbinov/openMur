#!/bin/bash
# Post-install script for openMur (deb/rpm)

set -euo pipefail

INSTALL_DIR="/opt/openMur"
if [ ! -d "$INSTALL_DIR" ]; then
  INSTALL_DIR="/opt/openmur"
fi

CHROME_SANDBOX=""
for pkg in open-mur openmur openMur; do
  CHROME_SANDBOX=$(dpkg -L "$pkg" 2>/dev/null | grep -E '/chrome-sandbox$' | head -1 || true)
  [ -n "$CHROME_SANDBOX" ] && break
done
if [ -z "$CHROME_SANDBOX" ]; then
  CHROME_SANDBOX="$INSTALL_DIR/chrome-sandbox"
fi
if [ -f "$CHROME_SANDBOX" ]; then
  chown root:root "$CHROME_SANDBOX"
  chmod 4755 "$CHROME_SANDBOX"
fi

if [ -x "$INSTALL_DIR/openmur" ]; then
  ln -sf "$INSTALL_DIR/openmur" /usr/local/bin/openmur 2>/dev/null || true
fi

UDEV_RULE='KERNEL=="uinput", GROUP="input", MODE="0660", TAG+="uaccess"'
UDEV_RULE_PATH="/etc/udev/rules.d/70-uinput.rules"
SERVICE_PATH="/usr/lib/systemd/user/ydotoold.service"

REAL_USER="${SUDO_USER:-}"
if [ -z "$REAL_USER" ] || [ "$REAL_USER" = "root" ]; then
  REAL_USER=$(logname 2>/dev/null || echo "")
fi

if [ ! -f "$UDEV_RULE_PATH" ] || ! grep -q uinput "$UDEV_RULE_PATH" 2>/dev/null; then
  echo "$UDEV_RULE" > "$UDEV_RULE_PATH"
  udevadm control --reload-rules 2>/dev/null || true
  udevadm trigger /dev/uinput 2>/dev/null || true
fi

if [ -n "$REAL_USER" ]; then
  if ! id -nG "$REAL_USER" 2>/dev/null | grep -qw input; then
    usermod -aG input "$REAL_USER" 2>/dev/null || true
  fi
fi

if [ ! -f "$SERVICE_PATH" ] && [ ! -f "/usr/lib/systemd/user/ydotool.service" ]; then
  YDOTOOLD_BIN=$(command -v ydotoold 2>/dev/null || echo "/usr/bin/ydotoold")
  if [ -x "$YDOTOOLD_BIN" ] || [ -f "$YDOTOOLD_BIN" ]; then
    mkdir -p "$(dirname "$SERVICE_PATH")"
    cat > "$SERVICE_PATH" << SERVICEEOF
[Unit]
Description=ydotoold - ydotool daemon
After=graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStartPre=/usr/bin/sleep 2
ExecStart=$YDOTOOLD_BIN
Restart=on-failure
RestartSec=1s

[Install]
WantedBy=graphical-session.target
SERVICEEOF
  fi
fi

if [ -n "$REAL_USER" ]; then
  REAL_UID=$(id -u "$REAL_USER" 2>/dev/null || echo "")
  if [ -n "$REAL_UID" ]; then
    export XDG_RUNTIME_DIR="/run/user/$REAL_UID"
    if [ -d "$XDG_RUNTIME_DIR" ]; then
      SERVICE_NAME=""
      if [ -f "/usr/lib/systemd/user/ydotoold.service" ]; then
        SERVICE_NAME="ydotoold"
      elif [ -f "/usr/lib/systemd/user/ydotool.service" ]; then
        SERVICE_NAME="ydotool"
      fi
      if [ -n "$SERVICE_NAME" ]; then
        su - "$REAL_USER" -c "XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR systemctl --user daemon-reload" 2>/dev/null || true
        su - "$REAL_USER" -c "XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR systemctl --user enable $SERVICE_NAME" 2>/dev/null || true
      fi
    fi
  fi
fi

exit 0
