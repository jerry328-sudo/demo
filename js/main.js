// Update footer year dynamically so the page stays current.
document.addEventListener('DOMContentLoaded', () => {
  const yearElement = document.querySelector('[data-current-year]');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear().toString();
  }
});
