# LiDAR-integrated Triangle Splatting — IROS 2026

Project page for **LiDAR-Integrated Coarse-to-Fine Optimization for Geometrically Consistent Triangle Splatting from Mobile Robots**, by Byoungkwon Yoon, Hojun Lee, Yuseop Sim, Hangyeom Lee, Dongjun Lee, and Martin Byung-Guk Jun.

The site is static HTML/CSS/JavaScript and works under `/lidar-ts-page/`. No deployment or publishing is performed by the scripts in this repository.

## Local preview and editing

Use Node.js 22 or newer, pnpm 11, and Google Chrome for the browser checks.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

Open **http://127.0.0.1:4173/lidar-ts-page/**. In another terminal:

```sh
pnpm check
pnpm test
```

- Edit `src/page.html` for text, captions, authors, and citation; `src/style.css` for layout.
- Edit `src/index.js` for shared video controls and page behavior.
- Edit `src/mesh-viewer.js` for the Three.js viewer.
- Run `pnpm build` after changes. It writes `index.html`, CSS, and locally bundled JavaScript to `static/`.
- `static/data/results.json` holds scene/method labels, asset URLs, preview URLs, and the camera shared by all methods in each scene.
- Runtime libraries are local and pinned: Three.js 0.186.0, OrbitControls, GLTFLoader, and MeshoptDecoder. No runtime CDN is required.

## Included results

The page contains the paper overview and final PDF, introductory comparison, pipeline figure, four synchronized optimization recordings, interactive comparisons, and three quadruped walking recordings.

The 3D comparison covers Replica room0, UTMM fast-straight, and NCD quad-easy, with Ours against TS, MILo, 2DGS, Mesh-splat, or SuGaR. Replica room0 versus TS is the default comparison. Meshes display in color only, using one coordinate system and camera per scene. Models load only after activation; videos load only after play or seek. Preview images remain available when WebGL or model loading fails.

**SuGaR data limitation:** the three supplied `sugar.ply` files contain Gaussian parameters and points, with no triangle faces. They are explicitly labeled point clouds in the interface. The package therefore contains **15 surface meshes and 3 point clouds**, not 18 extracted meshes. SuGaR previews show all supplied Gaussian centers with color derived from the DC spherical-harmonic coefficients; they do not render full Gaussian splats. Replace these assets with extracted SuGaR meshes if available before making surface-level comparisons.

Videos preserve their recorded timing. The optimization view is recorded optimization progress, not a wall-clock speed benchmark. Shorter clips hold their final frames on the shared timeline. `application/ours_1.mp4` was selected after inspecting the three Ours recordings because its view is clear and comparable to the TS and GT views. The walking caption identifies reconstructed-mesh collision geometry, 2DGS visual rendering, and the supplied GT clip's flat reference collision surface.

## Preparing assets again

Original source files stay outside this repository. Do not overwrite them. Preparation caches are in the ignored `.cache/` directory; the published assets are in `static/`. Allow substantial RAM and time for the original NCD 2DGS file (approximately 45 million faces).

Create a Python environment and install `scripts/requirements.txt`. The original inputs used here were:

- Paper: `C:/Users/robot-lamm/Downloads/root (2).pdf`
- Videos: `C:/Users/robot-lamm/OneDrive - purdue.edu/LAB/project/RadiField/video`
- Dataset root: `D:/archived/radi_field/Datasets/For_paper`
- Figure crops: `problem.png` (paper Figure 1) and `method.png` (paper Figure 2). The supplied crops are already included as `static/images/limited-viewpoints.png` and `static/images/pipeline.png`.

### Mesh mapping

Paths below are relative to each scene's `mesh_output/` folder. Scene directories are `replica/room0`, `UTMM/fast-straight`, and `NCD`.

| Method | Replica room0 | UTMM fast-straight | NCD quad-easy |
| --- | --- | --- | --- |
| Ours | ours_var.ply | ours_var.ply | 0_ours.ply |
| TS | triangle.ply | triangle.ply | TS.ply |
| MILo | milo.ply | milo.ply | milo.ply |
| 2DGS | 2dgs.ply | 2dgs.ply | 2dgs.ply |
| Mesh-splat | mesh_splatting.ply | mesh_splatting.ply | mesh_splat.ply |
| SuGaR points | sugar.ply | sugar.ply | sugar.ply |

