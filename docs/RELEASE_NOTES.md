# Murmur Community 0.1.1 — early preview

A standalone open-source desktop edition for Windows and macOS, under MIT.

## Security and correctness fixes in 0.1.1

- Restrict experimental ChatGPT media access to audio requests from the owned main frame at exact trusted HTTPS origins. Deny camera, unknown origins, popups and unapproved navigation/redirects.
- Replace substring readiness checks with exact origin checks.
- Repair Save → Test for stored provider keys without exposing saved secrets to the renderer.
- Users of 0.1.0 should upgrade before using ChatGPT. Additional/popup-only SSO flows intentionally fail closed. Live login and physical microphone compatibility remain unverified.

## Community changes

- No Murmur account, commercial license, quota, referral or usage-sync dependency.
- Marketing telemetry and automatic commercial updates removed.
- Local recognition is the default; cloud STT and optional AI use your own keys.
- Separate application identity and user-data directory preserve commercial installations.
- API keys fail closed if OS-backed encryption is unavailable.
- Verified, pinned local-model/runtime downloads; documented upstream licenses.
- Regression tests for microphone ownership, cancellation and shortcut updates.
- Real screenshots, architecture, privacy and contribution documentation.

## Downloads

- `Murmur-Community-Setup-0.1.1.exe`: Windows x64 installer.
- `Murmur-Community-0.1.1-arm64.zip`: Apple Silicon macOS application.
- `Murmur-Community-0.1.1-x64.zip`: Intel macOS application.
- `SHA256SUMS`: SHA-256 checksums for the files above.

These are **unsigned development binaries**, not notarized or reputation-backed
production installers. Windows SmartScreen and macOS Gatekeeper may block them.
Do not disable OS security globally. If you do not want to approve an unsigned
application from a source you have reviewed, build locally from the tagged source.

## Verification and limits

Artifacts are attached only from a successful clean-install Windows/macOS CI run
for the exact tagged commit. The pipeline checks types, unit/regression tests,
actual Electron startup/routes/settings IPC without startup network requests,
real local recognition of a public audio fixture, and distribution packaging.
The macOS CI exercises its native runner architecture; packaging both Intel and
Apple Silicon does **not** mean both CPU architectures were runtime-tested.

No live personal microphone, paid cloud-provider credentials, ChatGPT account,
native paste into arbitrary applications or all keyboard layouts are certified
by those tests. The ChatGPT adapter remains experimental. See
[verification scope](https://github.com/airope/murmur-community/blob/v0.1.1/docs/VERIFICATION.md), [privacy](https://github.com/airope/murmur-community/blob/v0.1.1/docs/PRIVACY.md) and
[model provenance](https://github.com/airope/murmur-community/blob/v0.1.1/docs/MODELS.md). Moderate transitive dependency advisories are
recorded openly; no claim of a formal security audit is made.

The old commercial website and backend are separate and are not dependencies of
this community edition. No commercial installation is automatically migrated.
