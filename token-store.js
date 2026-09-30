const { safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

function createStore(file) {
  function read() {
    try {
      const raw = fs.readFileSync(file, "utf8");
      if (!raw) return null;
      const buf = Buffer.from(raw, "base64");
      return JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString("utf8"));
    } catch { return null; }
  }
  function write(value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text = JSON.stringify(value);
    const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, "utf8");
    fs.writeFileSync(file, buf.toString("base64"), "utf8");
  }
  return { read, write, clear: () => { try { fs.unlinkSync(file); } catch {} } };
}
module.exports = { createStore };
