# 演示合集 (Next.js)

一些demo

## 快速开始

```bash
npm install
npm run dev
```

打开 <http://localhost:3000> 即可访问演示页面。

### 常用脚本

- `npm run dev`：本地开发，支持热更新。
- `npm run build`：构建生产版本（构建后的 `.next/` 目录未提交到仓库）。
- `npm run start`：使用构建产物启动生产服务器。
- `npm run lint`：运行 Next.js 预设的 ESLint 规则。

## 目录导览

```
public/                      # 静态资源
src/app/layout.tsx           # 全局布局与 meta 配置
src/app/page.tsx             # 演示合集主页
src/app/page.module.css      # 主页样式
src/app/cartpole/page.tsx    # CartPole 页面入口
src/app/cartpole/page.module.css
src/app/cartpole/cartpole-experience.ts
```

## 许可证

本项目以 [MIT License](./LICENSE) 授权。
