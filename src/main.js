// 3D Gaussian Splatting Viewer
// Based on: https://github.com/kishimisu/Gaussian-Splatting-WebGL

let gl, program;
let cam = null;
let vao;
let canvasSize = [0, 0];
let renderFrameRequest = null;
let indexCount = 0;
let splats = null;


const settings = {
    renderResolution: 1.0,
    maxGaussians: 1000000,
    scalingModifier: 1.0,
    debugDepth: false
};

const CONFIG = {
    splatFile: './assets/model.splat',
    plyFile: './assets/point_cloud.ply'
};

function initWebGL() {
    const canvas = document.getElementById('canvas');
    canvasSize = [window.innerWidth, window.innerHeight];

    gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) {
        document.getElementById('status').textContent = 'WebGL2 not supported';
        return false;
    }

    canvas.width = canvasSize[0];
    canvas.height = canvasSize[1];
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

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

function createProgram(vertSrc, fragSrc) {
    const vs = createShader(gl.VERTEX_SHADER, vertSrc);
    const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

async function loadShaders() {
    const vertResp = await fetch('./shaders/splat_vertex.glsl');
    const fragResp = await fetch('./shaders/splat_fragment.glsl');
    const vertSrc = await vertResp.text();
    const fragSrc = await fragResp.text();
    program = createProgram(vertSrc, fragSrc);
    return program != null;
}

function setupBuffers() {
    if (!splats) return;

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const setupAttr = (name, data, components) => {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, name);
        if (loc >= 0) {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, components, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(loc, 1);
        }
        return buf;
    };

    setupAttr('a_center', new Float32Array(splats.positions), 3);
    setupAttr('a_col', new Float32Array(splats.colors), 3);
    setupAttr('a_opacity', new Float32Array(splats.opacities), 1);

    const covData = new Float32Array(splats.cov3Ds);
    const covA = new Float32Array(splats.vertexCount * 3);
    const covB = new Float32Array(splats.vertexCount * 3);
    for (let i = 0; i < splats.vertexCount; i++) {
        covA[i * 3] = covData[i * 6];
        covA[i * 3 + 1] = covData[i * 6 + 1];
        covA[i * 3 + 2] = covData[i * 6 + 2];
        covB[i * 3] = covData[i * 6 + 3];
        covB[i * 3 + 1] = covData[i * 6 + 4];
        covB[i * 3 + 2] = covData[i * 6 + 5];
    }
    setupAttr('a_covA', covA, 3);
    setupAttr('a_covB', covB, 3);

    indexCount = Math.min(splats.vertexCount, settings.maxGaussians);
}

function setupCamera() {
    cam = new Camera(canvasSize[0], canvasSize[1]);

    if (window.sceneMin && window.sceneMax) {
        const cx = (window.sceneMin[0] + window.sceneMax[0]) / 2;
        const cy = (window.sceneMin[1] + window.sceneMax[1]) / 2;
        const cz = (window.sceneMin[2] + window.sceneMax[2]) / 2;
        const maxBound = Math.max(
            window.sceneMax[0] - window.sceneMin[0],
            window.sceneMax[1] - window.sceneMin[1],
            window.sceneMax[2] - window.sceneMin[2]
        );
        cam.target = [cx, cy, cz];
        cam.radius = maxBound * 1.5;
        cam.phi = Math.PI / 2.2;
        cam.theta = -Math.PI / 2;
        cam.updatePosition();
    }

    setupMouseControls();
}

function setupMouseControls() {
    let isDragging = false, lastX = 0, lastY = 0;

    document.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
    document.addEventListener('mousemove', (e) => {
        if (isDragging && cam) {
            cam.rotate(e.movementX * 0.005, e.movementY * 0.005);
        }
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
    document.addEventListener('mouseleave', () => { isDragging = false; });
    document.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (cam) cam.zoom(e.deltaY * 0.01);
    }, { passive: false });
}

function render() {
    if (!gl || !program || !cam || !splats) return;

    const w = Math.round(canvasSize[0] * settings.renderResolution);
    const h = Math.round(canvasSize[1] * settings.renderResolution);

    if (gl.canvas.width !== w || gl.canvas.height !== h) {
        gl.canvas.width = w;
        gl.canvas.height = h;
        gl.viewport(0, 0, w, h);
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    cam.update();

    const W = gl.canvas.width;
    const H = gl.canvas.height;
    const tan_fovy = Math.tan(cam.fov_y * 0.5);
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

    if (window.sceneMin && window.sceneMax) {
        gl.uniform3fv(gl.getUniformLocation(program, 'boxmin'), new Float32Array(window.sceneMin));
        gl.uniform3fv(gl.getUniformLocation(program, 'boxmax'), new Float32Array(window.sceneMax));
    }

    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projmatrix'), false, cam.vpm);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'viewmatrix'), false, cam.vm);

    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, indexCount);

    renderFrameRequest = requestAnimationFrame(render);
}

function onWindowResize() {
    canvasSize = [window.innerWidth, window.innerHeight];
    if (cam) cam.setAspectRatio(canvasSize[0] / canvasSize[1]);
}
window.addEventListener('resize', onWindowResize);

function createDemoData() {
    const vertexCount = 10000;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const opacities = new Float32Array(vertexCount);
    const cov3Ds = new Float32Array(vertexCount * 6);

    window.sceneMin = [-1, -1, -1];
    window.sceneMax = [1, 1, 1];

    for (let i = 0; i < vertexCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = Math.random() * 1;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        colors[i * 3] = Math.random();
        colors[i * 3 + 1] = Math.random();
        colors[i * 3 + 2] = Math.random();
        opacities[i] = Math.random() * 0.8 + 0.2;
        const s = 0.02 + Math.random() * 0.03;
        cov3Ds[i * 6] = s;
        cov3Ds[i * 6 + 1] = 0;
        cov3Ds[i * 6 + 2] = s;
        cov3Ds[i * 6 + 3] = s;
        cov3Ds[i * 6 + 4] = 0;
        cov3Ds[i * 6 + 5] = 0;
    }
    return { positions, colors, opacities, cov3Ds, vertexCount };
}

async function main() {
    if (!initWebGL()) return;

    if (!await loadShaders()) {
        document.getElementById('status').textContent = 'Shader error';
        return;
    }

    const setStatus = (msg) => {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    };

    try {
        splats = await loadSplat(CONFIG.splatFile, (step, current, total) => {
            const pct = total ? Math.round(current / total * 100) : 0;
            setStatus('Loading: ' + pct + '%');
        });
        setStatus('Loaded ' + splats.vertexCount + ' splats');
    } catch (e) {
        console.warn('Loading failed:', e);
        try {
            splats = await loadPLY(CONFIG.plyFile, (step, current, total) => {
                const pct = total ? Math.round(current / total * 100) : 0;
                setStatus('Loading PLY: ' + pct + '%');
            });
            setStatus('Loaded ' + splats.vertexCount + ' splats');
        } catch (e2) {
            console.warn('PLY also failed:', e2);
            splats = createDemoData();
            setStatus('Demo: ' + splats.vertexCount + ' splats');
        }
    }

    setupBuffers();
    setupCamera();

    const loading = document.getElementById('loading');
    if (loading) loading.classList.remove('active');

    render();
}

window.onload = main;


