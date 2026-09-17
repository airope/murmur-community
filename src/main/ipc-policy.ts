import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
/** Identity AND exact document URL are required: never trust a remote or child frame. */
export function isTrustedLocalSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
  windows: Array<BrowserWindow | null>,
  rendererURL: string
): boolean {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false
  if (!windows.some(win => win && !win.isDestroyed() && win.webContents === event.sender)) return false
  try {
    const actual = new URL(event.senderFrame.url)
    const expected = new URL(rendererURL)
    actual.hash = ''; expected.hash = ''
    return actual.href === expected.href
  } catch { return false }
}
