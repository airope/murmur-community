# Downloaded speech models and runtime

Murmur Community does **not bundle model weights or the native speech runtime**.
They are downloaded when the user installs a local model. Local recognition runs
on the device; installing requires HTTPS connections to **Hugging Face and its
CDN/Xet hosts**, and **GitHub and its release-asset hosts**. These hosts receive
ordinary connection/request metadata (including IP address); model downloads do
not upload recordings or transcripts. Optional cloud transcription is separate.

## Catalog, provenance and licenses

Only these OpenAI Whisper conversions are offered:

| Catalog ID | Upstream Hugging Face repository | Pinned revision |
| --- | --- | --- |
| whisper-tiny-en | [csukuangfj/sherpa-onnx-whisper-tiny.en](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en) | `d026532c022fa99fd789d6b32446a1df7b6bfc43` |
| whisper-small-en | [csukuangfj/sherpa-onnx-whisper-small.en](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en) | `d9533f69affd85061aee349af7fea5cb2996dbbe` |
| whisper-large-v3 | [csukuangfj/sherpa-onnx-whisper-large-v3](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3) | `2a6507094dd6020d939d78e3f1834a1d06267fca` |

**Whisper code and weights: MIT, copyright (c) 2022 OpenAI.** This is explicitly
stated in the [OpenAI README License section](https://github.com/openai/whisper#license)
and [license text](https://github.com/openai/whisper/blob/main/LICENSE).
The [sherpa-onnx conversion instructions](https://github.com/k2-fsa/sherpa-onnx/blob/v1.12.27/scripts/whisper/README.md)
describe conversion of OpenAI Whisper to ONNX. The selected HF repositories have
no license card/README in the metadata checked: the MIT identification is based
on the original weights' license and documented conversion lineage, **not an
invented Hugging Face license declaration**. Conversion reproducibility and
byte-for-byte equivalence to original weights have not been independently audited.
Preserve the OpenAI MIT notice when redistributing weights. Murmur's own MIT
license does not replace upstream notices.

### Exact model artifacts

Sizes below are bytes, not estimates. ONNX SHA-256 values and sizes came from the
Hugging Face API `GET /api/models/{repo}?blobs=true` (`siblings[].lfs.sha256` and
`size`); each `sha` revision was inserted into its resolve URL. Token files are
ordinary Git blobs, not LFS: their **actual bytes at the pinned revision** were
fetched (less than 1 MB each), counted and SHA-256 hashed. A Git blob ID is NOT a
file SHA-256. Full model weights were not downloaded during this metadata audit.

| File (pinned download link) | Bytes | SHA-256 |
| --- | ---: | --- |
| [tiny.en-encoder.int8.onnx](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/tiny.en-encoder.int8.onnx) | 12937772 | `0ce578b827c94a961aacb8fa14b02f096504b337e5c94be37c36238cbe3e8bc6` |
| [tiny.en-decoder.int8.onnx](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/tiny.en-decoder.int8.onnx) | 89853865 | `06c0e6ff6348d427e51839219d1c886c18cfdf411e629e33f5e1679bff9c1527` |
| [tiny.en-tokens.txt](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/tiny.en-tokens.txt) | 835554 | `306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930` |
| [small.en-encoder.int8.onnx](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en/resolve/d9533f69affd85061aee349af7fea5cb2996dbbe/small.en-encoder.int8.onnx) | 112442483 | `8bdac288f369aa94ee2194059238c465ed82ea9d47ee8fa4a8c0a891873e462f` |
| [small.en-decoder.int8.onnx](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en/resolve/d9533f69affd85061aee349af7fea5cb2996dbbe/small.en-decoder.int8.onnx) | 262223042 | `710ccf890e10f3faa15f51ec346081a2723c9f3adb6e4da81c6573a5a6f877fb` |
| [small.en-tokens.txt](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en/resolve/d9533f69affd85061aee349af7fea5cb2996dbbe/small.en-tokens.txt) | 835554 | `306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930` |
| [large-v3-encoder.int8.onnx](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3/resolve/2a6507094dd6020d939d78e3f1834a1d06267fca/large-v3-encoder.int8.onnx) | 766671985 | `d531cf17248acc43e8c09b472a0877055e770877857a5332fc1304b36534ec85` |
| [large-v3-decoder.int8.onnx](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3/resolve/2a6507094dd6020d939d78e3f1834a1d06267fca/large-v3-decoder.int8.onnx) | 1008265203 | `ebc6bfd88e162a46cb3edee8a7e727e1dcbc65cabecb19e2573695e4d495e1af` |
| [large-v3-tokens.txt](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3/resolve/2a6507094dd6020d939d78e3f1834a1d06267fca/large-v3-tokens.txt) | 816730 | `b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126` |

`sizeBytes` in the catalog is the exact sum of the listed files. Previous download
estimates were materially too small, especially decoder files.

## Native runtime

sherpa-onnx **v1.12.27**, [release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/v1.12.27).
The project is [Apache-2.0](https://github.com/k2-fsa/sherpa-onnx/blob/v1.12.27/LICENSE).
Static release binaries also contain dependencies; Apache-2.0 here identifies
sherpa-onnx, not a claim that every linked component has that same license.
Consult the upstream release/source notices before redistributing a binary.
This application downloads upstream assets rather than repackaging them.

| Release asset | Compressed bytes | SHA-256 |
| --- | ---: | --- |
| sherpa-onnx-v1.12.27-osx-universal2-static.tar.bz2 | 423371358 | `b2745e840b5460d7d9ad67ccb26b4d8e3c769f7663682dd805d0fb2f345e30d2` |
| sherpa-onnx-v1.12.27-win-x64-static-MT-Release.tar.bz2 | 198251806 | `1fed2afff5135645cda03d764a80761a3afcae12e08f9e2033912964b1d46900` |

Hashes and sizes were read from GitHub's
[release API](https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/tags/v1.12.27),
`assets[].digest` (`sha256:` prefix) and `assets[].size`. They are pinned in the
application, not re-fetched as trust anchors on each installation. macOS universal
and Windows x64 are supported; Linux/Windows ARM native runtime support is not
claimed. Full upstream runtime downloads were not performed in the disk-limited
local audit environment.

## Integrity and extraction policy

- Every model/token file and compressed runtime archive must match both the
  pinned SHA-256 and exact byte count. The downloaded stream is bounded by the
  expected size. Downloads use exclusive random `.part` files and are renamed
  into place only after validation; failures remove staging files and preserve
  any existing destination.
- HTTPS only; credentials and nonstandard ports are rejected. Each of at most
  five redirects is revalidated against GitHub release hosts or the
  `huggingface.co`/`.huggingface.co`/`.hf.co` domains (including Xet CDN hosts).
  There is a 30-second socket-inactivity timeout, not a total download deadline.
- Archive SHA-256 is rechecked before decompression. Streaming tar extraction
  validates header checksums and rejects absolute/traversing/Windows-special
  paths. It writes **only one matching regular executable** to an exclusive
  staging file; archive directories, hardlinks, symlinks, PAX/GNU metadata and
  other files are never materialized. No archive-controlled path is passed to
  filesystem extraction or a shell. Extended tar metadata is not interpreted;
  the selected binary must have its ordinary short filename in the header.
- The executable's hash/size and the pinned archive digest are recorded locally.
  Installed-runtime checks rehash it and require that receipt. Old unverified
  runtimes must be installed again. Model installed checks rehash all files;
  existing corrupt files are not silently skipped during repair/install.
- The runtime receipt is **not a signature** and cannot resist an attacker who
  can rewrite both the executable and userData receipt. Hashes protect against
  transport corruption/substitution relative to these pinned upstream artifacts,
  not malicious upstream publishers, compromised app code, or arbitrary local
  filesystem attackers. Hash checks do not eliminate check-to-use races.
- Hashing installed files currently runs synchronously with a bounded 1 MB
  buffer; large-model readiness checks may pause the main process. Extraction
  uses streaming JS bzip2 on all supported platforms, trading CPU time for low
  disk usage. Runtime peak space includes the archive plus extracted executable;
  allow several GB free for installation/testing, especially larger models.

## Deliberately omitted model

The old `parakeet-tdt-0.6b` catalog item pointed to
[csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2](https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2),
revision `86891485dd8ad7cb28cb1aade45c3e23d0197c30`, whose metadata declares
**CC-BY-4.0**, not MIT. It is omitted from this initial MIT-weight-only catalog
pending attribution and converted-weight/upstream license review. This is not
an assertion that Parakeet is unlicensed or noncommercial. Its encoder.onnx,
encoder.weights, decoder.onnx, joiner.onnx and tokens.txt are no longer offered;
no hashes or license claims for those artifacts have been invented. UI choices
must come from the catalog rather than depend on that ID.

## Real recognition integration test

`src/main/__tests__/local-recognition.integration.test.ts` is opt-in:

```sh
MURMUR_RUN_MODEL_INTEGRATION=1 npm run test:main -- src/main/__tests__/local-recognition.integration.test.ts
```

On Windows set the environment variable using your shell/CI environment. This
installs real pinned Tiny English weights/runtime into an isolated temporary
userData directory, invokes the actual LocalSTTService executable and checks the
JFK phrase. Only Electron's userData lookup is mocked. It requires no API key or
microphone and cleans its temporary installation in `finally`. It is skipped
in ordinary tests and **was not run locally** due to critically low disk space.
Run on Windows/macOS CI with sufficient disk before asserting end-to-end support.

The small [JFK WAV fixture](https://raw.githubusercontent.com/ggerganov/whisper.cpp/b0a11594aec50892a02cd8d129eee2dfe93a8bb8/samples/jfk.wav)
is pinned to the whisper.cpp repository commit above: 352078 bytes, SHA-256
`59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e`.
Its bytes were fetched and hashed during this audit; the test also checks both.
It is downloaded only by the opt-in test, not bundled in the application.
