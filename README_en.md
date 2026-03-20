# 🖥️ ServerStatus-Cloudflare-D1

A lightweight, high-performance, and industrial-grade server status monitoring dashboard built on **Cloudflare Workers** and **Cloudflare D1** database.

[English Version](./README_en.md) | [中文说明](./README.md)

### 🌟 Features
- **Zero Cost**: Leverages Cloudflare's free tier (D1 offers 5M writes/month), far more durable than KV for high-frequency heartbeats.
- **Single-File Deployment**: All logic is in `worker.js`. No local environment needed—just copy and paste via the Cloudflare Web Dashboard.
- **One-Click Management**: Dynamically generates installation scripts for **Debian/Ubuntu/CentOS**, with auto-fix for missing dependencies (e.g., `cron`, `curl`).
- **Professional Dashboard**: Real-time progress bars for CPU/RAM/Load, plus historical trend charts for the last 30 data points using Chart.js.
- **Security**: Admin panel protected by a Master Key with password management.
- **Theming**: One-click toggle between Light and Dark modes.

### 🚀 Deployment Guide

#### 1. Create D1 Database
1. Log in to Cloudflare Dashboard, go to **Storage & Databases** -> **D1**.
2. Click **Create database**, name it `SERVER_STATUS`.
3. Go to the **Console** tab of the database, paste and run the following SQL to initialize the schema:
   ```sql
   CREATE TABLE config (id TEXT PRIMARY KEY, value TEXT);
   CREATE TABLE servers (uuid TEXT PRIMARY KEY, name TEXT, url TEXT, interval INTEGER, last_seen INTEGER);
   CREATE TABLE stats_history (id INTEGER PRIMARY KEY AUTOINCREMENT, server_uuid TEXT, timestamp INTEGER, cpu REAL, mem REAL, load REAL, uptime TEXT, disk REAL);
   CREATE INDEX idx_history_uuid ON stats_history(server_uuid, timestamp);
   ```

#### 2. Create Cloudflare Worker
1. Go to **Compute** -> **Workers & Pages**, click **Create Worker**.
2. Name it and deploy. Then click **Edit Code**.
3. Copy the entire content of `worker.js` from this repo and replace the default code in the editor.

#### 3. Bind Database
1. In the Worker editor, click **Settings** (gear icon) -> **Variables**.
2. Find **D1 Database Bindings**, click **Add binding**.
3. **Variable name** MUST be: `DB`.
4. **D1 database** Select the `SERVER_STATUS` you just created.
5. Click **Save and Deploy**.

### 📖 Usage
1. Visit your Worker's URL. You will be prompted to set a **Master Key** (admin password).
2. After logging in, add a server in the admin panel (Enter name, location, and interval, e.g., 60s).
3. Copy the generated **One-click command** and execute it on your target server's terminal.
4. Wait a few seconds, and real-time data/charts will appear on the dashboard.

### 🛠️ Tech Stack
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Native HTML5 / CSS3 (Variables for theming) / Vanilla JavaScript
- **Charts**: Chart.js

### 📄 License
MIT License
