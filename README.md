# 3D Gaussian Splatting Viewer

An interactive WebGL viewer for rendering 3D Gaussian Splatting models. Available as a GitHub Page.

> **馃憦 Live Demo:** [caizefan34.github.io/my-gaussian-splatting-viewer](https://caizefan34.github.io/my-gaussian-splatting-viewer)

## Viewers

This repo contains two versions of the viewer:

1. 馃専 **SuperSplat Editor** (default) — superplat editor/point_cloud.html
   A full-featured editor with embedded point cloud data. Self-contained single HTML file.

2. 鈿?**Classic Viewer** — index.html / main.js
   The original WebGL2-based gaussian splatting renderer that loads external PLY files from ssets/.

## Quick Start

### Run Locally

`ash
# Using Node.js
npx http-server -p 8000

# Using Python
python -m http.server 8000
`

Then open http://localhost:8000 in your browser.

### Controls

- **Mouse Drag** — Rotate the model
- **Mouse Wheel** — Zoom in/out

## Deploy

This repo uses GitHub Actions to automatically deploy to GitHub Pages on every push to main.

## Project Structure

`
.
鈹溾攢鈹€ index.html              # Main entry (redirects to SuperSplat viewer)
鈹溾攢鈹€ main.js                 # Classic WebGL2 viewer
鈹溾攢鈹€ viewer.js               # Viewer utilities
鈹溾攢鈹€ .github/workflows/      # GitHub Actions deployment
鈹溾攢鈹€ superplat editor/       # SuperSplat editor (self-contained HTML)
鈹溾攢鈹€ assets/                 # PLY model files
鈹斺攢鈹€ README.md
`

## Browser Compatibility

- Chrome/Chromium 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## License

MIT
