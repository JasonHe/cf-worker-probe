/**
 * Server Status Dashboard - D1 数据库 极度兼容版
 * 1. 自动检测并安装缺失的 cron/curl/wget (解决 crontab not found)
 * 2. 修复 Debian 下 top 输出错位导致的 100% CPU Bug
 * 3. D1 数据库存储，支持历史曲线、悬停详情、白天/黑夜切换
 */

const MAX_HISTORY_POINTS = 30;

// --- 1. 前端 HTML 模板 ---
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ServerMonitor | D1 Cloud</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --p: #3b82f6; --bg: #0f172a; --c: #1e293b; --t: #f1f5f9; --td: #94a3b8;
            --border: #334155; --up: #10b981; --dn: #ef4444; --input-bg: #0f172a;
        }
        [data-theme="light"] {
            --bg: #f1f5f9; --c: #ffffff; --t: #1e293b; --td: #64748b;
            --border: #e2e8f0; --input-bg: #f8fafc;
        }
        body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--t); margin: 0; padding: 20px; transition: 0.3s; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .header-right { display: flex; align-items: center; gap: 15px; }
        #theme-toggle { background: var(--c); border: 1px solid var(--border); color: var(--t); padding: 8px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; }
        #theme-toggle svg { width: 20px; height: 20px; fill: currentColor; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
        .card { background: var(--c); border-radius: 12px; padding: 18px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px; transition: 0.3s; }
        .sh { display: flex; justify-content: space-between; align-items: flex-start; }
        .name { font-size: 1.1rem; font-weight: bold; display: flex; align-items: center; gap: 8px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .status-group { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
        .bg-up { background: rgba(16,185,129,0.2); color: var(--up); }
        .bg-dn { background: rgba(239,68,68,0.2); color: var(--dn); }
        .stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .label { color: var(--td); font-size: 12px; margin-bottom: 4px; display: block; }
        .bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
        .inner { height: 100%; transition: width 0.6s ease; }
        .chart-container { height: 140px; width: 100%; margin-top: 5px; cursor: crosshair; }
        .foot { font-size: 11px; color: var(--td); border-top: 1px solid var(--border); padding-top: 10px; display: flex; justify-content: space-between; }
        .nav { color: var(--p); cursor: pointer; font-size: 14px; font-weight: 500; text-decoration: none; }
        .admin-box { background: var(--c); border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid var(--p); }
        input { background: var(--input-bg); border: 1px solid var(--border); color: var(--t); padding: 8px 12px; border-radius: 6px; margin-right: 8px; outline: none; width: 180px; }
        button { background: var(--p); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .del-btn { color: var(--dn); background: rgba(239,68,68,0.1); border: none; cursor: pointer; font-size: 11px; padding: 2px 8px; border-radius: 4px; }
        #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(8px); }
        .modal-c { background: var(--c); padding: 25px; border-radius: 16px; width: 90%; max-width: 650px; border: 1px solid var(--border); color: var(--t); }
        pre { background: #000; color: #10b981; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; border: 1px solid var(--border); }
        .hidden { display: none !important; }
    </style>
</head>
<body data-theme="dark">
    <div class="container">
        <div id="setup-view" class="card hidden" style="text-align: center; margin-top: 100px;">
            <h1>🛡️ 初始化 D1 监控系统</h1>
            <input type="password" id="new-mk" placeholder="请设置 Master Key" style="width:260px">
            <button onclick="setup()">初始化</button>
        </div>
        <div id="main-view">
            <header>
                <h1 style="margin:0">Probe<span style="color:var(--p)">Stats</span></h1>
                <div class="header-right">
                    <button id="theme-toggle" onclick="toggleTheme()">
                        <svg id="sun-icon" class="hidden" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
                        <svg id="moon-icon" viewBox="0 0 24 24"><path d="M12.12 22a9.91 9.91 0 01-7.07-2.93 9.91 9.91 0 01-2.93-7.07c0-3.32 1.63-6.42 4.37-8.32.45-.31 1.06-.01 1.06.54 0 .22-.08.43-.22.6-1.12 1.34-1.72 3.03-1.72 4.78 0 4.14 3.36 7.5 7.5 7.5 1.75 0 3.44-.6 4.78-1.72.17-.14.38-.22.6-.22.55 0 .85.61.54 1.06-1.9 2.74-5 4.37-8.32 4.37z"/></svg>
                    </button>
                    <span id="li" class="nav" onclick="login()">管理登录</span>
                    <span id="lo" class="nav hidden" onclick="logout()">安全退出</span>
                </div>
            </header>
            <div id="ap" class="admin-box hidden">
                <div style="display:flex; flex-wrap:wrap; gap:10px">
                    <input type="text" id="n-n" placeholder="名称">
                    <input type="text" id="n-u" placeholder="备注">
                    <input type="number" id="n-i" placeholder="秒" value="60" style="width:70px">
                    <button onclick="add()">添加</button>
                </div>
            </div>
            <div id="grid" class="grid"></div>
        </div>
    </div>
    <div id="modal">
        <div class="modal-c">
            <h2 id="m-t" style="margin-top:0"></h2>
            <p id="m-d" style="font-size:14px; color:var(--td)"></p>
            <pre id="m-c"></pre>
            <div style="margin-top:20px; display:flex; gap:10px">
                <button onclick="copy()" style="flex:1">复制</button>
                <button onclick="closeM()" style="flex:1; background:#475569">关闭</button>
            </div>
        </div>
    </div>
    <script>
        let MK = localStorage.getItem('mk') || "";
        const charts = {};
        const $ = id => document.getElementById(id);

        function toggleTheme() {
            const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
            document.body.dataset.theme = next;
            localStorage.setItem('theme', next);
            updateIcons(next);
            render();
        }
        function updateIcons(theme) {
            if(theme === 'dark') { $('sun-icon').classList.add('hidden'); $('moon-icon').classList.remove('hidden'); }
            else { $('sun-icon').classList.remove('hidden'); $('moon-icon').classList.add('hidden'); }
        }
        async function init() {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.body.dataset.theme = savedTheme;
            updateIcons(savedTheme);
            const r = await fetch('/api/init-check');
            const d = await r.json();
            if(!d.initialized) $('setup-view').classList.remove('hidden');
            else {
                if(MK) $('ap').classList.remove('hidden');
                render();
                setInterval(render, 15000);
            }
        }
        async function setup() {
            await fetch('/api/setup', { method:'POST', body:JSON.stringify({key:$('new-mk').value}) });
            location.reload();
        }
        function login() { const k = prompt("Master Key:"); if(k){ localStorage.setItem('mk', k); location.reload(); }}
        function logout() { localStorage.removeItem('mk'); location.reload(); }

        async function render() {
            const r = await fetch('/api/list', { headers:{'Authorization':MK} });
            if(r.status === 401) { logout(); return; }
            const data = await r.json();
            if(MK) { $('li').classList.add('hidden'); $('lo').classList.remove('hidden'); }
            const grid = $('grid');
            if(data.length === 0) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--td)">暂无监控数据</div>'; return; }

            const theme = document.body.dataset.theme;
            const textColor = theme === 'dark' ? '#f1f5f9' : '#1e293b';
            const gridColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)';
            const tooltipBg = theme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)';

            grid.innerHTML = data.map(s => {
                const history = s.history || [];
                const last = history[history.length - 1] || {};
                const up = s.status === 'Up';
                const c = parseFloat(last.cpu || 0).toFixed(1);
                const m = parseFloat(last.mem || 0).toFixed(1);
                const d = parseFloat(last.disk || 0).toFixed(1);
                const color = v => v > 85 ? 'var(--dn)' : (v > 60 ? '#f59e0b' : 'var(--up)');

                return \`
                    <div class="card">
                        <div class="sh">
                            <div class="node-info">
                                <div class="name"><div class="dot" style="background:\${up?'var(--up)':'var(--dn)'}"></div>\${s.name}</div>
                                <div style="font-size:12px; color:var(--td);">\${s.url || '--'}</div>
                            </div>
                            <div class="status-group">
                                <span class="badge \${up?'bg-up':'bg-dn'}">\${up?'Online':'Offline'}</span>
                                \${MK ? \`<button class="del-btn" onclick="del('\${s.uuid}')">删除</button>\` : ''}
                            </div>
                        </div>
                        <div class="stat-row">
                            <div><span class="label">CPU \${c}%</span><div class="bar"><div class="inner" style="width:\${c}%; background:\${color(c)}"></div></div></div>
                            <div><span class="label">内存 \${m}%</span><div class="bar"><div class="inner" style="width:\${m}%; background:\${color(m)}"></div></div></div>
                        </div>
                        <div class="chart-container"><canvas id="chart-\${s.uuid}"></canvas></div>
                        <div class="foot"><span>负载: \${last.load || '0.00'} | 磁盘: \${d}%</span><span>⏱ \${last.uptime || '--'}</span></div>
                    </div>\`;
            }).join('');

            data.forEach(s => {
                const canvas = document.getElementById(\`chart-\${s.uuid}\`);
                if(!canvas) return;
                const ctx = canvas.getContext('2d');
                const h = s.history || [];
                if (charts[s.uuid]) charts[s.uuid].destroy();
                charts[s.uuid] = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: h.map(i => new Date(i.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})),
                        datasets: [
                            { label: 'CPU', data: h.map(i => i.cpu), borderColor: '#3b82f6', borderWidth: 1.5, tension: 0.4, pointRadius: 0, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
                            { label: '内存', data: h.map(i => i.mem), borderColor: '#10b981', borderWidth: 1.5, tension: 0.4, pointRadius: 0, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { display: false },
                            tooltip: {
                                enabled: true, backgroundColor: tooltipBg, titleColor: textColor, bodyColor: textColor,
                                borderColor: 'rgba(148, 163, 184, 0.3)', borderWidth: 1, padding: 10,
                                callbacks: {
                                    label: (ctx) => {
                                        let l = ctx.dataset.label + ': ' + parseFloat(ctx.parsed.y).toFixed(1) + '%';
                                        if (ctx.datasetIndex === 0) {
                                            const ld = h[ctx.dataIndex].load || 'N/A';
                                            return [l, '负载: ' + ld];
                                        }
                                        return l;
                                    }
                                }
                            }
                        },
                        scales: { x: { display: false }, y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { display: false } } }
                    }
                });
            });
        }

        async function add() {
            const res = await fetch('/api/add', {
                method:'POST', headers:{'Authorization':MK, 'Content-Type':'application/json'},
                body: JSON.stringify({ name:$('n-n').value, url:$('n-u').value, interval:$('n-i').value })
            });
            const d = await res.json();
            showM("✨ 纳管指令", "执行此指令即可开始监控：", d.cmd);
            render();
        }
        async function del(id) {
            if(!confirm("确认删除？")) return;
            const r = await fetch(\`/api/delete/\${id}\`, { headers:{'Authorization':MK} });
            const d = await r.json();
            showM("🗑️ 卸载指令", "已移除。清理指令：", d.uncmd);
            render();
        }
        function showM(t, d, c) { $('m-t').innerText=t; $('m-d').innerText=d; $('m-c').innerText=c; $('modal').style.display='flex'; }
        function closeM() { $('modal').style.display='none'; }
        function copy() { navigator.clipboard.writeText($('m-c').innerText); alert("已复制"); }
        init();
    </script>
</body>
</html>
`;

// --- 2. 后端逻辑 ---
async function handleRequest(request, env) {
    const { pathname } = new URL(request.url);
    const origin = new URL(request.url).origin;
    const auth = request.headers.get("Authorization");

    const getMK = async () => (await env.DB.prepare("SELECT value FROM config WHERE id = 'master_key'").first())?.value;
    const isAuth = async () => (await getMK()) === auth;

    if (pathname === "/api/init-check") {
        const mk = await getMK();
        return new Response(JSON.stringify({ initialized: !!mk }));
    }
    if (pathname === "/api/setup" && request.method === "POST") {
        if (await getMK()) return new Response("Done", { status: 403 });
        const { key } = await request.json();
        await env.DB.prepare("INSERT INTO config (id, value) VALUES ('master_key', ?)").bind(key).run();
        return new Response("OK");
    }
    if (pathname === "/") return new Response(HTML_CONTENT, { headers: { "Content-Type": "text/html;charset=UTF-8" } });

    // 心跳上报
    if (pathname.startsWith("/api/report/")) {
        const uuid = pathname.split("/").pop();
        const s = await request.json();
        const now = Date.now();
        await env.DB.batch([
            env.DB.prepare("UPDATE servers SET last_seen = ? WHERE uuid = ?").bind(now, uuid),
            env.DB.prepare("INSERT INTO stats_history (server_uuid, timestamp, cpu, mem, load, uptime, disk) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(uuid, now, s.cpu, s.mem, s.load, s.uptime, s.disk),
            env.DB.prepare("DELETE FROM stats_history WHERE server_uuid = ? AND id NOT IN (SELECT id FROM stats_history WHERE server_uuid = ? ORDER BY timestamp DESC LIMIT ?)")
                .bind(uuid, uuid, MAX_HISTORY_POINTS + 5)
        ]);
        return new Response("OK");
    }

    if (pathname === "/api/list") {
        const servers = (await env.DB.prepare("SELECT * FROM servers ORDER BY name ASC").all()).results;
        const results = await Promise.all(servers.map(async (srv) => {
            const h = (await env.DB.prepare("SELECT * FROM stats_history WHERE server_uuid = ? ORDER BY timestamp DESC LIMIT ?")
                .bind(srv.uuid, MAX_HISTORY_POINTS).all()).results;
            const status = (Date.now() - srv.last_seen < (srv.interval * 2000 + 20000)) ? "Up" : "Down";
            return { ...srv, status, history: h.reverse() };
        }));
        return new Response(JSON.stringify(results));
    }

    if (pathname === "/api/add" && request.method === "POST") {
        if (!await isAuth()) return new Response("401", { status: 401 });
        const { name, url, interval } = await request.json();
        const uuid = crypto.randomUUID();
        const inv = parseInt(interval) || 60;
        await env.DB.prepare("INSERT INTO servers (uuid, name, url, interval, last_seen) VALUES (?, ?, ?, ?, 0)")
            .bind(uuid, name, url, inv).run();
        return new Response(JSON.stringify({ cmd: `wget -qO- ${origin}/api/script/${uuid} | sh` }));
    }

    // 动态脚本 (增强了环境自动修复)
    if (pathname.startsWith("/api/script/")) {
        const uuid = pathname.split("/").pop();
        const srv = await env.DB.prepare("SELECT interval FROM servers WHERE uuid = ?").bind(uuid).first();
        if (!srv) return new Response("Error", { status: 404 });
        const interval = srv.interval;
        const loopCount = Math.floor(60 / interval) || 1;

        const script = `#!/bin/sh
echo "Checking environment..."
# 检查并安装 cron
if ! command -v crontab >/dev/null 2>&1; then
    echo "Cron not found, attempting to install..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update && apt-get install -y cron
        systemctl enable cron && systemctl start cron
    elif command -v yum >/dev/null 2>&1; then
        yum install -y cronie
        systemctl enable crond && systemctl start crond
    fi
fi
# 检查并安装 curl
if ! command -v curl >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then apt-get install -y curl; 
    elif command -v yum >/dev/null 2>&1; then yum install -y curl; fi
fi

cat << 'EOF' > /usr/local/bin/node_probe_${uuid}
#!/bin/sh
i=1
while [ \$i -le ${loopCount} ]; do
    CPU=\$(top -bn1 | tr ',' ' ' | awk '/Cpu\\(s\\)/ {for(i=1;i<=NF;i++) if(\$i=="id") print 100 - \$(i-1)}')
    [ -z "\$CPU" ] && CPU=0
    MEM=\$(free | awk '/Mem:/ {printf "%.1f", \$3/\$2 * 100.0}')
    LOAD=\$(cat /proc/loadavg | awk '{print \$1}')
    UPTIME=\$(uptime -p | sed 's/up //')
    DISK=\$(df -h / | awk 'NR==2 {print \$5}' | tr -d '%')
    JSON="{\\"cpu\\":\\"\$CPU\\", \\"mem\\":\\"\$MEM\\", \\"load\\":\\"\$LOAD\\", \\"uptime\\":\\"\$UPTIME\\", \\"disk\\":\\"\$DISK\\"}"
    curl -s -X POST -H "Content-Type: application/json" -d "\$JSON" "${origin}/api/report/${uuid}" > /dev/null
    [ \$i -lt ${loopCount} ] && sleep ${interval}
    i=\$((\$i + 1))
done
EOF
chmod +x /usr/local/bin/node_probe_${uuid}
(crontab -l 2>/dev/null | grep -v "${uuid}"; echo "*/1 * * * * /usr/local/bin/node_probe_${uuid}") | crontab -
/usr/local/bin/node_probe_${uuid} &
echo "Probe Installed Successfully."`;
        return new Response(script, { headers: { "Content-Type": "text/plain" } });
    }

    if (pathname.startsWith("/api/delete/")) {
        if (!await isAuth()) return new Response("401", { status: 401 });
        const uuid = pathname.split("/").pop();
        await env.DB.batch([
            env.DB.prepare("DELETE FROM servers WHERE uuid = ?").bind(uuid),
            env.DB.prepare("DELETE FROM stats_history WHERE server_uuid = ?").bind(uuid)
        ]);
        return new Response(JSON.stringify({ uncmd: `crontab -l | grep -v "${uuid}" | crontab - && rm -f /usr/local/bin/node_probe_${uuid}` }));
    }
    return new Response("404", { status: 404 });
}

export default {
    async fetch(request, env) {
        return handleRequest(request, env).catch(e => new Response(e.message, { status: 500 }));
    }
};
