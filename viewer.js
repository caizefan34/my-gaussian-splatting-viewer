var gl,program,cam=null,cs=[0,0],rf=null;
var gc,min3,max3;
var st={rr:0.3,mg:1e6,sm:1};

var VS=['#version 300 es','in vec3 a_center;','in vec3 a_col;','in float a_opacity;','in vec3 a_covA;','in vec3 a_covB;','uniform float W;','uniform float H;','uniform float focal_x;','uniform float focal_y;','uniform float tan_fovx;','uniform float tan_fovy;','uniform float scale_modifier;','uniform mat4 projmatrix;','uniform mat4 viewmatrix;','out vec3 col;','out float scale_modif;','out float depth;','out vec4 con_o;','out vec2 xy;','out vec2 pixf;','vec3 computeCov2D(vec3 mean,float focal_x,float focal_y,float tan_fovx,float tan_fovy,float[6]cov3D,mat4 viewmatrix){','vec4 t=viewmatrix*vec4(mean,1.0);','float limx=1.3*tan_fovx;float limy=1.3*tan_fovy;','float txtz=t.x/t.z;float tytz=t.y/t.z;','t.x=min(limx,max(-limx,txtz))*t.z;t.y=min(limy,max(-limy,tytz))*t.z;','mat3 J=mat3(focal_x/t.z,0,-(focal_x*t.x)/(t.z*t.z),0,focal_y/t.z,-(focal_y*t.y)/(t.z*t.z),0,0,0);','mat3 W=mat3(viewmatrix[0][0],viewmatrix[1][0],viewmatrix[2][0],viewmatrix[0][1],viewmatrix[1][1],viewmatrix[2][1],viewmatrix[0][2],viewmatrix[1][2],viewmatrix[2][2]);','mat3 T=W*J;','mat3 Vrk=mat3(cov3D[0],cov3D[1],cov3D[2],cov3D[1],cov3D[3],cov3D[4],cov3D[2],cov3D[4],cov3D[5]);','mat3 cov=transpose(T)*transpose(Vrk)*T;','cov[0][0]+=0.3;cov[1][1]+=0.3;','return vec3(cov[0][0],cov[0][1],cov[1][1]);','}','float ndc2Pix(float v,float S){return((v+1)*S-1)*.5;}','void main(){','vec3 p_orig=a_center;','vec4 p_hom=projmatrix*vec4(p_orig,1);float p_w=1/(p_hom.w+1e-7);vec3 p_proj=p_hom.xyz*p_w;','vec4 p_view=viewmatrix*vec4(p_orig,1);','if(p_view.z<=0.4){gl_Position=vec4(0,0,0,1);return;}','float cov3D[6]=float[6](a_covA.x,a_covA.y,a_covA.z,a_covB.x,a_covB.y,a_covB.z);','vec3 cov=computeCov2D(p_orig,focal_x,focal_y,tan_fovx,tan_fovy,cov3D,viewmatrix);','float det=cov.x*cov.z-cov.y*cov.y;if(det==0.){gl_Position=vec4(0,0,0,1);return;}','float det_inv=1./det;vec3 conic=vec3(cov.z,-cov.y,cov.x)*det_inv;','float mid=.5*(cov.x+cov.z);','float lambda1=mid+sqrt(max(.1,mid*mid-det));float lambda2=mid-sqrt(max(.1,mid*mid-det));','float my_radius=ceil(3.*sqrt(max(lambda1,lambda2)));','vec2 point_image=vec2(ndc2Pix(p_proj.x,W),ndc2Pix(p_proj.y,H));','my_radius*=.15+scale_modifier*.85;scale_modif=1./scale_modifier;','vec2 corner=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))-1.;','vec2 screen_pos=point_image+my_radius*corner;','col=a_col;con_o=vec4(conic,a_opacity);xy=point_image;pixf=screen_pos;depth=p_view.z;','vec2 clip_pos=screen_pos/vec2(W,H)*2.-1.;','gl_Position=vec4(clip_pos,0,1);','}'].join('\n');

var FS=['#version 300 es','precision mediump float;','in vec3 col;in float scale_modif;in float depth;in vec4 con_o;in vec2 xy;in vec2 pixf;','out vec4 fragColor;','void main(){','vec2 d=xy-pixf;','float power=-.5*(con_o.x*d.x*d.x+con_o.z*d.y*d.y)-con_o.y*d.x*d.y;','if(power>0.)discard;','power*=scale_modif;','float alpha=min(.99,con_o.w*exp(power));','if(alpha<1./255.)discard;','fragColor=vec4(col*alpha,alpha);','}'].join('\n');

