/**
 * Single switch for the local dictation product (openMur).
 *
 * This repository is the local-only fork. `npm run dev` and packaged builds
 * (electron-builder.local.json) run the same main process + renderer — only
 * dev uses the Vite server; production embeds the built assets.
 *
 * Renderer mirror: src/config/localOnlyMode.ts (keep LOCAL_ONLY in sync).
 */
module.exports = {
  LOCAL_ONLY: true,
  TRANSCRIPTION_RETENTION_MINUTES: 5,
};
