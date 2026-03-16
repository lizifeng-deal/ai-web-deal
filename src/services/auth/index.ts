import { get, post, put } from '@/utils/request';
import type {
  LoginRequest,
  LoginResponse,
  AuthStatusResponse,
  ChangePasswordRequest,
  UpdateProfileRequest,
  User,
  ApiResponse
} from '@/types/auth';

// 根据环境动态配置API基础路径
const getAuthApiBase = () => {
  // 生产环境使用完整URL
  if (process.env.NODE_ENV === 'production') {
    // 在生产环境中，需要使用完整的API URL
    return '/api/auth'; // 这里仍使用相对路径，由nginx代理处理
  }
  
  // 开发环境使用代理路径
  return '/auth';
};

const AUTH_API_BASE = getAuthApiBase();

/**
 * 用户登录
 */
export const login = async (params: LoginRequest): Promise<LoginResponse> => {
  return post(`${AUTH_API_BASE}/login`, params);
};

/**
 * 用户登出
 */
export const logout = async (): Promise<ApiResponse> => {
  return post(`${AUTH_API_BASE}/logout`);
};

/**
 * 获取认证状态
 */
export const getAuthStatus = async (): Promise<AuthStatusResponse> => {
  return get(`${AUTH_API_BASE}/status`);
};

/**
 * 获取用户信息
 */
export const getProfile = async (): Promise<{ user: User }> => {
  return get(`${AUTH_API_BASE}/profile`);
};

/**
 * 更新用户信息
 */
export const updateProfile = async (params: UpdateProfileRequest): Promise<ApiResponse<User>> => {
  return put(`${AUTH_API_BASE}/profile`, params);
};

/**
 * 修改密码
 */
export const changePassword = async (params: ChangePasswordRequest): Promise<ApiResponse> => {
  return post(`${AUTH_API_BASE}/change-password`, params);
};