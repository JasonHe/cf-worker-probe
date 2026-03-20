// Version 3.0 - API Handler
const JSON_CONTENT_TYPE = { headers: { 'Content-Type': 'application/json;charset=UTF-8' } };

export default async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const masterKey = request.headers.get('Authorization')?.replace(/^Bearer\s/, '');

  // 检查Master Key
  if (!env.MASTER_KEY) {
    return new Response(JSON.stringify({ error: 'MASTER_KEY not set in worker environment' }), { status: 500, ...JSON_CONTENT_TYPE });
  }
  if (masterKey !== env.MASTER_KEY) {
    return new Response(JSON.stringify({ error: 'Invalid or missing Master Key' }), { status: 401, ...JSON_CONTENT_TYPE });
  }

  // GET /api/servers - 获取所有服务器
  if (path === '/api/servers' && request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare("SELECT uuid, name, url FROM servers ORDER BY name").all();
      return new Response(JSON.stringify(results), JSON_CONTENT_TYPE);
    } catch (e) {
      // 捕获 D1_EXEC_ERROR，通常意味着表不存在
      if (e.message.includes('no such table')) {
        return new Response(JSON.stringify([]), JSON_CONTENT_TYPE); // 返回空数组，前端会提示初始化
      }
      throw e; // 其他错误则抛出
    }
  }

  // POST /api/servers - 添加新服务器
  if (path === '/api/servers' && request.method === 'POST') {
    const { name, url: serverUrl } = await request.json();
    if (!name || !serverUrl) {
      return new Response(JSON.stringify({ error: 'Server name and URL are required' }), { status: 400, ...JSON_CONTENT_TYPE });
    }
    const newUuid = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO servers (uuid, name, url) VALUES (?, ?, ?)")
      .bind(newUuid, name, serverUrl)
      .run();
    return new Response(JSON.stringify({ success: true, uuid: newUuid }), { status: 201, ...JSON_CONTENT_TYPE });
  }

  const serverMatch = path.match(/^\/api\/servers\/([0-9a-fA-F-]+)$/);
  if (serverMatch) {
    const uuid = serverMatch[1];
    // DELETE /api/servers/:uuid - 删除服务器
    if (request.method === 'DELETE') {
      const { success } = await env.DB.prepare("DELETE FROM servers WHERE uuid = ?").bind(uuid).run();
      const uninstall_command = 'rm -f /etc/cron.d/server_metrics && (crontab -l | grep -v "/api/metrics" | crontab -)';
      return new Response(JSON.stringify({ success, uninstall_command }), JSON_CONTENT_TYPE);
    }
    // PATCH /api/servers/:uuid - 重命名服务器
    if (request.method === 'PATCH') {
        const { name } = await request.json();
        const { success } = await env.DB.prepare("UPDATE servers SET name = ? WHERE uuid = ?").bind(name, uuid).run();
        return new Response(JSON.stringify({ success }), JSON_CONTENT_TYPE);
    }
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, ...JSON_CONTENT_TYPE });
}
