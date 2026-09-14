// Runs before the bundle, and after config.js, so the page is painted in the right theme AND the
// right colour from the first frame. Without it a dark-theme user sees a white flash on every
// load, and a workspace with its own accent sees this app's teal first.
(function () {
  var root = document.documentElement
  var cfg = window.__APP_CONFIG__ || {}

  try {
    var stored = localStorage.getItem('theme')
    var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.dataset.theme = stored === 'dark' || stored === 'light' ? stored : system
  } catch (error) {
    root.dataset.theme = 'light'
  }

  if (cfg.appName) document.title = cfg.appName

  var accent = String(cfg.accent || '').trim()
  // Only a colour this file can reason about is accepted: anything else would set a custom
  // property the stylesheet cannot use, and every accented control would lose its colour.
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) return

  var hex = accent.length === 4
    ? '#' + accent[1] + accent[1] + accent[2] + accent[2] + accent[3] + accent[3]
    : accent
  var channel = function (i) {
    var c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  var luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)

  root.style.setProperty('--accent', hex)
  // Left as a color-mix expression rather than a computed colour, so the soft tint is resolved
  // against whichever surface the current theme is using and follows a theme switch.
  root.style.setProperty('--accent-soft', 'color-mix(in srgb, ' + hex + ' 14%, var(--surface))')
  root.style.setProperty('--accent-contrast', luminance > 0.45 ? '#10131a' : '#ffffff')

  var mark = String(cfg.brandMark || '{}').slice(0, 2)
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="14" fill="' + hex + '"/>' +
    '<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="ui-monospace, monospace" font-weight="700" font-size="' +
    (mark.length > 1 ? 30 : 38) + '" fill="' + (luminance > 0.45 ? '#10131a' : '#ffffff') +
    '">' + mark.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text></svg>'
  var link = document.querySelector('link[rel="icon"]') || document.createElement('link')
  link.rel = 'icon'
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg)
  document.head.appendChild(link)
})()
