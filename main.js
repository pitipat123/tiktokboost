const { app, BrowserWindow, ipcMain, net, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let store;

// Initialize store lazily
function getStore() {
    if (!store) {
        const Store = require('electron-store');
        store = new Store();
    }
    return store;
}

// ===== AUTO-UPDATER =====
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
    autoUpdater.on('update-available', (info) => {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'อัปเดตใหม่!',
            message: `พบเวอร์ชันใหม่ v${info.version}\nต้องการดาวน์โหลดและติดตั้งไหม?`,
            buttons: ['ดาวน์โหลด', 'ไว้ก่อน'],
            defaultId: 0
        }).then(result => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate();
                if (mainWindow) mainWindow.webContents.send('update-status', 'downloading');
            }
        });
    });

    autoUpdater.on('update-not-available', () => {
        if (mainWindow) mainWindow.webContents.send('update-status', 'update-not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
        if (mainWindow) mainWindow.webContents.send('update-progress', Math.round(progress.percent));
    });

    autoUpdater.on('update-downloaded', () => {
        if (mainWindow) mainWindow.webContents.send('update-status', 'update-downloaded');
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'อัปเดตพร้อมแล้ว!',
            message: 'ดาวน์โหลดเสร็จแล้ว ต้องการรีสตาร์ทเพื่อติดตั้งเลยไหม?',
            buttons: ['รีสตาร์ทเลย', 'เดี๋ยวก่อน'],
            defaultId: 0
        }).then(result => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.log('Update error:', err.message);
    });

    // Check for updates after 5 seconds
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => { });
    }, 5000);
}

// IPC: Manual check for updates
ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { version: result?.updateInfo?.version || null };
    } catch (e) {
        return { error: e.message };
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'TikTok Boost Manager - Unified Platform',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        backgroundColor: '#0d1117',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0d1117',
            symbolColor: '#ffffff',
            height: 36
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webviewTag: true,
            spellcheck: false
        }
    });

    mainWindow.loadFile('app.html');

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ===== API PROXY — bypass CORS =====
ipcMain.handle('api-call', async (event, { url, body }) => {
    return new Promise((resolve, reject) => {
        try {
            // Use form-urlencoded (universally accepted by all SMM panel APIs)
            const postData = Object.entries(body)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const httpModule = urlObj.protocol === 'https:' ? require('https') : require('http');

            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ error: 'Invalid JSON response', raw: data.substring(0, 500) });
                    }
                });
            });

            req.on('error', (e) => {
                resolve({ error: e.message });
            });

            req.setTimeout(30000, () => {
                req.destroy();
                resolve({ error: 'Request timeout (30s)' });
            });

            req.write(postData);
            req.end();
        } catch (e) {
            resolve({ error: e.message });
        }
    });
});

// ===== SETTINGS IPC =====
ipcMain.handle('get-settings', () => {
    try {
        return getStore().get('settings', {});
    } catch {
        return {};
    }
});

ipcMain.handle('save-settings', (event, settings) => {
    try {
        getStore().set('settings', settings);
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('get-presets', () => {
    try {
        return getStore().get('presets', {});
    } catch {
        return {};
    }
});

ipcMain.handle('save-presets', (event, presets) => {
    try {
        getStore().set('presets', presets);
        return true;
    } catch {
        return false;
    }
});

// ===== PRESET SYNC via jsonblob.com (no auth needed) =====
function jsonBlobRequest(method, blobId, data = null) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const reqPath = blobId ? `/api/jsonBlob/${blobId}` : '/api/jsonBlob';
        const postData = data ? JSON.stringify(data) : null;
        const options = {
            hostname: 'jsonblob.com',
            path: reqPath,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`[Sync] ${method} ${reqPath} → ${res.statusCode} (${body.length} bytes)`);

                // POST: create new blob
                if (method === 'POST') {
                    if (res.statusCode === 201 && res.headers.location) {
                        const id = res.headers.location.split('/').pop();
                        resolve({ success: true, syncCode: id });
                    } else {
                        resolve({ error: `Upload failed (HTTP ${res.statusCode})` });
                    }
                    return;
                }

                // PUT: update existing blob
                if (method === 'PUT') {
                    if (res.statusCode === 200) {
                        resolve({ success: true });
                    } else {
                        resolve({ error: `Update failed (HTTP ${res.statusCode})` });
                    }
                    return;
                }

                // GET: download blob
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(body)); }
                    catch { resolve({ error: 'Invalid response data' }); }
                } else if (res.statusCode === 404) {
                    resolve({ error: 'Sync code not found — อาจหมดอายุหรือพิมพ์ผิด' });
                } else {
                    resolve({ error: `Download failed (HTTP ${res.statusCode})` });
                }
            });
        });
        req.on('error', e => reject(e));
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout — ลองใหม่อีกครั้ง')); });
        if (postData) req.write(postData);
        req.end();
    });
}

// Upload presets → get sync code
ipcMain.handle('sync-upload-presets', async (event, presets) => {
    try {
        let syncCode = getStore().get('sync_code', null);

        // Try updating existing blob
        if (syncCode) {
            const putResult = await jsonBlobRequest('PUT', syncCode, presets);
            if (putResult.success) {
                console.log(`[Sync] Updated existing blob: ${syncCode}`);
                return { success: true, syncCode };
            }
            // Old blob expired/deleted, create new one
            console.log(`[Sync] PUT failed (${putResult.error}), creating new blob...`);
        }

        // Create new blob
        const result = await jsonBlobRequest('POST', null, presets);
        if (result.success && result.syncCode) {
            getStore().set('sync_code', result.syncCode);
            console.log(`[Sync] Created new blob: ${result.syncCode}`);
            return { success: true, syncCode: result.syncCode };
        }
        return { error: result.error || 'Failed to upload' };
    } catch (e) {
        return { error: e.message };
    }
});

// Download presets by sync code
ipcMain.handle('sync-download-presets', async (event, syncCode) => {
    try {
        if (!syncCode) return { error: 'No sync code provided' };
        const presets = await jsonBlobRequest('GET', syncCode);
        if (presets && !presets.error) {
            getStore().set('presets', presets);
            getStore().set('sync_code', syncCode);
            return { success: true, presets };
        }
        return { error: 'Invalid sync code or data not found' };
    } catch (e) {
        return { error: e.message };
    }
});
