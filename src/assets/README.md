# Assets Directory

This directory contains app icons and other assets for openMur.

## Required Icons

For proper app packaging, you'll need the following icon files:

- `icon.icns` - macOS icon (1024x1024 recommended)
- `icon.ico` - Windows icon (256x256 recommended)
- `icon.png` - Linux icon (512x512 recommended)

## Icon Specifications

- **macOS (.icns)**: 1024x1024 pixels, PNG format converted to ICNS
- **Windows (.ico)**: 256x256 pixels, PNG format converted to ICO
- **Linux (.png)**: 512x512 pixels, PNG format

## Creating Icons

You can create these icons using:

- Online converters like https://convertio.co/
- Design tools like Figma, Sketch, or Photoshop
- Command line tools like ImageMagick

## Updating the app icon

1. Replace `src/helpers/assets/openMurIcon.png` with your artwork.
2. Run `npm run sync:icons` (also runs automatically via `npm run prepare:local` / `predev`).

This writes `icon.png` (512×512), `icon-256.png`, and `icon-128.png` in this folder. **Local dev and KDE taskbar load `src/assets/icon.png`**, not the 2000px source file.
