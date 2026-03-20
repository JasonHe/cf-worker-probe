# 🖥️ ServerStatus-Cloudflare-D1

这是一个基于 **Cloudflare Workers** 和 **Cloudflare D1** 数据库构建的极轻量、高性能、工业级兼容的服务器状态监控面板。

[English Version](./README_en.md) | [中文说明](./README.md)

### 🌟 项目亮点
- **零成本运维**：利用 Cloudflare 免费额度（D1 每月 500 万次写入），远超 KV 额度，支持多台服务器高频上报。
- **单文件部署**：全部逻辑集成在 `worker.js`，无需安装本地开发环境，直接在网页控制台粘贴即可。
- **一键纳管**：动态生成安装脚本，支持 **Debian/Ubuntu/CentOS**，自动补全缺失环境（如 `cron`, `curl`）。
- **专业仪表盘**：包含实时 CPU/内存/负载进度条，以及最近 30 个点的历史运行曲线图（Chart.js）。
- **安全保障**：Master Key 保护管理后台，支持管理密码修改。
- **全端适配**：支持白天/黑夜模式一键切换，移动端友好。

### 🚀 部署步骤

#### 1. 创建 D1 数据库
1. 登录 Cloudflare 控制台，进入 **“存储与数据库”** -> **“D1”**。
2. 点击 **“创建数据库”**，名称输入 `SERVER_STATUS`。
3. 进入该数据库的 **“控制台”**，复制并运行以下 SQL 语句以初始化表结构：
   ```sql
   CREATE TABLE config (id TEXT PRIMARY KEY, value TEXT);
   CREATE TABLE servers (uuid TEXT PRIMARY KEY, name TEXT, url TEXT, interval INTEGER, last_seen INTEGER);
   CREATE TABLE stats_history (id INTEGER PRIMARY KEY AUTOINCREMENT, server_uuid TEXT, timestamp INTEGER, cpu REAL, mem REAL, load REAL, uptime TEXT, disk REAL);
   CREATE INDEX idx_history_uuid ON stats_history(server_uuid, timestamp);
   ```

#### 2. 创建 Cloudflare Worker
1. 进入 **“计算”** -> **“Workers 和 Pages”**，点击 **“创建 Worker”**。
2. 命名后点击部署，随后点击 **“编辑代码”**。
3. 将本项目中的 `worker.js` 内容全部复制并替换编辑器中的原有代码。

#### 3. 绑定数据库
1. 在 Worker 编辑器界面，点击左侧的 **“设置”** (齿轮图标) -> **“变量”**。
2. 找到 **“D1 数据库绑定”**，点击 **“添加绑定”**。
3. **变量名称** 必须填写：`DB`。
4. **D1 数据库** 选择你刚才创建的 `SERVER_STATUS`。
5. 点击 **“保存并部署”**。

### 📖 如何使用
1. 访问你的 Worker 域名，系统会引导你设置 **Master Key**（管理密码）。
2. 登录后，在面板添加服务器，输入名称、备注和上报频率（如 60 秒）。
3. 复制生成的 **一键纳管指令**，在你的目标服务器终端执行。
4. 稍等片刻，即可在面板看到实时数据和历史曲线。

### 🛠️ 技术栈
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: 原生 HTML5 / CSS3 (变量控制主题) / JavaScript
- **Charts**: Chart.js

### 📄 开源协议
MIT License
