# Minecraft Launcher Web + Cloud API

本專案已升級為「瀏覽器版 Launcher + Cloudflare Worker API」。

## 網頁版

預定 GitHub Pages 網址：
https://railway79899-blip.github.io/Minecraft-launch/

功能：
- Microsoft OAuth 2.0 + PKCE（MSAL Browser）
- Minecraft Java entitlement/profile 驗證
- 玩家名稱、UUID、skin 頭像
- Mojang 官方 Java release version manifest
- 版本選擇與雲端 API 狀態
- GitHub Pages 自動部署

## Cloud API

Cloudflare Worker `api/worker.js`：
- `GET /api/health`
- `GET /api/versions`
- `POST /api/account`

`/api/account` 在請求期間使用 Microsoft access token，完成 Microsoft → Xbox Live → XSTS → Minecraft Services 驗證，不保存 Microsoft refresh token。

## 部署 Cloudflare Worker

```bash
npx wrangler login
npx wrangler deploy
```

部署後把 Worker URL 填到網頁「設定」的 Cloud API URL。預設值是假設的 `https://minecraft-launch-api.workers.dev`，若尚未部署會顯示 Offline。

## Microsoft Entra

建立 Single-page application，Redirect URI 設為：

`https://railway79899-blip.github.io/Minecraft-launch/`

把 Application (Client) ID 貼到網頁「設定」。不要把 client secret 放進前端。

## 重要限制

普通瀏覽器不能直接執行使用者電腦上的 Java，也不能直接控制 `.minecraft` 或啟動本機程序。因此目前網頁版負責雲端登入、Minecraft 帳號、版本資料與雲端狀態；真正的一鍵本機 Java 啟動需要另外安裝 Desktop Agent。

本專案不實作破解、offline/cracked authentication、偽造 token、繞過 Minecraft entitlement 或散布未授權遊戲內容。

原 Electron 程式檔案仍保留在 repository，可作為未來 Desktop Agent 的基礎。