From the repository directory:

```sh
python scripts/prepare_meshes.py --source "D:/archived/radi_field/Datasets/For_paper"
python scripts/prepare_sugar.py --source "D:/archived/radi_field/Datasets/For_paper"
python scripts/constrain_display_vertices.py ncd-quad 2dgs
node scripts/compress_meshes.mjs --force
python scripts/validate_mesh_views.py
```

Preparation merges exact duplicate vertices and uses quadric simplification targeting 500,000 faces while preserving boundaries, normals, and topology. Colors transfer from the nearest original vertex. There is no independent normalization, hole filling, or scene alignment adjustment. All transforms are identity, with Z up. Disconnected primitives and complex boundaries prevent several assets from reaching the target without damaging their geometry; these assets retain more faces.

Visual checks found that unconstrained NCD 2DGS simplification introduced a few extreme vertex displacements. The explicit constraint step above moves display vertices to their nearest original source vertex, removing those conversion artifacts without creating new faces or filling holes. Its measured displacements are recorded in the provenance file. The lightweight copy still has visible simplification faceting and is intended for qualitative browsing, not metric evaluation.

GLBs use Meshopt compression, 16-bit positions, and 8-bit vertex colors. `scripts/mesh-provenance.json` separately records source paths, SHA-256 hashes, original/display counts, and conversion settings. `results.json` is the runtime manifest. Conversion scripts reuse existing caches; to reconvert a changed source, remove only that method's matching `.cache/meshes/<scene>/<method>.glb` and `.json` first. Compression uses `--force` to replace generated web copies.

With the preview server running, regenerate previews from the actual viewer cameras:

```sh
pnpm build
pnpm previews
```

For videos and PDF, provide a folder containing the two named figure crops:

```sh
python scripts/prepare_media.py --source "C:/Users/robot-lamm/OneDrive - purdue.edu/LAB/project/RadiField/video" --paper "C:/Users/robot-lamm/Downloads/root (2).pdf" --figures "PATH/TO/FIGURE_CROPS"
```

Videos are encoded as H.264 at CRF 25, 1280 pixels wide, with original timing, browser-compatible pixel format, and fast-start metadata. Audio is omitted. Poster frames come from 5 seconds into each recording. Existing encoded files are reused; remove the relevant generated MP4 before re-encoding it. `scripts/media-provenance.json` records each source and its hash.

## Validation and package size

Browser tests cover all 18 assets, every scene and baseline, color rendering, linked camera movement, reset/fullscreen, rapid selection changes, loading failures, WebGL fallback, shared video controls, seeking and unequal durations, mobile layout, reduced motion, and initial lazy loading. Tests run under the actual `/lidar-ts-page/` prefix. Original-versus-display visual comparisons use matching cameras and are saved to `.cache/validation/`; screenshots from the browser are also saved to `.cache/`.

The current `static/` package is approximately **385 MB**, including approximately **306 MB** of 3D assets. The largest GLB is approximately **57 MB**. Several models exceed the approximate 15 MB target to preserve important surface defects and boundaries. All files remain below 100 MiB, and the package remains below GitHub Pages' 1 GB site limit. `pnpm check` verifies sizes, file headers, and preview availability. Exclude `node_modules/`, `.cache/`, and test reports from publication; they are ignored by Git.

The final PDF is copied without modification. SHA-256:

`2f367a317904b5d85e0e1883dde3e08d14b3f476a6fbd7534d037a088db8fb17`

The built site is ready for a separate GitHub Pages publishing step. Nothing has been pushed or published by this implementation.

## Attribution

Adapted from the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), which acknowledges [Nerfies](https://nerfies.github.io/). The template's [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/) attribution is retained in the page footer. See `static/vendor/THREE-LICENSE.txt` for the bundled Three.js license.
