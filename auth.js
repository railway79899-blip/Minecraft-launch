const crypto = require("crypto");
const http = require("http");
const { shell } = require("electron");

const AUTH_BASE = "https://login.live.com";
const CLIENT_ID = process.env.MINECRAFT_CLIENT_ID || "";

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

function pkceChallenge(verifier) {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

function parseQuery(url) {
  const u = new URL(url, "http://127.0.0.1");
  return Object.fromEntries(u.searchParams.entries());
}

function requestForm(url, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const req = require("https").request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(json.error_description || json.error || raw));
        } catch {
          reject(new Error(raw || "Microsoft OAuth 回應無法解析"));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function login({ clientId = CLIENT_ID } = {}) {
  if (!clientId) {
    throw new Error("尚未設定 Microsoft Entra Application (Client) ID。請到設定頁輸入 Client ID。");
  }

  const verifier = randomString(48);
  const challenge = pkceChallenge(verifier);
  const state = randomString(24);

  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const port = server.address().port;
  const redirectUri = `http://localhost:${port}`;
  const authUrl = new URL("/oauth20_authorize.srf", AUTH_BASE);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "XboxLive.signin offline_access");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const result = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Microsoft 登入逾時。"));
    }, 5 * 60 * 1000);

    server.on("request", async (req, res) => {
      try {
        const q = parseQuery(req.url);
        if (q.error) throw new Error(q.error_description || q.error);
        if (!q.code || q.state !== state) throw new Error("OAuth state 驗證失敗。");

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>登入完成</h2><p>可以回到 Minecraft Launcher 了。</p><script>window.close()</script>");
        clearTimeout(timeout);
        server.close();

        const tokens = await requestForm(`${AUTH_BASE}/oauth20_token.srf`, {
          client_id: clientId,
          grant_type: "authorization_code",
          code: q.code,
          redirect_uri: redirectUri,
          code_verifier: verifier
        });
        resolve(tokens);
      } catch (e) {
        clearTimeout(timeout);
        server.close();
        try {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(e.message);
        } catch {}
        reject(e);
      }
    });
  });

  await shell.openExternal(authUrl.toString());
  return result;
}

module.exports = { login };
