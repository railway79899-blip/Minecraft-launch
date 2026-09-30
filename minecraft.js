const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");
const extractZip = require("extract-zip");

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
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
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

function download(url, target, expectedSha1, onProgress) {
  return new Promise((resolve, reject) => {
    const verify = () => {
      if (!expectedSha1) return resolve(target);
      const crypto = require("crypto");
      const hash = crypto.createHash("sha1");
      const input = fs.createReadStream(target);
      input.on("data", d => hash.update(d));
      input.on("end", () => hash.digest("hex") === expectedSha1 ? resolve(target) : reject(new Error(`SHA-1 驗證失敗：${target}`)));
      input.on("error", reject);
    };
    if (fs.existsSync(target)) return verify();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const file = fs.createWriteStream(target);
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlink(target, () => {});
        return download(new URL(res.headers.location, url).toString(), target, expectedSha1, onProgress).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(target, () => {});
        return reject(new Error(`下載失敗 HTTP ${res.statusCode}`));
      }
      const total = Number(res.headers["content-length"] || 0);
      let done = 0;
      res.on("data", chunk => { done += chunk.length; if (total) onProgress?.(done / total); });
      res.pipe(file);
      file.on("finish", () => file.close(verify));
    }).on("error", err => { file.close(); fs.unlink(target, () => {}); reject(err); });
  });
}

async function xboxLogin(msAccessToken) {
  const user = await jsonRequest(XBOX_USER_AUTH, {
    method: "POST",
    body: {
      Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msAccessToken}` },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    }
  });
  const xsts = await jsonRequest(XBOX_XSTS, {
    method: "POST",
    body: {
      Properties: { SandboxId: "RETAIL", UserTokens: [user.Token] },
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
  if (!entitlements.items?.length) throw new Error("這個 Microsoft 帳號沒有可用的 Minecraft Java Edition entitlement。");
  const profile = await jsonRequest(MC_PROFILE, { headers });
  return { accessToken: mc.accessToken, expiresIn: mc.expiresIn, id: profile.id, name: profile.name, skins: profile.skins || [], cape: profile.capes?.[0] || null };
}

async function getVersionManifest() { return jsonRequest(MANIFEST_URL); }

async function getVersion(version) {
  const manifest = await getVersionManifest();
  const entry = manifest.versions.find(v => v.id === version && v.type === "release");
  if (!entry) throw new Error(`找不到正式版 Minecraft ${version}。`);
  return jsonRequest(entry.url);
}

function platformInfo() {
  if (process.platform === "win32") return { os: "windows", native: "natives-windows", arch: process.arch === "ia32" ? "32" : "64" };
  if (process.platform === "darwin") return { os: "osx", native: "natives-osx", arch: "64" };
  return { os: "linux", native: "natives-linux", arch: process.arch === "ia32" ? "32" : "64" };
}

function ruleAllows(rules, features = {}) {
  if (!rules?.length) return true;
  let allowed = false;
  for (const rule of rules) {
    if (rule.features && Object.entries(rule.features).some(([k,v]) => Boolean(features[k]) !== Boolean(v))) continue;
    if (rule.os?.name && rule.os.name !== platformInfo().os) continue;
    if (rule.os?.arch && rule.os.arch !== platformInfo().arch) continue;
    allowed = rule.action === "allow";
  }
  return allowed;
}

function classifyValue(value, features) {
  if (typeof value === "string") return value;
  if (!value?.rules || ruleAllows(value.rules, features)) return value?.value;
  return null;
}

function resolveLibraries(versionJson, gameDir, features) {
  const p = platformInfo();
  const artifacts = [];
  const natives = [];
  for (const lib of versionJson.libraries || []) {
    if (!ruleAllows(lib.rules, features)) continue;
    if (lib.downloads?.artifact) artifacts.push({ ...lib.downloads.artifact, target: path.join(gameDir, "libraries", lib.downloads.artifact.path) });
    const classifierName = lib.natives?.[p.os]?.replace("${arch}", p.arch);
    if (classifierName && lib.downloads?.classifiers?.[classifierName]) {
      const a = lib.downloads.classifiers[classifierName];
      natives.push({ ...a, target: path.join(gameDir, "libraries", a.path) });
    }
  }
  return { artifacts, natives };
}

function replaceVars(value, vars) {
  return String(value).replace(/\$\{([^}]+)\}/g, (_, key) => vars[key] ?? `\${${key}}`);
}

function resolveArguments(versionJson, vars, features) {
  const result = [];
  const add = item => {
    if (typeof item === "string") result.push(replaceVars(item, vars));
    else if (ruleAllows(item.rules, features)) {
      const value = classifyValue(item.value, features);
      if (Array.isArray(value)) value.forEach(v => result.push(replaceVars(v, vars)));
      else if (value != null) result.push(replaceVars(value, vars));
    }
  };
  for (const x of versionJson.arguments?.jvm || []) add(x);
  if (versionJson.arguments?.jvm) {
    if (!result.includes("-cp") && !result.includes("-classpath")) {
      result.push("-cp", vars.classpath);
    } else {
      const i = result.findIndex(x => x === "-cp" || x === "-classpath");
      if (i >= 0 && result[i + 1]) result[i + 1] = vars.classpath;
    }
  }
  for (const x of versionJson.arguments?.game || []) add(x);
  if (!versionJson.arguments?.game && versionJson.minecraftArguments) {
    versionJson.minecraftArguments.split(" ").filter(Boolean).forEach(x => result.push(replaceVars(x, vars)));
  }
  return result;
}

async function prepareJavaVersion({ version, gameDir, account, onProgress }) {
  const versionJson = await getVersion(version);
  const versionDir = path.join(gameDir, "versions", version);
  fs.mkdirSync(versionDir, { recursive: true });
  const jsonPath = path.join(versionDir, `${version}.json`);
  const jarPath = path.join(versionDir, `${version}.jar`);
  fs.writeFileSync(jsonPath, JSON.stringify(versionJson, null, 2));

  const features = { is_demo_user: false, has_custom_resolution: false, has_quick_plays_support: false };
  const libs = resolveLibraries(versionJson, gameDir, features);
  const assets = [];
  if (versionJson.assetIndex?.url) {
    const indexPath = path.join(gameDir, "assets", "indexes", `${versionJson.assetIndex.id}.json`);
    assets.push({ ...versionJson.assetIndex, target: indexPath, type: "index" });
  }

  let all = [];
  if (versionJson.downloads?.client) all.push({ ...versionJson.downloads.client, target: jarPath, type: "client" });
  all = all.concat(libs.artifacts.map(x => ({ ...x, type: "library" })), libs.natives.map(x => ({ ...x, type: "native" })), assets);
  let done = 0;
  for (const d of all) {
    await download(d.url, d.target, d.sha1, p => onProgress?.((done + p) / Math.max(all.length, 1)));
    done++;
    onProgress?.(done / Math.max(all.length, 1));
  }

  if (versionJson.assetIndex?.url) {
    const indexPath = assets[0].target;
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const objects = Object.entries(index.objects || {});
    const assetTasks = objects.map(([name, obj]) => ({
      url: `https://resources.download.minecraft.net/${obj.hash.slice(0,2)}/${obj.hash}`,
      target: path.join(gameDir, "assets", "objects", obj.hash),
      sha1: obj.hash
    }));
    for (let i = 0; i < assetTasks.length; i += 8) {
      await Promise.all(assetTasks.slice(i, i + 8).map(d => download(d.url, d.target, d.sha1)));
      onProgress?.(0.5 + 0.5 * ((i + Math.min(8, assetTasks.length - i)) / Math.max(assetTasks.length, 1)));
    }
  }

  const nativesDir = path.join(versionDir, "natives");
  fs.mkdirSync(nativesDir, { recursive: true });
  for (const n of libs.natives) await extractZip(n.target, nativesDir, { onEntry: entry => { if (entry.fileName.startsWith("META-INF/")) entry.autodrain(); } });

  return { versionJson, jsonPath, jarPath, libraries: libs.artifacts.map(x => x.target), nativesDir, assetsIndex: versionJson.assetIndex?.id || "" };
}

function buildClasspath(prepared) { return [...prepared.libraries, prepared.jarPath].join(path.delimiter); }

async function launchJava({ javaPath, gameDir, version, account, ram, onLog }) {
  if (!account?.accessToken || !account?.id || !account?.name) throw new Error("請先登入並取得 Minecraft Java 授權。");
  const prepared = await prepareJavaVersion({ version, gameDir, account, onProgress: p => onLog?.({ type: "progress", value: p }) });
  const vars = {
    auth_player_name: account.name,
    version_name: version,
    game_directory: gameDir,
    assets_root: path.join(gameDir, "assets"),
    assets_index_name: prepared.assetsIndex,
    auth_uuid: account.id,
    auth_access_token: account.accessToken,
    clientid: "00000000-0000-0000-0000-000000000000",
    user_type: "msa",
    version_type: prepared.versionJson.type || "release",
    user_properties: "{}",
    auth_xuid: "",
    natives_directory: prepared.nativesDir,
    library_directory: path.join(gameDir, "libraries"),
    classpath: buildClasspath(prepared),
    launcher_name: "Minecraft Launcher",
    launcher_version: "1.0.0"
  };
  const args = resolveArguments(prepared.versionJson, vars, { is_demo_user: false, has_custom_resolution: false, has_quick_plays_support: false });
  const child = spawn(javaPath, [`-Xmx${Number(ram || 4)}G`, ...args], { cwd: gameDir, detached: false, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", d => onLog?.({ type: "stdout", value: d.toString() }));
  child.stderr.on("data", d => onLog?.({ type: "stderr", value: d.toString() }));
  return { pid: child.pid, prepared };
}

module.exports = { getVersionManifest, getVersion, getMinecraftAccount, prepareJavaVersion, launchJava };
