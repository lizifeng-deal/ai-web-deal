#!/bin/bash

# 宝塔面板部署脚本

echo "🚀 开始构建项目..."

# 清理之前的构建
rm -rf dist

# 安装依赖（如果需要）
# npm install

# 构建生产版本
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功！"
    echo "📁 构建文件位于 dist 目录"
    echo ""
    echo "📋 接下来的步骤："
    echo "1. 将 dist 目录中的所有文件上传到宝塔面板的网站根目录"
    echo "2. 配置 Nginx 重写规则"
    echo "3. 配置 API 代理（如果后端在同一服务器）"
    echo ""
    echo "📖 详细部署指南请参考: docs/deployment-guide.md"
else
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi