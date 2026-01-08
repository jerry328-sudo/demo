# Repository Guidelines

## Project Structure & Module Organization

### 📁 Directory Structure
The project follows a modular, engineering-oriented folder structure:

```
demo/
├── index.html              # Main entry point
├── package.json            # Project configuration
├── esa.jsonc               # ESA configuration
├── LICENSE                 # MIT License
├── README.md               # Project documentation
├── .gitignore              # Git ignore rules
│
├── css/                    # Global styles (shared across all pages)
│   └── main.css           
│
├── js/                     # Global scripts (shared across all pages)
│   └── main.js            
│
├── assets/                 # Static resources
│   └── images/            # Image files (logos, icons, etc.)
│
├── demos/                  # All demo projects
│   ├── *.html             # Individual demo pages
│   ├── *.js               # Demo-specific scripts
│   └── [demo-name]/       # Complex demos with multiple modules
│
└── docs/                   # Project documentation
    ├── AGENTS.md          # This file
    ├── PROJECT_STRUCTURE.md   # Detailed structure guide
    └── REFACTORING_SUMMARY.md # Refactoring history
```

### 🎯 Adding New Demo Projects

When creating a new demo, follow these steps:

1. **Create demo files in `demos/` folder:**
   - Simple demo: `demos/my-demo.html` + `demos/my-demo.js` (if needed)
   - Complex demo: `demos/my-demo/` folder with multiple files

2. **Resource references (from demo pages):**
   ```html
   <!-- Favicon -->
   <link rel="icon" type="image/webp" href="../assets/images/cropped-logo1.webp">
   
   <!-- Global CSS -->
   <link rel="stylesheet" href="../css/main.css">
   
   <!-- Demo-specific script -->
   <script src="./my-demo.js"></script>
   <!-- OR for modular demos -->
   <script type="module" src="./my-demo/main.js"></script>
   
   <!-- Back link -->
   <a href="../index.html">← 返回实验室主页</a>
   ```

3. **Register in `index.html`:**
   Add a card in the `demo-grid` section:
   ```html
   <article class="card">
     <span class="badge">Category</span>
     <h2>Demo Title</h2>
     <p>Demo description...</p>
     <footer>
       <span>2026 · Type</span>
       <a href="demos/my-demo.html" target="_blank" rel="noopener">打开演示 →</a>
     </footer>
   </article>
   ```

4. **Asset management:**
   - Images → `assets/images/`
   - Shared styles → `css/main.css`
   - Shared scripts → `js/main.js`
   - Demo-specific files → `demos/`

### 📂 File Placement Rules

- **Root level:** Only `index.html`, config files, and documentation
- **`demos/`:** All HTML demo pages and their specific scripts/modules
- **`assets/images/`:** All image files (`.webp`, `.png`, `.svg`, etc.)
- **`css/`:** Global stylesheets shared across pages
- **`js/`:** Global scripts shared across pages
- **`docs/`:** Technical documentation and guides

### 🔗 Path Reference Patterns

| From | To | Path |
|------|-----|------|
| `index.html` | Global CSS | `css/main.css` |
| `index.html` | Global JS | `js/main.js` |
| `index.html` | Images | `assets/images/file.webp` |
| `index.html` | Demo pages | `demos/demo-name.html` |
| `demos/*.html` | Global CSS | `../css/main.css` |
| `demos/*.html` | Global JS | `../js/main.js` |
| `demos/*.html` | Images | `../assets/images/file.webp` |
| `demos/*.html` | Demo script | `./demo-name.js` |
| `demos/*.html` | Back to home | `../index.html` |

When adding content, maintain these relative path conventions to ensure GitHub Pages hosting remains functional.

## Build, Test, and Development Commands
There is no local debugging workflow; commit changes directly to the static files. The `npm run build` script is reserved for CI or remote validation and simply confirms that no additional build step is required—keep its output explicit. Whenever scripts change, update `package.json` so contributors can discover them through `npm run`. If a command must run in a particular remote environment, document that execution flow in the pull request description.

## Coding Style & Naming Conventions
Author HTML with semantic sections (`main`, `header`, `footer`) and two-space indentation. CSS selectors use lowercase kebab-case; extend existing utility classes instead of inlining styles. Maintain gradients and color tokens near the top of `css/main.css` so theme adjustments stay manageable. JavaScript should rely on modern ES2015+ patterns with early returns and guard clauses, mirroring the `data-current-year` handler. Favor descriptive variable names and avoid introducing frameworks without prior agreement.

## Testing Guidelines
No automated test harness exists, so validation happens in the deployment environment. After pushing, view the latest branch on GitHub Pages (or the equivalent hosting preview) to ensure cards render, links resolve, and the footer year updates correctly. When altering an interactive demo, include a short sanity checklist in the PR (for example, “CartPole animation runs for 60s without console errors”). If you add automated linting or visual regression checks, record the corresponding commands in the section above.

## Commit & Pull Request Guidelines
Commits should remain concise and action-led; the history uses short Mandarin summaries like `新增...`, which you may mirror in Mandarin or tight English and keep under 72 characters. Pull requests must provide: (1) a brief problem statement, (2) a bullet list of key changes, (3) before/after screenshots or GIFs for UI updates, and (4) links to related issues. When touching shared CSS or the landing page layout, request at least one reviewer.
