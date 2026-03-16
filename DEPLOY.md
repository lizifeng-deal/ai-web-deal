# 宝塔面板快速部署指南

## 🚀 快速开始

### 1. 构建项目
```bash
npm run deploy:build
```

### 2. 上传文件到宝塔
1. 将 `dist` 目录中的所有文件上传到宝塔面板的网站根目录
2. 确保网站根目录包含 `index.html` 文件

### 3. 配置Nginx（重要！）
在宝塔面板的网站设置中，添加以下配置到Nginx配置文件：

```nginx
# SPA路由支持
location / {
    try_files $uri $uri/ /index.html;
}

# API代理（如果后端在同一服务器）
location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 4. 测试访问
- 访问你的域名，应该能看到登录页面
- 测试路由：`yourdomain.com/login`, `yourdomain.com/profile`

## 📖 详细部署文档

请查看 [完整部署指南](docs/deployment-guide.md)

## 🔧 环境要求

- Node.js 16+
- 宝塔面板 7.0+
- Nginx（宝塔自带）

## 📞 技术支持

如有问题，请参考：
1. [部署指南](docs/deployment-guide.md) 
2. [登录模块说明](docs/login-module-guide.md)