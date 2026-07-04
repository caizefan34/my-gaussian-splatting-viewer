#version 300 es

precision highp float;

in vec3 position;
in vec4 color;
in vec3 covariance;

uniform mat4 view;
uniform mat4 projection;
uniform float splatSize;

out vec4 vColor;
out vec2 vUv;

void main() {
    // Simple point rendering
    // Each gaussian is rendered as a point that will be expanded in the fragment shader
    gl_Position = projection * view * vec4(position, 1.0);
    gl_PointSize = splatSize * 5.0;
    
    vColor = color / 255.0; // Normalize color from 0-255 to 0-1
    vUv = vec2(0.0);
}