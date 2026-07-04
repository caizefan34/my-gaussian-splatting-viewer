#version 300 es

precision highp float;

in vec4 vColor;
in vec2 vUv;

out vec4 FragColor;

void main() {
    // Create circular splat using point coordinates
    vec2 pointCoord = gl_PointCoord * 2.0 - 1.0;
    float dist = length(pointCoord);
    
    // Gaussian falloff
    float alpha = exp(-dist * dist * 2.0);
    
    if (dist > 1.0) {
        discard;
    }
    
    FragColor = vec4(vColor.rgb, vColor.a * alpha);
}