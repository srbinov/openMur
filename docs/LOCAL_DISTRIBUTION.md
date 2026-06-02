# openMur — distributing the local dictation build

This repo is the **local-only** openMur fork (`LOCAL_ONLY=true`): Whisper on your machine, optional BYOK AI cleanup. No cloud account required for dictation.

## Security (read this first)

- **Never commit API keys.** Copy `.env.example` to `.env` locally only; `.env` is gitignored.
- **Do not bundle `.env` in installers.** `electron-builder.local.json` does not ship `.env`.
- Keys are stored per-user via Electron `safeStorage` under `~/.config/openmur/secure-keys/` (or your OS keyring).
- Before publishing, run: `npm run check:secrets`
- If a key was ever committed to git, **revoke it** in the provider console and create a new one.

## Build installable files (Linux)

Requires Node.js 24+ and build tools (`convert` from ImageMagick, or Python PIL for icons).

```bash
git clone <your-repo-url>
cd openwhispr   # or your fork directory
npm ci
npm run sync:icons
npm run build:local:deb      # → dist/openmur-<version>-linux-amd64.deb
npm run build:local:appimage # → dist/openmur-<version>-linux-amd64.AppImage
```

Install on Debian/Ubuntu:

```bash
sudo dpkg -i dist/openmur-*-linux-amd64.deb
sudo apt-get install -f -y
sudo chown root:root /opt/openMur/chrome-sandbox
sudo chmod 4755 /opt/openMur/chrome-sandbox
```

## Publish for anyone to download (GitHub Releases)

1. Push this repo to GitHub (public or private).
2. Tag a release: `git tag v1.7.2 && git push origin v1.7.2`
3. Use the workflow **Release (local dictation)** (`.github/workflows/release-local.yml`) or run the build locally and upload artifacts manually.
4. On GitHub: **Releases → Draft new release → attach** `.deb` and/or `.AppImage` from `dist/`.
5. Users download from the release page — no dev server, no `npm run dev`.

### Manual upload (no CI)

```bash
npm run build:local:deb
gh release create v1.7.2 dist/openmur-1.7.2-linux-amd64.deb \
  --title "openMur 1.7.2" \
  --notes "Local dictation build. Install .deb on Ubuntu/Debian."
```

## What users need

| Feature | Requirement |
|--------|-------------|
| Dictation (local Whisper) | Microphone, ~150MB+ for `base` model (downloaded on first run) |
| AI text cleanup | Optional — user adds their own API key in Settings |
| Global hotkey (Linux) | `linux-key-listener` binary (bundled); Wayland may need X11 mode |
| Auto-paste (Linux) | `xdotool`, `wtype`, or `ydotool` |

## Open source checklist

- [ ] `npm run check:secrets` passes
- [ ] No `.env` in git or in `dist/` artifacts
- [ ] `LICENSE` file present (project uses upstream openMur license)
- [ ] README explains local vs full openMur product
- [ ] GitHub Release with built `.deb` / `.AppImage` (not source-only)

## Full openMur (cloud, meetings, notes)

The upstream [openMur/openmur](https://github.com/openMur/openmur) project includes cloud features, meetings, and Qdrant semantic search. This fork strips those for a smaller local dictation app.
