NOTICE

Project: GS GPL Utils (Browser PDF Compressor)
Repository: https://github.com/etsolution/gs-gpl-utils
Primary License (this project): AGPL-3.0 (see LICENSE)

This project includes and/or is derived from the following third‑party software:

1) Ghostscript / GhostPDL (Artifex Software, Inc.)
   - Upstream: https://www.ghostscript.com/
   - License: GNU Affero General Public License, version 3 (AGPL-3.0)
   - License text: https://www.gnu.org/licenses/agpl-3.0.html
   - Upstream source: https://github.com/ArtifexSoftware/ghostpdl
   - Copyright © 2001–2025 Artifex Software, Inc. and its contributors
   - Note: Ghostscript is used via a WebAssembly build. As required by the AGPL (including §13), source code for the version deployed is made available via the repository above.

2) ghostpdl-wasm by okathira-dev (and local fork)
   - Upstream repository: https://github.com/okathira-dev/ghostpdl-wasm
   - Local fork repository (this deployment): <your-fork-url-here>
   - NPM package (upstream): https://www.npmjs.com/package/@okathira/ghostpdl-wasm
   - License: AGPL-3.0 (see upstream LICENSE)
   - Upstream LICENSE: https://github.com/okathira-dev/ghostpdl-wasm/blob/main/LICENSE
   - Upstream README: https://github.com/okathira-dev/ghostpdl-wasm/blob/main/README.md
   - Purpose: Provides the GhostPDL/Ghostscript WebAssembly build used by this project (`gs.wasm`, `gs.js`).
   - Notes: If using a fork, retain upstream notices and AGPL license, and publish your modified source and build scripts. Record the exact commit used for reproducibility.

3) Mozilla PDF.js
   - Repository: https://github.com/mozilla/pdf.js
   - License: Apache-2.0
   - Purpose: PDF rendering in-browser for preview.

4) @types/emscripten (TypeScript definitions)
   - Repository: https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/emscripten
   - License: MIT
   - Purpose: Type definitions for Emscripten APIs used by `ghostpdl-wasm` (if used in development/build tooling).

5) Tailwind CSS (CDN)
   - Website: https://tailwindcss.com/
   - License: MIT
   - Purpose: Utility-first CSS framework for UI styling.

Local Modifications and Integration Code
   - © 2023–2025 ET Solution and contributors
   - The application code, integration scripts, UI, and tooling around the above components are licensed under AGPL-3.0 (see LICENSE).

Attribution and Compliance Notes
   - All upstream copyright notices and license texts are preserved.
   - Source code for any AGPL-covered components, including modifications and build scripts used for the deployed version, is provided in the repository listed above.
   - This NOTICE is for informational purposes only and does not modify the terms of any license applicable to this project or its dependencies.
   - Trademarks: Ghostscript and GhostPDL may be trademarks of Artifex Software, Inc. All trademarks belong to their respective owners. No affiliation is implied.
   - No affiliation with Artifex Software, Inc., Mozilla, Tailwind Labs, or okathira-dev is claimed.

Version/Provenance (fill these when you publish a release)
   - ghostpdl-wasm NPM version (upstream): <fill-in-e.g., 0.10.2>
   - ghostpdl-wasm upstream repo commit: <fill-in-short-SHA>
   - ghostpdl-wasm fork repository URL: <your-fork-url-here>
   - ghostpdl-wasm fork commit: <fill-in-short-SHA>
   - ghostpdl-wasm NPM provenance URL: https://www.npmjs.com/package/@okathira/ghostpdl-wasm/v/<version>?activeTab=provenance
   - GhostPDL/Ghostscript upstream version (if known): <fill-in>
   - PDF.js version: <fill-in-e.g., 3.11.174>
   - Build date: <YYYY-MM-DD>

End of NOTICE