function setup(){
var T=function(m){document.getElementById('t').textContent=m;};
var c=document.getElementById('canvas');
var g=c.getContext('webgl2');
if(!g){T('WebGL2 not supported');return null;}
new ResizeObserver(function(e){var r=e[0];var w,h,d=window.devicePixelRatio;if(r.devicePixelContentBoxSize){w=r.devicePixelContentBoxSize[0].inlineSize;h=r.devicePixelContentBoxSize[0].blockSize;d=1}else if(r.contentBoxSize&&r.contentBoxSize[0]){w=r.contentBoxSize[0].inlineSize;h=r.contentBoxSize[0].blockSize}else{w=r.contentRect.width;h=r.contentRect.height}cs=[w*d,h*d];if(cam)draw();}).observe(c,{box:'content-box'});
g.disable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);
var vs=g.createShader(g.VERTEX_SHADER);g.shaderSource(vs,VS);g.compileShader(vs);if(!g.getShaderParameter(vs,g.COMPILE_STATUS)){T('VS: '+g.getShaderInfoLog(vs));return null;}
var fs=g.createShader(g.FRAGMENT_SHADER);g.shaderSource(fs,FS);g.compileShader(fs);if(!g.getShaderParameter(fs,g.COMPILE_STATUS)){T('FS: '+g.getShaderInfoLog(fs));return null;}
var p=g.createProgram();g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS)){T('Program: '+g.getProgramInfoLog(p));return null;}
function ab(name,data,comps){var b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);var l=g.getAttribLocation(p,name);if(l>=0){g.enableVertexAttribArray(l);g.vertexAttribPointer(l,comps,g.FLOAT,false,0,0);g.vertexAttribDivisor(l,1);}return b;}
return{g:g,p:p,bu:{c:ab('a_col',null,3),ct:ab('a_center',null,3),o:ab('a_opacity',null,1),a:ab('a_covA',null,3),b:ab('a_covB',null,3)}};}

function loadSplat(buf,onStep){
var dv=new DataView(buf),GS=128;
var N=Math.floor(buf.byteLength/GS);
var smin=[Infinity,Infinity,Infinity],smax=[-Infinity,-Infinity,-Infinity];
var SC=0.28209479177387814;
var p=new Float32Array(N*3),c=new Float32Array(N*3),o=new Float32Array(N),cv=new Float32Array(N*6);
var bat=Math.max(1,Math.floor(N/50));
for(var i=0;i<N;i++){
var off=i*GS;
var px=dv.getFloat32(off,true),py=dv.getFloat32(off+4,true),pz=dv.getFloat32(off+8,true);
var r=dv.getFloat32(off+12,true),rx=dv.getFloat32(off+16,true),ry=dv.getFloat32(off+20,true),rz=dv.getFloat32(off+24,true);
var sx=Math.exp(dv.getFloat32(off+28,true)),sy=Math.exp(dv.getFloat32(off+32,true)),sz=Math.exp(dv.getFloat32(off+36,true));
var sh0=dv.getFloat32(off+40,true),sh1=dv.getFloat32(off+44,true),sh2=dv.getFloat32(off+48,true);
var al=1/(1+Math.exp(-dv.getFloat32(off+52,true)));
if(px<smin[0])smin[0]=px;if(py<smin[1])smin[1]=py;if(pz<smin[2])smin[2]=pz;
if(px>smax[0])smax[0]=px;if(py>smax[1])smax[1]=py;if(pz>smax[2])smax[2]=pz;
var len=Math.sqrt(r*r+rx*rx+ry*ry+rz*rz);if(len>0){r/=len;rx/=len;ry/=len;rz/=len;}
var R=[1-2*(ry*ry+rz*rz),2*(rx*ry-r*rz),2*(rx*rz+r*ry),2*(rx*ry+r*rz),1-2*(rx*rx+rz*rz),2*(ry*rz-r*rx),2*(rx*rz-r*ry),2*(ry*rz+r*rx),1-2*(rx*rx+ry*ry)];
var S=[];for(var a=0;a<3;a++)for(var b=0;b<3;b++)S[a*3+b]=R[a*3+0]*[sx,sy,sz][b];
var Sig=[];for(var a=0;a<3;a++)for(var b=0;b<3;b++){var sum=0;for(var k=0;k<3;k++)sum+=S[k*3+a]*S[k*3+b];Sig[a*3+b]=sum;}
p[i*3]=px;p[i*3+1]=py;p[i*3+2]=pz;
c[i*3]=.5+SC*sh0;c[i*3+1]=.5+SC*sh1;c[i*3+2]=.5+SC*sh2;
o[i]=al;
cv[i*6]=Sig[0];cv[i*6+1]=Sig[1];cv[i*6+2]=Sig[2];cv[i*6+3]=Sig[4];cv[i*6+4]=Sig[5];cv[i*6+5]=Sig[8];
if(i%bat==0&&onStep)onStep('Loading '+Math.round(i/N*100)+'%');
}
gc=N;min3=smin;max3=smax;
if(onStep)onStep('Loaded '+N+' gaussians');
return{positions:p,opacities:o,colors:c,cov3Ds:cv};}

