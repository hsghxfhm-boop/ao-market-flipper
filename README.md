# Market Tracer - Albion Online Black Market Flipper

Market Tracer is an open-source Electron-based dashboard designed to help Albion Online players identify profitable trading opportunities (flips) between royal city markets and the Black Market in Caerleon.

## 🚀 Features

- **Real-time Packet Capture**: Automatically listens to game traffic to update market prices as you browse them in-game.
- **Offline Core**: No central server dependency. All market data is stored in a local SQLite database on your machine.
- **Profit Engine**: Automatically calculates net profit (after tax) and ROI for thousands of items.
- **Advanced Filters**: Filter by Tier, Enchantment, Quality, Category, and specific cities.
- **Safe & Stealthy**: Uses a custom sniffer that listens to network traffic without modifying game memory or files.

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/flipper.git
   cd flipper
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Rebuild native modules** (for SQLite compatibility):
   ```bash
   npx electron-rebuild -f -w sqlite3
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

## 📖 How to Use

1. Launch **Albion Online**.
2. Open **Market Tracer** and click **"Start Capture"**.
3. In-game, visit any Market (e.g., Lymhurst) and browse items. The app will capture the prices.
4. Visit the **Black Market** in Caerleon and browse items.
5. Click **"Profit Scan"** in the app to see profitable flips!
6. Click **"Clear Records"** anytime to start fresh.

## ⚖️ License

This project is open-source and released under the **ISC License**.

## ⚠️ Disclaimer

Market Tracer is a third-party tool and is not affiliated with Sandbox Interactive. Use it at your own risk. Always ensure you are complying with Albion Online's Terms of Service.
