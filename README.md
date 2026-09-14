# Demo 展示

此仓库托管了一个个人演示登录页面和多个交互式可视化项目。

## 项目结构

```
demo/
├── index.html              # 主要入口点，展示所有演示项目
├── package.json            # 项目配置文件
├── LICENSE                 # MIT 许可证
├── README.md               # 项目说明文档
├── esa.jsonc               # ESA 配置文件
├── css/                    # 全局样式资源
│   └── main.css           # 主样式表
├── js/                     # 全局脚本资源
│   └── main.js            # 主脚本文件
├── assets/                 # 静态资源目录
│   └── images/            # 图片资源
│       └── cropped-logo1.webp  # 网站 Logo
├── demos/                  # 所有演示项目
│   ├── interstellar.html  # 星际旅行燃料计算器
│   ├── interstellar.js    # 星际旅行计算器脚本
│   ├── lorentz.html       # 洛伦兹时空图演示
│   ├── lorentz/           # 洛伦兹演示相关脚本
│   ├── brillouin_sampling.html  # 布里渊区采样演示
│   ├── cnn-conv1d.html    # CNN 卷积核可视化
│   ├── CartPole.html      # CartPole 强化学习演示
│   ├── gravity/           # 几何即引力交互课堂
│   └── gnn-neuron/        # GNN 神经元交互实验
└── docs/                   # 项目文档
    └── AGENTS.md          # AI Agents 相关文档
```

## 开始使用

在现代浏览器中打开 `index.html` 以查看展示。为了获得最佳效果，请通过简单的静态Web服务器提供站点：

```bash
python3 -m http.server 8000
```

然后导航到 http://localhost:8000/。

## 演示项目

- **星际旅行燃料计算器** - 基于相对论火箭方程的燃料计算工具
- **洛伦兹时空图** - 基于 Three.js 的闵可夫斯基时空图交互演示
- **布里渊区采样** - 第一布里渊区可视化工具
- **CNN 卷积核可视化** - Conv1d 交互式可视化实验
- **CartPole 强化学习** - MLP 控制倒立摆演示
- **几何即引力** - 从度规到爱因斯坦场方程的交互式相对论课堂
- **GNN 神经元实验** - 从图节点、邻居聚合到单个神经元的交互演示

## 许可证

此项目根据MIT许可证提供。有关详细信息，请参见LICENSE。

## 首页目录维护

首页按「物理与宇宙」「人工智能」「效率工具」分组。新增条目时，在 `index.html` 对应的 `.project-list` 中添加 `.project-row`，保留标题、说明和链接；可通过 `data-keywords` 补充搜索别名。分类数量由脚本按实际条目计算，搜索与类别筛选可同时使用。禁用 JavaScript 时仍显示完整目录。

首页样式限定在 `.lab-home` 下，避免影响使用共享样式的演示页。运行 `npm run check` 可检查首页脚本语法；`npm run build` 仅用于 CI/远端确认静态站点无需构建。
