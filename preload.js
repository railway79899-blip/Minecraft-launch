const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcherAPI", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: patch => ipcRenderer.invoke("config:set", patch),
  chooseDirectory: () => ipcRenderer.invoke("dialog:directory"),
  chooseFile: filters => ipcRenderer.invoke("dialog:file", filters),
  openPath: target => ipcRenderer.invoke("shell:openPath", target),
  openExternal: url => ipcRenderer.invoke("shell:openExternal", url),
  login: () => ipcRenderer.invoke("auth:login"),
  authStatus: () => ipcRenderer.invoke("auth:status"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  prepare: options => ipcRenderer.invoke("launcher:prepare", options),
  launchJava: options => ipcRenderer.invoke("launcher:java", options),
  onProgress: callback => ipcRenderer.on("launcher:progress", (_event, value) => callback(value)),
  onLog: callback => ipcRenderer.on("launcher:log", (_event, value) => callback(value))
});
