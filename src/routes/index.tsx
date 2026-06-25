import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ImportDropzone } from "@/components/chat/ImportDropzone";
import { LockGate } from "@/components/chat/LockGate";
import { Sidebar } from "@/components/chat/Sidebar";
import { ConversationView } from "@/components/chat/ConversationView";
import {
  computeChain,
  parseChatGPTExportWithMetadata,
  type Conversation,
  type ImportHealthReport,
  type ParsedChatGPTExport,
} from "@/lib/chatgpt-import";
import { getInstalledBackupApi } from "@/lib/installed-backups";
import type {
  InstalledBackupApi,
  InstalledBackupPayload,
  InstalledBackupSummary,
  InstalledLockState,
} from "@/types/installed-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chat Replay" },
      {
        name: "description",
        content:
          "Browse supported ChatGPT, OpenAI, Claude, and Gemini exports locally in your browser. Nothing gets uploaded to the server.",
      },
      { property: "og:title", content: "Chat Replay" },
      {
        property: "og:description",
        content:
          "Browse exported ChatGPT, Claude, and Gemini history locally in your browser. Nothing gets uploaded to the server.",
      },
    ],
  }),
  component: Index,
});

type ImportedFile = ParsedChatGPTExport & {
  file: File;
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

async function restoreInstalledConversations(
  loaded: InstalledBackupPayload,
): Promise<{ conversations: Conversation[]; report: ImportHealthReport | null }> {
  if (!loaded.archiveData) return { conversations: loaded.conversations, report: null };
  try {
    const source = new File([loaded.archiveData], loaded.backup.originalFileName);
    const parsed = await parseChatGPTExportWithMetadata(source);
    return hasRenderableAssistantMessages(parsed.conversations)
      ? { conversations: parsed.conversations, report: parsed.report }
      : { conversations: loaded.conversations, report: null };
  } catch {
    return { conversations: loaded.conversations, report: null };
  }
}

function Index() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [installedApi, setInstalledApi] = useState<InstalledBackupApi | null>(null);
  const [savedBackups, setSavedBackups] = useState<InstalledBackupSummary[]>([]);
  const [activeBackup, setActiveBackup] = useState<InstalledBackupSummary | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportedFile | null>(null);
  const [activeReport, setActiveReport] = useState<ImportHealthReport | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savePermissionConfirmed, setSavePermissionConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [lockState, setLockState] = useState<InstalledLockState | null>(null);
  const [appUnlocked, setAppUnlocked] = useState(true);

  const showInstalledHome = useCallback(() => {
    setConversations(null);
    setActiveId(null);
    setActiveBackup(null);
    setPendingImport(null);
    setActiveReport(null);
    setImportStatus(null);
    setSaveDialogOpen(false);
    setFocusNodeId(null);
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateInstalledApp() {
      const api = getInstalledBackupApi();
      if (!api) return;
      setInstalledApi(api);

      const [backups, lock] = await Promise.all([api.listBackups(), api.getLockState()]);
      if (cancelled) return;
      setSavedBackups(backups);
      setLockState(lock);
      setAppUnlocked(!lock.configured);
    }

    async function hydrate() {
      try {
        await hydrateInstalledApp();
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

  useEffect(() => {
    if (!installedApi || savedBackups.length === 0) return;

    let wasHidden = document.visibilityState === "hidden";
    const showHomeWhenReopened = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;

      wasHidden = false;
      if (lockState?.configured) setAppUnlocked(false);
      showInstalledHome();
    };

    document.addEventListener("visibilitychange", showHomeWhenReopened);
    return () => document.removeEventListener("visibilitychange", showHomeWhenReopened);
  }, [installedApi, savedBackups.length, showInstalledHome, lockState?.configured]);

  useEffect(() => {
    if (installedApi?.platform !== "android" || savedBackups.length === 0) return;

    const showHomeOnAndroidResume = () => {
      if (lockState?.configured) setAppUnlocked(false);
      showInstalledHome();
    };
    document.addEventListener("resume", showHomeOnAndroidResume);
    return () => document.removeEventListener("resume", showHomeOnAndroidResume);
  }, [installedApi, savedBackups.length, showInstalledHome, lockState?.configured]);

  async function refreshSavedBackups() {
    const backups = (await installedApi?.listBackups()) ?? [];
    setSavedBackups(backups);
    return backups;
  }

  async function refreshLockState(api = installedApi) {
    const lock = await api?.getLockState();
    if (lock) setLockState(lock);
    return lock;
  }

  async function loadSavedBackup(id: string) {
    const api = installedApi;
    if (!api) return;

    setImportStatus(null);
    try {
      const loaded = await api.loadBackup(id);
      const restored = await restoreInstalledConversations(loaded);
      if (!hasRenderableAssistantMessages(restored.conversations)) {
        throw new Error("This saved backup has no readable assistant messages.");
      }
      const openedBackup = await api.markBackupOpened(id);
      await refreshSavedBackups();
      setConversations(restored.conversations);
      setActiveId(restored.conversations[0]?.id ?? null);
      setActiveBackup(openedBackup);
      setActiveReport(restored.report);
      setPendingImport(null);
      setFocusNodeId(null);
      setMobileSidebarOpen(false);
    } catch (e) {
      setImportStatus(e instanceof Error ? e.message : "Failed to open saved backup.");
    }
  }

  async function handleLoaded(imported: ImportedFile) {
    setImportStatus(null);
    setConversations(imported.conversations);
    setActiveId(imported.conversations[0]?.id ?? null);
    setActiveBackup(null);
    setActiveReport(imported.report);
    setPendingImport(installedApi ? imported : null);
    setFocusNodeId(null);
    if (installedApi) {
      setImportStatus("Imported temporarily. Choose Save chats to keep this collection.");
    }
  }

  async function renameSavedBackup(id: string, displayName: string) {
    const renamed = await installedApi?.renameBackup(id, displayName);
    await refreshSavedBackups();
    if (renamed && activeBackup?.id === id) setActiveBackup(renamed);
  }

  async function deleteSavedBackup(id: string) {
    await installedApi?.deleteBackup(id);
    await refreshSavedBackups();
    if (activeBackup?.id === id) showInstalledHome();
  }

  async function unlockApp(passcode: string) {
    await installedApi?.verifyLock(passcode);
    setAppUnlocked(true);
  }

  async function unlockWithBiometric() {
    await installedApi?.unlockWithBiometric?.();
    setAppUnlocked(true);
  }

  async function setupLock(passcode: string, biometricEnabled: boolean) {
    const lock = await installedApi?.setupLock(passcode, { biometricEnabled });
    if (lock) setLockState(lock);
    setAppUnlocked(true);
  }

  async function disableLock(passcode: string) {
    const lock = await installedApi?.disableLock(passcode);
    if (lock) setLockState(lock);
    setAppUnlocked(true);
  }

  async function resetLockAndBackups() {
    await installedApi?.resetLockAndBackups();
    setSavedBackups([]);
    setLockState((await refreshLockState()) ?? null);
    setAppUnlocked(true);
    showInstalledHome();
  }

  async function savePendingImport() {
    const api = installedApi;
    if (!api || !pendingImport || !savePermissionConfirmed) return;

    setSaving(true);
    setImportStatus(null);
    try {
      const result = await api.saveBackup({
        displayName: saveName,
        fileName: pendingImport.file.name,
        archiveData: await pendingImport.file.arrayBuffer(),
        conversations: pendingImport.conversations,
        permissionConfirmed: savePermissionConfirmed,
        metadata: pendingImport.metadata,
      });
      await refreshSavedBackups();
      setActiveBackup(result.backup);
      setPendingImport(null);
      setSaveDialogOpen(false);
      setSaveName("");
      setSavePermissionConfirmed(false);
      setImportStatus(
        result.action === "kept-existing"
          ? `"${result.backup.displayName}" was already saved with an equal or newer export.`
          : result.action === "replaced"
            ? `"${result.backup.displayName}" was updated with the newer export.`
            : `"${result.backup.displayName}" was saved in the installed app.`,
      );
    } catch (e) {
      setImportStatus(e instanceof Error ? e.message : "Failed to save chats.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    const api = installedApi;
    if (api && activeBackup) {
      if (!confirm(`Remove "${activeBackup.displayName}" from this installed app?`)) return;
      await api.deleteBackup(activeBackup.id);
      await refreshSavedBackups();
      setConversations(null);
      setActiveId(null);
      setActiveBackup(null);
      setMobileSidebarOpen(false);
      return;
    }

    if (!confirm("Close the currently imported conversations?")) return;
    setConversations(null);
    setActiveId(null);
    setActiveBackup(null);
    setPendingImport(null);
    setActiveReport(null);
    setMobileSidebarOpen(false);
  }

  function handleReimport() {
    setConversations(null);
    setActiveBackup(null);
    setPendingImport(null);
    setActiveReport(null);
    setImportStatus(null);
    setFocusNodeId(null);
    setMobileSidebarOpen(false);
  }

  function handleSelect(id: string, selection?: Record<string, number>, nodeId?: string | null) {
    setActiveId(id);
    if (selection) {
      setSelections((prev) => ({ ...prev, [id]: selection }));
    }
    setFocusNodeId(nodeId ?? null);
    setMobileSidebarOpen(false);
  }

  if (!hydrated) return null;

  if (installedApi && lockState?.configured && !appUnlocked) {
    return (
      <LockGate
        platform={installedApi.platform}
        lockState={lockState}
        onUnlock={unlockApp}
        onBiometricUnlock={
          lockState.biometricEnabled && installedApi.unlockWithBiometric
            ? unlockWithBiometric
            : undefined
        }
        onReset={resetLockAndBackups}
      />
    );
  }

  if (!conversations) {
    return (
      <ImportDropzone
        onLoaded={handleLoaded}
        installed={Boolean(installedApi)}
        savedBackups={savedBackups}
        onLoadBackup={loadSavedBackup}
        onRenameBackup={renameSavedBackup}
        onDeleteBackup={deleteSavedBackup}
        importStatus={importStatus}
        platform={installedApi?.platform ?? null}
        lockState={lockState}
        onSetupLock={setupLock}
        onDisableLock={disableLock}
        onResetLockAndBackups={resetLockAndBackups}
      />
    );
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <>
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
          selections={selections}
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
          <ConversationView
            conversation={active}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
            onSelectConversation={handleSelect}
            savedName={activeBackup?.displayName}
            report={activeReport}
            selection={active ? (selections[active.id] ?? {}) : {}}
            onSelectionChange={(selection) => {
              if (!active) return;
              setSelections((prev) => ({ ...prev, [active.id]: selection }));
              setFocusNodeId(null);
            }}
            focusNodeId={focusNodeId}
            onSave={
              pendingImport
                ? () => {
                    setSaveDialogOpen(true);
                    setImportStatus(null);
                  }
                : undefined
            }
          />
        </main>
      </div>

      {saveDialogOpen && pendingImport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-chats-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/30 px-4 backdrop-blur-sm"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void savePendingImport();
            }}
            className="w-full max-w-md rounded-xl border bg-background p-5 text-foreground shadow-2xl"
          >
            <h2 id="save-chats-title" className="text-lg font-semibold">
              Save chats
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep this imported collection in the installed app so you can open it again later.
            </p>
            {importStatus && (
              <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importStatus}
              </div>
            )}
            <label className="mt-5 block text-sm font-medium">
              Name
              <input
                autoFocus
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                maxLength={80}
                placeholder="Leave blank for a random name"
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3 text-left text-sm">
              <input
                type="checkbox"
                checked={savePermissionConfirmed}
                onChange={(event) => setSavePermissionConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                <span className="font-medium">Permission confirmed</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  I own this backup or have permission from the owner to save and view it.
                </span>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setSavePermissionConfirmed(false);
                }}
                disabled={saving}
                className="inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!savePermissionConfirmed || saving}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save chats"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
