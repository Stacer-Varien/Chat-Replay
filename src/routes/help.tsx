import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Database,
  Download,
  ExternalLink,
  FileArchive,
  FileWarning,
  GitBranch,
  ShieldCheck,
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
          "Steps for downloading supported ChatGPT, OpenAI Privacy Portal, and Gemini Google Takeout exports.",
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

const geminiSteps = [
  "Open Google Takeout and deselect all products.",
  "Select My Activity and make sure Gemini Apps activity is included.",
  "Keep the activity format as HTML.",
  "Create the export and download the ZIP file when Google finishes preparing it.",
  "Import the Takeout ZIP that contains My Activity/Gemini Apps/MyActivity.html.",
];

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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How to get your chat export
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            This app reads the ZIP file in your browser. Nothing gets uploaded to the server. You
            can import ChatGPT/OpenAI exports or Gemini Apps activity from Google Takeout.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 text-card-foreground sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">From ChatGPT</h2>
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
                <h2 className="font-semibold">From the Privacy Portal</h2>
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

        <section className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm leading-6 sm:p-5">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <h2 className="font-semibold text-foreground">Missing ChatGPT-generated files</h2>
              <p className="mt-1 text-muted-foreground">
                OpenAI exports sometimes omit images, videos, documents, and other files generated
                inside ChatGPT. Chat Replay can only display files that OpenAI actually includes in
                the export ZIP. If a generated file is absent from the ZIP, it will also be absent
                here.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 text-sm leading-6 text-card-foreground sm:p-5">
          <div className="flex items-start gap-3">
            <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">Branched ChatGPT chats</h2>
              <p className="mt-1 text-muted-foreground">
                Like ChatGPT, Chat Replay keeps original and branched chats as separate
                conversations. A branched chat includes the inherited conversation up to its branch
                point, followed by its own continuation, and links let you move between related
                chats. Backups containing many or very large branched chats can take longer to load
                because those chats often repeat much of the original conversation.
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
              <h2 className="font-semibold">From Gemini with Google Takeout</h2>
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
            Google Takeout stores Gemini data differently from ChatGPT exports and does not reliably
            show which activity entries belong to the same conversation. Because of this, Chat
            Replay displays each Gemini prompt and assistant response as its own chat instead of
            grouping multiple messages into one full conversation.
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
