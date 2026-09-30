# Minecraft Launcher — Electron Desktop

這個專案現在是 **Electron 桌面版的合法 Minecraft Launcher 架構**，不是單純網頁。

## 已完成的流程

1. 使用 Microsoft OAuth 2.0 + PKCE 登入。
2. 透過 Xbox Live / XSTS 取得 Minecraft Services 授權。
3. 檢查 Minecraft Java Edition entitlement。
4. 取得玩家 UUID、Java Edition 玩家名稱與已授權的 skin/cape 資訊。
5. 使用 Electron safeStorage 加密保存登入 session。
6. Microsoft refresh token 到期前自動更新 session。
7. 從 Mojang 官方 version manifest 取得正式版。
8. 自動下載合法版本的 client JAR、libraries、natives 與 assets。
9. 驗證下載檔 SHA-1。
10. 建立 classpath、natives、遊戲參數與授權參數。
11. 使用本機 Java 啟動選定版本。
12. Bedrock 仍交給系統安裝的官方 Minecraft 啟動協議。

## 第一次使用

### 1. 建立 Microsoft 應用程式

到 Microsoft Entra admin center 建立 Desktop / Public Client App，取得 **Application (Client) ID**。

在 Authentication / Mobile and desktop applications 中加入 localhost redirect URI。這個 Electron 啟動器會在登入時使用本機 loopback callback。

**不要把 client secret 放進 Electron 桌面程式。**

### 2. 在 Launcher 設定 Client ID

啟動：

```bash
npm install
npm start
```

到「設定」貼上你的 Application (Client) ID。

### 3. 設定 Java

在「設定」選擇已安裝的 Java 執行檔。

Minecraft Java 不會繞過 Microsoft/Mojang 授權；啟動前必須有合法的 Microsoft Minecraft Java entitlement。

## 建立安裝檔

Windows：

```bash
npm run build:win
```

macOS：

```bash
npm run build:mac
```

Linux：

```bash
npm run build:linux
```

輸出在 `dist/`。

## 技術架構

- Electron BrowserWindow
- contextIsolation + preload IPC
- Microsoft OAuth 2.0 Authorization Code + PKCE
- 本機 loopback OAuth callback
- Xbox Live → XSTS → Minecraft Services
- Minecraft entitlement/profile
- Electron safeStorage session storage
- 官方 Mojang version manifest
- 官方 client/library/assets download
- SHA-1 完整性驗證
- natives extraction
- Minecraft arguments / JVM arguments
- Java process launcher
- Windows NSIS / macOS DMG / Linux AppImage
- GitHub Actions 三平台建置

## 合法性與限制

本專案不實作：

- 破解帳號
- offline/cracked authentication
- 偽造 Microsoft/Xbox/Minecraft token
- 繞過 entitlement
- 下載或散布未授權遊戲內容

啟動所需的帳號授權與遊戲擁有權仍由 Microsoft / Minecraft Services 驗證。

## 重要設定

Client ID 不是 client secret。Electron 桌面應用屬於 public client，不應在應用程式內保存 confidential client secret。

官方 Microsoft 文件：

- Desktop app authentication / redirect URI
- OAuth authorization code flow

本專案下載的 Minecraft Java metadata 與遊戲檔會直接依照官方 version manifest 中的 URL 與 SHA-1 資訊處理。

## GitHub Actions

推送到 `main` 或手動執行 workflow 後，GitHub Actions 會建立 Windows、macOS、Linux 安裝檔並放入 Actions Artifacts。
