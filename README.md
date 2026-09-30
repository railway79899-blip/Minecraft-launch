# Minecraft Launcher — Electron Desktop

這個專案現在是 Electron 桌面版 Launcher 外殼，可在 Windows / macOS / Linux 建置桌面程式。

## 開發

```bash
npm install
npm start
```

## 建置安裝檔

```bash
npm run build
```

electron-builder 會依目前作業系統產生對應的安裝/發行檔。

## 已加入

- Electron 桌面視窗
- 安全 preload / IPC bridge
- Java / Bedrock Edition 切換
- 本機設定保存
- 遊戲目錄選擇
- Java 執行檔選擇
- 本機 Minecraft JAR 路徑選擇
- Java 啟動程序
- Bedrock 嘗試交給系統官方 `minecraft:` 協議
- Windows / macOS / Linux electron-builder 設定

## 重要

Java 啟動功能只負責執行你指定的本機 Java 與 JAR，不包含破解、離線驗證繞過或偽造 Microsoft/Mojang 授權。

目前 Microsoft OAuth 與真正的 Minecraft 版本下載/資產/Library 管理仍需接入合法的官方授權流程；下載頁的進度仍是 UI 示意。

Bedrock 也不能當成 Java JAR 啟動；桌面版這裡會交給系統的官方 Minecraft 協議/平台處理。