import { useEffect, useState, type ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearOnlineImageCache,
  initializeOnlineImages,
  setOnlineImagesEnabled,
} from "@/lib/online-images";
import {
  OnlineImageSettingsContext,
  useImageSettings,
  useOpenImageSettings,
} from "@/lib/online-image-context";

export function OnlineImageSettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const state = useImageSettings();
  useEffect(() => {
    void initializeOnlineImages();
    const close = () => setOpen(false);
    window.addEventListener("chat-replay:close-image-settings", close);
    return () => window.removeEventListener("chat-replay:close-image-settings", close);
  }, []);
  return (
    <OnlineImageSettingsContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-online-image-settings
          className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-auto rounded-xl sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Online images</DialogTitle>
            <DialogDescription>
              Find similar images for missing ChatGPT image descriptions, then keep them on this
              device for offline viewing.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            When enabled, descriptions of nearby missing images are sent to Wikimedia Commons. Your
            full chats are not uploaded. Results are replacements and may differ from the originals.
          </p>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3 text-sm font-medium">
            Download nearby images automatically
            <input
              type="checkbox"
              role="switch"
              checked={state.enabled}
              disabled={!state.loaded || busy}
              onChange={(event) => void setOnlineImagesEnabled(event.target.checked)}
              className="h-5 w-5 shrink-0 accent-primary"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Cached images: {state.count} · {(state.bytes / 1048576).toFixed(1)} MB of 100 MB.
            Turning downloads off keeps cached images available.
          </p>
          <button
            type="button"
            disabled={busy || !state.loaded}
            onClick={async () => {
              setBusy(true);
              try {
                await clearOnlineImageCache();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {busy ? "Clearing…" : "Clear cache and turn off"}
          </button>
          {state.error && (
            <p role="status" className="text-sm text-muted-foreground">
              {state.error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </OnlineImageSettingsContext.Provider>
  );
}
export function OnlineImageSettingsButton({
  className = "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm hover:bg-accent",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const open = useOpenImageSettings();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
        open();
      }}
      aria-label="Online images"
      title="Online images"
      className={className}
    >
      <ImageIcon className="h-4 w-4 shrink-0" />
      <span className={compact ? "hidden sm:inline" : undefined}>Online images</span>
    </button>
  );
}
