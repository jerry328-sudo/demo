// Shared footer enhancement; directory behavior runs only on the home page.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-current-year]').forEach((element) => {
    element.textContent = new Date().getFullYear().toString();
  });

  const directory = document.querySelector('.lab-home .directory');
  if (!directory) return;

  const search = directory.querySelector('input[type="search"]');
  const buttons = [...directory.querySelectorAll('[data-filter]')];
  const groups = [...directory.querySelectorAll('[data-category]')];
  const rows = [...directory.querySelectorAll('.project-row')];
  const emptyState = directory.querySelector('.empty-state');
  const resultCount = directory.querySelector('[data-result-count]');
  let category = 'all';
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase().trim();
  const searchText = new Map(rows.map((row) => [row,
    normalize(`${row.textContent} ${row.dataset.keywords || ''} ${row.closest('.project-group').querySelector('h3').textContent}`)
  ]));

  buttons.forEach((button) => {
    const count = button.dataset.filter === 'all' ? rows.length :
      directory.querySelector(`[data-category="${button.dataset.filter}"]`).querySelectorAll('.project-row').length;
    button.querySelector('span').textContent = String(count).padStart(2, '0');
  });

  const updateDirectory = () => {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let visibleCount = 0;
    groups.forEach((group) => {
      let groupCount = 0;
      group.querySelectorAll('.project-row').forEach((row) => {
        const matches = (category === 'all' || group.dataset.category === category) &&
          terms.every((term) => searchText.get(row).includes(term));
        row.hidden = !matches;
        if (matches) groupCount += 1;
      });
      group.hidden = groupCount === 0;
      visibleCount += groupCount;
    });
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === category));
    });
    resultCount.textContent = `共 ${visibleCount} 个项目`;
    emptyState.hidden = visibleCount > 0;
  };

  buttons.forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.filter;
    updateDirectory();
  }));
  search.addEventListener('input', updateDirectory);
  directory.querySelector('[data-reset]').addEventListener('click', () => {
    category = 'all';
    search.value = '';
    updateDirectory();
    search.focus();
  });
  directory.querySelector('.directory-controls').hidden = false;
  updateDirectory();
});
