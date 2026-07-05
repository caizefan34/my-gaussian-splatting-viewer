/**
 * Camera for 3D Gaussian Splatting - Column-major matrices (WebGL compatible)
 */

class Camera {
    constructor(width, height) {
        this.width = width || window.innerWidth;
        this.height = height || window.innerHeight;
        this.aspectRatio = this.width / this.height;

        this.position = [0, 0, 3];
        this.target = [0, 0, 0];
        this.up = [0, 1, 0];
        this.fov = Math.PI / 4;
        this.fov_y = this.fov;
        this.near = 0.1;
        this.far = 1000;

        this.phi = 0;
        this.theta = 0;
        this.distance = 3;

        this.viewMatrix = new Float32Array(16);
        this.projMatrix = new Float32Array(16);
        this.updateMatrices();
    }

    rotate(deltaTheta, deltaPhi) {
        this.theta += deltaTheta;
        this.phi += deltaPhi;
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

    // Column-major view matrix (WebGL standard)
    getViewMatrix() {
        var eye = this.position;
        var center = this.target;
        var up = this.up;

        var f = [center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]];
        var fLen = Math.hypot(f[0], f[1], f[2]);
        if (fLen > 0) { f[0] /= fLen; f[1] /= fLen; f[2] /= fLen; }

        var s = [
            f[1] * up[2] - f[2] * up[1],
            f[2] * up[0] - f[0] * up[2],
            f[0] * up[1] - f[1] * up[0]
        ];
        var sLen = Math.hypot(s[0], s[1], s[2]);
        if (sLen > 0) { s[0] /= sLen; s[1] /= sLen; s[2] /= sLen; }

        var u = [
            s[1] * f[2] - s[2] * f[1],
            s[2] * f[0] - s[0] * f[2],
            s[0] * f[1] - s[1] * f[0]
        ];

        var dotSE = s[0]*eye[0] + s[1]*eye[1] + s[2]*eye[2];
        var dotUE = u[0]*eye[0] + u[1]*eye[1] + u[2]*eye[2];
        var dotFE = f[0]*eye[0] + f[1]*eye[1] + f[2]*eye[2];

        var result = new Float32Array(16);
        // Column 0: s
        result[0] = s[0]; result[1] = s[1]; result[2] = s[2]; result[3] = 0;
        // Column 1: u
        result[4] = u[0]; result[5] = u[1]; result[6] = u[2]; result[7] = 0;
        // Column 2: -f
        result[8] = -f[0]; result[9] = -f[1]; result[10] = -f[2]; result[11] = 0;
        // Column 3: translation
        result[12] = -dotSE; result[13] = -dotUE; result[14] = dotFE; result[15] = 1;

        return result;
    }

    // Column-major projection matrix (WebGL standard)
    getProjectionMatrix() {
        var fov = this.fov;
        var aspect = this.aspectRatio;
        var near = this.near;
        var far = this.far;

        var f = 1.0 / Math.tan(fov / 2.0);
        var nf = 1.0 / (near - far);

        var result = new Float32Array(16);
        result[0] = f / aspect; result[1] = 0; result[2] = 0; result[3] = 0;
        result[4] = 0; result[5] = f; result[6] = 0; result[7] = 0;
        result[8] = 0; result[9] = 0; result[10] = (far + near) * nf; result[11] = -1;
        result[12] = 0; result[13] = 0; result[14] = 2 * far * near * nf; result[15] = 0;

        return result;
    }
}
