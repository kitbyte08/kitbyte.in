(() => {
  const toast = document.getElementById('toast');
  const randomButton = document.getElementById('randomButton');
  const helpButton = document.querySelector('.help-button');
  const toolCards = Array.from(document.querySelectorAll('[data-tool]'));
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  randomButton?.addEventListener('click', () => {
    if (!toolCards.length) return;
    toolCards.forEach(card => card.classList.remove('is-picked'));
    const chosen = toolCards[Math.floor(Math.random() * toolCards.length)];
    chosen.classList.add('is-picked');
    chosen.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    showToast(`Today's creative pick: ${chosen.dataset.tool} ✨`);
    window.setTimeout(() => chosen.classList.remove('is-picked'), 1300);
  });

  helpButton?.addEventListener('click', event => {
    // The help control is an in-page anchor; navigation remains a normal HTML link.
    showToast('Pick any tool and learn at your own pace. You’ve got this! 💜');
  });

  // Give the page a graceful fallback if a browser does not support smooth scrolling.
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      if (targetId === '#toolsSection') {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });
})();
