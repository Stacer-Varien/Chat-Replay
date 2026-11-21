const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatReplayDesktop", {
  isElectron: true,
  platform: "electron",
  onlineImages: {
    read: (key) => ipcRenderer.invoke("chat-replay:images:read", key),
    write: (record) => ipcRenderer.invoke("chat-replay:images:write", record),
    clear: () => ipcRenderer.invoke("chat-replay:images:clear"),
    stats: () => ipcRenderer.invoke("chat-replay:images:stats"),
    enabled: () => ipcRenderer.invoke("chat-replay:images:enabled"),
    setEnabled: (value) => ipcRenderer.invoke("chat-replay:images:set-enabled", value),
  },
  listBackups: () => ipcRenderer.invoke("chat-replay:list-backups"),
  loadBackup: (id) => ipcRenderer.invoke("chat-replay:load-backup", id),
  loadConversation: (id, conversationId) =>
    ipcRenderer.invoke("chat-replay:load-conversation", id, conversationId),
  loadBackupArchive: (id) => ipcRenderer.invoke("chat-replay:load-backup-archive", id),
  saveBackup: (payload) => ipcRenderer.invoke("chat-replay:save-backup", payload),
  saveSearchIndex: (id, searchIndex) =>
    ipcRenderer.invoke("chat-replay:save-search-index", id, searchIndex),
  renameBackup: (id, displayName) =>
    ipcRenderer.invoke("chat-replay:rename-backup", id, displayName),
  markBackupOpened: (id) => ipcRenderer.invoke("chat-replay:mark-backup-opened", id),
  deleteBackup: (id) => ipcRenderer.invoke("chat-replay:delete-backup", id),
  getLockState: () => ipcRenderer.invoke("chat-replay:get-lock-state"),
  setupLock: (passcode, options) => ipcRenderer.invoke("chat-replay:setup-lock", passcode, options),
  verifyLock: (passcode) => ipcRenderer.invoke("chat-replay:verify-lock", passcode),
  disableLock: (passcode) => ipcRenderer.invoke("chat-replay:disable-lock", passcode),
  resetLockAndBackups: () => ipcRenderer.invoke("chat-replay:reset-lock-and-backups"),
});
