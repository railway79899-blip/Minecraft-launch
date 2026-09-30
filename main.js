const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const configPath = path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); }
  catch { return {}; }
}
function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#101010",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile("index.html");
}

ipcMain.handle("config:get", () => loadConfig());
ipcMain.handle("config:set", (_event, patch) => {
  const next = { ...loadConfig(), ...patch };
  saveConfig(next);
  return next;
});

ipcMain.handle("dialog:directory", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:file", async (_event, filters) => {
  const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: filters || [] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("shell:openPath", async (_event, target) => shell.openPath(target));
ipcMain.handle("shell:openExternal", async (_event, url) => shell.openExternal(url));

ipcMain.handle("launcher:java", async (_event, options) => {
  if (!options?.javaPath || !options?.jarPath) {
    return { ok: false, error: "請先設定 Java 路徑與 Minecraft JAR 路徑。" };
  }
  if (!fs.existsSync(options.javaPath) || !fs.existsSync(options.jarPath)) {
    return { ok: false, error: "找不到 Java 或 Minecraft JAR。" };
  }

  const args = ["-Xmx" + Number(options.ram || 4) + "G", "-jar", options.jarPath];
  const child = spawn(options.javaPath, args, {
    cwd: options.gameDir || path.dirname(options.jarPath),
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  return { ok: true, pid: child.pid };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
