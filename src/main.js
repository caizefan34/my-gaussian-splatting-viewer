// Configuration
const CONFIG = {
    plyFile: './assets/model.ply', // Change this to your PLY file path
    canvas: document.getElementById('canvas'),
    vertexShaderPath: './shaders/splat_vertex.glsl',
    fragmentShaderPath: './shaders/splat_fragment.glsl',
};

let gl;
let program;
let camera;
let splats = null;
let vao, vbo, colorVBO, indexCount;
let sortWorker;
let lastSortTime = 0;
const SORT_INTERVAL = 50; // Sort every 50ms

// Initialize WebGL
function initWebGL() {
    gl = CONFIG.canvas.getContext('webgl2');
    if (!gl) {
        alert('WebGL2 not supported');
        return false;
    }

    gl.viewport(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
}

// Load shaders
async function loadShaders() {
    const vertexSource = await fetch(CONFIG.vertexShaderPath).then(r => r.text());
    const fragmentSource = await fetch(CONFIG.fragmentShaderPath).then(r => r.text());

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return false;
    }

    return true;
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

// Setup camera
function setupCamera() {
    camera = new Camera(CONFIG.canvas.width, CONFIG.canvas.height);
    setupMouseControls();
}

function setupMouseControls() {
    let isDragging = false;
    let lastX, lastY;

    CONFIG.canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    CONFIG.canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            camera.rotate(deltaX * 0.01, deltaY * 0.01);
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    CONFIG.canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    CONFIG.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    });
}

// Setup WebGL buffers
function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Position buffer
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, splats.positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 12, 0);

    // Color buffer
    colorVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVBO);
    gl.bufferData(gl.ARRAY_BUFFER, splats.colors, gl.STATIC_DRAW);

    const colorLoc = gl.getAttribLocation(program, 'color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.UNSIGNED_BYTE, true, 4, 0);

    // Covariance buffer
    const covBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, covBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, splats.covariances, gl.STATIC_DRAW);

    const covLoc = gl.getAttribLocation(program, 'covariance');
    gl.enableVertexAttribArray(covLoc);
    gl.vertexAttribPointer(covLoc, 3, gl.FLOAT, false, 12, 0);

    indexCount = splats.positions.length / 3;
}

// Sort splats by depth
function sortSplats() {
    if (!camera) return;
    const now = Date.now();
    if (now - lastSortTime < SORT_INTERVAL) return;
    lastSortTime = now;

    if (sortWorker) {
        sortWorker.postMessage({
            positions: splats.positions,
            viewMatrix: camera.getViewMatrix(),
        });
    }
}

// Render loop
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (splats && program && camera) {
        gl.useProgram(program);

        const viewMatrix = camera.getViewMatrix();
        const projMatrix = camera.getProjectionMatrix();

        const viewLoc = gl.getUniformLocation(program, 'view');
        const projLoc = gl.getUniformLocation(program, 'projection');
        const splatSizeLoc = gl.getUniformLocation(program, 'splatSize');

        gl.uniformMatrix4fv(viewLoc, false, viewMatrix);
        gl.uniformMatrix4fv(projLoc, false, projMatrix);
        gl.uniform1f(splatSizeLoc, 1.0);

        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, indexCount);

        sortSplats();
    }

    requestAnimationFrame(render);
}

// Handle canvas resize
function onWindowResize() {
    CONFIG.canvas.width = window.innerWidth;
    CONFIG.canvas.height = window.innerHeight;
    gl.viewport(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    if (camera) {
        camera.setAspectRatio(CONFIG.canvas.width / CONFIG.canvas.height);
    }
}

window.addEventListener('resize', onWindowResize);

// Main initialization
async function main() {
    // Set canvas size
    CONFIG.canvas.width = window.innerWidth;
    CONFIG.canvas.height = window.innerHeight;

    // Initialize WebGL
    if (!initWebGL()) {
        document.getElementById('status').textContent = 'WebGL2 not supported';
        return;
    }

    // Load shaders
    if (!await loadShaders()) {
        document.getElementById('status').textContent = 'Shader error';
        return;
    }

    // Load PLY file
    try {
        splats = await loadPLY(CONFIG.plyFile);
        setupBuffers();
        setupCamera();
        document.getElementById('loading').classList.remove('active');
        document.getElementById('status').textContent = `Loaded ${indexCount} splats`;
    } catch (error) {
        console.error('Error loading PLY:', error);
        document.getElementById('status').textContent = 'Error loading model';
        return;
    }

    // Start render loop
    render();
}

// Start application
main();