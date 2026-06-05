const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatReplayDesktop", {
  isElectron: true,
  listBackups: () => ipcRenderer.invoke("chat-replay:list-backups"),
  loadBackup: (id) => ipcRenderer.invoke("chat-replay:load-backup", id),
  importBackup: (payload) => ipcRenderer.invoke("chat-replay:import-backup", payload),
  deleteBackup: (id) => ipcRenderer.invoke("chat-replay:delete-backup", id),
});
