// Proper 3DGS Viewer using .splat with scale+rot → covariance rendering
// Inspired by antimatter15/splat and kishimisu/Gaussian-Splatting-WebGL
// Minimal gl-matrix mat4 inline (no CDN dependency)
!function(){var e=Float32Array;function t(e,t){if(e){if(e instanceof e)return e;var n=new e(t);return n.set(t),n}return new e(t||16)}function n(e,n,r){for(var i=0,o=0;o<e.length;o++)i+=e[o]*n[o];return i+=r||0}window.mat4={create:function(n){var r=new e(16);return n&&(r[0]=n[0],r[1]=n[1],r[2]=n[2],r[3]=n[3],r[4]=n[4],r[5]=n[5],r[6]=n[6],r[7]=n[7],r[8]=n[8],r[9]=n[9],r[10]=n[10],r[11]=n[11],r[12]=n[12],r[13]=n[13],r[14]=n[14],r[15]=n[15]),r},identity:function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},multiply:function(e,n,r){var i=n[0],o=n[1],a=n[2],u=n[3],c=n[4],f=n[5],l=n[6],s=n[7],h=n[8],d=n[9],p=n[10],v=n[11],g=n[12],y=n[13],m=n[14],b=n[15],x=r[0],w=r[1],k=r[2],A=r[3];return e[0]=x*i+w*c+k*h+A*g,e[1]=x*o+w*f+k*d+A*y,e[2]=x*a+w*l+k*p+A*m,e[3]=x*u+w*s+k*v+A*b,x=r[4],w=r[5],k=r[6],A=r[7],e[4]=x*i+w*c+k*h+A*g,e[5]=x*o+w*f+k*d+A*y,e[6]=x*a+w*l+k*p+A*m,e[7]=x*u+w*s+k*v+A*b,x=r[8],w=r[9],k=r[10],A=r[11],e[8]=x*i+w*c+k*h+A*g,e[9]=x*o+w*f+k*d+A*y,e[10]=x*a+w*l+k*p+A*m,e[11]=x*u+w*s+k*v+A*b,x=r[12],w=r[13],k=r[14],A=r[15],e[12]=x*i+w*c+k*h+A*g,e[13]=x*o+w*f+k*d+A*y,e[14]=x*a+w*l+k*p+A*m,e[15]=x*u+w*s+k*v+A*b,e},perspective:function(e,t,n,r,i){var o=i||null;if(void 0!==o){var a=1/Math.tan(t/2);e[0]=a/n,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=a,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[11]=-1,e[12]=0,e[13]=0,e[15]=0,null!=o&&1/0!==o?(e[10]=-(i+r)/(i-r),e[14]=-2*i*r/(i-r)):(e[10]=-1,e[14]=-2*r)}else{var u=1/Math.tan(t/2);e[0]=u/n,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=u,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=-r/(i-r),e[11]=-1,e[12]=0,e[13]=0,e[14]=-r*i/(i-r),e[15]=0}return e},lookAt:function(e,t,n,r){var i,o,a,u,c,f,l,s,h,d,p=n[0],v=n[1],g=n[2],y=r[0],m=r[1],b=r[2],x=t[0],w=t[1],k=t[2];return Math.abs(p-x)<1e-6&&Math.abs(v-w)<1e-6&&Math.abs(g-k)<1e-6?this.identity(e):(l=p-x,s=v-w,h=g-k,d=1/Math.sqrt(l*l+s*s+h*h),l*=d,s*=d,h*=d,i=m*h-b*s,o=b*l-y*h,a=y*s-m*l,d=Math.sqrt(i*i+o*o+a*a),d?(d=1/d,i*=d,o*=d,a*=d):(i=0,o=0,a=0),u=s*a-h*o,c=h*i-l*a,f=l*o-s*i,d=Math.sqrt(u*u+c*c+f*f),d?(d=1/d,u*=d,c*=d,f*=d):(u=0,c=0,f=0),e[0]=i,e[1]=u,e[2]=-l,e[3]=0,e[4]=o,e[5]=c,e[6]=-s,e[7]=0,e[8]=a,e[9]=f,e[10]=-h,e[11]=0,e[12]=-n(i,x,w,k),e[13]=-n(u,x,w,k),e[14]=n(l,x,w,k),e[15]=1,e)}}
}();

