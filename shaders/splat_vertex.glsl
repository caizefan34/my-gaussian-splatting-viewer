#version 300 es
precision highp float;

in vec3 a_center;      // Gaussian center position
in vec3 a_col;         // RGB color
in float a_opacity;    // Alpha/opacity
in vec3 a_covA;        // Covariance matrix upper left (cov_xx, cov_xy, cov_yy)
in vec3 a_covB;        // Covariance matrix lower right (cov_zz, cov_xz, cov_yz)

uniform float W;           // Canvas width
uniform float H;           // Canvas height
uniform float focal_x;     // Focal length X
uniform float focal_y;     // Focal length Y
uniform float tan_fovx;    // tan(FOV_x/2)
uniform float tan_fovy;    // tan(FOV_y/2)
uniform float scale_modifier;  // Scale multiplier
uniform mat4 projmatrix;   // Projection matrix
uniform mat4 viewmatrix;   // View matrix

out vec3 col;              // Output color
out float depth;           // Output depth
out float scale_modif;     // Output scale modifier
out vec4 con_o;           // Output conic coefficients + opacity
out vec2 xy;              // Output center position in screen space
out vec2 pixf;            // Output fragment position

// Compute 2D covariance matrix from 3D covariance
vec3 computeCov2D(vec3 mean, float focal_x, float focal_y, float tan_fovx, float tan_fovy, vec3 covA, vec3 covB, mat4 viewmatrix) {
    vec4 t = viewmatrix * vec4(mean, 1.0);

    float limx = 1.3 * tan_fovx;
    float limy = 1.3 * tan_fovy;
    float txtz = t.x / t.z;
    float tytz = t.y / t.z;
    t.x = min(limx, max(-limx, txtz)) * t.z;
    t.y = min(limy, max(-limy, tytz)) * t.z;

    // Jacobian matrix of projection
    mat3 J = mat3(
        focal_x / t.z, 0., -(focal_x * t.x) / (t.z * t.z),
        0., focal_y / t.z, -(focal_y * t.y) / (t.z * t.z),
        0., 0., 0.
    );

    // Extract rotation part of view matrix
    mat3 W = mat3(
        viewmatrix[0][0], viewmatrix[1][0], viewmatrix[2][0],
        viewmatrix[0][1], viewmatrix[1][1], viewmatrix[2][1],
        viewmatrix[0][2], viewmatrix[1][2], viewmatrix[2][2]
    );

    mat3 T = W * J;

    // Reconstruct 3D covariance matrix
    mat3 Vrk = mat3(
        covA.x, covA.y, covB.z,
        covA.y, covA.z, covB.y,
        covB.z, covB.y, covB.x
    );

    // Compute 2D covariance: Sigma = J^T * V * J
    mat3 cov = transpose(T) * Vrk * T;

    // Add regularization
    cov[0][0] += 0.3;
    cov[1][1] += 0.3;
    
    return vec3(cov[0][0], cov[0][1], cov[1][1]);
}

float ndc2Pix(float v, float S) {
    return ((v + 1.0) * S - 1.0) * 0.5;
}

void main() {
    vec3 p_orig = a_center;

    // Transform point by projection
    vec4 p_hom = projmatrix * vec4(p_orig, 1.0);
    float p_w = 1.0 / (p_hom.w + 1e-7);
    vec3 p_proj = p_hom.xyz * p_w;

    // Perform near culling
    vec4 p_view = viewmatrix * vec4(p_orig, 1.0);
    if (p_view.z <= 0.4) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Compute 2D screen-space covariance matrix
    vec3 cov = computeCov2D(p_orig, focal_x, focal_y, tan_fovx, tan_fovy, a_covA, a_covB, viewmatrix);

    // Invert covariance (EWA algorithm)
    float det = (cov.x * cov.z - cov.y * cov.y);
    if (det == 0.0) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    float det_inv = 1.0 / det;
    vec3 conic = vec3(cov.z, -cov.y, cov.x) * det_inv;

    // Compute extent in screen space
    float mid = 0.5 * (cov.x + cov.z);
    float lambda1 = mid + sqrt(max(0.1, mid * mid - det));
    float lambda2 = mid - sqrt(max(0.1, mid * mid - det));
    float my_radius = ceil(3.0 * sqrt(max(lambda1, lambda2)));
    vec2 point_image = vec2(ndc2Pix(p_proj.x, W), ndc2Pix(p_proj.y, H));

    // Apply scale modifier
    my_radius *= 0.15 + scale_modifier * 0.85;
    scale_modif = 1.0 / scale_modifier;

    // Convert gl_VertexID to quad corners: [-1,-1],[1,-1],[-1,1],[1,1]
    vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) - 1.0;
    
    // Vertex position in screen space
    vec2 screen_pos = point_image + my_radius * corner;

    // Store data for fragment shader
    col = a_col;
    con_o = vec4(conic, a_opacity);
    xy = point_image;
    pixf = screen_pos;
    depth = p_view.z;

    // Convert from screen-space to clip-space
    vec2 clip_pos = screen_pos / vec2(W, H) * 2.0 - 1.0;

    gl_Position = vec4(clip_pos, 0.0, 1.0);
}