# Chat Replay

A local-first viewer for ChatGPT export data. Upload your ChatGPT or OpenAI privacy export ZIP file, browse your conversations, search messages, and review your history without sending your data anywhere else.

## What this app does

Chat Replay helps you:

- open ChatGPT export ZIP files, direct Conversations ZIP files, and conversations JSON files
- browse your saved conversations locally in the browser
- search and filter messages by text, author, and date
- view rich Markdown content with readable formatting
- export the current conversation view to PDF
- run as a desktop app with Electron, or as a web app for Vercel / local hosting

## Why it exists

This app is designed for privacy and convenience:

- all parsing happens on your device
- nothing is uploaded to a server during normal use
- it is suitable for personal archive viewing and offline review

## Features

- Local import and parsing of ChatGPT/OpenAI export data
- Conversation list with quick navigation
- Search and filtering for titles and messages
- Markdown rendering for readable chat content
- PDF export for the visible conversation view
- Browser, Vercel, and Electron build support

## Supported input formats

The app accepts:

- ChatGPT export ZIP files
- OpenAI Privacy Portal export ZIP files
- direct Conversations ZIP files
- conversations JSON files

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

## Release notes

When publishing GitHub Releases, you can include both:

- Installer version (recommended for most users)
- Portable version (for users who prefer a no-install executable or folder-based setup)

This makes the release easier to use for both standard desktop installs and portable workflows.

## Project structure

- src/ — application UI, routes, and chat viewer logic
- electron/ — Electron entry points
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
