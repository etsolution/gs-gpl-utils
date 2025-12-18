# GS GPL Utils — Browser PDF Compressor

A client‑side PDF compression tool using Ghostscript (GhostPDL) compiled to WebAssembly, with PDF.js for preview and Tailwind CSS for UI. This project aims to be GPLv3/AGPLv3 compliant by making the complete corresponding source available and preserving upstream attributions.

- Live UI: `portal/pdfapi/pdfapi.html`
- Source repo: https://github.com/etsolution/gs-gpl-utils

## Features
- Client‑side compression via Ghostscript (WASM)
- Quality presets with instant preview (via PDF.js)
- Background preloading and caching of outputs
- Mobile‑friendly interface (Tailwind)

## Quick Start (Local)
```bash
# From repo root
cd portal/pdfapi
# Start a simple HTTP server (Service Worker requires http/https)
python -m http.server 8080
# Open http://localhost:8080/portal/pdfapi/pdfapi.html
```
Notes:
- Use a hard refresh (Ctrl+Shift+R) after updates due to Service Worker caching for `gs.wasm`.
- Alternatively serve via any static server (nginx, Node, etc.).

## Components & Licenses
- Ghostscript / GhostPDL (WebAssembly build)
  - Upstream: https://www.ghostscript.com/
  - License: AGPL‑3.0 (free “network use is distribution” license)
- ghostpdl-wasm by okathira-dev
  - Upstream: https://github.com/okathira-dev/ghostpdl-wasm (original)
  - Local fork (this deployment): <your-fork-url-here>
  - NPM (upstream): https://www.npmjs.com/package/@okathira/ghostpdl-wasm
  - License: AGPL‑3.0 — see upstream [LICENSE](https://github.com/okathira-dev/ghostpdl-wasm/blob/main/LICENSE) and [README](https://github.com/okathira-dev/ghostpdl-wasm/blob/main/README.md). If you publish a fork, retain AGPL‑3.0 and preserve upstream notices.
- PDF.js
  - Repo: https://github.com/mozilla/pdf.js
  - License: Apache‑2.0
- Tailwind CSS
  - Site: https://tailwindcss.com/
  - License: MIT

See `NOTICE.md` for full attributions and links.

## License (This Project)
This project is licensed under the GNU Affero General Public License version 3 (AGPL‑3.0). See `LICENSE`.

You are free to use, modify, and redistribute this project under the terms of the AGPL‑3.0. If you modify and deploy it (including over a network), you must make the complete corresponding source code of your deployed version available to users interacting with it.

### Ghostscript/ghostpdl‑wasm License Notes
- Both `GhostPDL/Ghostscript` and `@okathira/ghostpdl-wasm` are licensed under AGPL‑3.0.
- AGPL section 13 applies: network use is distribution. If you run modified versions over a network, you must provide the Corresponding Source to those users.
- Preserve copyright and license notices from upstream projects.
- This project imports the build artifacts `gs.wasm` and `gs.js` provided by `@okathira/ghostpdl-wasm` (or your fork) without modification. If you replace or modify those artifacts, record the exact upstream/fork commit and publish your modified source.

## Compliance & Source Availability
- The complete corresponding source for the deployed site is available at:
  - https://github.com/etsolution/gs-gpl-utils
- Upstream licenses and notices are preserved.
- For reproducibility, record exact versions when you publish (fill the section below and update `NOTICE.md`).

### Compliance Checklist
- AGPL‑3.0 license included in distribution (see `LICENSE`).
- Source code for the running deployment linked in the UI footer and published publicly.
- Upstream license/notice preserved for Ghostscript/ghostpdl‑wasm, PDF.js, Tailwind (see `NOTICE.md`).
- Exact versions/commits of third‑party artifacts recorded (see Reproducible Releases below).
 - If using your own fork of `ghostpdl-wasm`, the fork repository is public and contains complete corresponding source and build scripts.

## Reproducible Releases (Fill When Publishing)
- ghostpdl-wasm NPM version: `x.y.z`
- ghostpdl-wasm upstream commit: `<short-sha>`
- ghostpdl-wasm fork repo: `<your-fork-url>`
- ghostpdl-wasm fork commit: `<short-sha>`
- ghostpdl-wasm NPM Provenance: `https://www.npmjs.com/package/@okathira/ghostpdl-wasm/v/x.y.z?activeTab=provenance`
- PDF.js version: `3.11.174`
- Build date: `YYYY-MM-DD`
- Tag used for this deployment: `vYYYY.MM.DD`

## Provenance & Traceability
When using `@okathira/ghostpdl-wasm`, verify the npm Package Provenance links back to the upstream repository and the exact commit that produced the release, as described in their README. Record the version and commit in the section above for auditability.

## Trademarks
Ghostscript and GhostPDL may be trademarks of Artifex Software, Inc. All trademarks are the property of their respective owners. No affiliation is implied.

## Acknowledgements
- Artifex Software, Inc. and Ghostscript contributors
- okathira-dev for the GhostPDL/Ghostscript WASM packaging
- Mozilla PDF.js team
- Tailwind Labs
