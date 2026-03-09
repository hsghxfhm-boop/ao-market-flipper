// State
let mockDataMode = false; // Set to true to test UI without game running
let marketFlips = [];
const state = {
    isCapturing: false,
    scannedCount: 0,
    flipCount: 0,
    filters: {
        city: 'all',
        targetCity: 'Black Market',
        minProfit: 1000,
        minRoi: 5,
        tiers: ['4', '5', '6', '7', '8'],
        enchantments: ['0', '1', '2', '3', '4'],
        qualities: ['1', '2', '3', '4', '5'],
        category: 'all'
    },
    sortBy: 'profit-desc'
};

// DOM Elements
const els = {
    btnCapture: document.getElementById('btn-capture'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    flipsList: document.getElementById('flips-list'),
    statScanned: document.getElementById('stat-scanned'),
    statFlips: document.getElementById('stat-flips'),
    version: document.getElementById('app-version'),

    // Filters
    filterCity: document.getElementById('filter-city'),
    filterTarget: document.getElementById('filter-target'),
    filterMinProfit: document.getElementById('filter-min-profit'),
    filterMinRoi: document.getElementById('filter-min-roi'),
    filterTiers: document.getElementById('filter-tiers'),
    filterEnchantment: document.getElementById('filter-enchantment'),
    filterQuality: document.getElementById('filter-quality'),
    filterCategory: document.getElementById('filter-category'),
    filterPremium: document.getElementById('filter-premium'),
    sortBy: document.getElementById('sort-by'),
    btnScan: document.getElementById('btn-scan'),
    btnClear: document.getElementById('btn-clear')
};



// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');

    // Offline mode: Hide login always
    if (loginOverlay) loginOverlay.classList.add('hidden');

    initApp();
});

async function initApp() {

    if (window.api) {
        els.version.textContent = `v${await window.api.getAppVersion()}`;

        // Listen for IPC events
        window.api.onCaptureStatus((status) => updateCaptureStatus(status));
        window.api.onMarketData((data) => handleNewMarketData(data));
        window.api.onScannedCount((count) => {
            state.scannedCount += count;
            els.statScanned.textContent = state.scannedCount.toLocaleString();
        });

        window.api.onLocationUpdate((data) => {
            if (data.name !== 'Unknown') {
                document.getElementById('current-map').textContent = data.name;
            }
        });

        window.api.onPlayerUpdate((playerName) => {
            document.getElementById('player-name').textContent = playerName;
        });

        window.api.onIngestSuccess(() => {
            handleNewIngest();
        });

        window.api.onClearDataSuccess(() => {
            handleDataCleared();
        });
    }

    setupEventListeners();
}

function getQualityName(q) {
    switch (parseInt(q)) {
        case 1: return "Normal";
        case 2: return "Good";
        case 3: return "Outstanding";
        case 4: return "Excellent";
        case 5: return "Masterpiece";
        default: return `Q${q}`;
    }
}

function setupEventListeners() {
    els.btnCapture.addEventListener('click', toggleCapture);
    els.btnScan.addEventListener('click', () => {
        if (window.api) {
            const taxRate = els.filterPremium.checked ? 0.04 : 0.08;
            window.api.triggerManualScan(taxRate, state.filters.targetCity);
        }
    });

    els.filterCity.addEventListener('change', (e) => {
        state.filters.city = e.target.value;
        renderFlips();
    });

    els.filterTarget.addEventListener('change', (e) => {
        state.filters.targetCity = e.target.value;
        // Trigger a fresh scan when target city changes to update server perspective
        const taxRate = els.filterPremium.checked ? 0.04 : 0.08;
        window.api.triggerManualScan(taxRate, state.filters.targetCity);
    });

    els.filterCategory.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        renderFlips();
    });

    els.filterMinProfit.addEventListener('input', (e) => {
        state.filters.minProfit = parseInt(e.target.value) || 0;
        renderFlips();
    });

    els.filterMinRoi.addEventListener('input', (e) => {
        state.filters.minRoi = parseInt(e.target.value) || 0;
        renderFlips();
    });

    els.sortBy.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderFlips();
    });

    els.filterPremium.addEventListener('change', () => {
        renderFlips();
    });

    els.btnClear.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all historical market records?')) {
            window.api.clearMarketData();
        }
    });

    // Checkboxes
    const tierChecks = els.filterTiers.querySelectorAll('input[type="checkbox"]');
    tierChecks.forEach(cb => {
        cb.addEventListener('change', () => {
            state.filters.tiers = Array.from(tierChecks).filter(c => c.checked).map(c => c.value);
            renderFlips();
        });
    });

    const enchantmentChecks = els.filterEnchantment.querySelectorAll('input[type="checkbox"]');
    enchantmentChecks.forEach(cb => {
        cb.addEventListener('change', () => {
            state.filters.enchantments = Array.from(enchantmentChecks).filter(c => c.checked).map(c => c.value);
            renderFlips();
        });
    });

    const qualityChecks = els.filterQuality.querySelectorAll('input[type="checkbox"]');
    qualityChecks.forEach(cb => {
        cb.addEventListener('change', () => {
            state.filters.qualities = Array.from(qualityChecks).filter(c => c.checked).map(c => c.value);
            renderFlips();
        });
    });
}

function toggleCapture() {
    if (state.isCapturing) {
        if (window.api) window.api.stopCapture();
        updateCaptureStatus('disconnected');
        if (mockDataMode) clearInterval(window.mockInterval);
    } else {
        if (window.api) window.api.startCapture();
        updateCaptureStatus('connecting');
        setTimeout(() => updateCaptureStatus('active'), 1000); // simulate connection success

        if (mockDataMode) startMockData();
    }
}

function updateCaptureStatus(status) {
    state.isCapturing = status !== 'disconnected';
    els.statusDot.className = `dot ${status}`;

    switch (status) {
        case 'disconnected':
            els.statusText.textContent = 'Disconnected';
            els.btnCapture.textContent = 'Start Capture';
            els.btnCapture.className = 'btn primary';
            break;
        case 'connecting':
            els.statusText.textContent = 'Connecting via Npcap...';
            els.btnCapture.textContent = 'Cancel';
            break;
        case 'active':
            els.statusText.textContent = 'Listening to Game Traffic';
            els.btnCapture.textContent = 'Stop Capture';
            els.btnCapture.className = 'btn danger';
            // Clear empty state if needed
            if (els.flipsList.innerHTML.includes('Waiting')) {
                els.flipsList.innerHTML = '';
            }
            break;
    }
}

let ingestDebounce = null;
function handleNewIngest() {
    clearTimeout(ingestDebounce);
    // Debounce to prevent server database hammering from aggressive in-game captures
    ingestDebounce = setTimeout(() => {
        if (!state.isCapturing) return;
        console.log('[IPC] New local packet ingested. UI fetching flips...');
        if (window.api) els.btnScan.click(); // Triggers the manual scan logic with all current UI settings
    }, 1500); // Wait 1.5 seconds after last ingest packet before querying DB
}

function handleDataCleared() {
    console.log('[IPC] Market data cleared.');
    state.scannedCount = 0;
    state.flipCount = 0;
    marketFlips = []; // Clear current session flips
    els.statScanned.textContent = '0';
    els.statFlips.textContent = '0';
    renderFlips();
    alert('Historical market data has been cleared.');
}

function handleNewMarketData(flips) {
    console.log(`[IPC] Received new market data block:`, flips);
    if (!flips || flips.length === 0) return;

    // Update overall list, replacing existing items or adding new ones
    flips.forEach(newFlip => {
        const existingIdx = marketFlips.findIndex(f => f.itemId === newFlip.itemId && f.quality === newFlip.quality);
        if (existingIdx !== -1) {
            marketFlips[existingIdx] = newFlip;
        } else {
            marketFlips.push(newFlip);
        }
    });


    renderFlips();
}

function getTierBadge(itemId) {
    const match = itemId.match(/^T(\d)/);
    if (match) {
        const tier = match[1];
        return `<span class="badge t${tier}">Tier ${tier}</span>`;
    }
    return '';
}

function getTierNumber(itemId) {
    const match = itemId.match(/^T(\d)/);
    return match ? match[1] : '4';
}

