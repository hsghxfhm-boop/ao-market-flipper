const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
    getAppVersion: () => ipcRenderer.invoke('app-version'),
    onMarketData: (callback) => ipcRenderer.on('market-data', (event, data) => callback(data)),
    onCaptureStatus: (callback) => ipcRenderer.on('capture-status', (event, status) => callback(status)),
    onScannedCount: (callback) => ipcRenderer.on('scanned-count', (event, count) => callback(count)),
    onLocationUpdate: (callback) => ipcRenderer.on('location-update', (event, data) => callback(data)),
    onPlayerUpdate: (callback) => ipcRenderer.on('player-update', (event, playerName) => callback(playerName)),
    onIngestSuccess: (callback) => ipcRenderer.on('ingest-success', () => callback()),
    triggerManualScan: (taxRate, targetCity) => ipcRenderer.send('manual-profit-scan', taxRate, targetCity),
    startCapture: () => ipcRenderer.send('start-capture'),
    stopCapture: () => ipcRenderer.send('stop-capture'),
    clearMarketData: () => ipcRenderer.send('clear-market-data'),
    onClearDataSuccess: (callback) => ipcRenderer.on('clear-data-success', () => callback()),
    login: (key) => ipcRenderer.invoke('auth-login', key)
});
