/**
 * PLY File Loader for Gaussian Splatting
 */

async function loadPLY(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return parsePLY(buffer);
}

function parsePLY(buffer) {
    const view = new DataView(buffer);
    let offset = 0;

    // Parse header
    const headerEnd = findHeaderEnd(buffer);
    const headerStr = new TextDecoder().decode(new Uint8Array(buffer, 0, headerEnd));
    const header = parseHeader(headerStr);

    offset = headerEnd;

    // Initialize data arrays
    const positions = new Float32Array(header.vertexCount * 3);
    const colors = new Uint8Array(header.vertexCount * 4);
    const covariances = new Float32Array(header.vertexCount * 3);

    // Parse vertices
    for (let i = 0; i < header.vertexCount; i++) {
        const vertex = parseVertex(view, offset, header.properties);
        offset = vertex.offset;

        // Position
        positions[i * 3 + 0] = vertex.x;
        positions[i * 3 + 1] = vertex.y;
        positions[i * 3 + 2] = vertex.z;

        // Color (RGBA)
        colors[i * 4 + 0] = vertex.red || 255;
        colors[i * 4 + 1] = vertex.green || 255;
        colors[i * 4 + 2] = vertex.blue || 255;
        colors[i * 4 + 3] = vertex.alpha || 255;

        // Covariance (simplified - using scale values)
        covariances[i * 3 + 0] = vertex.scale_0 || 1.0;
        covariances[i * 3 + 1] = vertex.scale_1 || 1.0;
        covariances[i * 3 + 2] = vertex.scale_2 || 1.0;
    }

    console.log(`Loaded PLY: ${header.vertexCount} vertices`);

    return {
        positions,
        colors,
        covariances,
        vertexCount: header.vertexCount,
    };
}

function findHeaderEnd(buffer) {
    const view = new Uint8Array(buffer);
    const endMarker = new TextEncoder().encode('end_header');
    const markerLen = endMarker.length;

    for (let i = 0; i < view.length - markerLen; i++) {
        let match = true;
        for (let j = 0; j < markerLen; j++) {
            if (view[i + j] !== endMarker[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            // Find the newline after end_header
            return i + markerLen + 1;
        }
    }
    return -1;
}

function parseHeader(headerStr) {
    const lines = headerStr.split('\n');
    const result = {
        vertexCount: 0,
        properties: [],
        format: 'binary_little_endian',
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('element vertex')) {
            result.vertexCount = parseInt(trimmed.split(' ')[2]);
        } else if (trimmed.startsWith('property')) {
            const parts = trimmed.split(' ');
            const type = parts[1];
            const name = parts[2];
            result.properties.push({ type, name });
        } else if (trimmed.startsWith('format')) {
            result.format = trimmed.split(' ')[1];
        }
    }

    return result;
}

function parseVertex(view, offset, properties) {
    const vertex = { offset };
    let pos = offset;

    const isLittleEndian = true;

    for (const prop of properties) {
        const { type, name } = prop;

        if (type === 'float') {
            vertex[name] = view.getFloat32(pos, isLittleEndian);
            pos += 4;
        } else if (type === 'uchar') {
            vertex[name] = view.getUint8(pos);
            pos += 1;
        } else if (type === 'int' || type === 'int32') {
            vertex[name] = view.getInt32(pos, isLittleEndian);
            pos += 4;
        }
    }

    vertex.offset = pos;
    return vertex;
}