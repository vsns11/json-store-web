/** Reading a .json file the user picked or dropped, and handing one back. */

export async function readJsonFile(file) {
  return { name: file.name.replace(/\.json$/i, ''), text: await file.text() }
}

export function downloadJson(name, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(name.trim() || 'profile').replace(/[^\w.-]+/g, '-').toLowerCase()}.json`
  link.click()
  URL.revokeObjectURL(url)
}
