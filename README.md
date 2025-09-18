# 交互式机器学习演示合集 (Next.js)

本项目基于 Next.js 15 + TypeScript，将原有的静态 Demo 网页迁移到现代化的多页面应用结构中，方便继续拓展更多交互式机器学习体验。

## 当前内容

- **演示主页**（`src/app/page.tsx`）
  - 保留模板的视觉风格，列出所有可用的机器学习演示卡片。
- **CartPole 强化学习交互体验**（`src/app/cartpole/page.tsx`）
  - 在浏览器端实时训练/回放使用 MLP 的小车-倒立摆策略。
  - 包含奖励曲线、神经网络可视化、策略回放等交互控件。

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

CartPole 的执行逻辑保留了原始 HTML 中的 Canvas 绘制与强化学习训练实现，并通过 `useEffect` 在客户端初始化与清理，保证在 Next.js App Router 下正常运行。

## 后续扩展建议

- 按照主页卡片的格式继续添加新的演示页面。
- 将强化学习的超参数、训练曲线等抽象为可复用的 hooks 或组件。
- 根据部署环境需求，接入 Edge Function / Node Function 实现服务端推理或数据持久化。

## 许可证

本项目以 [MIT License](./LICENSE) 授权。
