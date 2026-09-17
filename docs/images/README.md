# Screenshot provenance

The main README gallery uses unmodified captures of the actual Murmur Community Electron application from the Windows CI smoke evidence retained during release preparation. These are not mockups, commercial-edition screenshots, or generated UI.

| Published image | Original smoke capture | SHA-256 |
| --- | --- | --- |
| `home.png` | `home.png` | `e2abc2bd80bb8b2a3cff0030f24fc40b6fed9aef7176546b53041d92456167f0` |
| `transcription.png` | `settings-transcription.png` | `9d7e2b2485f3053e97b6cfa8c7ea2dfda6a8235a76b2daa24483e79648f3710e` |
| `ai-processing.png` | `settings-ai.png` | `7ce035a8d381cb8b608b87930c87bf0c4411d91590d811adca5414fc108a7310` |

All three images were visually reviewed before selection. They show a clean English-language profile, empty statistics, empty provider-key fields, and AI post-processing disabled. No personal dictation, account details, API keys, or desktop background is included. Images were copied byte-for-byte, without retouching or synthetic content.

## Reproduce

On Windows, after installing dependencies:

```sh
npm run build
npm run test:smoke
```

[`scripts/electron-smoke.cjs`](../../scripts/electron-smoke.cjs) launches the built app using temporary, isolated user data, sets English through the real settings IPC, and captures routes with Electron's `capturePage()`. Output defaults to `test-results/electron/`. Review every capture visually before publishing: a passing route assertion does not guarantee that entrance animations have settled or that the screenshot is nonblank.

The smoke substitutes OS login-item, shortcut, and focus side effects; it does not use a microphone, personal audio, or live provider credentials. These screenshots establish interface appearance only, not end-to-end transcription compatibility. See [verification scope](../VERIFICATION.md).

The older `onboarding.png` is retained for existing references but is not part of the current README gallery.
