// Runs before the bundle so the page is painted in the right theme from the first frame; without
// this a dark-theme user sees a white flash on every load. The app takes over from here.
(function () {
  try {
    var stored = localStorage.getItem('theme')
    var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.dataset.theme = stored === 'dark' || stored === 'light' ? stored : system
  } catch (error) {
    document.documentElement.dataset.theme = 'light'
  }
})()