const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl2");
if (!gl) { document.body.textContent = "WebGL2 required"; throw "no webgl2"; }

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

let W = 0, H = 0;
function resize() {
  W = innerWidth | 0;
  H = innerHeight | 0;
  canvas.width = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
addEventListener("resize", resize);

const VS = `#version 300 es
precision highp float;
in vec3 a_center;
in vec3 a_col;
in float a_opacity;
in vec3 a_covA;
in vec3 a_covB;
uniform mat4 viewmatrix;
uniform mat4 projmatrix;
uniform float W;
uniform float H;
uniform float focal_x;
uniform float focal_y;
uniform float tan_fovx;
uniform float tan_fovy;
uniform float scale_modifier;
out vec3 v_col;
out vec4 v_conic;
out vec2 v_xy;
out vec2 v_pos;

vec3 computeCov2D(vec3 mean, float focal_x, float focal_y, float tan_fovx, float tan_fovy, mat4 viewmatrix) {
    vec4 t = viewmatrix * vec4(mean, 1.0);
    float limx = 1.3 * tan_fovx;
    float limy = 1.3 * tan_fovy;
    float txtz = t.x / t.z;
    float tytz = t.y / t.z;
    t.x = min(limx, max(-limx, txtz)) * t.z;
    t.y = min(limy, max(-limy, tytz)) * t.z;
    mat3 J = mat3(focal_x/t.z, 0.0, -(focal_x*t.x)/(t.z*t.z), 0.0, focal_y/t.z, -(focal_y*t.y)/(t.z*t.z), 0.0, 0.0, 0.0);
    mat3 Wm = mat3(viewmatrix[0][0], viewmatrix[1][0], viewmatrix[2][0], viewmatrix[0][1], viewmatrix[1][1], viewmatrix[2][1], viewmatrix[0][2], viewmatrix[1][2], viewmatrix[2][2]);
    mat3 T = Wm * J;
    float cov3D[6];
    cov3D[0] = a_covA.x; cov3D[1] = a_covA.y; cov3D[2] = a_covA.z;
    cov3D[3] = a_covB.x; cov3D[4] = a_covB.y; cov3D[5] = a_covB.z;
    mat3 Vrk = mat3(cov3D[0], cov3D[1], cov3D[2], cov3D[1], cov3D[3], cov3D[4], cov3D[2], cov3D[4], cov3D[5]);
    mat3 cov = transpose(T) * transpose(Vrk) * T;
    cov[0][0] += 0.3;
    cov[1][1] += 0.3;
    return vec3(cov[0][0], cov[0][1], cov[1][1]);
}

void main() {
    vec4 p_hom = projmatrix * vec4(a_center, 1.0);
    float p_w = 1.0 / max(p_hom.w, 1e-7);
    vec3 p_proj = p_hom.xyz * p_w;
    vec4 p_view = viewmatrix * vec4(a_center, 1.0);
    if (p_view.z <= 0.4) { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); return; }

    vec3 cov = computeCov2D(a_center, focal_x, focal_y, tan_fovx, tan_fovy, viewmatrix);
    float det = cov.x * cov.z - cov.y * cov.y;
    if (det == 0.0) { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); return; }
    float det_inv = 1.0 / det;
    vec3 conic = vec3(cov.z, -cov.y, cov.x) * det_inv;

    float mid = 0.5 * (cov.x + cov.z);
    float lambda1 = mid + sqrt(max(0.1, mid*mid - det));
    float lambda2 = mid - sqrt(max(0.1, mid*mid - det));
    float my_radius = ceil(3.0 * sqrt(max(lambda1, lambda2)));

    float ndc_x = (p_proj.x + 1.0) * 0.5;
    float ndc_y = (p_proj.y + 1.0) * 0.5;
    vec2 point_image = vec2(ndc_x * W, ndc_y * H);

    my_radius *= (0.15 + scale_modifier * 0.85);
    int vid = gl_VertexID & 3;
    vec2 corner = vec2(float(vid & 1), float(vid >> 1)) * 2.0 - 1.0;
    vec2 screen_pos = point_image + my_radius * corner;

    v_col = a_col;
    v_conic = vec4(conic, a_opacity);
    v_xy = point_image;
    v_pos = screen_pos;

    vec2 clip_pos = screen_pos / vec2(W, H) * 2.0 - 1.0;
    gl_Position = vec4(clip_pos, 0.0, 1.0);
}
`;

const FS = `#version 300 es
precision mediump float;
in vec3 v_col;
in vec4 v_conic;
in vec2 v_xy;
in vec2 v_pos;
out vec4 fragColor;
void main() {
    vec2 d = v_xy - v_pos;
    float power = -0.5 * (v_conic.x * d.x * d.x + v_conic.z * d.y * d.y) - v_conic.y * d.x * d.y;
    if (power > 0.0) discard;
    float alpha = min(0.99, v_conic.w * exp(power));
    if (alpha < 1.0/255.0) discard;
    fragColor = vec4(v_col * alpha, alpha);
}
`;

function compileShader(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compileShader(VS, gl.VERTEX_SHADER));
gl.attachShader(prog, compileShader(FS, gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const u_viewmatrix = gl.getUniformLocation(prog, "viewmatrix");
const u_projmatrix = gl.getUniformLocation(prog, "projmatrix");
const u_W = gl.getUniformLocation(prog, "W");
const u_H = gl.getUniformLocation(prog, "H");
const u_focal_x = gl.getUniformLocation(prog, "focal_x");
const u_focal_y = gl.getUniformLocation(prog, "focal_y");
const u_tan_fovx = gl.getUniformLocation(prog, "tan_fovx");
const u_tan_fovy = gl.getUniformLocation(prog, "tan_fovy");
const u_scale_modifier = gl.getUniformLocation(prog, "scale_modifier");

let theta = -Math.PI / 2, phi = Math.PI / 2, radius = 5;
let target = [0, 0, 0];

canvas.style.touchAction = "none";
canvas.addEventListener("mousemove", e => {
  if (!e.buttons) return;
  theta -= e.movementX * 0.005;
  phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi + e.movementY * 0.005));
});
canvas.addEventListener("wheel", e => {
  radius = Math.max(0.5, radius + e.deltaY * 0.01);
  e.preventDefault();
}, { passive: false });

function updateCamera() {
  const eye = [
    target[0] + radius * Math.sin(phi) * Math.cos(theta),
    target[1] + radius * Math.cos(phi),
    target[2] + radius * Math.sin(phi) * Math.sin(theta)
  ];
  const vw = mat4.create();
  mat4.lookAt(vw, eye, target, [0, 1, 0]);
  const pm = mat4.create();
  mat4.perspective(pm, 0.820176, canvas.width / canvas.height, 0.1, 1000);
  const vm = new Float32Array(vw);
  const vpm = mat4.create();
  mat4.multiply(vpm, pm, vw);
  function nr(m, r) { m[r] = -m[r]; m[r+4] = -m[r+4]; m[r+8] = -m[r+8]; m[r+12] = -m[r+12]; }
  nr(vm, 1); nr(vm, 2);
  nr(vpm, 1);
  nr(vm, 0);
  nr(vpm, 0);
  return { vm, vpm };
}

const infoEl = document.getElementById("info");
function setStatus(msg) { infoEl.textContent = msg; }

setStatus("Downloading model...");
fetch("assets/model.splat").then(r => r.arrayBuffer()).then(buf => {
  const dv = new DataView(buf);
  const N = Math.floor(buf.byteLength / 32);
  setStatus("Loading " + N + " gaussians...");

  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const opacities = new Float32Array(N);
  const cov3Ds = new Float32Array(N * 6);

  let minPos = [Infinity, Infinity, Infinity];
  let maxPos = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < N; i++) {
    const o = i * 32;
    const px = dv.getFloat32(o, true);
    const py = dv.getFloat32(o+4, true);
    const pz = dv.getFloat32(o+8, true);

    const sx = dv.getFloat32(o+12, true);
    const sy = dv.getFloat32(o+16, true);
    const sz = dv.getFloat32(o+20, true);

    const r = dv.getUint8(o+24) / 255;
    const g = dv.getUint8(o+25) / 255;
    const b = dv.getUint8(o+26) / 255;
    const a = dv.getUint8(o+27) / 255;

    let qx = (dv.getUint8(o+28) - 128) / 128;
    let qy = (dv.getUint8(o+29) - 128) / 128;
    let qz = (dv.getUint8(o+30) - 128) / 128;
    let qw = (dv.getUint8(o+31) - 128) / 128;
    const qlen = Math.sqrt(qx*qx+qy*qy+qz*qz+qw*qw);
    if (qlen > 0) { qx /= qlen; qy /= qlen; qz /= qlen; qw /= qlen; }

    const R = [
      1 - 2*(qy*qy+qz*qz), 2*(qx*qy-qw*qz),     2*(qx*qz+qw*qy),
      2*(qx*qy+qw*qz),     1 - 2*(qx*qx+qz*qz), 2*(qy*qz-qw*qx),
      2*(qx*qz-qw*qy),     2*(qy*qz+qw*qx),     1 - 2*(qx*qx+qy*qy)
    ];
    const S = [R[0]*sx, R[1]*sy, R[2]*sz, R[3]*sx, R[4]*sy, R[5]*sz, R[6]*sx, R[7]*sy, R[8]*sz];
    const Sig = [
      S[0]*S[0] + S[1]*S[1] + S[2]*S[2],
      S[0]*S[3] + S[1]*S[4] + S[2]*S[5],
      S[0]*S[6] + S[1]*S[7] + S[2]*S[8],
      S[3]*S[3] + S[4]*S[4] + S[5]*S[5],
      S[3]*S[6] + S[4]*S[7] + S[5]*S[8],
      S[6]*S[6] + S[7]*S[7] + S[8]*S[8]
    ];

    positions[i*3] = px; positions[i*3+1] = py; positions[i*3+2] = pz;
    colors[i*3] = r; colors[i*3+1] = g; colors[i*3+2] = b;
    opacities[i] = a;
    cov3Ds[i*6] = Sig[0]; cov3Ds[i*6+1] = Sig[1]; cov3Ds[i*6+2] = Sig[2];
    cov3Ds[i*6+3] = Sig[3]; cov3Ds[i*6+4] = Sig[4]; cov3Ds[i*6+5] = Sig[5];

    if (px < minPos[0]) minPos[0] = px;
    if (py < minPos[1]) minPos[1] = py;
    if (pz < minPos[2]) minPos[2] = pz;
    if (px > maxPos[0]) maxPos[0] = px;
    if (py > maxPos[1]) maxPos[1] = py;
    if (pz > maxPos[2]) maxPos[2] = pz;
  }

  target = [(minPos[0]+maxPos[0])/2, (minPos[1]+maxPos[1])/2, (minPos[2]+maxPos[2])/2];
  radius = Math.max(maxPos[0]-minPos[0], maxPos[1]-minPos[1], maxPos[2]-minPos[2]) * 1.5;
  phi = Math.PI / 2.2;

  setStatus("Uploading to GPU (" + N + " gaussians)...");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  function bindInstanced(name, data, size, divisor) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) { console.warn("No attrib " + name); return; }
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, divisor);
  }

  bindInstanced("a_center", positions, 3, 1);
  bindInstanced("a_col", colors, 3, 1);
  bindInstanced("a_opacity", opacities, 1, 1);
  bindInstanced("a_covA", cov3Ds.subarray(0, N*3), 3, 1);
  bindInstanced("a_covB", cov3Ds.subarray(N*3), 3, 1);

  setStatus("Ready - " + N + " gaussians");

  function frame() {
    resize();
    const { vm, vpm } = updateCamera();

    gl.useProgram(prog);
    gl.uniformMatrix4fv(u_viewmatrix, false, vm);
    gl.uniformMatrix4fv(u_projmatrix, false, vpm);
    gl.uniform1f(u_W, canvas.width);
    gl.uniform1f(u_H, canvas.height);

    const fov = 0.820176;
    const tan_fovy = Math.tan(fov * 0.5);
    const tan_fovx = tan_fovy * (canvas.height / canvas.width);
    const fy = canvas.height / (2 * tan_fovy);
    const fx = canvas.width / (2 * tan_fovx);
    gl.uniform1f(u_focal_x, fx);
    gl.uniform1f(u_focal_y, fy);
    gl.uniform1f(u_tan_fovx, tan_fovx);
    gl.uniform1f(u_tan_fovy, tan_fovy);
    gl.uniform1f(u_scale_modifier, 1.0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N);
    requestAnimationFrame(frame);
  }

  setTimeout(() => {
    resize();
    requestAnimationFrame(frame);
  }, 50);
}).catch(e => {
  setStatus("Error: " + e.message);
  console.error(e);
});
