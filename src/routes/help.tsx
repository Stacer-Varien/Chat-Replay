import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Download, ExternalLink, FileArchive, ShieldCheck } from "lucide-react";

import { CopyrightLabel } from "@/components/CopyrightLabel";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "ChatGPT Export Viewer Help" },
      {
        name: "description",
        content:
          "Steps for downloading your ChatGPT export ZIP from ChatGPT or the OpenAI Privacy Portal.",
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
            How to get your ChatGPT Export ZIP
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            This app reads the ZIP file in your browser. Nothing gets uploaded to the server. You
            can use the export from ChatGPT itself, or request the same data through OpenAI's
            Privacy Portal.
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

        <section className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground sm:p-5">
          <h2 className="mb-2 font-semibold text-foreground">Before you upload it here</h2>
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