function Camera(){
this.t=[0,0,0];this.u=[0,1,0];this.th=-Math.PI/2;this.ph=Math.PI/2;this.r=5;
this.fov=0.820176;this.dm=true;
this.vm=mat4.create();this.vpm=mat4.create();this.vw=mat4.create();this.pj=mat4.create();
var s=this;
gl.canvas.addEventListener('mousemove',function(e){if(!e.buttons||s.dm)return;s.th-=e.movementX*0.005;s.ph=Math.max(1e-6,Math.min(Math.PI-1e-6,s.ph+e.movementY*0.005));draw();});
gl.canvas.addEventListener('wheel',function(e){if(s.dm)return;s.r=Math.max(0.5,s.r+e.deltaY*0.01);draw();});}
Camera.prototype.upd=function(){
var p=vec3.fromValues(this.t[0]+this.r*Math.sin(this.ph)*Math.cos(this.th),this.t[1]+this.r*Math.cos(this.ph),this.t[2]+this.r*Math.sin(this.ph)*Math.sin(this.th));
mat4.lookAt(this.vw,p,this.t,this.u);
mat4.perspective(this.pj,this.fov,gl.canvas.width/gl.canvas.height,0.1,1000);
mat4.copy(this.vm,this.vw);mat4.multiply(this.vpm,this.pj,this.vw);
function nr(m,r){m[r+0]=-m[r+0];m[r+4]=-m[r+4];m[r+8]=-m[r+8];m[r+12]=-m[r+12];}
nr(this.vm,1);nr(this.vm,2);nr(this.vpm,1);nr(this.vm,0);nr(this.vpm,0);};

function draw(){
if(rf)cancelAnimationFrame(rf);
rf=requestAnimationFrame(function(){
var w=Math.round(cs[0]*st.rr),h=Math.round(cs[1]*st.rr);
if(gl.canvas.width!==w||gl.canvas.height!==h){gl.canvas.width=w;gl.canvas.height=h;}
gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
cam.upd();
var W=gl.canvas.width,H=gl.canvas.height;
var tf=Math.tan(cam.fov*0.5),tfx=tf*W/H,fy=H/(2*tf),fx=W/(2*tfx);
gl.uniform1f(gl.getUniformLocation(program,'W'),W);
gl.uniform1f(gl.getUniformLocation(program,'H'),H);
gl.uniform1f(gl.getUniformLocation(program,'focal_x'),fx);
gl.uniform1f(gl.getUniformLocation(program,'focal_y'),fy);
gl.uniform1f(gl.getUniformLocation(program,'tan_fovx'),tfx);
gl.uniform1f(gl.getUniformLocation(program,'tan_fovy'),tf);
gl.uniform1f(gl.getUniformLocation(program,'scale_modifier'),st.sm);
gl.uniform3fv(gl.getUniformLocation(program,'boxmin'),min3);
gl.uniform3fv(gl.getUniformLocation(program,'boxmax'),max3);
gl.uniformMatrix4fv(gl.getUniformLocation(program,'projmatrix'),false,cam.vpm);
gl.uniformMatrix4fv(gl.getUniformLocation(program,'viewmatrix'),false,cam.vm);
gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,st.mg);
rf=null;});}

async function main(){
var T=function(m){document.getElementById('t').textContent=m;};
T('Starting WebGL...');
var ctx=setup();if(!ctx)return;gl=ctx.g;program=ctx.p;var bu=ctx.bu;
try{cam=new Camera();cam.dm=true;}catch(e){T('Cam err: '+e.message);return;}
T('Downloading model...');
try{
var buf=await new Promise(function(resolve,reject){
var x=new XMLHttpRequest();
x.open('GET','assets/model.splat',true);
x.responseType='arraybuffer';
x.onprogress=function(e){if(e.lengthComputable){var pct=Math.round(e.loaded/e.total*100);document.getElementById('b').style.width=pct+'%';if(pct%10===0)T('DL '+pct+'% ('+Math.round(e.loaded/1e6)+'/'+Math.round(e.total/1e6)+' MB)');}};
x.onload=function(){T('DL 100%');resolve(x.response);};
x.onerror=function(){reject('XHR failed');};
x.ontimeout=function(){reject('XHR timeout');};
x.send();});
var raw=loadSplat(buf,T);
T('Uploading to GPU...');
await new Promise(function(r){setTimeout(r,0);});
gl.bindBuffer(gl.ARRAY_BUFFER,bu.c);gl.bufferData(gl.ARRAY_BUFFER,raw.colors,gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER,bu.ct);gl.bufferData(gl.ARRAY_BUFFER,raw.positions,gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER,bu.o);gl.bufferData(gl.ARRAY_BUFFER,raw.opacities,gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER,bu.a);gl.bufferData(gl.ARRAY_BUFFER,raw.cov3Ds.subarray(0,gc*3),gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER,bu.b);gl.bufferData(gl.ARRAY_BUFFER,raw.cov3Ds.subarray(gc*3),gl.STATIC_DRAW);
T('Rendering '+gc+' gaussians');
document.getElementById('l').style.opacity='0';document.getElementById('l').style.pointerEvents='none';
cam.dm=false;
var cx=(min3[0]+max3[0])/2,cy=(min3[1]+max3[1])/2,cz=(min3[2]+max3[2])/2;
cam.t=[cx,cy,cz];
cam.r=Math.max(max3[0]-min3[0],max3[1]-min3[1],max3[2]-min3[2])*1.5;
cam.ph=Math.PI/2.2;
draw();
}catch(e){T('Error: '+e.message);console.error(e);}}
window.onload=main;