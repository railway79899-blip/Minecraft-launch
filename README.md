# Minecraft Launcher — Electron Desktop

這個專案是 Electron 桌面應用程式，不只是瀏覽器網頁。

## 啟動桌面版

npm install
npm start

## 建立安裝檔

Windows：npm run build:win
macOS：npm run build:mac
Linux：npm run build:linux

輸出會放在 dist/。

## 桌面版功能

- Electron BrowserWindow
- contextIsolation + preload IPC
- 本機設定保存
- Java / Bedrock Edition 切換
- 遊戲目錄、Java、JAR 選擇
- Java 程序啟動
- Bedrock 交給系統官方 minecraft: 協議
- Windows NSIS 安裝程式
- macOS DMG
- Linux AppImage
- GitHub Actions 自動建立三平台安裝檔

## 注意

這個 Electron 外殼不繞過 Microsoft/Mojang 授權。

目前 Java 啟動器會執行使用者指定的本機 Java/JAR；完整的官方 Minecraft Java 啟動流程仍需要合法的 Microsoft OAuth、版本 manifest、libraries、assets、access token 與遊戲參數。

Bedrock 不使用 Java JAR，因此桌面版會使用系統的官方 Minecraft 協議/平台。

## GitHub Actions

推送到 main 或手動執行 workflow 後，GitHub Actions 會在 Windows、macOS、Linux 建立安裝檔並放進 Actions Artifacts。
