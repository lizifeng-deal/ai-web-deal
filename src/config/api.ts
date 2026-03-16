// 生产环境配置
const PRODUCTION_API_BASE = 'https://yourdomain.com'; // 替换为你的生产域名

// 根据环境变量或域名判断环境
export const getApiBase = () => {
  // 如果设置了环境变量
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_BASE;
  }
  
  // 如果在生产域名下访问
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${hostname}`;
    }
  }
  
  // 开发环境使用代理
  return '';
};

// API 基础路径
export const API_BASE_URL = getApiBase() + '/api';

// 认证API基础路径
export const AUTH_API_BASE = getApiBase() ? `${getApiBase()}/api/auth` : '/api/auth';