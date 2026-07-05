// Based on antimatter15/splat
const gl = document.getElementById("c").getContext("webgl2");
if (!gl) { document.write("No WebGL2"); throw "no webgl2"; }

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

// Resize
function resize() {
  const w = innerWidth, h = innerHeight;
  gl.canvas.width = w * devicePixelRatio;
  gl.canvas.height = h * devicePixelRatio;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}
addEventListener("resize", resize);
resize();

const VS = `#version 300 es
in vec3 pos;in vec3 col;in float a;in vec4 q;
uniform mat4 vp;uniform vec2 wh;
out vec4 c;out float d;
vec3 qrot(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void main(){
  vec3 p=qrot(q,pos);
  vec4 pp=vp*vec4(p,1);
  gl_PointSize=wh.y*pp.z/pp.w;
  gl_Position=pp;
  c=vec4(col,a);d=pp.z/pp.w;
}`;

const FS = `#version 300 es
precision mediump float;
in vec4 c;in float d;
out vec4 f;
void main(){
  vec2 r=gl_PointCoord*2.-1.;
  float a=exp(-dot(r,r)*2.)*c.a;
  if(a<1./255.)discard;
  f=vec4(c.rgb*a,a);
}`;

function shader(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, shader(VS, gl.VERTEX_SHADER));
gl.attachShader(prog, shader(FS, gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
gl.useProgram(prog);

const u_vp = gl.getUniformLocation(prog, "vp");
const u_wh = gl.getUniformLocation(prog, "wh");

// Camera
let theta = -Math.PI / 2, phi = Math.PI / 2, radius = 5;
let target = [0, 0, 0];

gl.canvas.addEventListener("mousemove", e => {
  if (!e.buttons) return;
  theta -= e.movementX * 0.005;
  phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi + e.movementY * 0.005));
});
gl.canvas.addEventListener("wheel", e => {
  radius = Math.max(0.5, radius + e.deltaY * 0.01);
  e.preventDefault();
}, { passive: false });

function updateCamera() {
  const eye = [
    target[0] + radius * Math.sin(phi) * Math.cos(theta),
    target[1] + radius * Math.cos(phi),
    target[2] + radius * Math.sin(phi) * Math.sin(theta)
  ];
  const vm = mat4.create();
  mat4.lookAt(vm, eye, target, [0, 1, 0]);
  const pm = mat4.create();
  mat4.perspective(pm, 0.820176, gl.canvas.width / gl.canvas.height, 0.1, 1000);
  const vpm = mat4.create();
  mat4.multiply(vpm, pm, vm);
  // Invert rows as per 3DGS convention
  for (let r = 0; r < 4; r++) {
    if (r !== 3) { vpm[r] = -vpm[r]; vpm[r+4] = -vpm[r+4]; vpm[r+8] = -vpm[r+8]; vpm[r+12] = -vpm[r+12]; }
  }
  return vpm;
}

// Load .splat data
console.log("Downloading model...");
fetch("assets/model.splat").then(r => r.arrayBuffer()).then(buf => {
  const dv = new DataView(buf);
  const N = Math.floor(buf.byteLength / 32);
  const rowLen = 32; // 12(pos) + 12(scale) + 4(color) + 4(rot)
  console.log(N + " gaussians");
  
  // Create vertex buffers
  const posArr = new Float32Array(N * 3);
  const colArr = new Float32Array(N * 3);
  const aArr = new Float32Array(N);
  const qArr = new Float32Array(N * 4);
  
  for (let i = 0; i < N; i++) {
    const o = i * rowLen;
    posArr[i*3] = dv.getFloat32(o, true);
    posArr[i*3+1] = dv.getFloat32(o+4, true);
    posArr[i*3+2] = dv.getFloat32(o+8, true);
    // scale is not used directly - we compute point size differently
    const sc0 = dv.getFloat32(o+12, true);
    const sc1 = dv.getFloat32(o+16, true);
    const sc2 = dv.getFloat32(o+20, true);
    colArr[i*3] = dv.getUint8(o+24) / 255;
    colArr[i*3+1] = dv.getUint8(o+25) / 255;
    colArr[i*3+2] = dv.getUint8(o+26) / 255;
    aArr[i] = dv.getUint8(o+27) / 255;
    // Decode quantized rotation
    const qx = (dv.getUint8(o+28) - 128) / 128;
    const qy = (dv.getUint8(o+29) - 128) / 128;
    const qz = (dv.getUint8(o+30) - 128) / 128;
    const qw = (dv.getUint8(o+31) - 128) / 128;
    const qlen = Math.sqrt(qx*qx+qy*qy+qz*qz+qw*qw);
    if (qlen > 0) {
      qArr[i*4] = qx/qlen; qArr[i*4+1] = qy/qlen;
      qArr[i*4+2] = qz/qlen; qArr[i*4+3] = qw/qlen;
    }
  }
  
  // Setup VAO
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  
  function bind(name, data, size) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  
  bind("pos", posArr, 3);
  bind("col", colArr, 3);
  bind("a", aArr, 1);
  bind("q", qArr, 4);
  
  // Render loop
  function frame() {
    resize();
    gl.uniformMatrix4fv(u_vp, false, updateCamera());
    gl.uniform2f(u_wh, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
    requestAnimationFrame(frame);
  }
  frame();
});