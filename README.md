<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/openMur-logo-light-text.png">
    <source media="(prefers-color-scheme: light)" srcset="src/assets/openMur-logo-dark-text.png">
    <img src="src/assets/openMur-logo-dark-text.png" alt="openMur" width="300">
  </picture>
</p>

<p align="center">
  <img src="src/helpers/assets/openMurIcon.png" alt="" width="72" height="72">
</p>

<p align="center">
  <strong>Local-first voice dictation for your desktop.</strong><br>
  Press a hotkey, speak, get text — Whisper runs on your machine.
</p>

<p align="center">
  <a href="https://github.com/srbinov/openMur/blob/main/LICENSE"><img src="https://img.shields.io/github/license/srbinov/openMur?style=flat&color=889eff&labelColor=1a1826" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey?style=flat" alt="Platform">
  <img src="https://img.shields.io/badge/Whisper-local-889eff?style=flat&labelColor=1a1826" alt="Local Whisper">
  <img src="https://img.shields.io/badge/account-not%20required-success?style=flat" alt="No account">
</p>

<p align="center">
  <a href="https://github.com/srbinov/openMur/releases">Download</a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#install">Install</a>
  ·
  <a href="#build-from-source">Build</a>
  ·
  <a href="docs/LOCAL_DISTRIBUTION.md">Publish</a>
</p>

---

## What is openMur?

**openMur** is a privacy-first dictation app. Hold a global hotkey, talk, and your words are transcribed **locally** with [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — your audio never leaves your device.

No cloud account. No telemetry. Optional AI text cleanup if **you** bring your own API key.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/openMur-logo-light-text.png">
    <img src="src/assets/openMur-logo-dark-text.png" alt="openMur wordmark" width="220">
  </picture>
</p>

## Features

| | |
|---|---|
| **Local transcription** | Whisper runs on-device; models download on first use |
| **Global hotkey** | Push-to-talk or tap-to-talk from any app |
| **Dictation pill** | Minimal overlay while you speak |
| **Auto-paste** | Inserts text at your cursor (Linux: `xdotool` / `wtype` / `ydotool`) |
| **History** | Recent dictations kept locally (auto-expire after 5 minutes) |
| **Optional AI cleanup** | Polish text with your own OpenAI, Anthropic, or Gemini key — off by default |
| **Cross-platform** | Linux, macOS, and Windows (Electron) |

## Install

### Linux (recommended)

Download the latest **`.deb`** or **AppImage** from [Releases](https://github.com/srbinov/openMur/releases).

```bash
# Debian / Ubuntu
sudo dpkg -i openmur-*-linux-amd64.deb
sudo apt-get install -f -y

# Required for Electron on some systems
sudo chown root:root /opt/openMur/chrome-sandbox
sudo chmod 4755 /opt/openMur/chrome-sandbox
```

Launch **openMur** from your app menu, or run:

```bash
openmur
```

### macOS & Windows

Build installers locally (see below) or check [Releases](https://github.com/srbinov/openMur/releases) when available.

## Build from source

Requires **Node.js 24+** ([`.nvmrc`](.nvmrc)).

```bash
git clone https://github.com/srbinov/openMur.git
cd openMur
npm ci
npm run sync:icons
npm run build:local:deb        # Linux .deb
npm run build:local:appimage   # Linux AppImage
```

Output: `dist/openmur-*.{deb,AppImage}`

See [docs/LOCAL_DISTRIBUTION.md](docs/LOCAL_DISTRIBUTION.md) for publishing releases and CI.

### Verify no secrets before publishing

```bash
npm run check:secrets
```

API keys belong in **Settings** (stored encrypted on your machine), never in the repo.

## First run

1. Grant **microphone** access when prompted.
2. Pick a **hotkey** in Settings → Hotkeys (default: `` ` `` on Windows/Linux, configurable on GNOME/Hyprland).
3. Hold the hotkey, speak, release — text appears at your cursor.

On **Linux Wayland**, the app uses XWayland for reliable overlay positioning.

## Tech stack

React 19 · TypeScript · Tailwind CSS v4 · Electron 41 · whisper.cpp · better-sqlite3

## Contributing

Issues and pull requests welcome on [github.com/srbinov/openMur](https://github.com/srbinov/openMur).

## License

[MIT](LICENSE) — free for personal and commercial use.

Based on [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT, Copyright (c) 2024 OpenWhispr Team). openMur is a local-first fork maintained independently.

## Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) & [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — on-device speech recognition
- [Electron](https://www.electronjs.org/) — cross-platform desktop shell
- [React](https://react.dev/) & [shadcn/ui](https://ui.shadcn.com/) — UI
