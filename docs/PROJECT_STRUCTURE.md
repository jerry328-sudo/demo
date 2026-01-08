# 项目结构说明

本文档描述了 Demo 展示项目的工程化文件夹结构和组织方式。

## 目录结构

```
demo/
│
├── index.html              # 🏠 主入口页面 - 展示所有演示项目
├── package.json            # 📦 项目配置和依赖管理
├── esa.jsonc               # ⚙️ ESA 配置文件
├── LICENSE                 # 📄 MIT 开源许可证
├── README.md               # 📖 项目说明文档
├── .gitignore              # 🚫 Git 忽略规则
│
├── css/                    # 🎨 全局样式
│   └── main.css           #    主样式表（所有页面共享）
│
├── js/                     # ⚡ 全局脚本
│   └── main.js            #    主脚本文件（所有页面共享）
│
├── assets/                 # 📁 静态资源
│   └── images/            #    图片资源
│       └── cropped-logo1.webp  # 网站 Logo
│
├── demos/                  # 🎯 演示项目集合
│   ├── interstellar.html  #    星际旅行燃料计算器
│   ├── interstellar.js    #    ↑ 对应脚本
│   │
│   ├── lorentz.html       #    洛伦兹时空图演示
│   └── lorentz/           #    ↑ 对应模块化脚本
│       ├── main.js        #       入口
│       ├── diagram.js     #       图表逻辑
│       ├── graphics.js    #       图形渲染
│       ├── lorentz.js     #       物理计算
│       └── ui.js          #       UI 交互
│   │
│   ├── brillouin_sampling.html  # 布里渊区采样演示
│   ├── cnn-conv1d.html   #    CNN 卷积核可视化
│   └── CartPole.html     #    CartPole 强化学习演示
│
└── docs/                   # 📚 项目文档
    └── AGENTS.md          #    AI Agents 相关文档
```

## 设计原则

### 1. 关注点分离
- **全局资源** (`css/`, `js/`) - 跨页面共享的样式和脚本
- **演示项目** (`demos/`) - 每个独立演示项目的 HTML 和专属脚本
- **静态资源** (`assets/`) - 图片、字体等静态文件
- **文档** (`docs/`) - 项目说明和开发文档

### 2. 模块化组织
- 每个演示项目的相关文件集中在 `demos/` 文件夹
- 复杂项目（如 lorentz）使用子文件夹进一步组织代码
- 简单项目的 JS 文件与 HTML 放在同一目录

### 3. 资源路径约定
- 主页面引用全局资源：`css/main.css`, `js/main.js`
- 演示页面引用全局资源：`../css/main.css`, `../js/main.js`
- 演示页面引用自身脚本：`./script.js` 或 `./folder/script.js`
- 所有页面引用图片：`assets/images/` 或 `../assets/images/`

## 添加新演示

要添加新的演示项目，请遵循以下步骤：

1. **创建 HTML 文件**
   ```
   demos/new-demo.html
   ```

2. **添加专属脚本**（如需要）
   - 简单项目：`demos/new-demo.js`
   - 复杂项目：`demos/new-demo/` 文件夹

3. **更新主页面**
   在 `index.html` 的 demo-grid 中添加新卡片：
   ```html
   <article class="card">
     <span class="badge">分类标签</span>
     <h2>演示标题</h2>
     <p>演示描述</p>
     <footer>
       <span>2026 · 类型</span>
       <a href="demos/new-demo.html" target="_blank" rel="noopener">打开演示 →</a>
     </footer>
   </article>
   ```

4. **配置资源引用**
   在新的演示 HTML 中正确引用资源：
   ```html
   <link rel="icon" type="image/webp" href="../assets/images/cropped-logo1.webp">
   <link rel="stylesheet" href="../css/main.css">
   <script src="./new-demo.js"></script>
   ```

## 维护指南

### 全局样式更新
- 修改 `css/main.css` 影响所有页面
- 确保更改不会破坏现有演示的布局

### 添加新的共享脚本
- 放入 `js/` 文件夹
- 在需要的页面中引用

### 图片资源管理
- 所有图片统一放在 `assets/images/`
- 使用描述性文件名
- 优先使用 WebP 格式以优化性能

### 文档维护
- 重要的技术文档放在 `docs/`
- 项目说明更新 `README.md`
- 每次重大更改更新此文件

## 部署说明

本项目是纯静态网站，支持：
- GitHub Pages
- Netlify
- Vercel
- 任何静态托管服务

**本地测试：**
```bash
python3 -m http.server 8000
# 访问 http://localhost:8000/
```

**重要提醒：**
- 确保所有路径使用相对路径
- 文件名大小写保持一致（尤其在部署到 Linux 服务器时）
- 资源引用检查完整性

---

最后更新：2026年1月8日
