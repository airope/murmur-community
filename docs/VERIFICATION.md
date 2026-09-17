# Verification scope

This is an early community edition, not a claim of complete hardware/provider
certification. The CI badge and linked workflow are the live build status.

## Checks implemented

- Main/preload/shared and renderer TypeScript projects are checked explicitly.
- Unit/regression tests cover community boundaries, IPC sender policy, editable
  settings, local storage, local STT, model downloads and recording lifecycle.
- Source-boundary tests prevent commercial routes, telemetry and retired preload
  APIs from silently returning.
- The Electron smoke launches the actual built main process, preload and renderer
  with isolated temporary user data. It checks local defaults, settings IPC,
  route rendering, and unexpected network requests. Screenshots are generated
  from this real app, not from HTML mockups.
- Native OS login-item/global-shortcut mutations are substituted in that smoke.
  A passing smoke therefore does not certify native shortcut registration or
  insertion into other applications.
- Opt-in local-recognition integration downloads pinned, verified upstream
  artifacts and transcribes a hashed public JFK audio fixture with the actual
  sherpa-onnx binary. It is skipped in the normal unit suite and run separately
  on Windows/macOS CI. No live microphone, personal audio or provider key is used.
- Secret scanning uses Gitleaks and a clean public Git history. Old private
  development history and operational documents are intentionally excluded.

## Observed local recognition result

The opt-in test was actually executed on macOS arm64. It downloaded and verified
the pinned sherpa runtime and Whisper Tiny model, extracted the real executable,
and recognized both expected phrases from the hashed public JFK WAV fixture.
The integration test passed in 98.15 seconds including first-time installation.
This test used the existing Vitest 2 runner before the fresh toolchain install;
it does not substitute for the new-lockfile Windows/macOS CI gates. It did not
use a microphone or personal audio.

## Dependency audit

The refreshed lockfile audit found no high/critical advisories at preparation
check time. Seven moderate findings remain in the nut-js → Jimp → file-type
transitive chain (multiple affected packages, not seven independent application
exploits). The cited upstream issue is an infinite loop parsing crafted ASF
files. Murmur uses the keyboard insertion API, not the image/file parsing API;
this is scope reduction, not a guarantee of unreachability or a security waiver.
CI fails on high/critical audit results. Do not apply incompatible major overrides
merely to make an audit counter read zero; replace/upgrade the dependency with
behavioral verification when upstream support becomes available.

## Boundaries not certified

- Physical microphone permissions/capture on all OS versions or audio devices.
- Native paste into every third-party app and every keyboard layout.
- Authenticated cloud provider responses or billing; no private keys are used in CI.
- Experimental ChatGPT website login and voice automation against a live account.
- Notarization, trusted code-signing or Microsoft SmartScreen reputation.
- Linux support, performance/accuracy benchmarks, or a formal penetration test.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:smoke
```

For real local recognition on a machine with sufficient disk and network access,
set `MURMUR_RUN_MODEL_INTEGRATION=1` and run the integration file as documented in
[MODELS.md](MODELS.md). Do not enable this on a low-disk development machine.

At initial preparation, local dependency reuse was necessary because the host
had very little free disk. Fresh dependency installation and distribution
packaging are separate CI gates; a local build alone is not proof of them.
