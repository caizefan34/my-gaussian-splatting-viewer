// High-quality 3D Gaussian Splatting Viewer
// Based on: https://github.com/kishimisu/Gaussian-Splatting-WebGL

let gl, program;
let camera;
let splats = null;
let vao;
let indexCount = 0;
let canvasSize = [0, 0];
let renderFrameRequest = null;
let renderTimeout = null;

const settings = {
    renderResolution: 1.0,
    maxGaussians: 1000000,
    scalingModifier: 1.0,
    bgColor: '#000000',
    fov: 47,
    debugDepth: false
};

const CONFIG = {
    plyFile: './assets/model.ply',
    canvas: null
};

// Initialize WebGL
function initWebGL() {
    CONFIG.canvas = document.getElementById('canvas');
    gl = CONFIG.canvas.getContext('webgl2');
    
    if (!gl) {
        console.error('WebGL2 not supported');
        return false;
    }

    gl.viewport(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    
    // Set blending mode for proper Gaussian splatting
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

    return true;
}

// Load and compile shaders
async function loadShaders() {
    try {
        const vertexSource = await fetch('./shaders/splat_vertex.glsl').then(r => r.text());
        const fragmentSource = await fetch('./shaders/splat_fragment.glsl').then(r => r.text());

        program = createProgram(vertexSource, fragmentSource);
        return program != null;
    } catch (error) {
        console.error('Error loading shaders:', error);
        return false;
    }
}

function createProgram(vertexSource, fragmentSource) {
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

// Setup WebGL buffers
function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const setupBuffer = (name, data, components) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(location, 1);
        return buffer;
    };

    // Setup position buffer
    setupBuffer('a_center', new Float32Array(splats.positions), 3);
    
    // Setup color buffer
    setupBuffer('a_col', new Float32Array(splats.colors), 3);
    
    // Setup opacity buffer
    setupBuffer('a_opacity', new Float32Array(splats.opacities), 1);
    
    // Setup covariance buffers
    const cov3Ds = new Float32Array(splats.cov3Ds);
    const covA = new Float32Array(splats.vertexCount * 3);
    const covB = new Float32Array(splats.vertexCount * 3);
    
    for (let i = 0; i < splats.vertexCount; i++) {
        covA[i * 3 + 0] = cov3Ds[i * 6 + 0];
        covA[i * 3 + 1] = cov3Ds[i * 6 + 1];
        covA[i * 3 + 2] = cov3Ds[i * 6 + 2];
        
        covB[i * 3 + 0] = cov3Ds[i * 6 + 3];
        covB[i * 3 + 1] = cov3Ds[i * 6 + 4];
        covB[i * 3 + 2] = cov3Ds[i * 6 + 5];
    }
    
    setupBuffer('a_covA', covA, 3);
    setupBuffer('a_covB', covB, 3);

    indexCount = Math.min(splats.vertexCount, settings.maxGaussians);
}

// Setup camera
function setupCamera() {
    camera = new Camera();
}

// Render loop
function render() {
    const resolution = settings.renderResolution;
    const canvasWidth = Math.round(canvasSize[0] * resolution);
    const canvasHeight = Math.round(canvasSize[1] * resolution);

    if (gl.canvas.width !== canvasWidth || gl.canvas.height !== canvasHeight) {
        gl.canvas.width = canvasWidth;
        gl.canvas.height = canvasHeight;
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    if (camera) camera.update();

    if (splats && program && camera) {
        // Set uniforms
        const W = gl.canvas.width;
        const H = gl.canvas.height;
        const tan_fovy = Math.tan(camera.fov_y * 0.5);
        const tan_fovx = tan_fovy * W / H;
        const focal_y = H / (2 * tan_fovy);
        const focal_x = W / (2 * tan_fovx);

        gl.uniform1f(gl.getUniformLocation(program, 'W'), W);
        gl.uniform1f(gl.getUniformLocation(program, 'H'), H);
        gl.uniform1f(gl.getUniformLocation(program, 'focal_x'), focal_x);
        gl.uniform1f(gl.getUniformLocation(program, 'focal_y'), focal_y);
        gl.uniform1f(gl.getUniformLocation(program, 'tan_fovx'), tan_fovx);
        gl.uniform1f(gl.getUniformLocation(program, 'tan_fovy'), tan_fovy);
        gl.uniform1f(gl.getUniformLocation(program, 'scale_modifier'), settings.scalingModifier);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projmatrix'), false, camera.projMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'viewmatrix'), false, camera.viewMatrix);
        gl.uniform1i(gl.getUniformLocation(program, 'show_depth_map'), settings.debugDepth);

        // Draw instanced
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, indexCount);
    }

    renderFrameRequest = requestAnimationFrame(render);
}

// Handle canvas resize
function onWindowResize() {
    canvasSize = [window.innerWidth, window.innerHeight];
    if (camera) camera.setAspectRatio(canvasSize[0] / canvasSize[1]);
}

window.addEventListener('resize', onWindowResize);

// Create demo data
function createDemoData() {
    const vertexCount = 10000;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const opacities = new Float32Array(vertexCount);
    const cov3Ds = new Float32Array(vertexCount * 6);

    sceneMin = [0, 0, 0];
    sceneMax = [2, 2, 2];

    for (let i = 0; i < vertexCount; i++) {
        // Random points in a sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = Math.random() * 1;

        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        colors[i * 3 + 0] = Math.random();
        colors[i * 3 + 1] = Math.random();
        colors[i * 3 + 2] = Math.random();

        opacities[i] = Math.random() * 0.8 + 0.2;

        for (let j = 0; j < 6; j++) {
            cov3Ds[i * 6 + j] = 0.1 + Math.random() * 0.1;
        }
    }

    return {
        positions,
        colors,
        opacities,
        cov3Ds,
        vertexCount
    };
}

// Main initialization
async function main() {
    canvasSize = [window.innerWidth, window.innerHeight];
    CONFIG.canvas = document.getElementById('canvas');
    CONFIG.canvas.width = canvasSize[0];
    CONFIG.canvas.height = canvasSize[1];

    if (!initWebGL()) {
        document.getElementById('status').textContent = 'WebGL2 not supported';
        return;
    }

    if (!await loadShaders()) {
        document.getElementById('status').textContent = 'Shader error';
        return;
    }

    try {
        splats = await loadPLY(CONFIG.plyFile);
        document.getElementById('status').textContent = `Loaded ${splats.vertexCount} splats`;
    } catch (error) {
        console.warn('PLY not found, using demo:', error);
        splats = createDemoData();
        document.getElementById('status').textContent = `Demo: ${splats.vertexCount} splats`;
    }

    setupBuffers();
    setupCamera();
    document.getElementById('loading').classList.remove('active');

    render();
}

window.onload = main;