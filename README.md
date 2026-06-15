# Chat Replay

A local-first viewer for ChatGPT, Claude, and Gemini export data. Upload your export ZIP file, browse your conversations, search messages, and review your history without sending your data anywhere else.

## What this app does

Chat Replay helps you:

- open ChatGPT export ZIP files, direct Conversations ZIP files, and conversations JSON files
- browse your saved conversations locally in the browser
- search and filter messages by text, author, and date
- view rich Markdown content with readable formatting
- export the current conversation view to PDF
- run as an Android app with Capacitor, a desktop app with Electron, or a web app for Vercel / local hosting

## Why it exists

This app is designed for privacy and convenience:

- all parsing happens on your device
- nothing is uploaded to a server during normal use
- it is suitable for personal archive viewing and offline review

## Features

- Local import and parsing of ChatGPT/OpenAI, Claude, and Gemini export data
- Conversation list with quick navigation
- Search and filtering for titles and messages
- Markdown rendering for readable chat content
- PDF export for the visible conversation view
- Browser, Vercel, Electron, and Android build support

## Supported input formats

The app accepts:

- ChatGPT export ZIP files
- OpenAI Privacy Portal export ZIP files
- Claude export ZIP files containing `conversations.json`
- direct Conversations ZIP files
- conversations JSON files
- Gemini Apps activity from Google Takeout ZIP files

## Quick start

### Web / local development

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

### Electron desktop app

```bash
npm install
npm run electron:dev
```

### Production build

```bash
npm run build
```

### Windows desktop release build

```bash
npm run electron:build
```

This produces the desktop release output in the release folder.

### Android app

Install Android Studio with its Android SDK and Java Development Kit 21, then run:

```bash
npm run android:sync
npm run android:open
```

`android:sync` creates the offline web bundle and copies it into the native Android project.
`android:open` opens that project in Android Studio for emulator/device testing and signed APK or
Android App Bundle creation.

To regenerate Android icons and splash screens after changing `assets/icon.png`:

```bash
npm run android:assets
```

For an installable local debug APK:

```bash
npm run android:build
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

The Android app has the same installed-app backup flow as Electron: imports open temporarily, and
users can explicitly save named chat collections, reopen them later, replace older copies with a
newer export, or delete them. Saved data remains in the app's private local storage. Export PDF
opens Android's native print dialog, where the conversation can be saved as a PDF.

## Release notes

When publishing GitHub Releases, you can include both:

- Installer version (recommended for most users)
- Portable version (for users who prefer a no-install executable or folder-based setup)

This makes the release easier to use for both standard desktop installs and portable workflows.

## Project structure

- src/ — application UI, routes, and chat viewer logic
- electron/ — Electron entry points
- android/ — Capacitor Android Studio project
- capacitor.config.ts — Capacitor Android wrapper configuration
- release/ — packaged desktop build output

## Development notes

The app is built with:

- React + TypeScript
- Vite
- TanStack Router
- Electron
- Tailwind CSS

## License

This project is licensed under the terms in the [LICENSE](LICENSE) file.

See [LICENSE](LICENSE) for the full license text and usage terms.
