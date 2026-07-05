#version 300 es
precision mediump float;

in vec3 col;
in float scale_modif;
in float depth;
in vec4 con_o;
in vec2 xy;
in vec2 pixf;

out vec4 fragColor;

float depth_palette(float x) { 
    x = min(1.0, x);
    return vec3(
        sin(x * 6.28 / 4.0),
        x * x,
        mix(sin(x * 6.28), x, 0.6)
    ).r;
}

void main() {
    // Resample using conic matrix (cf. "Surface Splatting" by Zwicker et al., 2001)
    vec2 d = xy - pixf;
    float power = -0.5 * (con_o.x * d.x * d.x + con_o.z * d.y * d.y) - con_o.y * d.x * d.y;

    if (power > 0.0) {
        discard;
    }

    // Apply scale modifier correctly
    power *= scale_modif;

    // Eq. (2) from 3D Gaussian splatting paper: compute alpha
    float alpha = min(0.99, con_o.w * exp(power));
    
    if (alpha < 1.0 / 255.0) {
        discard;
    }

    // Ensure color is properly clamped
    vec3 finalColor = clamp(col, 0.0, 1.0);
    
    // Eq. (3) from 3D Gaussian splatting paper: front-to-back blending (premultiplied alpha)
    fragColor = vec4(finalColor * alpha, alpha);
}
