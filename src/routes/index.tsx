import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImportDropzone } from "@/components/chat/ImportDropzone";
import { LockGate } from "@/components/chat/LockGate";
import { Sidebar } from "@/components/chat/Sidebar";
import { ConversationView } from "@/components/chat/ConversationView";
import { ArchiveDashboard } from "@/components/chat/ArchiveDashboard";
import { OnlineImageSettingsProvider } from "@/components/chat/OnlineImageSettings";
import { clearOnlineImageCache, stopOnlineImageRequests } from "@/lib/online-images";
import {
  computeChain,
  parseChatGPTExportWithMetadata,
  releaseConversationAssets,
  type Conversation,
  type ImportHealthReport,
  type ParsedChatGPTExport,
} from "@/lib/chatgpt-import";
import { getInstalledBackupApi } from "@/lib/installed-backups";
import {
  getCollection,
  openSavedCollection,
  type CollectionSession,
} from "@/lib/collection-session";
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
          "Browse ChatGPT, OpenAI, Claude, and Gemini exports locally. Exports stay on your device; optional image lookups use Wikimedia Commons.",
      },
      { property: "og:title", content: "Chat Replay" },
      {
        property: "og:description",
        content:
          "Browse exported chats locally. Exports stay on your device; optional image lookups use Wikimedia Commons.",
      },
    ],
  }),
  component: Index,
});

type ImportedFile = ParsedChatGPTExport & {
  file: File;
};

