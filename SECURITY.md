# Security

Murmur Community is an early community edition, not a security-certified product.
Do not submit API keys, audio recordings, transcripts or account identifiers in
public issues. For vulnerabilities, use GitHub's private vulnerability reporting
when enabled; otherwise contact the maintainer privately through their profile
rather than publishing exploit details or credentials.

The app handles microphone input, clipboard insertion and optional API keys.
Review [the privacy model](docs/PRIVACY.md) before enabling a cloud provider.
Dependencies and optional third-party model/runtime downloads have their own
security lifecycles. Review their licenses and release integrity independently.

Development builds are unsigned/not notarized by default. Never weaken your
system-wide security settings to run an untrusted build. Use trusted source and
verify the origin of any downloaded artifact.

Security updates target the current community branch only. No maintenance
commitment is made for previous commercial binaries or forks.
