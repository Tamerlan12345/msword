## 2024-05-22 - [Refactor Sync I/O in WOPI PutFile]
**Learning:** `fs.writeFileSync` in a high-traffic endpoint like WOPI `PutFile` blocks the Node.js event loop, causing performance degradation. Replacing it with `fs.promises.writeFile` is a critical optimization.
**Action:** Always audit file I/O operations in Express controllers and prefer asynchronous methods (`fs.promises.*`).
