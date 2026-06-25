import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  Database,
  Download,
  ExternalLink,
  FileArchive,
  FileJson2,
  FileWarning,
  GitBranch,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { CopyrightLabel } from "@/components/CopyrightLabel";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Chat Replay Help" },
      {
        name: "description",
        content:
          "A visual guide to importing and browsing AI chat exports, plus steps for downloading supported ChatGPT, Claude, and Gemini data.",
      },
    ],
  }),
  component: Help,
});

const chatGptSteps = [
  "Sign in to ChatGPT.",
  "Open your profile menu.",
  "Go to Settings.",
  "Open Data Controls.",
  "Under Export Data, choose Export.",
  "Confirm the export request.",
  "Open the message from OpenAI and download the ZIP file.",
];

const privacyPortalSteps = [
  "Open the OpenAI Privacy Portal.",
  "Choose Make a Privacy Request.",
  "Select that you have a consumer ChatGPT account.",
  "Choose Download my data.",
  "Follow the verification steps and download the ZIP file when it arrives.",
];

const claudeSteps = [
  "Open Claude on the web or in Claude Desktop. Claude does not allow export requests from its iOS or Android apps.",
  "Click your initials in the lower-left corner and select Settings.",
  "Open the Privacy section.",
  "Click Export data.",
  "Wait for the email from Claude, then open its download link while signed in.",
  "Download the ZIP within 24 hours and import that ZIP directly into Chat Replay.",
];

const geminiSteps = [
  "Open Google Takeout and deselect all products.",
  "Select My Activity and make sure Gemini Apps activity is included.",
  "Keep the activity format as HTML.",
  "Create the export and download the ZIP file when Google finishes preparing it.",
  "Import the Takeout ZIP that contains My Activity/Gemini Apps/MyActivity.html.",
];

interface HelpScreenshotProps {
  src: string;
  alt: string;
  caption: string;
}

function HelpScreenshot({ src, alt, caption }: HelpScreenshotProps) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-muted/30 shadow-sm">
      <div className="overflow-hidden border-b bg-background">
        <img
          src={src}
          alt={alt}
          width={1280}
          height={820}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
      <figcaption className="px-3 py-2.5 text-xs leading-5 text-muted-foreground sm:px-4">
        {caption}
      </figcaption>
    </figure>
  );
}

