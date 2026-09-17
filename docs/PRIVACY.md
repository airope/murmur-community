# Privacy and network behavior

## Community boundary

No Murmur account is required. The community edition removes marketing analytics,
user/machine identification, clipboard visitor tracking, license validation,
usage synchronization and automatic update polling. The commercial application's
privacy behavior is different; this document covers this repository only.

## What stays on your computer

Settings, dictation history and aggregate usage statistics are stored locally in
the application's own user-data directory. History contains the dictated text;
anyone with access to that user account may be able to read it. Clearing history
does not promise forensic secure erasure. Clipboard insertion puts the text on
the OS clipboard, which may be retained by other clipboard managers.

Provider keys are stored through Electron's OS-backed `safeStorage` support.
If OS encryption is unavailable, saving a key fails rather than falling back to
plaintext. This is not protection against malware running as the same user. Keys are not
returned in plaintext by the settings UI. Do not put keys into environment
examples, repository files or screenshots.

## When network access is expected

| Action | Destination / data |
|---|---|
| Install a local model or runtime | GitHub-hosted runtime releases and Hugging Face-hosted model artifacts / artifact requests and normal HTTP metadata; not dictated audio |
| Dictate using a cloud STT provider | Selected provider receives audio and the API credentials needed for that request |
| Enable AI post-processing | Selected LLM provider receives dictated text and your configured prompt/mode |
| Use experimental ChatGPT | OpenAI's website receives the web session and audio; its cookies and policy apply |
| Test a provider key | Selected provider receives an authenticated test request |
| Open a documentation/release/provider link | Your system browser contacts that site |

Cloud providers include Groq, Deepgram, AssemblyAI and ElevenLabs for
speech adapters, and configured LLM providers such as OpenAI, Anthropic, Google, Mistral,
DeepSeek and OpenRouter. Provider policies, billing and retention are independent
of Murmur Community. Choosing a local speech model does **not** keep text local
if cloud AI post-processing is enabled.

Local recognition needs an initial model/runtime download. After installation,
local recognition with AI post-processing off is intended to operate offline.
Refer to the release verification notes for the scope actually exercised; this
document is not a packet-level certification of every provider.

## Permissions

Microphone access is needed to record. Accessibility/keyboard permissions may be
needed to paste into another application on macOS. Permission prompts must be
accepted by the user; the app should not alter system security settings.
