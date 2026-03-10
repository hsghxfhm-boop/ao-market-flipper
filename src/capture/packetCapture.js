const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const locations = require('../core/locations.json');
const marketDb = require('../core/marketDb');

class PacketCapture {
    constructor() {
        this.clientProcess = null;
        this.isCapturing = false;
        this.marketListeners = [];
        this.scanListeners = [];
        this.locationListeners = [];
        this.ingestListeners = [];
        this.app = express();
        this.server = null;
        this.port = 3333;

        // Express Middleware Setup
        this.app.use(bodyParser.json({ limit: '10mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
        // Catch all raw text for non-standard headers
        this.app.use(bodyParser.text({ type: '*/*', limit: '10mb' }));

        // UNIVERSAL INTERCEPTOR
        this.app.use((req, res, next) => {
            if (req.method === 'POST') {
                process.stdout.write(`\n[Sunucu] Paket Yakalandı: ${req.url}\n`);

                try {
                    let data = req.body;

                    // --- RAW JSON DUMP ---
                    if (data && req.url.includes('marketorders')) {
                        process.stdout.write(`[HAM VERI] ${JSON.stringify(data).substring(0, 300)}...\n`);
                    }


                    // String gelmişse JSON parse etmeye çalış
                    if (data && typeof data === 'string') {
                        const trimmed = data.trim();
                        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                            try {
                                data = JSON.parse(trimmed);
                            } catch (e) {
                                process.stdout.write(`[Sunucu] JSON Parse Hatası: ${e.message}\n`);
                            }
                        }
                    }

                    // Veri yapısını kontrol et
                    let rawOrders = [];
                    if (Array.isArray(data)) {
                        rawOrders = data;
                    } else if (data && data.Orders && Array.isArray(data.Orders)) {
                        rawOrders = data.Orders;
                    }

                    if (rawOrders && rawOrders.length > 0) {
                        process.stdout.write(`[Sunucu] Parselenecek Emir Sayısı: ${rawOrders.length}\n`);

                        // --- EN GUARANTILI LOKASYON BULUCU ---
                        const locs = new Set();
                        rawOrders.forEach(o => {
                            if (o.LocationId !== undefined) locs.add(o.LocationId);
                        });
                        if (locs.size > 0) {
                            process.stdout.write(`\n=== DİKKAT! ŞEHİR KODLARI: ${Array.from(locs).join(', ')} ===\n\n`);
                        }

                        this.scanListeners.forEach(cb => cb(rawOrders.length));
                        this._processAndNotify(rawOrders);
                    } else {
                        const keys = (data && typeof data === 'object') ? Object.keys(data).join(',') : 'none';
                        process.stdout.write(`[Sunucu] Geçersiz veya boş veri yapısı. (Tip: ${typeof data}, Keys: ${keys})\n`);
                    }

                } catch (err) {
                    process.stdout.write(`[Sunucu] Kritik HATA: ${err.message}\n`);
                }

                return res.sendStatus(200);
            }
            next();
        });
    }

    onMarketUpdate(callback) {
        this.marketListeners.push(callback);
    }

    onScanCount(callback) {
        this.scanListeners.push(callback);
    }

    onLocationUpdate(callback) {
        this.locationListeners.push(callback);
    }

    onPlayerUpdate(callback) {
        this.playerListeners = this.playerListeners || [];
        this.playerListeners.push(callback);
    }

    onIngestSuccess(callback) {
        this.ingestListeners.push(callback);
    }

    start() {
        if (this.isCapturing) return;

        try {
            if (!this.server) {
                this.server = this.app.listen(this.port, () => {
                    console.log(`[Sistem] Yerel Ingest sunucusu ${this.port} portunda dinleniyor...`);
                });
            }

            const isDev = !require('electron').app.isPackaged;
            const resourcesPath = isDev ? path.join(__dirname, '..', '..') : process.resourcesPath;
            const exePath = path.join(resourcesPath, 'MarketTracerSniffer.exe');

            console.log(`[Sistem] Custom Sniffer başlatılıyor: ${exePath}`);

            // Parametreleri artık Go kodunda hallettik (hardcoded)
            // windowsHide: true ile görev çubuğunda ve ekranda çıkmasını engelleriz
            this.clientProcess = spawn(exePath, [], {
                windowsHide: true,
                detached: false // Keep it attached to Node so it dies when the app dies
            });

            const fs = require('fs');
            const logPath = path.join(resourcesPath, 'capture.log');
            const logStream = fs.createWriteStream(logPath, { flags: 'a' });

            this.clientProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                logStream.write(`[INFO] ${new Date().toISOString()} ${output}\n`);

                // Parse Location from stdout
                const locMatch = output.match(/Updating player location to (\d+)/i);
                if (locMatch) {
                    const locId = parseInt(locMatch[1], 10);
                    let cityName = locId.toString();
                    if (locations[locId] || locations[cityName]) {
                        cityName = locations[locId] || locations[cityName];
                    }
                    switch (locId) {
                        case 4000:
                        case 4002: cityName = 'Fort Sterling'; break;
                        case 3000:
                        case 1002: cityName = 'Lymhurst'; break;
                        case 4:
                        case 2004: cityName = 'Bridgewatch'; break;
                        case 2000:
                        case 7: cityName = 'Thetford'; break;
                        case 1000:
                        case 3008: cityName = 'Martlock'; break;
                        case 3005: cityName = 'Caerleon'; break;
                        case 3003: cityName = 'Black Market'; break;
                        case 5000:
                        case 5003: cityName = 'Brecilien'; break;
                    }
                    this.locationListeners.forEach(cb => cb({ id: locId, name: cityName }));
                }

                // Parse Player Name
                const playerMatch = output.match(/Updating player to ([^\.]+)\./i);
                if (playerMatch) {
                    const playerName = playerMatch[1].trim();
                    if (this.playerListeners) {
                        this.playerListeners.forEach(cb => cb(playerName));
                    }
                }
            });

            this.clientProcess.stderr.on('data', (data) => {
                const output = data.toString().trim();
                console.error(`[DataClient HATA]: ${output}`);
                logStream.write(`[ERROR] ${new Date().toISOString()} ${output}\n`);
            });

            this.clientProcess.on('close', (code) => {
                console.log(`[Sistem] Data client ${code} kodu ile kapandı.`);
                this.isCapturing = false;
            });

            this.isCapturing = true;
            return true;
        } catch (e) {
            console.error('[Hata] Gömülü paket yakalayıcı başlatılamadı.', e);
            this.isCapturing = false;
            return false;
        }
    }

