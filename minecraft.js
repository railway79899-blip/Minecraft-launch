const fs = require("fs");
const path = require("path");
const https = require("https");

const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const XBOX_USER_AUTH = "https://user.auth.xboxlive.com/user/authenticate";
const XBOX_XSTS = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_ENTITLEMENTS = "https://api.minecraftservices.com/entitlements/mcstore";
const MC_PROFILE = "https://api.minecraftservices.com/minecraft/profile";

function jsonRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    }, res => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        let data;
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = raw; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${typeof data === "string" ? data : JSON.stringify(data)}`));
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function download(url, target, onProgress) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(target)) return resolve(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const file = fs.createWriteStream(target);
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlinkSync(target);
        return download(new URL(res.headers.location, url).toString(), target, onProgress).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(target, () => {});
        return reject(new Error(`下載失敗 HTTP ${res.statusCode}`));
      }
      const total = Number(res.headers["content-length"] || 0);
      let done = 0;
      res.on("data", chunk => {
        done += chunk.length;
        if (onProgress && total) onProgress(done / total);
      });
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(target)));
    }).on("error", err => {
      file.close(); fs.unlink(target, () => {});
      reject(err);
    });
  });
}

async function xboxLogin(msAccessToken) {
  const user = await jsonRequest(XBOX_USER_AUTH, {
    method: "POST",
    body: {
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    }
  });
  const xsts = await jsonRequest(XBOX_XSTS, {
    method: "POST",
    body: {
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [user.Token]
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT"
    }
  });
  const xuid = xsts.DisplayClaims.xui[0].uhs;
  const mc = await jsonRequest(MC_LOGIN, {
    method: "POST",
    body: { identityToken: `XBL3.0 x=${xuid};${xsts.Token}` }
  });
  return { accessToken: mc.access_token, expiresIn: mc.expires_in };
}

async function getMinecraftAccount(msAccessToken) {
  const mc = await xboxLogin(msAccessToken);
  const headers = { Authorization: `Bearer ${mc.accessToken}` };
  const entitlements = await jsonRequest(MC_ENTITLEMENTS, { headers });
  if (!entitlements.items || entitlements.items.length === 0) {
    throw new Error("這個 Microsoft 帳號沒有可用的 Minecraft Java Edition entitlement。");
  }
  const profile = await jsonRequest(MC_PROFILE, { headers });
  return {
    accessToken: mc.accessToken,
    expiresIn: mc.expiresIn,
    id: profile.id,
    name: profile.name,
    skins: profile.skins || [],
    cape: profile.capes?.[0] || null
  };
}

async function getVersionManifest() {
  return jsonRequest(MANIFEST_URL);
}

async function getVersion(version) {
  const manifest = await getVersionManifest();
  const entry = manifest.versions.find(v => v.id === version && v.type === "release");
  if (!entry) throw new Error(`找不到正式版 Minecraft ${version}。`);
  return jsonRequest(entry.url);
}

function allowed(rule, platform) {
  if (!rule) return true;
  const os = rule.os;
  if (!os) return true;
  if (os.name && os.name !== platform) return false;
  return true;
}

function resolveDownloads(versionJson, platform) {
  const libraries = [];
  for (const lib of versionJson.libraries || []) {
    const rules = lib.rules || [];
    if (rules.length && !rules.some(r => allowed(r, platform))) continue;
    const d = lib.downloads;
    if (!d?.artifact) continue;
    libraries.push(d.artifact);
  }
  return libraries;
}

async function prepareJavaVersion({ version, gameDir, onProgress }) {
  const versionJson = await getVersion(version);
  const versionDir = path.join(gameDir, "versions", version);
  fs.mkdirSync(versionDir, { recursive: true });
  const jsonPath = path.join(versionDir, `${version}.json`);
  const jarPath = path.join(versionDir, `${version}.jar`);
  fs.writeFileSync(jsonPath, JSON.stringify(versionJson, null, 2));

  const downloads = [];
  if (versionJson.downloads?.client) downloads.push({ kind: "client", ...versionJson.downloads.client, target: jarPath });
  for (const a of resolveDownloads(versionJson, process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux")) {
    downloads.push({ kind: "library", ...a, target: path.join(gameDir, "libraries", a.path) });
  }

  let done = 0;
  for (const d of downloads) {
    await download(d.url, d.target, p => onProgress?.((done + p) / downloads.length));
    done++;
    onProgress?.(done / downloads.length);
  }
  return { versionJson, jsonPath, jarPath, libraries: downloads.filter(x => x.kind === "library").map(x => x.target) };
}

function buildClasspath(prepared) {
  return [...prepared.libraries, prepared.jarPath].join(path.delimiter);
}

async function launchJava({ javaPath, gameDir, version, account, ram, onLog }) {
  const prepared = await prepareJavaVersion({ version, gameDir, onProgress: p => onLog?.({ type: "progress", value: p }) });
  const jvmArgs = [
    `-Xmx${Number(ram || 4)}G`,
    "-cp", buildClasspath(prepared),
    prepared.versionJson.mainClass
  ];
  const child = require("child_process").spawn(javaPath, jvmArgs, {
    cwd: gameDir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", d => onLog?.({ type: "stdout", value: d.toString() }));
  child.stderr.on("data", d => onLog?.({ type: "stderr", value: d.toString() }));
  return { pid: child.pid, prepared };
}

module.exports = { getVersionManifest, getVersion, prepareJavaVersion, getMinecraftAccount, launchJava };
