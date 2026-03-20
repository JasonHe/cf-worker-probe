// Version 3.0 - Main Entry Point & Router
import handleApiRequest from './api';
import { handleConfigRequest, handleDashboardRequest, handleDbInitRequest } from './html';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // API 路由
      if (path.startsWith('/api/')) {
        return await handleApiRequest(request, env);
      }

      // 页面路由
      switch (path) {
        case '/config':
          return handleConfigRequest(request, env);
        case '/init-db':
          return handleDbInitRequest(request, env);
        case '/':
        default:
          return handleDashboardRequest(request, env);
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      // 在生产环境中，为了安全，可以返回一个通用的错误消息
      return new Response(`Internal Server Error: ${err.message}`, { status: 500 });
    }
  },
};