    stop() {
        if (!this.isCapturing) return;
        if (this.clientProcess) this.clientProcess.kill();
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.isCapturing = false;
        console.log('[Sistem] Yerel sunucu ve Data Client durduruldu.');
    }

    async _processAndNotify(rawOrders) {
        try {
            const parsedOrders = [];
            const timestamp = Date.now();

            if (rawOrders.length > 0) {
                const sample = rawOrders[0];
                process.stdout.write(`[DEBUG ÖRNEK PAKET] İçi: ${JSON.stringify(sample).substring(0, 150)}\n`);
            }

            rawOrders.forEach(msg => {
                const itemId = msg.ItemId || msg.ItemTypeId || msg.Item || msg.EquipmentItem;

                let price = null;
                if (msg.Price != null) {
                    price = msg.Price;
                } else if (msg.UnitPriceSilver != null) {
                    price = msg.UnitPriceSilver / 10000;
                }

                if (!itemId || price == null) {
                    process.stdout.write(`[DEBUG Düşen Paket] Neden: ${!itemId ? 'No ID' : 'No Price'}. Keys: ${Object.keys(msg).join(',')} | Değerler: ${JSON.stringify(msg).substring(0, 50)}\n`);
                    return;
                }

                const orderType = msg.AuctionType === 'request' ? 'buy' : 'sell';
                const locId = parseInt(msg.LocationId, 10);

                let cityName = locId ? locId.toString() : 'Unknown';
                if (locations[locId] || locations[cityName]) {
                    cityName = locations[locId] || locations[cityName];
                }

                // Fallback to manual overrides if not in the official json
                switch (locId) {
                    case 4000:
                    case 4002: cityName = 'Fort Sterling'; break;
                    case 3000:
                    case 1002: cityName = 'Lymhurst'; break;
                    case 4:
                    case 2004: cityName = 'Bridgewatch'; break;
                    case 2000:
                    case 7: cityName = 'Thetford'; break;
                    case 1000:
                    case 3008: cityName = 'Martlock'; break;
                    case 3005: cityName = 'Caerleon'; break;
                    case 3003: cityName = 'Black Market'; break;
                    case 5000:
                    case 5003: cityName = 'Brecilien'; break;
                }

                // Notify the UI of the current location once per capture batch
                this.locationListeners.forEach(cb => cb({ id: locId, name: cityName }));



                parsedOrders.push({
                    itemId: itemId,
                    quality: msg.QualityLevel || 1,
                    enchantment: msg.EnchantmentLevel || 0,
                    city: cityName,
                    price: price,
                    amount: msg.Amount || 1,
                    order_type: orderType,
                    timestamp: timestamp
                });
            });

            if (parsedOrders.length === 0) return;

            // ---- LOCAL STORAGE (Offline Mode) ----
            marketDb.addOrders(parsedOrders);

            // Notify UI that new data is available locally
            this.ingestListeners.forEach(cb => cb());
        } catch (e) {
            process.stdout.write(`[_processAndNotify HATA] ${e.message}\n`);
        }
    }

    setSession(session) {
        // Obsolete in offline mode, kept for compatibility if called
    }
}

module.exports = new PacketCapture();