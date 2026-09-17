# Changelog

## 0.1.1

- Security: restrict remote ChatGPT media permissions, navigation and readiness to explicit trusted origins/frames; deny camera and popups.
- Fix testing previously saved provider keys without sending keys back to the renderer.
- Add behavioral regression coverage; no live ChatGPT login certification.

## 0.1.0 — Community edition

- Separate open-source Windows/macOS desktop project from the private website.
- Remove commercial activation, quota enforcement, marketing analytics and usage
  synchronization; keep useful history and statistics local.
- Separate application identity and data directory from the commercial release.
- Keep local speech recognition and optional user-configured cloud providers.
- Remove obfuscation and author-specific signing requirements.
- Add explicit privacy, architecture, contribution and security documentation.

This version starts a new public history from the author's Murmur codebase.
The private development history is intentionally not published because it
contains operational material. AI-assisted development was used in the original
project and in preparing this edition. Third-party code remains subject to its
own licenses; see THIRD_PARTY_NOTICES.md.
