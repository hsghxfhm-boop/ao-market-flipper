const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const packetCapture = require('./src/capture/packetCapture');
const profitEngine = require('./src/core/profitEngine');

// Global reference to prevent garbage collection
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        // We can make it frameless or styled later
        backgroundColor: '#0a0a0c', // Dark albion theme
        icon: path.join(__dirname, 'assets', 'unnamed.jpg'),
        autoHideMenuBar: true,
    });

    // Load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Open the DevTools. (Disabled by user request)
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
    // Initialize DB first

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// axios removed for offline mode

// IPC Communication endpoints
ipcMain.handle('app-version', () => {
    return app.getVersion();
});

// Register PacketCapture listeners globally once 
packetCapture.onMarketUpdate((flips) => {
    if (mainWindow) mainWindow.webContents.send('market-data', flips);
});

packetCapture.onScanCount((count) => {
    if (mainWindow) mainWindow.webContents.send('scanned-count', count);
});

packetCapture.onLocationUpdate((locationInfo) => {
    if (mainWindow) mainWindow.webContents.send('location-update', locationInfo);
});

packetCapture.onPlayerUpdate((playerName) => {
    if (mainWindow) mainWindow.webContents.send('player-update', playerName);
});

packetCapture.onIngestSuccess(() => {
    if (mainWindow) mainWindow.webContents.send('ingest-success');
});

ipcMain.on('start-capture', (event) => {
    const success = packetCapture.start();
    event.sender.send('capture-status', success ? 'active' : 'disconnected');
});

ipcMain.on('manual-profit-scan', async (event, taxRate, targetCity) => {
    try {
        const tax = taxRate !== undefined ? taxRate : 0.08;
        const target = targetCity || 'Black Market';

        console.log(`[Main] Running local profit scan (Tax: ${tax}, Target: ${target})`);
        const flips = await profitEngine.calculateFlips({
            taxRate: tax,
            minProfit: 100,
            targetCity: target
        });

        event.sender.send('market-data', flips);
    } catch (e) {
        console.error("Failed to calculate local flips", e.message);
    }
});

ipcMain.on('clear-market-data', async (event) => {
    try {
        const marketDb = require('./src/core/marketDb');
        await marketDb.clearData();
        event.sender.send('clear-data-success');
    } catch (e) {
        console.error("Failed to clear data", e.message);
    }
});

ipcMain.on('stop-capture', (event) => {
    packetCapture.stop();
    event.sender.send('capture-status', 'disconnected');
});
