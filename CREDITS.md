# Credits

gridtwin is MIT licensed (see [LICENSE](LICENSE)). It stands on the work below. Versions and licenses were read from the installed packages and the project files on 2026-10-04. [docs/third-party-licenses.md](docs/third-party-licenses.md) is generated from the dependency trees by `tools/licenses.sh` and lists every runtime library and every npm tool outside the permissive licenses. CI fails when it is out of date.

## Data

### IEEE 14-bus and IEEE 30-bus test cases

The network data comes from the MATPOWER 8.1 case files `case14` and `case_ieee30`. MATPOWER converted them from the IEEE Common Data Format files of the University of Washington Power Systems Test Case Archive (https://labs.ece.uw.edu/pstca/). The numbers are used as published.

The MATPOWER license says this about its case files:

> The code in MATPOWER is distributed under the 3-clause BSD license below. The MATPOWER case files distributed with MATPOWER are not covered by the BSD license. In most cases, the data has either been included with permission or has been converted from data available from a public source.

Both files state that they were converted from the public archive. The repository does not contain MATPOWER's `.m` files. It contains its own JSON conversion of the numbers, written by `tools/reference/export_case.m`, and each JSON file carries a `provenance` block that names the source and the version.

Everything else about the networks is synthetic and generated or written by this project: the thermal ratings (ADR 0006), the base voltages of IEEE 14, the bus 9 base voltage of IEEE 30, the schematic coordinates and the whole substation that replaces bus 4. The substation is fictional and describes no real installation.

### Reference solutions

The reference solutions in `validation/src/test/resources/reference/` were produced by MATPOWER 8.1 running under GNU Octave 11.3.0 (GPL-3.0-or-later) in the `gnuoctave/octave:11.3.0` Docker image, with the scripts in `tools/reference/`. Neither MATPOWER nor Octave is part of this repository or of the application.

### MATPOWER license

    Copyright (c) 1996-2025, Power Systems Engineering Research Center (PSERC)
    and individual contributors (see AUTHORS file for details).
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are
    met:

    1. Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

    3. Neither the name of the copyright holder nor the names of its
    contributors may be used to endorse or promote products derived from
    this software without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
    IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
    TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
    PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
    TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
    LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
    NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
    SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### Citation

R. D. Zimmerman, C. E. Murillo-Sanchez and R. J. Thomas, "MATPOWER: Steady-State Operations, Planning and Analysis Tools for Power Systems Research and Education", IEEE Transactions on Power Systems, vol. 26, no. 1, pp. 12-19, Feb. 2011. doi: 10.1109/TPWRS.2010.2051168

R. D. Zimmerman and C. E. Murillo-Sanchez (2025). MATPOWER (Version 8.1) [Software]. https://matpower.org, doi: 10.5281/zenodo.15871662

## Libraries in the application

### Web front end

| Library | Version | License | Use |
| --- | --- | --- | --- |
| Angular (core, common, compiler, forms, platform-browser) | 22.2.1 | MIT | front-end framework |
| Angular CDK | 22.2.1 | MIT | accessibility helpers |
| NgRx Signals | 22.0.1 | MIT | signal store |
| RxJS | 7.8.2 | Apache-2.0 | HTTP and socket streams |
| tslib | 2.8.1 | 0BSD | compiler helpers |
| Three.js, with `RoomEnvironment` and `OrbitControls` from its addons | 0.186.1 | MIT | 3D scene |

### Back end

| Library | Version | License | Use |
| --- | --- | --- | --- |
| Quarkus (rest, rest-jackson, websockets-next, scheduler, smallrye-health, smallrye-openapi, hibernate-validator) | 3.40.1 | Apache-2.0 | HTTP, WebSocket and OpenAPI |
| Jackson, Vert.x, Netty, SmallRye, JBoss Logging, OpenTelemetry API and the other libraries Quarkus pulls in | from the Quarkus BOM | Apache-2.0, MIT, BSD-2-Clause or BSD-3-Clause | JSON, networking and logging |
| EJML (`ejml-dsparse`) | 0.46.1 | Apache-2.0 | sparse LU solver |
| Jakarta activation and XML binding APIs | 2.1.4 and 4.0.5 | EDL 1.0 (BSD-3-Clause) | Quarkus dependencies |
| Jakarta annotation, EL, interceptor, JSON, transaction and REST APIs, Parsson and Expressly | see the generated list | EPL-2.0 | Quarkus dependencies |

Eight jars in the application image are under the Eclipse Public License 2.0, which is not on the permissive list (ADR 0014). They are the Jakarta API jars and two Eclipse implementations that Quarkus requires. They are used unmodified, as published on Maven Central. Each of them also offers a GPL-2.0 with Classpath Exception alternative, which I do not use.

## Build, test and quality tools

These tools are not shipped with the application. Some of them use licenses that are not on the permissive list for shipped code (ADR 0014). Nothing from them is copied into the repository.

| Tool | License |
| --- | --- |
| Angular CLI and build, Vitest, `@vitest/coverage-v8`, jsdom, ESLint, `@eslint/js`, typescript-eslint, angular-eslint, Prettier, openapi-typescript, Cypress, `@types/three` | MIT |
| TypeScript, Playwright, Lighthouse | Apache-2.0 |
| `@axe-core/playwright`, axe-core and lightningcss (used by the Angular build) | MPL-2.0 |
| caniuse-lite (browser support data used by the Angular build) | CC-BY-4.0 |
| argparse (a dependency of the linters) | Python-2.0 |
| JUnit, JaCoCo | EPL-2.0 |
| Checkstyle | LGPL-2.1-or-later |
| ArchUnit, AssertJ, Awaitility, REST Assured, Spotless, google-java-format, Maven and its plugins (compiler, surefire, failsafe, enforcer, dependency, jar) | Apache-2.0 |
| GNU Octave | GPL-3.0-or-later |
| ffmpeg, used to convert the demo recording | LGPL-2.1-or-later or GPL, depending on the build |

Container images, used to build and run only: `node:24-alpine`, `maven:3.9-eclipse-temurin-21` and `eclipse-temurin:21-jre`, each under the license of its upstream project. The GitHub Actions in `.github/workflows/ci.yml` are used as published.

## Assets

No images, fonts or 3D models are shipped. The IEC 60617 style symbols are drawn from scratch as SVG paths, the 3D equipment is generated in code, labels are drawn on a canvas and the page uses the system font stack. The demo GIF is a recording of this application. The coverage badge is generated by `tools/coverage-badge.ts`.
