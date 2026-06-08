const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatReplayDesktop", {
  isElectron: true,
  platform: "electron",
  listBackups: () => ipcRenderer.invoke("chat-replay:list-backups"),
  loadBackup: (id) => ipcRenderer.invoke("chat-replay:load-backup", id),
  saveBackup: (payload) => ipcRenderer.invoke("chat-replay:save-backup", payload),
  deleteBackup: (id) => ipcRenderer.invoke("chat-replay:delete-backup", id),
});
