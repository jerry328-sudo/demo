# Repository Guidelines

## Project Structure & Module Organization
The site is a static set of interactive demos surfaced by `index.html`. Standalone pages such as `CartPole.html`, `brillouin_sampling.html`, and `cnn-conv1d.html` live at the repository root. Shared styling is centralized in `css/main.css`, while lightweight behavior (like the dynamic footer year) is handled in `js/main.js`. Place new assets in sibling folders (`css`, `js`, `assets`) and reference them with relative paths to keep GitHub Pages hosting untouched. When adding a demo, register it in the card grid inside `index.html` and reuse the existing badge/button patterns to maintain visual continuity.

## Build, Test, and Development Commands
There is no local debugging workflow; commit changes directly to the static files. The `npm run build` script is reserved for CI or remote validation and simply confirms that no additional build step is required—keep its output explicit. Whenever scripts change, update `package.json` so contributors can discover them through `npm run`. If a command must run in a particular remote environment, document that execution flow in the pull request description.

## Coding Style & Naming Conventions
Author HTML with semantic sections (`main`, `header`, `footer`) and two-space indentation. CSS selectors use lowercase kebab-case; extend existing utility classes instead of inlining styles. Maintain gradients and color tokens near the top of `css/main.css` so theme adjustments stay manageable. JavaScript should rely on modern ES2015+ patterns with early returns and guard clauses, mirroring the `data-current-year` handler. Favor descriptive variable names and avoid introducing frameworks without prior agreement.

## Testing Guidelines
No automated test harness exists, so validation happens in the deployment environment. After pushing, view the latest branch on GitHub Pages (or the equivalent hosting preview) to ensure cards render, links resolve, and the footer year updates correctly. When altering an interactive demo, include a short sanity checklist in the PR (for example, “CartPole animation runs for 60s without console errors”). If you add automated linting or visual regression checks, record the corresponding commands in the section above.

## Commit & Pull Request Guidelines
Commits should remain concise and action-led; the history uses short Mandarin summaries like `新增...`, which you may mirror in Mandarin or tight English and keep under 72 characters. Pull requests must provide: (1) a brief problem statement, (2) a bullet list of key changes, (3) before/after screenshots or GIFs for UI updates, and (4) links to related issues. When touching shared CSS or the landing page layout, request at least one reviewer.
