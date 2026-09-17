import { Notification } from 'electron'
import {
  TimeoutError,
  SessionExpiredError,
  MicOccupiedError,
  CloudflareBlockError,
  EmptyTranscriptionError
} from './errors'
import { mt } from './i18n'

const MESSAGE_KEYS: Record<string, string> = {
  TimeoutError: 'notifications.timeout',
  SessionExpiredError: 'notifications.sessionExpired',
  MicOccupiedError: 'notifications.micOccupied',
  CloudflareBlockError: 'notifications.cloudflareBlock',
  EmptyTranscriptionError: 'notifications.emptyTranscription'
}

export class NotificationService {
  showError(
    error: TimeoutError | SessionExpiredError | MicOccupiedError | CloudflareBlockError | EmptyTranscriptionError
  ): void {
    const key = MESSAGE_KEYS[error.name]
    if (key) {
      new Notification({ title: 'Murmur', body: mt(key) }).show()
    } else {
      new Notification({ title: 'Murmur', body: mt('notifications.genericError') + error.message }).show()
    }
  }
}