function Index() {
  return (
    <OnlineImageSettingsProvider>
      <ArchiveApp />
    </OnlineImageSettingsProvider>
  );
}
function ArchiveApp() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [installedApi, setInstalledApi] = useState<InstalledBackupApi | null>(null);
  const [savedBackups, setSavedBackups] = useState<InstalledBackupSummary[]>([]);
  const [activeBackup, setActiveBackup] = useState<InstalledBackupSummary | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportedFile | null>(null);
  const [activeReport, setActiveReport] = useState<ImportHealthReport | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [dashboardConversations, setDashboardConversations] = useState<Conversation[]>([]);
  const sessionRef = useRef<CollectionSession | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savePermissionConfirmed, setSavePermissionConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [lockState, setLockState] = useState<InstalledLockState | null>(null);
  const [appUnlocked, setAppUnlocked] = useState(true);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const loadGeneration = useRef(0);
  const backupLoad = useRef<AbortController | null>(null);
  useEffect(() => {
    const native = window as Window & { chatReplayBack?: () => boolean };
    native.chatReplayBack = () => {
      const attachment = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close attachment"]',
      );
      if (attachment) {
        attachment.click();
        return true;
      }
      if (document.querySelector("[data-online-image-settings]")) {
        window.dispatchEvent(new Event("chat-replay:close-image-settings"));
        return true;
      }
      const menu = document.querySelector("details[open]");
      if (menu) {
        menu.removeAttribute("open");
        return true;
      }
      if (saveDialogOpen) {
        setSaveDialogOpen(false);
        return true;
      }
      if (mobileSidebarOpen) {
        setMobileSidebarOpen(false);
        return true;
      }
      if (dashboardOpen) {
        setDashboardOpen(false);
        return true;
      }
      if (conversations) {
        handleCloseArchive();
        return true;
      }
      return false;
    };
    return () => {
      delete native.chatReplayBack;
    };
  });

  const invalidateLoad = useCallback(() => {
    loadGeneration.current += 1;
    backupLoad.current?.abort();
    backupLoad.current = null;
    return loadGeneration.current;
  }, []);

  useEffect(() => {
    return () => {
      invalidateLoad();
    };
  }, [invalidateLoad]);

  useEffect(() => {
    return () => {
      if (conversations) {
        releaseConversationAssets(conversations);
        stopOnlineImageRequests();
      }
    };
  }, [conversations]);

  const closeArchive = useCallback(() => {
    stopOnlineImageRequests();
    invalidateLoad();
    setConversations(null);
    setActiveId(null);
    setActiveBackup(null);
    setIsSample(false);
    setPendingImport(null);
    setActiveReport(null);
    setActiveConversation(null);
    sessionRef.current?.close();
    sessionRef.current = null;
    setImportStatus(null);
    setSaveDialogOpen(false);
    setSaveName("");
    setSavePermissionConfirmed(false);
    setFocusNodeId(null);
    setMobileSidebarOpen(false);
    setDashboardOpen(false);
  }, [invalidateLoad]);

  useEffect(() => {
    if (!activeId || !conversations) return;
    let disposed = false;
    setActiveConversation(null);
    const session = sessionRef.current;
    void session
      ?.getConversation(activeId)
      .then((conversation) => {
        if (!disposed) setActiveConversation(conversation);
      })
      .catch((error) => {
        if (!disposed)
          setImportStatus(error instanceof Error ? error.message : "Could not open this chat.");
      });
    return () => {
      disposed = true;
    };
  }, [activeId, conversations]);

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

    const generation = invalidateLoad();
    const controller = new AbortController();
    backupLoad.current = controller;
    setImportStatus(null);
    try {
      const loaded = await api.loadBackup(id);
      if (generation !== loadGeneration.current) return;

      const restored = loaded.conversations,
        report = loaded.report;
      const session = await openSavedCollection(
        restored,
        loaded.searchIndex,
        (conversationId) => api.loadConversation(id, conversationId),
        async () => {
          const archive = await api.loadBackupArchive(id);
          return archive ? new File([archive], loaded.backup.originalFileName) : null;
        },
        async (index) => api.saveSearchIndex(id, index),
      );
      if (generation !== loadGeneration.current) {
        session.close();
        return;
      }
      sessionRef.current = session;
      if (generation !== loadGeneration.current) return;
      setConversations(restored);
      let remembered: { id?: string; selection?: Record<string, number> } = {};
      try {
        remembered = JSON.parse(localStorage.getItem(`chat-replay-view:${id}`) ?? "{}");
      } catch {
        /* A damaged reading position does not prevent opening the collection. */
      }
      setActiveId(
        restored.some((c) => c.id === remembered.id) ? remembered.id! : (restored[0]?.id ?? null),
      );
      if (remembered.id && remembered.selection)
        setSelections((prev) => ({ ...prev, [remembered.id!]: remembered.selection! }));
      setActiveBackup(loaded.backup);
      setIsSample(false);
      setActiveReport(report);
      setPendingImport(null);
      setSaveDialogOpen(false);
      setSaveName("");
      setSavePermissionConfirmed(false);
      setFocusNodeId(null);
      setMobileSidebarOpen(false);

      void api
        .markBackupOpened(id)
        .then(async (openedBackup) => {
          const backups = await api.listBackups();
          if (generation !== loadGeneration.current) return;
          setActiveBackup(openedBackup);
          setSavedBackups(backups);
        })
        .catch((error) => console.error("Could not update last-opened time", error));
    } catch (e) {
      if (generation === loadGeneration.current) {
        setImportStatus(e instanceof Error ? e.message : "Failed to open saved backup.");
      }
    }
  }

  function handleLoaded(imported: ParsedChatGPTExport, file: File | null) {
    invalidateLoad();
    setImportStatus(null);
    sessionRef.current = imported.session ?? getCollection(imported.conversations) ?? null;
    setConversations(imported.conversations);
    setActiveId(imported.conversations[0]?.id ?? null);
    setActiveBackup(null);
    setIsSample(file === null);
    setActiveReport(imported.report);
    setPendingImport(installedApi && file ? { ...imported, file } : null);
    setFocusNodeId(null);
  }

  async function renameSavedBackup(id: string, displayName: string) {
    const renamed = await installedApi?.renameBackup(id, displayName);
    await refreshSavedBackups();
    if (renamed && activeBackup?.id === id) setActiveBackup(renamed);
  }

  async function deleteSavedBackup(id: string) {
    await installedApi?.deleteBackup(id);
    await refreshSavedBackups();
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
    await clearOnlineImageCache();
    setSavedBackups([]);
    setLockState((await refreshLockState()) ?? null);
    setAppUnlocked(true);
    closeArchive();
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
        conversations: await sessionRef.current!.all(),
        report: pendingImport.report,
        searchIndex: await sessionRef.current!.index(),
        permissionConfirmed: savePermissionConfirmed,
        metadata: pendingImport.metadata,
      });
      await refreshSavedBackups();
      if (result.action === "kept-existing") {
        await loadSavedBackup(result.backup.id);
        return;
      }
      setActiveBackup(result.backup);
      setPendingImport(null);
      setSaveDialogOpen(false);
      setSaveName("");
      setSavePermissionConfirmed(false);
      setImportStatus(
        result.action === "replaced"
          ? `"${result.backup.displayName}" was updated with the newer export.`
          : `"${result.backup.displayName}" was saved in the installed app.`,
      );
    } catch (e) {
      setImportStatus(e instanceof Error ? e.message : "Failed to save chats.");
    } finally {
      setSaving(false);
    }
  }

  function handleCloseArchive() {
    if (saving) return;
    if (pendingImport && !confirm("Return to the library without saving this collection?")) return;
    closeArchive();
  }

  async function handleSelect(
    id: string,
    selection?: Record<string, number>,
    nodeId?: string | null,
  ) {
    if (nodeId && sessionRef.current) selection = await sessionRef.current.resolve(id, nodeId);
    setActiveId(id);
    if (selection) {
      setSelections((prev) => ({ ...prev, [id]: selection }));
    }
    setFocusNodeId(nodeId ?? null);
    setMobileSidebarOpen(false);
    setDashboardOpen(false);
    if (activeBackup)
      try {
        localStorage.setItem(
          `chat-replay-view:${activeBackup.id}`,
          JSON.stringify({ id, selection: selection ?? selections[id] ?? {} }),
        );
      } catch {
        /* Reading position is optional when local storage is unavailable. */
      }
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

  const active = activeConversation;
  const collectionName = isSample
    ? "Sample archive"
    : (activeBackup?.displayName ?? activeReport?.sourceName ?? "Chat archive");
  const collectionStatus = activeBackup ? "Saved" : "Temporary";

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
          onCloseArchive={handleCloseArchive}
          closeArchiveLabel={installedApi ? "Back to library" : "Close archive"}
          onOpenDashboard={() => {
            void sessionRef.current?.all().then(setDashboardConversations);
            setDashboardOpen(true);
            setMobileSidebarOpen(false);
          }}
          onRequestClose={() => setMobileSidebarOpen(false)}
          className={`fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-1rem))] shadow-xl transition-transform duration-200 sm:w-80 md:static md:z-auto md:w-72 md:translate-x-0 md:shadow-none lg:w-80 ${
            mobileSidebarOpen
              ? "visible translate-x-0 pointer-events-auto"
              : "invisible -translate-x-full pointer-events-none md:visible md:pointer-events-auto"
          }`}
        />
        <main className="min-w-0 flex-1 overflow-hidden">
          {dashboardOpen ? (
            <ArchiveDashboard
              conversations={dashboardConversations}
              report={activeReport}
              savedBackups={savedBackups}
              onClose={() => setDashboardOpen(false)}
              onSelect={(id, nodeId) => handleSelect(id, undefined, nodeId)}
            />
          ) : (
            <ConversationView
              conversation={active}
              viewKey={activeBackup ? `${activeBackup.id}:${activeId}` : undefined}
              onOpenSidebar={() => setMobileSidebarOpen(true)}
              onSelectConversation={handleSelect}
              collectionName={collectionName}
              collectionStatus={collectionStatus}
              report={activeReport}
              selection={active ? (selections[active.id] ?? {}) : {}}
              onSelectionChange={(selection) => {
                if (!active) return;
                setSelections((prev) => ({ ...prev, [active.id]: selection }));
                if (activeBackup)
                  try {
                    localStorage.setItem(
                      `chat-replay-view:${activeBackup.id}`,
                      JSON.stringify({ id: active.id, selection }),
                    );
                  } catch {
                    /* Optional reading state. */
                  }
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
          )}
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
