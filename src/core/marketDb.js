const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class MarketDb {
    constructor() {
        // Store DB in user data directory for persistence across builds
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'market.db');
        this.db = null;
        this.init();
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Could not connect to database', err);
            } else {
                console.log('Connected to local market database at', this.dbPath);
                this.createTables();
            }
        });
    }

    createTables() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS market_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT,
                quality INTEGER,
                enchantment INTEGER,
                city TEXT,
                price INTEGER,
                amount INTEGER,
                order_type TEXT,
                timestamp INTEGER
            )`);

            // Create indexes for faster profit calculation
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_market_lookup ON market_orders (item_id, quality, enchantment, city, order_type)`);
        });
    }

    addOrders(orders) {
        if (!orders || !Array.isArray(orders)) return;

        const stmt = this.db.prepare(`INSERT INTO market_orders (item_id, quality, enchantment, city, price, amount, order_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        this.db.serialize(() => {
            orders.forEach(o => {
                stmt.run(o.itemId, o.quality, o.enchantment, o.city, o.price, o.amount, o.order_type, Date.now());
            });
            stmt.finalize();
        });

        console.log(`[MarketDb] Saved ${orders.length} orders locally.`);
    }

    clearData() {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM market_orders`, (err) => {
                if (err) {
                    console.error('[MarketDb] Error clearing data:', err);
                    reject(err);
                } else {
                    console.log('[MarketDb] Database records cleared.');
                    resolve();
                }
            });
        });
    }

    getDatabase() {
        return this.db;
    }
}

module.exports = new MarketDb();
