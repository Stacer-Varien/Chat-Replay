const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatReplayDesktop", {
  isElectron: true,
  platform: "electron",
  listBackups: () => ipcRenderer.invoke("chat-replay:list-backups"),
  loadBackup: (id) => ipcRenderer.invoke("chat-replay:load-backup", id),
  saveBackup: (payload) => ipcRenderer.invoke("chat-replay:save-backup", payload),
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