function renderFlips() {
    // 0. Recalculate all profits dynamically based on selected tax rate
    const taxRate = els.filterPremium.checked ? 0.04 : 0.08;
    marketFlips.forEach(flip => {
        flip.profit = flip.sellPrice - flip.buyPrice - (flip.sellPrice * taxRate);
        flip.roi = (flip.profit / flip.buyPrice) * 100;
    });

    // 1. Filter
    console.log(`[RENDER] Total flips to review: ${marketFlips.length}`);
    const filtered = marketFlips.filter(flip => {
        // City filters
        if (state.filters.city !== 'all' && flip.sourceCity !== state.filters.city) return false;
        if (flip.targetCity !== state.filters.targetCity) return false;

        // Profit/ROI filters
        if (flip.profit < state.filters.minProfit) return false;
        if (flip.roi < state.filters.minRoi) return false;

        // Tier filter
        const tier = getTierNumber(flip.itemId);
        if (!state.filters.tiers.includes(tier)) return false;

        // Enchantment filter
        const enchant = flip.enchantment.toString();
        if (!state.filters.enchantments.includes(enchant)) return false;

        // Quality filter
        const quality = flip.quality.toString();
        if (!state.filters.qualities.includes(quality)) return false;

        // Category filter
        if (state.filters.category !== 'all') {
            const cat = state.filters.category;
            const id = flip.itemId;
            let match = false;

            if (cat === 'WEAPON') {
                match = id.includes('_MAIN_') || id.includes('_2H_') || id.includes('_OFF_');
            } else if (cat === 'ARMOR') {
                match = id.includes('_HEAD_') || id.includes('_BODY_') || id.includes('_SHOES_') || id.includes('_ARMOR_');
            } else if (cat === 'ACCESSORIES') {
                match = id.includes('_BAG') || id.includes('_CAPE');
            } else if (cat === 'CONSUMABLE') {
                match = id.includes('_POTION') || id.includes('_MEAL') || id.includes('_FOOD');
            } else if (cat === 'MOUNT') {
                match = id.includes('_MOUNT') || id.includes('UNIQUE_MOUNT');
            }

            if (!match) return false;
        }

        return true;
    });
    console.log(`[RENDER] Surviving flips: ${filtered.length}`);


    // 2. Sort
    filtered.sort((a, b) => {
        switch (state.sortBy) {
            case 'profit-desc': return b.profit - a.profit;
            case 'roi-desc': return b.roi - a.roi;
            case 'recent': return b.timestamp - a.timestamp;
            default: return 0;
        }
    });

    // 3. Update UI
    state.flipCount = filtered.length;
    els.statFlips.textContent = state.flipCount;

    if (filtered.length === 0) {
        if (state.isCapturing) {
            els.flipsList.innerHTML = `<div class="empty-state">
        <div class="icon">🔍</div>
        <h3>No Profitable Flips Found</h3>
        <p>Try adjusting your filters or checking a different market in-game.</p>
      </div>`;
        }
        return;
    }

    els.flipsList.innerHTML = filtered.map(flip => {
        // Format money
        const fmt = (num) => Math.round(num).toLocaleString('en-US');
        const timeAgo = Math.round((Date.now() - flip.timestamp) / 1000) || 1;
        let timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;
        if (mockDataMode) timeStr = 'Just now';

        // Use itemName from server, or fallback to itemId
        const itemName = flip.itemName || flip.itemId;

        // Safely extract enchantments for the badge
        const enchantMatch = flip.itemId.match(/@(\d+)/);
        let enchantBadge = '';
        if (enchantMatch) {
            const level = enchantMatch[1];
            enchantBadge = `<span class="badge enchant-${level}">.${level} Enchant</span>`;
        } else {
            enchantBadge = `<span class="badge enchant-0">.0 Enchant</span>`;
        }

        const qName = getQualityName(flip.quality);

        return `
      <div class="flip-card">
        <div class="time-ago">${timeStr}</div>
        
        <div class="card-header">
          <img src="https://render.albiononline.com/v1/item/${flip.itemId}.png" class="item-icon">
          <div class="item-info">
            <div class="item-title" title="${itemName}">${itemName}</div>
            <div class="item-meta">
              ${getTierBadge(flip.itemId)}
              ${enchantBadge}
              <span class="badge quality-${flip.quality}">${qName}</span>
            </div>
          </div>
        </div>
        
        <div class="price-row">
          <div class="city-col">
            <span class="city-name">${flip.sourceCity} (Ours)</span>
            <span class="price">${fmt(flip.buyPrice)}</span>
          </div>
          <span class="arrow">→</span>
          <div class="city-col right">
            <span class="city-name">${flip.targetCity} (Sell)</span>
            <span class="price">${fmt(flip.sellPrice)}</span>
          </div>
        </div>
        
        <div class="profit-row">
          <span class="profit-label">Net Profit (After Tax)</span>
          <div>
            <span class="profit-val">+${fmt(flip.profit)}</span>
            <span class="roi-val">(${flip.roi.toFixed(1)}%)</span>
          </div>
        </div>
      </div>
    `;
    }).join('');
}


// --- Mock Data Generator for Dev ---
function startMockData() {
    const items = ['T4_HEAD_PLATE_SET1', 'T5_MAIN_SWORD', 'T4_BAG', 'T6_ARMOR_LEATHER_SET1', 'T8_MOUNT_HORSE'];
    const cities = ['Martlock', 'Thetford', 'Lymhurst'];

    window.mockInterval = setInterval(() => {
        const buyPrice = Math.floor(Math.random() * 50000) + 10000;
        const profit = Math.floor(Math.random() * 20000) + 5000;
        const sellPrice = buyPrice + profit + (buyPrice * 0.065); // Includes tax

        const flip = {
            itemId: items[Math.floor(Math.random() * items.length)],
            itemName: 'Example Item',
            quality: Math.floor(Math.random() * 4) + 1,
            sourceCity: cities[Math.floor(Math.random() * cities.length)],
            targetCity: 'Black Market',
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            profit: profit,
            roi: (profit / buyPrice) * 100,
            timestamp: Date.now()
        };

        handleNewMarketData([flip]);
    }, 3000);
}

// Start
document.addEventListener('DOMContentLoaded', init);
