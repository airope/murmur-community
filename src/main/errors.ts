export class TimeoutError extends Error {
  constructor(message = 'Transcription timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'ChatGPT session expired') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

export class MicOccupiedError extends Error {
  constructor(message = 'Microphone is in use by another application') {
    super(message)
    this.name = 'MicOccupiedError'
  }
}

export class CloudflareBlockError extends Error {
  constructor(message = 'Blocked by Cloudflare') {
    super(message)
    this.name = 'CloudflareBlockError'
  }
}

export class EmptyTranscriptionError extends Error {
  constructor(message = 'Empty transcription result') {
    super(message)
    this.name = 'EmptyTranscriptionError'
  }
}
