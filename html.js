// Version 3.0 - HTML Page Generator

const HTML_CONTENT_TYPE = { headers: { 'Content-Type': 'text/html;charset=UTF-8' } };

// 主页：检查数据库是否已初始化
export async function handleDashboardRequest(request, env) {
  try {
    // 尝试查询，如果失败（表不存在），则跳转到配置页进行初始化
    await env.DB.prepare("SELECT 1 FROM servers LIMIT 1").first();
    return new Response('<!DOCTYPE html><html><head><title>Dashboard</title></head><body><h1>Server Metrics Dashboard</h1><p>Go to <a href="/config">/config</a> to manage servers.</p></body></html>', HTML_CONTENT_TYPE);
  } catch (e) {
    if (e.message.includes('no such table')) {
      const configUrl = new URL(request.url);
      configUrl.pathname = '/config';
      return Response.redirect(configUrl.toString(), 302);
    }
    throw e;
  }
}

// 数据库初始化请求
export async function handleDbInitRequest(request, env) {
    if (request.method !== 'POST') {
        return new Response('Invalid method', { status: 405 });
    }
    const masterKey = request.headers.get('Authorization')?.replace(/^Bearer\s/, '');
    if (masterKey !== env.MASTER_KEY) {
        return new Response('Unauthorized', { status: 401 });
    }
    
    await env.DB.exec(`
      DROP TABLE IF EXISTS servers;
      CREATE TABLE servers (
        uuid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return new Response("Database initialized successfully! Please refresh.", { status: 200 });
}


// 配置页面
export function handleConfigRequest(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Config</title>
    <style>
        body { font-family: sans-serif; margin: 2em; background: #f9f9f9; }
        .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 2em; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        input, button { padding: 0.5em; border-radius: 4px; border: 1px solid #ccc; }
        button { cursor: pointer; background: #007bff; color: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 1em; }
        th, td { padding: 0.8em; border: 1px solid #ddd; text-align: left; }
        pre { background: #eee; padding: 0.5em; border-radius: 4px; white-space: pre-wrap; word-break: break-all; }
        #notifications { position: fixed; top: 1em; right: 1em; }
        .notification { padding: 1em; border-radius: 4px; margin-bottom: 1em; }
        .error { background: #f8d7da; color: #721c24; }
        .success { background: #d4edda; color: #155724; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Server Configuration</h1>
        <div id="notifications"></div>
        
        <div id="master-key-section">
            <label for="masterKey">Master Key:</label>
            <input type="password" id="masterKey" placeholder="输入Master Key以管理服务器">
            <button onclick="saveKeyAndLoad()">保存并加载</button>
        </div>

        <div id="main-content" style="display:none;">
            <div id="init-db-section" style="display:none;">
                <h2>数据库未初始化</h2>
                <p>看起来这是您第一次设置。请点击下方按钮来创建所需的数据库表。</p>
                <button onclick="initializeDatabase()">Initialize Database</button>
            </div>

            <div id="server-management-section" style="display:none;">
                <h2>添加新服务器</h2>
                <input type="text" id="newServerName" placeholder="服务器名 (e.g., 'web-prod-1')">
                <button onclick="addServer()">添加服务器</button>
                <hr style="margin: 2em 0;">
                <h2>已管理的服务器</h2>
                <table>
                    <thead><tr><th>Name</th><th>UUID</th><th>Install Command</th><th>Actions</th></tr></thead>
                    <tbody id="server-list"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const masterKeyInput = document.getElementById('masterKey');
        const mainContent = document.getElementById('main-content');
        const initDbSection = document.getElementById('init-db-section');
        const serverManagementSection = document.getElementById('server-management-section');
        let currentMasterKey = '';

        function notify(message, type = 'success') {
            const div = document.createElement('div');
            div.className = 'notification ' + type;
            div.textContent = message;
            document.getElementById('notifications').appendChild(div);
            setTimeout(() => div.remove(), 5000);
        }

        function getHeaders() {
            return {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + currentMasterKey
            };
        }

        function saveKeyAndLoad() {
            const key = masterKeyInput.value;
            if (!key) {
                notify('请输入Master Key', 'error');
                return;
            }
            currentMasterKey = key;
            localStorage.setItem('masterKey', key);
            masterKeyInput.disabled = true; // 锁定输入框
            mainContent.style.display = 'block';
            loadServers();
        }

        async function initializeDatabase() {
            if (!confirm('这将创建新的数据库表。如果表已存在，它们将被删除并重建。确定吗？')) return;
            try {
                const response = await fetch('/init-db', { method: 'POST', headers: getHeaders() });
                if (!response.ok) throw new Error(await response.text());
                notify('数据库初始化成功！页面将刷新。', 'success');
                setTimeout(() => location.reload(), 2000);
            } catch (err) {
                notify('初始化失败: ' + err.message, 'error');
            }
        }
        async function loadServers() {
            try {
                const response = await fetch('/api/servers', { headers: getHeaders() });
                if (response.status === 401) {
                    notify('Master Key 无效', 'error');
                    localStorage.removeItem('masterKey');
                    masterKeyInput.disabled = false;
                    mainContent.style.display = 'none';
                    return;
                }
                const servers = await response.json();
                const serverListBody = document.getElementById('server-list');
                serverListBody.innerHTML = '';
                
                // 检查是否需要初始化
                if (servers.length === 0 && response.ok) {
                    const checkResponse = await fetch('/api/servers', { headers: getHeaders() }); // re-fetch to be sure
                    const checkData = await checkResponse.json();
                     // A bit of a hack: if we get an empty array, we can't know if the table exists or not.
                     // The backend now catches the "no such table" error. If we get here with an empty array,
                     // we assume the table is there but empty. The init button is shown on the dashboard redirect.
                     // A better check is needed if this logic proves insufficient.
                }

                initDbSection.style.display = 'none';
                serverManagementSection.style.display = 'block';

                if (servers.length === 0) {
                    serverListBody.innerHTML = '<tr><td colspan="4">暂无服务器，请添加一个。</td></tr>';
                    // This is the key logic. If we get an empty list, maybe the table doesn't exist.
                    // Let's try a test query. If it fails, show the init button.
                    try {
                        await fetch('/api/servers/test-query-should-fail', { headers: getHeaders() });
                    } catch(e) {
                         initDbSection.style.display = 'block';
                         serverManagementSection.style.display = 'none';
                    }

                } else {
                    servers.forEach(server => {
                        const row = document.createElement('tr');
                        const installCommand = \`echo "*/1 * * * * root curl -s -X POST \${window.location.origin}/api/metrics?uuid=\${server.uuid}" > /etc/cron.d/server_metrics\`;
                        row.innerHTML = \`
                            <td>\${server.name}</td>
                            <td>\${server.uuid}</td>
                            <td><pre>\${installCommand}</pre></td>
                            <td>
                                <button onclick="deleteServer('\${server.uuid}', '\${server.name}')">删除</button>
                                <button onclick="renameServer('\${server.uuid}', '\${server.name}')">重命名</button>
                            </td>
                        \`;
                        serverListBody.appendChild(row);
                    });
                }

            } catch (err) {
                 // This error is often "no such table"
                 initDbSection.style.display = 'block';
                 serverManagementSection.style.display = 'none';
            }
        }
        
        // ... (addServer, deleteServer, renameServer functions are the same as v2.9, just use getHeaders())
        // For brevity, they are included here:
        async function addServer() {
            const name = document.getElementById('newServerName').value;
            if (!name) { notify('请输入服务器名', 'error'); return; }
            try {
                const response = await fetch('/api/servers', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ name: name, url: window.location.origin })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || '未知错误');
                notify('服务器添加成功!', 'success');
                document.getElementById('newServerName').value = '';
                loadServers();
            } catch (err) { notify('添加失败: ' + err.message, 'error'); }
        }

        async function deleteServer(uuid, name) {
            if (!confirm(\`确定要删除服务器 "\${name}"吗？\`)) return;
            try {
                const response = await fetch(\`/api/servers/\${uuid}\`, { method: 'DELETE', headers: getHeaders() });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || '未知错误');
                notify('服务器已删除。请在服务器上运行以下卸载命令：\\n' + data.uninstall_command, 'success');
                loadServers();
            } catch (err) { notify('删除失败: ' + err.message, 'error'); }
        }

        async function renameServer(uuid, oldName) {
            const newName = prompt(\`为 "\${oldName}" 输入新名称:\`, oldName);
            if (!newName || newName === oldName) return;
            try {
                const response = await fetch(\`/api/servers/\${uuid}\`, {
                    method: 'PATCH',
                    headers: getHeaders(),
                    body: JSON.stringify({ name: newName })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || '未知错误');
                notify('重命名成功!', 'success');
                loadServers();
            } catch (err) { notify('重命名失败: ' + err.message, 'error'); }
        }

        // Load master key from localStorage on page load
        document.addEventListener('DOMContentLoaded', () => {
            const savedKey = localStorage.getItem('masterKey');
            if (savedKey) {
                masterKeyInput.value = savedKey;
                saveKeyAndLoad();
            }
        });
    </script>
</body>
</html>
  `;
  return new Response(html, HTML_CONTENT_TYPE);
}
