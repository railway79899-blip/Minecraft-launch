const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { login, refresh } = require("./auth");
const { createStore } = require("./token-store");
const minecraft = require("./minecraft");

const configPath = path.join(app.getPath("userData"), "config.json");
const tokenStore = createStore(path.join(app.getPath("userData"), "auth.bin"));

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { return {}; }
}
function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 760, minWidth: 900, minHeight: 620,
    backgroundColor: "#101010", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile("index.html");
}

ipcMain.handle("config:get", () => loadConfig());
ipcMain.handle("config:set", (_event, patch) => {
  const next = { ...loadConfig(), ...patch }; saveConfig(next); return next;
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

async function ensureSession() {
  let stored = tokenStore.read();
  if (!stored?.microsoft?.accessToken) return null;
  if (stored.microsoft.expiresAt && stored.microsoft.expiresAt < Date.now() + 120000 && stored.microsoft.refreshToken) {
    const config = loadConfig();
    const oauth = await refresh(stored.microsoft.refreshToken, config.clientId);
    stored.microsoft = {
      accessToken: oauth.access_token,
      refreshToken: oauth.refresh_token || stored.microsoft.refreshToken,
      expiresAt: Date.now() + Number(oauth.expires_in || 3600) * 1000
    };
    const account = await minecraft.getMinecraftAccount(stored.microsoft.accessToken);
    stored.account = { id: account.id, name: account.name, skins: account.skins, cape: account.cape };
    stored.minecraft = { accessToken: account.accessToken, expiresAt: Date.now() + Number(account.expiresIn || 3600) * 1000 };
    tokenStore.write(stored);
  }
  return stored;
}

ipcMain.handle("auth:status", async () => {
  const stored = await ensureSession();
  return stored?.account ? stored.account : null;
});

ipcMain.handle("auth:login", async () => {
  const config = loadConfig();
  const oauth = await login({ clientId: config.clientId });
  const account = await minecraft.getMinecraftAccount(oauth.access_token);
  tokenStore.write({
    microsoft: {
      accessToken: oauth.access_token,
      refreshToken: oauth.refresh_token || null,
      expiresAt: Date.now() + Number(oauth.expires_in || 3600) * 1000
    },
    account: { id: account.id, name: account.name, skins: account.skins, cape: account.cape },
    minecraft: { accessToken: account.accessToken, expiresAt: Date.now() + Number(account.expiresIn || 3600) * 1000 }
  });
  return tokenStore.read().account;
});

ipcMain.handle("auth:logout", () => { tokenStore.clear(); return true; });

ipcMain.handle("launcher:prepare", async (event, options) => {
  const stored = await ensureSession();
  if (!stored?.account || !stored?.minecraft?.accessToken) throw new Error("請先登入 Microsoft 帳號。");
  const gameDir = options.gameDir || path.join(app.getPath("home"), "minecraft");
  const result = await minecraft.prepareJavaVersion({
    version: options.version, gameDir,
    account: { ...stored.account, accessToken: stored.minecraft.accessToken },
    onProgress: value => event.sender.send("launcher:progress", value)
  });
  return { version: options.version, gameDir, jarPath: result.jarPath };
});

ipcMain.handle("launcher:java", async (event, options) => {
  const stored = await ensureSession();
  if (!stored?.account || !stored?.minecraft?.accessToken) throw new Error("請先登入 Microsoft 帳號。");
  const javaPath = options.javaPath;
  if (!javaPath || !fs.existsSync(javaPath)) throw new Error("找不到 Java 執行檔。");
  const gameDir = options.gameDir || path.join(app.getPath("home"), "minecraft");
  const result = await minecraft.launchJava({
    javaPath, gameDir, version: options.version,
    account: { ...stored.account, accessToken: stored.minecraft.accessToken },
    clientId: loadConfig().clientId,
    ram: options.ram,
    onLog: log => event.sender.send("launcher:log", log)
  });
  return { ok: true, pid: result.pid };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
