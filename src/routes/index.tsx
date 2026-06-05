import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImportDropzone } from "@/components/chat/ImportDropzone";
import { Sidebar } from "@/components/chat/Sidebar";
import { ConversationView } from "@/components/chat/ConversationView";
import { computeChain, type Conversation, type ParsedChatGPTExport } from "@/lib/chatgpt-import";
import type { DesktopBackupSummary } from "@/types/electron";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChatGPT Export Viewer" },
      {
        name: "description",
        content:
          "Upload your ChatGPT Export ZIP file and browse it locally in your browser. Nothing gets uploaded to the server.",
      },
      { property: "og:title", content: "ChatGPT Export Viewer" },
      {
        property: "og:description",
        content:
          "Browse your exported ChatGPT history locally in your browser. Nothing gets uploaded to the server.",
      },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "chatgpt-archive-v1";

type ImportedFile = ParsedChatGPTExport & {
  file: File;
  permissionConfirmed: boolean;
};

function hasRenderableAssistantMessages(conversations: Conversation[]) {
  const hasAssistantNodes = conversations.some((conversation) =>
    Object.values(conversation.nodes).some((node) => node.role === "assistant"),
  );
  if (!hasAssistantNodes) return false;

  return conversations.some((conversation) =>
    computeChain(conversation, {}).some((item) => item.node.role === "assistant"),
  );
}

function Index() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopBackups, setDesktopBackups] = useState<DesktopBackupSummary[]>([]);
  const [activeBackup, setActiveBackup] = useState<DesktopBackupSummary | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDesktop() {
      const api = window.chatReplayDesktop;
      if (!api) return false;

      const backups = await api.listBackups();
      if (cancelled) return true;
      setDesktopBackups(backups);

      const first = backups[0];
      if (first) {
        const loaded = await api.loadBackup(first.id);
        if (cancelled) return true;
        if (hasRenderableAssistantMessages(loaded.conversations)) {
          setConversations(loaded.conversations);
          setActiveId(loaded.conversations[0]?.id ?? null);
          setActiveBackup(loaded.backup);
        }
      }

      return true;
    }

    async function hydrate() {
      try {
        if (await hydrateDesktop()) return;

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Conversation[];
          if (Array.isArray(parsed) && parsed.length) {
            if (hasRenderableAssistantMessages(parsed)) {
              setConversations(parsed);
              setActiveId(parsed[0].id);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          }
        }
      } catch {
        // ignore bad saved state
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshDesktopBackups() {
    const backups = (await window.chatReplayDesktop?.listBackups()) ?? [];
    setDesktopBackups(backups);
    return backups;
  }

  async function loadDesktopBackup(id: string) {
    const api = window.chatReplayDesktop;
    if (!api) return;

    setImportStatus(null);
    try {
      const loaded = await api.loadBackup(id);
      if (!hasRenderableAssistantMessages(loaded.conversations)) {
        throw new Error("This saved backup has no readable assistant messages.");
      }
      setConversations(loaded.conversations);
      setActiveId(loaded.conversations[0]?.id ?? null);
      setActiveBackup(loaded.backup);
      setMobileSidebarOpen(false);
    } catch (e) {
      setImportStatus(e instanceof Error ? e.message : "Failed to open saved backup.");
    }
  }

  async function handleLoaded(imported: ImportedFile) {
    const api = window.chatReplayDesktop;
    setImportStatus(null);

    if (api) {
      const result = await api.importBackup({
        fileName: imported.file.name,
        archiveData: await imported.file.arrayBuffer(),
        conversations: imported.conversations,
        permissionConfirmed: imported.permissionConfirmed,
        metadata: imported.metadata,
      });
      await refreshDesktopBackups();
      await loadDesktopBackup(result.backup.id);
      setImportStatus(
        result.action === "kept-existing"
          ? "An equal or newer version of this backup is already saved."
          : result.action === "replaced"
            ? "Saved backup updated with the newer export."
            : "Backup saved in the desktop app.",
      );
      return;
    }

    setConversations(imported.conversations);
    setActiveId(imported.conversations[0]?.id ?? null);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(imported.conversations, (key, value) => (key === "url" ? null : value)),
      );
    } catch {
      // ignore quota errors
    }
  }

  async function handleClear() {
    const api = window.chatReplayDesktop;
    if (api && activeBackup) {
      if (!confirm(`Remove "${activeBackup.originalFileName}" from this desktop app?`)) return;
      await api.deleteBackup(activeBackup.id);
      const backups = await refreshDesktopBackups();
      setConversations(null);
      setActiveId(null);
      setActiveBackup(null);
      setMobileSidebarOpen(false);
      if (backups[0]) await loadDesktopBackup(backups[0].id);
      return;
    }

    if (!confirm("Clear all imported conversations from this browser?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setConversations(null);
    setActiveId(null);
    setActiveBackup(null);
    setMobileSidebarOpen(false);
  }

  function handleReimport() {
    setConversations(null);
    setActiveBackup(null);
    setImportStatus(null);
    setMobileSidebarOpen(false);
  }

  function handleSelect(id: string) {
    setActiveId(id);
    setMobileSidebarOpen(false);
  }

  if (!hydrated) return null;

  if (!conversations) {
    return (
      <ImportDropzone
        onLoaded={handleLoaded}
        desktop={Boolean(window.chatReplayDesktop)}
        savedBackups={desktopBackups}
        onLoadBackup={loadDesktopBackup}
        importStatus={importStatus}
      />
    );
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-dvh min-h-dvh w-full overflow-hidden bg-background text-foreground">
      <button
        type="button"
        aria-label="Close conversation list"
        aria-hidden={!mobileSidebarOpen}
        tabIndex={mobileSidebarOpen ? 0 : -1}
        onClick={() => setMobileSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity md:hidden ${
          mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onReimport={handleReimport}
        onClear={handleClear}
        onRequestClose={() => setMobileSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-1rem))] shadow-xl transition-transform duration-200 sm:w-80 md:static md:z-auto md:w-72 md:translate-x-0 md:shadow-none lg:w-80 ${
          mobileSidebarOpen
            ? "visible translate-x-0 pointer-events-auto"
            : "invisible -translate-x-full pointer-events-none md:visible md:pointer-events-auto"
        }`}
      />
      <main className="min-w-0 flex-1 overflow-hidden">
        <ConversationView conversation={active} onOpenSidebar={() => setMobileSidebarOpen(true)} />
      </main>
    </div>
  );
}
