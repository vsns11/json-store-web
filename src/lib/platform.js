/** Which modifier key the shortcuts use, so hints read ⌘ on a Mac and Ctrl everywhere else. */
export const isMac =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? '')

export const modKey = isMac ? '⌘' : 'Ctrl'

/** Joins keys the way the hints show them: "⌘ S" on a Mac, "Ctrl+S" elsewhere. */
export const shortcut = (...keys) => [modKey, ...keys].join(isMac ? ' ' : '+')
