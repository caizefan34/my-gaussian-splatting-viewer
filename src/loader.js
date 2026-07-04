// Load all gaussian data from a point-cloud PLY file
// Based on: https://github.com/kishimisu/Gaussian-Splatting-WebGL

let gaussianCount = 0;
let sceneMin, sceneMax;

async function loadPLY(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return parsePLY(buffer);
}

function parsePLY(buffer) {
    const start = performance.now();
    const contentStart = new TextDecoder('utf-8').decode(buffer.slice(0, 2000));
    const headerEnd = contentStart.indexOf('end_header') + 'end_header'.length + 1;
    const header = contentStart.split('end_header')[0];

    // Get number of gaussians
    const regex = /element vertex (\d+)/;
    const match = header.match(regex);
    gaussianCount = parseInt(match[1]);

    console.log(`Loading ${gaussianCount} gaussians...`);

    // Create arrays
    const positions = [];
    const opacities = [];
    const colors = [];
    const cov3Ds = [];

    // Scene bounding box
    sceneMin = new Array(3).fill(Infinity);
    sceneMax = new Array(3).fill(-Infinity);

    const sigmoid = (m1) => 1.0 / (1.0 + Math.exp(-m1));
    const NUM_PROPS = 62; // Total float properties per gaussian

    const view = new DataView(buffer);

    const fromDataView = (splatID, start, end) => {
        const startOffset = headerEnd + splatID * NUM_PROPS * 4 + start * 4;
        if (end == null) {
            return view.getFloat32(startOffset, true);
        }
        return new Float32Array(end - start).map((_, i) => 
            view.getFloat32(startOffset + i * 4, true)
        );
    };

    const extractSplatData = (splatID) => {
        const position = Array.from(fromDataView(splatID, 0, 3));
        const harmonic = Array.from(fromDataView(splatID, 6, 9));
        const H_END = 6 + 48;
        const opacity = fromDataView(splatID, H_END);
        const scale = Array.from(fromDataView(splatID, H_END + 1, H_END + 4));
        const rotation = Array.from(fromDataView(splatID, H_END + 4, H_END + 8));
        return { position, harmonic, opacity, scale, rotation };
    };

    for (let i = 0; i < gaussianCount; i++) {
        let { position, harmonic, opacity, scale, rotation } = extractSplatData(i);

        // Update bounding box
        sceneMin = sceneMin.map((v, j) => Math.min(v, position[j]));
        sceneMax = sceneMax.map((v, j) => Math.max(v, position[j]));

        // Normalize quaternion
        let length2 = rotation.reduce((sum, r) => sum + r * r, 0);
        const length = Math.sqrt(length2);
        rotation = rotation.map(v => v / length);

        // Exponentiate scale
        scale = scale.map(v => Math.exp(v));

        // Apply sigmoid to opacity
        opacity = sigmoid(opacity);
        opacities.push(opacity);

        // Compute color from spherical harmonics (degree 0)
        const SH_C0 = 0.28209479177387814;
        const color = [
            0.5 + SH_C0 * harmonic[0],
            0.5 + SH_C0 * harmonic[1],
            0.5 + SH_C0 * harmonic[2]
        ];
        colors.push(...color);

        // Compute 3D covariance matrix
        const cov3D = computeCov3D(scale, 1.0, rotation);
        cov3Ds.push(...cov3D);

        positions.push(...position);
    }

    console.log(`Loaded ${gaussianCount} gaussians in ${((performance.now() - start) / 1000).toFixed(3)}s`);
    
    return { positions, opacities, colors, cov3Ds, vertexCount: gaussianCount };
}

// Use glMatrix library for matrix operations
const { mat3 } = glMatrix || {};

function computeCov3D(scale, mod, rot) {
    // Create scaling matrix
    const S = [
        mod * scale[0], 0, 0,
        0, mod * scale[1], 0,
        0, 0, mod * scale[2]
    ];

    const r = rot[0];
    const x = rot[1];
    const y = rot[2];
    const z = rot[3];

    // Create rotation matrix from quaternion
    const R = [
        1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - r * z), 2.0 * (x * z + r * y),
        2.0 * (x * y + r * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - r * x),
        2.0 * (x * z - r * y), 2.0 * (y * z + r * x), 1.0 - 2.0 * (x * x + y * y)
    ];

    // M = S * R
    const M = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            M[i * 3 + j] = S[i * 3 + 0] * R[0 * 3 + j] + S[i * 3 + 1] * R[1 * 3 + j] + S[i * 3 + 2] * R[2 * 3 + j];
        }
    }

    // Sigma = M^T * M (symmetric covariance matrix)
    const Sigma = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) {
                sum += M[k * 3 + i] * M[k * 3 + j];
            }
            Sigma[i * 3 + j] = sum;
        }
    }

    // Return upper triangular part
    return [
        Sigma[0], Sigma[1], Sigma[2],
        Sigma[4], Sigma[5], Sigma[8]
    ];
}