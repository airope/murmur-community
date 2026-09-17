# Murmur Community

**Desktop voice dictation for Windows and macOS — local speech recognition, or cloud providers with your own API keys.**

[![Build verification](https://github.com/airope/murmur-community/actions/workflows/build.yml/badge.svg)](https://github.com/airope/murmur-community/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

> **Early community edition.** This is the independent open-source desktop app,
> not the previous commercial release. No Murmur account, activation server or
> paid subscription is required. Provider API fees, if you choose a cloud
> provider, are your responsibility.

![Murmur Community desktop](docs/images/home.png)

## What it does

- Start and stop dictation with a configurable global keyboard shortcut.
- Insert recognized text into your current application using the clipboard.
- Use downloadable local speech models, or choose a supported speech API.
- Optionally rewrite text with AI using your own provider key and explicit modes.
- Keep dictation history and usage statistics on your computer.
- Configure microphone, shortcuts, sound and interface language.

**No marketing telemetry, user/machine tracking, commercial quotas or automatic
update polling.** Local STT is the default. Read the [privacy and network
behavior](docs/PRIVACY.md), especially before enabling cloud post-processing.

## Try it from source

Requirements: Windows x64 or macOS, **Node.js 22.12+ (22.x recommended)**, npm,
and a microphone. Linux is not a supported release target.

```sh
git clone https://github.com/airope/murmur-community.git
cd murmur-community
npm ci
npm run dev
```

No `.env` file, backend deployment, Apple signing identity or Murmur account is
needed. Complete the setup, then choose a model or configure a provider in
Transcription settings. Local models and their inference runtime are downloaded
separately on request, not silently at first launch. See [model provenance and
requirements](docs/MODELS.md). English-only models are marked as such.

On macOS, grant microphone access when requested and Accessibility permission
if required for insertion into other applications. Change the shortcut if the
system or another app already uses it. Do not disable system-wide security
protections to run a development build.

## Verify and package

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke

# On Windows
npm run package

# On macOS (unsigned development ZIPs)
npm run package:mac
```

CI checks both operating systems and packages development artifacts. The smoke
test launches the real Electron app with a temporary profile, exercises the
renderer/preload/settings IPC and checks offline startup. It substitutes OS
login-item/global-shortcut side effects and does **not** certify microphone
capture or paste into other applications.

Release availability and exact tested scope are documented in
[verification notes](docs/VERIFICATION.md). Never treat the old commercial
installers as builds of this repository. Builds here use a separate application
identity and do not import or overwrite commercial Murmur data.

## Design and limitations

Murmur uses Electron, React, TypeScript and provider adapters. Windows and macOS
share one codebase; platform-specific behavior is kept in native integration and
packaging. [Architecture and trade-offs →](docs/ARCHITECTURE.md)

- Local recognition requires disk space and CPU resources; quality depends on
  the selected model and language. No speed/accuracy benchmark is claimed.
- Local audio can still produce cloud-bound text if AI post-processing is on.
- Experimental ChatGPT website integration is included but is not an official
  API, is not OpenAI-endorsed and may break when the website changes. Prefer
  local recognition or supported BYOK APIs.
- Automatic active-window context detection is deliberately excluded from this
  edition. Explicit AI modes remain available.
- Development packages are unsigned/not notarized by default.
- This is a personal project with best-effort maintenance, not a support SLA.

## Project background

Murmur began as a personal desktop product with an associated commercial website.
This edition extracts the reusable desktop application and removes the private
operational dependencies. The website, billing and account backend remain in a
separate private repository. The public history starts with the cleaned edition;
it does not expose private operational history. Development has been AI-assisted.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
[Privacy](docs/PRIVACY.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

The application source is available under the [MIT license](LICENSE).
Third-party packages, model weights, runtimes and service APIs retain their own
licenses and terms; the application license does not replace them.
