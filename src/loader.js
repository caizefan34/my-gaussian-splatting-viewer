/**
 * Loader for 3D Gaussian Splatting (.splat / .ply)
 * Based on: https://github.com/kishimisu/Gaussian-Splatting-WebGL
 */

let gaussianCount = 0;

async function loadSplat(url, onStep) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return parseSplat(buffer, onStep);
}

function parseSplat(buffer, onStep) {
    const start = performance.now();
    const view = new DataView(buffer);
    const NUM_FLOATS = 32; // 3 pos + 4 rot + 3 scale + 3 SH_C0 + 15 SH_rest + 1 opacity + 3 padding
    const FLOAT_SIZE = 4;
    const GAUSSIAN_SIZE = NUM_FLOATS * FLOAT_SIZE;

    gaussianCount = Math.floor(buffer.byteLength / GAUSSIAN_SIZE);
    const SH_C0 = 0.28209479177387814;

    const sceneMin = [Infinity, Infinity, Infinity];
    const sceneMax = [-Infinity, -Infinity, -Infinity];
    window.sceneMin = sceneMin;
    window.sceneMax = sceneMax;

    const positions = new Float32Array(gaussianCount * 3);
    const colors = new Float32Array(gaussianCount * 3);
    const opacities = new Float32Array(gaussianCount);
    const cov3Ds = new Float32Array(gaussianCount * 6);

    const batchSize = Math.max(1, Math.floor(gaussianCount / 100));

    for (let i = 0; i < gaussianCount; i++) {
        const offset = i * GAUSSIAN_SIZE;
        const pos = [
            view.getFloat32(offset + 0, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true)
        ];
        const rot = [
            view.getFloat32(offset + 12, true),
            view.getFloat32(offset + 16, true),
            view.getFloat32(offset + 20, true),
            view.getFloat32(offset + 24, true)
        ];
        const scale = [
            view.getFloat32(offset + 28, true),
            view.getFloat32(offset + 32, true),
            view.getFloat32(offset + 36, true)
        ];
        const sh = [
            view.getFloat32(offset + 40, true),
            view.getFloat32(offset + 44, true),
            view.getFloat32(offset + 48, true)
        ];
        const alpha = view.getFloat32(offset + 52, true);

        for (let j = 0; j < 3; j++) {
            if (pos[j] < sceneMin[j]) sceneMin[j] = pos[j];
            if (pos[j] > sceneMax[j]) sceneMax[j] = pos[j];
        }

        // Normalize quaternion
        let len = Math.sqrt(rot[0]*rot[0] + rot[1]*rot[1] + rot[2]*rot[2] + rot[3]*rot[3]);
        if (len > 0) {
            rot[0] /= len; rot[1] /= len; rot[2] /= len; rot[3] /= len;
        }

        const expScale = [Math.exp(scale[0]), Math.exp(scale[1]), Math.exp(scale[2])];
        const opacity = 1.0 / (1.0 + Math.exp(-alpha));
        const color = [
            0.5 + SH_C0 * sh[0],
            0.5 + SH_C0 * sh[1],
            0.5 + SH_C0 * sh[2]
        ];

        // Compute 3D covariance
        const r = rot[0], x = rot[1], y = rot[2], z = rot[3];
        const R = [
            1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - r * z), 2.0 * (x * z + r * y),
            2.0 * (x * y + r * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - r * x),
            2.0 * (x * z - r * y), 2.0 * (y * z + r * x), 1.0 - 2.0 * (x * x + y * y)
        ];

        const M = [];
        for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
                M[a * 3 + b] = R[a * 3 + 0] * expScale[0] * (b === 0 ? 1 : 0) +
                                R[a * 3 + 1] * expScale[1] * (b === 1 ? 1 : 0) +
                                R[a * 3 + 2] * expScale[2] * (b === 2 ? 1 : 0);
            }

        const Sigma = [];
        for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
                let sum = 0;
                for (let k = 0; k < 3; k++) sum += M[k * 3 + a] * M[k * 3 + b];
                Sigma[a * 3 + b] = sum;
            }

        positions[i * 3 + 0] = pos[0];
        positions[i * 3 + 1] = pos[1];
        positions[i * 3 + 2] = pos[2];
        colors[i * 3 + 0] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
        opacities[i] = opacity;
        cov3Ds[i * 6 + 0] = Sigma[0];
        cov3Ds[i * 6 + 1] = Sigma[1];
        cov3Ds[i * 6 + 2] = Sigma[2];
        cov3Ds[i * 6 + 3] = Sigma[4];
        cov3Ds[i * 6 + 4] = Sigma[5];
        cov3Ds[i * 6 + 5] = Sigma[8];

        if (onStep && i % batchSize === 0) {
            onStep('Processing', i, gaussianCount);
        }
    }

    if (onStep) onStep('Loaded', gaussianCount, gaussianCount);
    console.log('Loaded ' + gaussianCount + ' gaussians in ' + ((performance.now() - start) / 1000).toFixed(2) + 's');

    return { positions, colors, opacities, cov3Ds, vertexCount: gaussianCount };
}

