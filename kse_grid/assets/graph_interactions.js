(function () {
  function bindBackgroundClear() {
    const graph = document.getElementById('graph');
    const clearButton = document.getElementById('clear-selection');
    if (!graph || !clearButton || graph.dataset.clearBound === '1') {
      return;
    }

    graph.dataset.clearBound = '1';
    graph.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('.selection-card')) {
        return;
      }

      if (target.closest('.scatterlayer .trace, .legend, .modebar, .hoverlayer')) {
        return;
      }

      clearButton.click();
    });
  }

  const observer = new MutationObserver(bindBackgroundClear);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', bindBackgroundClear);
  document.addEventListener('DOMContentLoaded', bindBackgroundClear);
})();
