# Update notes

## 1.6.0 — Unreleased

### Added

- Rich ChatGPT layouts, including boxes, titles, rows, badges and image groups.
- Draft cards for `<writingblock>` and `:::writing`, with Markdown formatting and Copy draft.
- Optional online image replacements from Wikimedia Commons, with creator, licence and source
  credits. Enable once to download nearby images automatically and keep them for offline viewing.
- Image cache controls, a 100 MiB limit, and cached images in conversation PDF exports.
- A sample archive and direct access to export instructions for first-time users.
- A separate signed Android Preview app that preserves the regular app and its saved chats.

### Improved

- Large exports parse in a background worker with progress and cancellation.
- ZIP contents and attachments are read on demand rather than loading the whole archive into memory.
- Chat and result lists render only the items needed on screen. Saved collections open chats on demand
  and reuse compressed search indexes.
- Redesigned library, conversation reader, mobile menu and app logo.
- Clearer search filters and recovery from empty results while keeping the search text.
- Closing an archive is separate from deleting a named saved collection.
- PDF export includes the complete selected conversation path, draft cards and rich layouts.

### Compatibility

- Existing saved collections work without re-importing their message text.
- Online images are optional replacements; the export often contains descriptions instead of the
  original image URLs. Images already present in the export take priority.
- Android displays version 1.6.0 and uses internal version code 171 so it can update earlier local
  Preview builds. The original installed app and its data remain separate.
- Browser/Vercel, Windows installer and portable EXE, and signed Android APK builds are provided.