// Legacy PLY loader (kept for compatibility)
async function loadPLY(url, onStep) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return parsePLY(buffer, onStep);
}

function parsePLY(buffer, onStep) {
    const start = performance.now();
    const contentStart = new TextDecoder('utf-8').decode(buffer.slice(0, 2000));
    const headerEnd = contentStart.indexOf('end_header') + 'end_header'.length + 1;
    const header = contentStart.split('end_header')[0];

    const regex = /element vertex (\d+)/;
    const match = header.match(regex);
    const gaussianCount = parseInt(match[1]);

    const NUM_PROPS = 62;
    const view = new DataView(buffer);
    const sigmoid = (m1) => 1.0 / (1.0 + Math.exp(-m1));
    const SH_C0 = 0.28209479177387814;

    const sceneMin = [Infinity, Infinity, Infinity];
    const sceneMax = [-Infinity, -Infinity, -Infinity];
    window.sceneMin = sceneMin;
    window.sceneMax = sceneMax;

    const fromDataView = (splatID, start, end) => {
        const startOffset = headerEnd + splatID * NUM_PROPS * 4 + start * 4;
        if (end == null) return view.getFloat32(startOffset, true);
        const result = [];
        for (let i = 0; i < end - start; i++) {
            result.push(view.getFloat32(startOffset + i * 4, true));
        }
        return result;
    };

    const positions = new Float32Array(gaussianCount * 3);
    const colors = new Float32Array(gaussianCount * 3);
    const opacities = new Float32Array(gaussianCount);
    const cov3Ds = new Float32Array(gaussianCount * 6);

    const batchSize = Math.max(1, Math.floor(gaussianCount / 100));

    for (let i = 0; i < gaussianCount; i++) {
        const pos = fromDataView(i, 0, 3);
        const harmonic = fromDataView(i, 6, 9);
        const H_END = 6 + 48;
        const opacity = fromDataView(i, H_END);
        const scale = fromDataView(i, H_END + 1, H_END + 4);
        const rotation = fromDataView(i, H_END + 4, H_END + 8);

        for (let j = 0; j < 3; j++) {
            if (pos[j] < sceneMin[j]) sceneMin[j] = pos[j];
            if (pos[j] > sceneMax[j]) sceneMax[j] = pos[j];
        }

        let len = Math.sqrt(rotation[0]*rotation[0] + rotation[1]*rotation[1] +
                            rotation[2]*rotation[2] + rotation[3]*rotation[3]);
        if (len > 0) {
            rotation[0] /= len; rotation[1] /= len;
            rotation[2] /= len; rotation[3] /= len;
        }

        const expScale = [Math.exp(scale[0]), Math.exp(scale[1]), Math.exp(scale[2])];
        const alpha = sigmoid(opacity);
        const color = [
            0.5 + SH_C0 * harmonic[0],
            0.5 + SH_C0 * harmonic[1],
            0.5 + SH_C0 * harmonic[2]
        ];

        const r = rotation[0], x = rotation[1], y = rotation[2], z = rotation[3];
        const R = [
            1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - r * z), 2.0 * (x * z + r * y),
            2.0 * (x * y + r * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - r * x),
            2.0 * (x * z - r * y), 2.0 * (y * z + r * x), 1.0 - 2.0 * (x * x + y * y)
        ];

        const M = [];
        for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
                M[a * 3 + b] = R[a * 3 + 0] * expScale[0] * (b === 0 ? 1 : 0) +
                                R[a * 3 + 1] * expScale[1] * (b === 1 ? 1 : 0) +
                                R[a * 3 + 2] * expScale[2] * (b === 2 ? 1 : 0);
            }

        const Sigma = [];
        for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
                let sum = 0;
                for (let k = 0; k < 3; k++) sum += M[k * 3 + a] * M[k * 3 + b];
                Sigma[a * 3 + b] = sum;
            }

        positions[i * 3] = pos[0];
        positions[i * 3 + 1] = pos[1];
        positions[i * 3 + 2] = pos[2];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
        opacities[i] = alpha;
        cov3Ds[i * 6] = Sigma[0];
        cov3Ds[i * 6 + 1] = Sigma[1];
        cov3Ds[i * 6 + 2] = Sigma[2];
        cov3Ds[i * 6 + 3] = Sigma[4];
        cov3Ds[i * 6 + 4] = Sigma[5];
        cov3Ds[i * 6 + 5] = Sigma[8];

        if (onStep && i % batchSize === 0) {
            onStep('Processing', i, gaussianCount);
        }
    }

    if (onStep) onStep('Loaded', gaussianCount, gaussianCount);
    console.log('Loaded ' + gaussianCount + ' gaussians in ' + ((performance.now() - start) / 1000).toFixed(2) + 's');

    return { positions, colors, opacities, cov3Ds, vertexCount: gaussianCount };
}
