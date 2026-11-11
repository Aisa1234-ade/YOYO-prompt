document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    const saved = localStorage.getItem('yoyo-theme');
    if (saved === 'light') document.body.style.background = '#eef2ff';
    themeToggle.addEventListener('click', () => {
      const next = document.body.style.background === 'rgb(238, 242, 255)' ? '#0a0d18' : '#eef2ff';
      document.body.style.background = next;
      localStorage.setItem('yoyo-theme', next === '#eef2ff' ? 'light' : 'dark');
    });
  }

  document.querySelectorAll('[data-tab-button]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tabButton;
      document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.tabPanel !== target);
      });
      document.querySelectorAll('[data-tab-button]').forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  document.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copyLink || window.location.href);
        const label = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = label), 1200);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
  });
});
