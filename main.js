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
