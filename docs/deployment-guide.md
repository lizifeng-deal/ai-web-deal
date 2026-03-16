# 阿里云宝塔部署指南

## 前期准备

### 1. 本地构建生产版本

```bash
# 在项目根目录执行
npm run build
```

构建完成后会生成 `dist` 文件夹，这就是要上传的静态文件。

### 2. 修改生产环境API配置

在部署前，需要修改API地址为生产环境地址。

## 宝塔面板部署步骤

### 第一步：创建网站

1. 登录宝塔面板
2. 点击左侧菜单 "网站"
3. 点击 "添加站点"
4. 填写配置：
   - 域名：填入你的域名（如：yourdomain.com）
   - 根目录：选择一个目录（如：/www/wwwroot/yourdomain.com）
   - PHP版本：选择 "纯静态"
   - 创建FTP：可选
   - 创建数据库：不需要

### 第二步：上传文件

**方法一：通过宝塔文件管理器**
1. 在宝塔面板点击 "文件"
2. 进入网站根目录（如：/www/wwwroot/yourdomain.com）
3. 删除默认的 index.html 文件
4. 将本地 `dist` 文件夹中的所有内容上传到根目录

**方法二：通过FTP上传**
1. 使用FTP客户端（如FileZilla）
2. 连接到服务器
3. 上传 `dist` 文件夹中的所有内容

### 第三步：配置Nginx

由于是单页应用(SPA)，需要配置URL重写规则：

1. 在宝塔面板找到你的网站
2. 点击 "设置"
3. 点击 "配置文件"
4. 在 `location /` 配置块中添加：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}

# 配置API代理（如果需要）
location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

5. 点击 "保存"

### 第四步：配置HTTPS（推荐）

1. 在网站设置中点击 "SSL"
2. 选择 "Let's Encrypt" 申请免费证书
3. 或上传自己的证书
4. 开启 "强制HTTPS"

## 生产环境配置优化

### 1. 修改API地址

在 `src/services/auth/index.ts` 中已经配置了环境检测，会自动根据环境选择合适的API地址。

### 2. 性能优化建议

**启用Gzip压缩**
```nginx
# 在网站设置 -> 配置文件中添加
gzip on;
gzip_min_length 1k;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/js
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json;
gzip_disable "MSIE [1-6]\.";
gzip_vary on;
```

**设置缓存策略**
```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML文件不缓存
location ~* \.(html)$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 3. 安全配置

**设置安全头**
```nginx
# 在 server 块中添加
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## 完整Nginx配置示例

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name yourdomain.com;
    index index.html;
    root /www/wwwroot/yourdomain.com;
    
    # SSL配置（由宝塔自动生成）
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip压缩
    gzip on;
    gzip_min_length 1k;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/js text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS设置（如果需要）
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization';
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML文件不缓存
    location ~* \.(html)$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # SPA路由配置
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

## 后端API部署

如果后端API也部署在同一台服务器上：

### 1. 使用PM2管理Node.js应用

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start app.js --name "api-server"

# 设置开机自启
pm2 startup
pm2 save
```

### 2. 在宝塔面板中配置

1. 安装 "PM2管理器" 插件
2. 通过插件管理Node.js应用
3. 配置Nginx反向代理到Node.js应用

## 部署检查清单

### ✅ 部署前检查

- [ ] 修改 `src/config/api.ts` 中的生产域名
- [ ] 执行 `npm run build` 确认构建成功
- [ ] 检查 `dist` 目录内容完整

### ✅ 宝塔配置检查

- [ ] 网站创建成功
- [ ] 文件上传完成
- [ ] Nginx配置已更新
- [ ] SSL证书已配置
- [ ] 域名解析正确

### ✅ 功能测试

- [ ] 首页访问正常
- [ ] 路由跳转正常（如 `/login`, `/profile`）
- [ ] API调用正常
- [ ] 登录功能正常
- [ ] 静态资源加载正常

## 常见问题解决

### 1. 404错误

**问题**：直接访问 `/login` 等路由返回404
**解决**：确保Nginx配置了 `try_files $uri $uri/ /index.html;`

### 2. API调用失败

**问题**：前端无法调用后端API
**解决**：
- 检查Nginx代理配置
- 确认后端服务运行正常
- 检查防火墙设置

### 3. 静态资源加载失败

**问题**：CSS、JS文件404
**解决**：
- 检查文件上传是否完整
- 确认路径配置正确

### 4. HTTPS混合内容警告

**问题**：HTTPS页面调用HTTP API
**解决**：
- 确保API也使用HTTPS
- 配置Nginx SSL代理

## 自动化部署（可选）

可以使用GitHub Actions实现自动部署：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.KEY }}
        script: |
          cd /www/wwwroot/yourdomain.com
          rm -rf *
          # 然后通过其他方式上传dist文件
```

按照这个指南，你就可以成功在阿里云宝塔面板上部署React应用了！
