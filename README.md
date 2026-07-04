# 3D Gaussian Splatting Viewer

An interactive WebGL viewer for rendering 3D Gaussian Splatting models from PLY files.

## Features

✨ **Real-time 3D Rendering** - WebGL2 based gaussian splatting renderer  
🎮 **Interactive Controls** - Drag to rotate, scroll to zoom  
📁 **PLY File Support** - Load gaussian splatting PLY files  
⚡ **High Performance** - Optimized for smooth rendering  

## Quick Start

### 1. Prepare Your PLY File

Place your PLY file in the `assets/` directory:

```bash
# Create assets folder if it doesn't exist
mkdir -p assets

# Copy your PLY file there
cp your_model.ply assets/model.ply
```

### 2. Update the Configuration

Edit `src/main.js` and update the PLY file path if needed:

```javascript
const CONFIG = {
    plyFile: './assets/model.ply', // Update this path
    // ...
};
```

### 3. Run Locally

**Option A: Using npm (recommended)**
```bash
npm install
npm start
```

Then open `http://localhost:8000` in your browser.

**Option B: Using Python**
```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

**Option C: Using Node.js**
```bash
npx http-server -p 8000
```

### 4. Deploy

Deploy to GitHub Pages, Vercel, Netlify, or any static hosting service.

## Controls

- **Mouse Drag** - Rotate the model
- **Mouse Wheel** - Zoom in/out
- **Status Display** - Shows number of loaded splats

## Project Structure

```
.
├── index.html              # Main HTML file
├── src/
│   ├── main.js            # Application entry point
│   ├── loader.js          # PLY file loader and parser
│   ├── camera.js          # Camera management
│   └── utils.js           # WebGL utilities
├── shaders/
│   ├── splat_vertex.glsl  # Vertex shader
│   └── splat_fragment.glsl # Fragment shader
├── assets/
│   └── model.ply          # Your PLY model file (add your own)
├── package.json           # NPM configuration
└── README.md              # This file
```

## PLY File Format

The viewer expects PLY files with the following properties:

```
element vertex [count]
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
property uchar alpha
property float scale_0
property float scale_1
property float scale_2
```

## Browser Compatibility

- Chrome/Chromium 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## Performance Tips

1. **Model Size** - Keep PLY files under 100MB for smooth performance
2. **Splat Count** - Models with 1-10M splats work best
3. **Hardware** - High-end GPUs provide better performance

## Troubleshooting

**Model not loading?**
- Check browser console for errors (F12)
- Verify PLY file path in `src/main.js`
- Ensure file is in correct PLY format

**Rendering very slow?**
- Try a smaller PLY file
- Check GPU/driver compatibility
- Disable other browser tabs

**Black screen?**
- Verify WebGL2 is supported: https://get.webgl.org/webgl2/
- Check browser console for shader errors

## Resources

- [Original Gaussian Splatting Paper](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
- [WebGL Documentation](https://khronos.org/webgl/)
- [Gaussian Splatting Explained](https://huggingface.co/spaces/playgroundai/gaussian-splatting)

## License

MIT
