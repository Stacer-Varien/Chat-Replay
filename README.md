# Chat Replay

A local-first viewer for ChatGPT, Claude, and Gemini export data. Open your export ZIP file, browse your conversations, search messages, and review your history without uploading the export.

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
- exports stay on your device; optional online image lookups send image descriptions to Wikimedia Commons
- it is suitable for personal archive viewing and offline review

## Features

- Local import and parsing of ChatGPT/OpenAI, Claude, and Gemini export data
- Conversation list with quick navigation
- Search and filtering for titles and messages
- Markdown rendering for readable chat content
- Draft cards and safe ChatGPT layouts, including nested boxes, rows, and badges
- Background import and indexed search, with chats and attachments opened on demand
- Optional Wikimedia image replacements, downloaded nearby and cached for offline viewing
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

### Production checks and web builds

```bash
npm run typecheck
npm run lint
npm run build
npm run build:vercel
```

`build` creates the default web output. `build:vercel` creates `.vercel/output` for Vercel.
The desktop and Android commands below select their own build targets automatically.

### Windows desktop release build

```bash
npm run electron:build
```

This produces both `Chat Replay-Setup-1.6.0-x64.exe` and
`Chat Replay-Portable-1.6.0-x64.exe` in the `release` folder on a Windows x64 build. Code signing
is recommended before public distribution.

### Vercel deployment

The included `vercel.json` runs the server-rendered Vercel build automatically. Import the Git
repository into Vercel or deploy from the CLI:

```bash
npx vercel --prod
```

Vercel uses `npm ci` with the checked-in lockfile for a reproducible install.

### Android app

Install Android Studio with its Android SDK and JDK 21. Select the JDK in PowerShell before
building (replace the example path with your JDK 21 installation):

```powershell
$env:JAVA_HOME = "C:\path\to\jdk-21"
```

Then run:

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

The APK is written to `android/app/build/outputs/apk/standard/debug/app-standard-debug.apk`.

For a publishable signed release, copy `android/keystore.properties.example` to
`android/keystore.properties`, replace all four placeholder values, and keep the keystore outside
Git. `RELEASE_STORE_FILE` is relative to the `android` directory, so the example keystore belongs
at `android/release-keystore.jks`. The same `RELEASE_*` values can be supplied as CI environment
variables or Gradle properties. Then build either:

```bash
npm run android:build:release
npm run android:bundle:release
```

The signed APK is written to `android/app/build/outputs/apk/standard/release/app-standard-release.apk`;
the Android App Bundle is written to `android/app/build/outputs/bundle/standardRelease/app-standard-release.aab`.

`npm run android:build:preview` builds a separate **Chat Replay Preview** app. Its package is
`com.chatreplay.viewer.preview`, so it preserves the regular app and its saved collections.
Only Preview enables WebView inspection for device testing; the standard release does not.
Both display version 1.6.0. Android version code 171 preserves update compatibility with the
earlier local Preview builds that used code 170.

On this Windows release machine, `scripts/build-android-release.ps1 -JdkPath <JDK-21-path>`
builds both signed APKs using the existing key and Windows-encrypted password under
`%LOCALAPPDATA%\ChatReplay\release-signing`. These files stay outside the repository.

The Android app has the same installed-app backup flow as Electron: imports open temporarily, and
users can explicitly save named chat collections, reopen them later, replace older copies with a
newer export, or delete them. Saved data remains in the app's private local storage. Export PDF
opens Android's native print dialog, where the conversation can be saved as a PDF.
Saved conversations open from their local cache immediately; archives are read again only when
attachments need to be restored or a damaged cache needs recovery. Existing Android collections
remain available after the local storage upgrade.

## Release notes

See [CHANGELOG.md](CHANGELOG.md) for the unpublished 1.6.0 update notes.

### Optional online images

Open **Online images** in the library or conversation menu to enable downloads once. Descriptions
from missing ChatGPT `<AsyncImage>` tags are sent directly to Wikimedia Commons to find similar
images; full chats are not uploaded. Results are labelled as replacements with source and licence
information, and may differ from the original ChatGPT images. Some descriptions have no match.

Only nearby images download, with two jobs at a time. Images are cached on the device for offline
viewing, up to 100 MiB, with older unused entries removed as needed. Turning downloads off keeps
cached images. **Clear cache and turn off** removes them. PDF export uses already cached images
without downloading more. No account, API key or image proxy is required.

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
