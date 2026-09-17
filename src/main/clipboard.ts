import { clipboard, systemPreferences } from 'electron'

export class ClipboardService {
  async writeAndPaste(text: string): Promise<void> {
    console.log(`[Murmur] Clipboard: writing text (${text.length} chars) + simulating paste`)
    clipboard.writeText(text)
    await this.simulatePaste()
  }

  private async simulatePaste(): Promise<void> {
    try {
      const isMac = process.platform === 'darwin'

      if (isMac) {
        const trusted = systemPreferences.isTrustedAccessibilityClient(false)
        if (!trusted) {
          console.warn('[Murmur] Clipboard: Accessibility permission not granted — opening System Settings...')
          // Prompt macOS to open System Settings → Privacy → Accessibility
          systemPreferences.isTrustedAccessibilityClient(true)
          throw new Error(
            'Murmur needs Accessibility permission to paste text. Please grant it in System Settings → Privacy & Security → Accessibility, then restart Murmur.'
          )
        }
      }

      const modKey = isMac ? 'Cmd' : 'Ctrl'
      console.log(`[Murmur] Clipboard: simulating ${modKey}+V...`)
      const { keyboard, Key } = await import('@nut-tree-fork/nut-js')
      const modifier = isMac ? Key.LeftSuper : Key.LeftControl
      await keyboard.pressKey(modifier, Key.V)
      await keyboard.releaseKey(modifier, Key.V)
      console.log(`[Murmur] Clipboard: ${modKey}+V simulated`)
    } catch (err) {
      console.error('[Murmur] Paste simulation failed:', err)
      throw err
    }
  }
}
