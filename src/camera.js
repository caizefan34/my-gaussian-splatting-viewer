/**
 * Camera for 3D Gaussian Splatting
 * Based on: https://github.com/kishimisu/Gaussian-Splatting-WebGL
 */

const { mat4, vec3 } = glMatrix;

class Camera {
    constructor(width, height) {
        this.width = width || window.innerWidth;
        this.height = height || window.innerHeight;
        this.aspectRatio = this.width / this.height;

        this.target = [0, 0, 0];
        this.up = [0, 1, 0];
        this.theta = -Math.PI / 2;
        this.phi = Math.PI / 2;
        this.radius = 5;
        this.fov_y = 0.820176;

        this.position = vec3.create();
        this.viewMatrix = mat4.create();
        this.projMatrix = mat4.create();
        this.vm = mat4.create();
        this.vpm = mat4.create();

        this.updatePosition();
    }

    rotate(deltaTheta, deltaPhi) {
        this.theta -= deltaTheta;
        this.phi = Math.max(1e-6, Math.min(Math.PI - 1e-6, this.phi + deltaPhi));
        this.updatePosition();
    }

    zoom(factor) {
        this.radius = Math.max(0.5, this.radius + factor);
        this.updatePosition();
    }

    updatePosition() {
        this.position[0] = this.target[0] + this.radius * Math.sin(this.phi) * Math.cos(this.theta);
        this.position[1] = this.target[1] + this.radius * Math.cos(this.phi);
        this.position[2] = this.target[2] + this.radius * Math.sin(this.phi) * Math.sin(this.theta);
        this.updateMatrices();
    }

    setAspectRatio(ratio) {
        this.aspectRatio = ratio;
    }

    update() {
        this.updateMatrices();
    }

    updateMatrices() {
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
        mat4.perspective(this.projMatrix, this.fov_y, this.aspectRatio, 0.1, 100);

        mat4.copy(this.vm, this.viewMatrix);
        mat4.multiply(this.vpm, this.projMatrix, this.viewMatrix);

        // Apply sign flips as in the original SIBR implementation
        const invertRow = (mat, row) => {
            mat[row + 0] = -mat[row + 0];
            mat[row + 4] = -mat[row + 4];
            mat[row + 8] = -mat[row + 8];
            mat[row + 12] = -mat[row + 12];
        };

        invertRow(this.vm, 1);
        invertRow(this.vm, 2);
        invertRow(this.vpm, 1);
        invertRow(this.vm, 0);
        invertRow(this.vpm, 0);
    }
}
