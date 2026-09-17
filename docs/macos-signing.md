# macOS signing

Community builds do not require an Apple account or the original author's certificate. The default configuration disables Developer ID signing and notarization. Unsigned builds are for development and carry macOS trust warnings.

For an official signed release, maintainers must use their own Developer ID certificate and Apple notarization credentials, supplied through a protected CI environment or Keychain. Never place passwords, certificates, private keys, Apple account identifiers or tokens in source documentation.

Use a separate, private electron-builder configuration to enable signing and notarization. Do not commit that configuration if it contains identifying or secret values. Verify the resulting application with `codesign --verify --deep --strict` and `spctl --assess --type execute` before describing it as signed and notarized.

The Community application uses its own bundle identifier and does not replace the commercial Murmur installation.
