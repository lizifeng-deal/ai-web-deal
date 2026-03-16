import { defineConfig } from '@umijs/max';
const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:3000';
// const API_TARGET = process.env.API_TARGET || 'http://43.99.26.245:80';
export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: '@umijs/max',
  },
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      name: '资金管理',
      path: '/home',
      component: './Home',
    },
    {
      name: '初步建仓',
      path: '/simple',
      component: './simple',
    },
    {
      name: '权限演示',
      path: '/access',
      component: './Access',
    },
    {
      name: ' CRUD 示例',
      path: '/table',
      component: './Table',
    },
  ],
  npmClient: 'npm',
  proxy: {
    '/api': {
      target: API_TARGET,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  },
  // publicPath: './',
  // // 路由配置为 hash 模式（避免 history 模式下直接打开的路径问题）
  // history: {
  //   type: 'hash',
  // },
});
