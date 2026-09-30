const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcherAPI", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (patch) => ipcRenderer.invoke("config:set", patch),
  chooseDirectory: () => ipcRenderer.invoke("dialog:directory"),
  chooseFile: (filters) => ipcRenderer.invoke("dialog:file", filters),
  openPath: (target) => ipcRenderer.invoke("shell:openPath", target),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  launchJava: (options) => ipcRenderer.invoke("launcher:java", options)
});
