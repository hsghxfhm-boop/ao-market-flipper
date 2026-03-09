const marketDb = require('./marketDb');
const path = require('path');
const fs = require('fs');

// Load items for name mapping
const itemsPath = path.join(__dirname, '..', '..', 'items.json');
let itemsMap = {};
try {
    itemsMap = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
} catch (e) {
    console.warn('[ProfitEngine] items.json not found, item names will be IDs only.');
}

class ProfitEngine {
    constructor() {
        this.db = marketDb.getDatabase();
    }

    async calculateFlips(options = {}) {
        const {
            taxRate = 0.08,
            minProfit = 1000,
            targetCity = 'Black Market'
        } = options;

        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    sell.item_id as itemId,
                    sell.enchantment,
                    sell.quality,
                    sell.city as sourceCity,
                    sell.price as buyPrice,
                    sell.timestamp as buyDataAge,
                    
                    buy.city as targetCity,
                    buy.price as sellPrice,
                    buy.timestamp as sellDataAge,
                    
                    (buy.price - sell.price - (buy.price * ?)) as profit
                    
                FROM (
                    SELECT item_id, enchantment, quality, city, MIN(price) as price, timestamp
                    FROM market_orders
                    WHERE order_type = 'sell' AND city != ?
                    GROUP BY item_id, enchantment, quality, city
                ) sell
                
                JOIN (
                    SELECT item_id, enchantment, quality, city, MAX(price) as price, timestamp
                    FROM market_orders
                    WHERE order_type = 'buy' AND city = ?
                    GROUP BY item_id, enchantment, quality
                ) buy 
                ON sell.item_id = buy.item_id AND sell.quality = buy.quality AND sell.enchantment = buy.enchantment
                
                WHERE (buy.price - sell.price - (buy.price * ?)) >= ?
                ORDER BY profit DESC
                LIMIT 100
            `;

            marketDb.getDatabase().all(query, [taxRate, targetCity, targetCity, taxRate, minProfit], (err, rows) => {
                if (err) {
                    console.error("[ProfitEngine] DB Error:", err);
                    return reject(err);
                }

                const results = rows.map(row => {
                    let baseItemId = row.itemId;
                    if (row.enchantment > 0 && baseItemId.includes(`@${row.enchantment}`)) {
                        baseItemId = baseItemId.replace(`@${row.enchantment}`, '');
                    }
                    const localName = itemsMap[baseItemId] || baseItemId;

                    return {
                        ...row,
                        itemName: localName,
                        roi: (row.profit / row.buyPrice) * 100,
                        timestamp: Math.max(row.buyDataAge, row.sellDataAge)
                    };
                });

                resolve(results);
            });
        });
    }
}

module.exports = new ProfitEngine();