function Help() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <section className="max-w-3xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileArchive className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Chat Replay help</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Import an AI chat export and read it in a clean, familiar conversation layout. Chat
            Replay processes the file on your device, so nothing gets uploaded to the server.
          </p>
        </section>

        <section aria-labelledby="using-chat-replay" className="space-y-6">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              Quick start
            </p>
            <h2
              id="using-chat-replay"
              className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
            >
              How to use Chat Replay
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              Once you have downloaded your export, opening it takes three simple steps. Your
              original ZIP or JSON file is only read—it is not changed.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.7fr)] md:items-center">
            <div className="rounded-xl border bg-card p-4 text-card-foreground sm:p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                1
              </div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Choose your export</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Click the upload area or drag in a supported ZIP or JSON export. Chat Replay reads
                the conversations locally on your device.
              </p>
            </div>
            <HelpScreenshot
              src="/help/import-export.webp"
              alt="Chat Replay upload screen with a large area for choosing or dropping a chat export"
              caption="Choose the downloaded export file or drag it onto the upload area."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.7fr)] md:items-center">
            <div className="rounded-xl border bg-card p-4 text-card-foreground sm:p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                2
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Browse and search</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pick a title from the sidebar, search titles and messages, or filter by author and
                date. Messages appear in reading order with Markdown, lists, code, and tables
                formatted for you. Turn on all-variant search when you need older edited prompts or
                regenerated responses.
              </p>
            </div>
            <HelpScreenshot
              src="/help/organized-replay.webp"
              alt="A fictional hiking conversation organized in Chat Replay with chat titles in a sidebar and formatted messages in the main view"
              caption="Conversation titles stay together in the sidebar while the selected chat reads like the original AI app."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.7fr)] md:items-center">
            <div className="rounded-xl border bg-card p-4 text-card-foreground sm:p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                3
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Focus or export</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Move between branched replies, show only assistant messages, or export the current
                view as a PDF. In the installed app, use Save chats if you want to open the
                collection again later.
              </p>
            </div>
            <HelpScreenshot
              src="/help/search-filter.webp"
              alt="Chat Replay showing a search for checklist with the filter panel open beside the formatted conversation"
              caption="Search and filters find useful messages without digging through the export structure."
            />
          </div>
        </section>

        <section
          aria-labelledby="json-comparison"
          className="rounded-xl border bg-card p-4 text-card-foreground sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileJson2 className="h-5 w-5" />
            </div>
            <div className="max-w-3xl">
              <h2 id="json-comparison" className="text-xl font-semibold tracking-tight sm:text-2xl">
                JSON stores it. Chat Replay makes it readable.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                These screenshots show the same fictional conversation. Opening the JSON directly
                exposes nested fields, internal IDs, timestamps, metadata, and message branches all
                mixed together. That structure is useful to software, but awkward for a person to
                read.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <HelpScreenshot
              src="/help/raw-json.webp"
              alt="Raw conversations JSON filled with nested IDs, timestamps, message objects, metadata, and branch references"
              caption="Raw JSON: the message text is buried inside the export's storage structure."
            />
            <HelpScreenshot
              src="/help/organized-replay.webp"
              alt="The same fictional conversation reconstructed as an organized AI chat with a sidebar and formatted messages"
              caption="Chat Replay: the same data is reconstructed into titles, messages, branches, and readable formatting."
            />
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border bg-background/70 p-3">
              <span className="font-medium text-foreground">Find conversations quickly.</span>{" "}
              <span className="text-muted-foreground">
                Search message text and titles, then narrow results by author, date, or branch
                variant scope.
              </span>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <span className="font-medium text-foreground">Read the content, not the schema.</span>{" "}
              <span className="text-muted-foreground">
                Markdown, code, tables, attachments, and message roles are presented clearly.
              </span>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <span className="font-medium text-foreground">Keep conversation structure.</span>{" "}
              <span className="text-muted-foreground">
                Related branches and alternate replies remain navigable instead of becoming nested
                objects.
              </span>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <span className="font-medium text-foreground">Stay in control of the file.</span>{" "}
              <span className="text-muted-foreground">
                The source export is not altered, and its contents are not uploaded to Chat Replay.
              </span>
            </div>
          </div>
        </section>

        <section aria-labelledby="get-your-export" className="space-y-4">
          <div className="max-w-3xl">
            <h2 id="get-your-export" className="text-xl font-semibold tracking-tight sm:text-2xl">
              How to get your chat export
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              Chat Replay can import ChatGPT/OpenAI and Claude exports or Gemini Apps activity from
              Google Takeout. Follow the instructions for the service you used.
            </p>
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 text-card-foreground sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">From ChatGPT</h3>
                  <p className="text-sm text-muted-foreground">Use this when you can sign in.</p>
                </div>
              </div>
              <ol className="space-y-3 text-sm leading-6">
                {chatGptSteps.map((step) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                      {chatGptSteps.indexOf(step) + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm transition-colors hover:bg-accent"
              >
                Open ChatGPT
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="rounded-lg border bg-card p-4 text-card-foreground sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">From the Privacy Portal</h3>
                  <p className="text-sm text-muted-foreground">
                    Use this for privacy requests or account access issues.
                  </p>
                </div>
              </div>
              <ol className="space-y-3 text-sm leading-6">
                {privacyPortalSteps.map((step) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                      {privacyPortalSteps.indexOf(step) + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <a
                href="https://privacy.openai.com"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm transition-colors hover:bg-accent"
              >
                Open Privacy Portal
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 text-card-foreground sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">From Claude</h3>
                <p className="text-sm text-muted-foreground">
                  Export your Claude conversation history from the web app or Claude Desktop.
                </p>
              </div>
            </div>
            <ol className="grid gap-3 text-sm leading-6 md:grid-cols-2">
              {claudeSteps.map((step) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                    {claudeSteps.indexOf(step) + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-muted-foreground">
              Claude exports can list uploaded and generated file names inside{" "}
              <code className="font-mono text-foreground">conversations.json</code> without
              including the original image or document files. Chat Replay shows those file
              references in their messages, but cannot open or download a file that Claude omitted
              from the ZIP.
            </p>
            <a
              href="https://claude.ai/settings/privacy"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm transition-colors hover:bg-accent"
            >
              Open Claude Privacy settings
              <ExternalLink className="h-4 w-4" />
            </a>
          </section>

          <section className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm leading-6 sm:p-5">
            <div className="flex items-start gap-3">
              <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <div>
                <h3 className="font-semibold text-foreground">Missing ChatGPT-generated files</h3>
                <p className="mt-1 text-muted-foreground">
                  OpenAI exports sometimes omit images, videos, documents, and other files generated
                  inside ChatGPT. Chat Replay can only display files that OpenAI actually includes
                  in the export ZIP. If a generated file is absent from the ZIP, it will also be
                  absent here.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 text-sm leading-6 text-card-foreground sm:p-5">
            <div className="flex items-start gap-3">
              <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">Branched ChatGPT chats</h3>
                <p className="mt-1 text-muted-foreground">
                  Like ChatGPT, Chat Replay keeps original and branched chats as separate
                  conversations. A branched chat includes the inherited conversation up to its
                  branch point, followed by its own continuation, and links let you move between
                  related chats. Backups containing many or very large branched chats can take
                  longer to load because those chats often repeat much of the original conversation.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 text-card-foreground sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">From Gemini with Google Takeout</h3>
                <p className="text-sm text-muted-foreground">
                  Gemini conversations are stored as activity entries under My Activity.
                </p>
              </div>
            </div>
            <ol className="grid gap-3 text-sm leading-6 md:grid-cols-2">
              {geminiSteps.map((step) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                    {geminiSteps.indexOf(step) + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-muted-foreground">
              Google Takeout stores Gemini data differently from ChatGPT exports and does not
              reliably show which activity entries belong to the same conversation. Because of this,
              Chat Replay displays each Gemini prompt and assistant response as its own chat instead
              of grouping multiple messages into one full conversation.
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Chat Replay matches Gemini uploads and generated media to the activity entry that
              references them. Video activity may include an audio file and a related ZIP containing
              exported video frames; both are shown together.
            </p>
            <a
              href="https://takeout.google.com"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm transition-colors hover:bg-accent"
            >
              Open Google Takeout
              <ExternalLink className="h-4 w-4" />
            </a>
          </section>
        </section>

        <section className="rounded-lg border bg-card p-4 text-card-foreground sm:p-5">
          <div className="flex items-start gap-3">
            <Search className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Searching edited and regenerated variants</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The default search follows the visible conversation path. If you turn on all-variant
                search, Chat Replay also checks older edited prompts and regenerated responses, then
                opens the exact path where the match happened. Large exports with many branches can
                take longer to scan.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground sm:p-5">
          <h2 className="mb-2 font-semibold text-foreground">Before importing an OpenAI export</h2>
          <p>
            OpenAI sends the export link to your account email or phone number, and the link expires
            after 24 hours. If it does not arrive, check spam or promotions, then request a new
            export.
          </p>
        </section>
        <div className="flex justify-center">
          <CopyrightLabel />
        </div>
      </main>
    </div>
  );
}
