# Contributing

Use Node.js 22.12 or later in the 22.x line and npm. Clone this repository, run
`npm ci`, then `npm run dev`. No Murmur account, backend or `.env` is needed.

Before proposing a change run:

```sh
npm run typecheck
npm test
npm run build
```

Add a failing test before fixing a regression. Keep changes focused and explain
Windows/macOS differences. Test hardware-specific behavior on the actual OS;
a mocked unit test does not establish microphone or accessibility compatibility.

Never add analytics, background account checks, production credentials, user
transcripts or personal application data. New network destinations must be
explained in `docs/PRIVACY.md` and require a deliberate user action.

The public repository is an independently buildable community edition. The
commercial website, billing and account services are not prerequisites and
are not developed here. Do not reintroduce commercial activation gates.

Contributions are provided under this repository's MIT license. Preserve
third-party notices and document provenance when adding assets or models.

## Maintainer release workflow

The build workflow produces unsigned Windows/macOS artifacts. For the initial
0.1.0 preview, manually run **Prepare verified prerelease** with a successful
**Verify community builds** run ID. It rejects another commit, branch, workflow
or unsuccessful run and creates a draft only. Review assets, checksums and
unsigned-binary warnings before publishing. Update the version and release
metadata explicitly before any later release.

This is a personal project: support and review are best effort, not a service
level commitment. See SECURITY.md for sensitive reports.
