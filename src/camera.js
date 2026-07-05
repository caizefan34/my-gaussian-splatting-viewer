/**
 * Camera Manager
 */

class Camera {
    constructor(width, height) {
        this.width = width || window.innerWidth;
        this.height = height || window.innerHeight;
        this.aspectRatio = this.width / this.height;

        // Camera parameters
        this.position = [0, 0, 3];
        this.target = [0, 0, 0];
        this.up = [0, 1, 0];
        this.fov = Math.PI / 4; // 45 degrees
        this.fov_y = this.fov; // For render loop compatibility
        this.near = 0.1;
        this.far = 1000;

        // Rotation parameters
        this.phi = 0; // vertical angle
        this.theta = 0; // horizontal angle
        this.distance = 3;

        // Initialize matrices
        this.viewMatrix = new Float32Array(16);
        this.projMatrix = new Float32Array(16);
        this.updateMatrices();
    }

    rotate(deltaTheta, deltaPhi) {
        this.theta += deltaTheta;
        this.phi += deltaPhi;

        // Clamp phi to avoid flipping
        this.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.phi));

        this.updatePosition();
    }

    zoom(factor) {
        this.distance *= factor;
        this.distance = Math.max(0.1, Math.min(100, this.distance));
        this.updatePosition();
    }

    updatePosition() {
        this.position[0] = this.distance * Math.sin(this.theta) * Math.cos(this.phi);
        this.position[1] = this.distance * Math.sin(this.phi);
        this.position[2] = this.distance * Math.cos(this.theta) * Math.cos(this.phi);
        
        this.updateMatrices();
    }

    setAspectRatio(ratio) {
        this.aspectRatio = ratio;
        this.updateMatrices();
    }

    update() {
        this.updateMatrices();
    }

    updateMatrices() {
        this.viewMatrix = this.getViewMatrix();
        this.projMatrix = this.getProjectionMatrix();
    }

    getViewMatrix() {
        return this.lookAt(
            this.position,
            this.target,
            this.up
        );
    }

    getProjectionMatrix() {
        return this.perspective(
            this.fov,
            this.aspectRatio,
            this.near,
            this.far
        );
    }

    // Matrix helper functions
    lookAt(eye, center, up) {
        const f = this.normalize(this.subtract(center, eye));
        const s = this.normalize(this.cross(f, up));
        const u = this.cross(s, f);

        const result = new Float32Array(16);
        result[0] = s[0];
        result[4] = s[1];
        result[8] = s[2];
        result[12] = -this.dot(s, eye);
        
        result[1] = u[0];
        result[5] = u[1];
        result[9] = u[2];
        result[13] = -this.dot(u, eye);
        
        result[2] = -f[0];
        result[6] = -f[1];
        result[10] = -f[2];
        result[14] = this.dot(f, eye);
        
        result[3] = 0;
        result[7] = 0;
        result[11] = 0;
        result[15] = 1;

        return result;
    }

    perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2.0);
        const nf = 1.0 / (near - far);

        const result = new Float32Array(16);
        result[0] = f / aspect;
        result[1] = 0;
        result[2] = 0;
        result[3] = 0;

        result[4] = 0;
        result[5] = f;
        result[6] = 0;
        result[7] = 0;

        result[8] = 0;
        result[9] = 0;
        result[10] = (far + near) * nf;
        result[11] = -1;

        result[12] = 0;
        result[13] = 0;
        result[14] = 2 * far * near * nf;
        result[15] = 0;

        return result;
    }

    // Vector operations
    normalize(v) {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    subtract(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }

    cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }
}
