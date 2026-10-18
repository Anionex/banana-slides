import { galleryWarpPoint } from './gallerySurface';

const vertex = `
attribute vec2 a_position;
attribute float a_localY;
attribute vec2 a_uv;
uniform vec2 u_viewport;
uniform float u_center;
varying vec2 v_uv;
varying float v_y;
void main() {
  gl_Position = vec4(a_position.x * 2.0 / u_viewport.x,
    1.0 - 2.0 * (u_center + a_position.y) / u_viewport.y, 0.0, 1.0);
  v_uv = a_uv;
  v_y = a_localY;
}`;
const fragment = `
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_size;
uniform vec2 u_fit;
uniform vec2 u_viewport;
uniform float u_dpr;
uniform float u_center;
uniform float u_alpha;
uniform float u_belt;
uniform float u_aperture;
uniform float u_inset;
varying vec2 v_uv;
varying float v_y;
void main() {
  vec2 local = (v_uv - .5) * u_size;
  vec2 q = abs(local) - u_size * .5 + 12.0;
  float corner = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 12.0;
  float alpha = (1.0 - smoothstep(-.7, .7, corner)) * u_alpha;
  vec2 uv = (v_uv - .5) / u_fit + .5;
  vec3 color = vec3(1.0);
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) color = texture2D(u_image, uv).rgb;
  float y = u_viewport.y - gl_FragCoord.y / u_dpr;
  float top = u_center - u_size.y * .5;
  float bottom = u_center + u_size.y * .5;
  float fade = smoothstep(u_inset, max(u_inset + 1.0, top), y) * (1.0 - smoothstep(bottom, u_viewport.y - u_inset, y));
  alpha *= mix(1.0, fade, u_belt);
  float aperture = 1.0 - smoothstep(u_size.y * .5 - 1.0, u_size.y * .5 + 1.0, abs(v_y));
  alpha *= mix(1.0, aperture, u_aperture);
  gl_FragColor = vec4(color * alpha, alpha);
}`;

/** Shared indexed mesh, bounded texture cache, one GPU draw per visible page. */
export class GalleryRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private indices: WebGLBuffer;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textures = new Map<string, { texture: WebGLTexture; used: number; bytes: number }>();
  private vertices = new Float32Array(129 * 2 * 5);
  private frame = 0;
  private textureBytes = 0;
  private width = 0;
  private height = 0;
  private center = 0;
  private dpr = 1;
  draws = 0;

  constructor(private canvas: HTMLCanvasElement, private restrained = false) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message || 'Shader compilation failed'); }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) || 'Gallery shader link failed');
    this.buffer = gl.createBuffer()!;
    this.indices = gl.createBuffer()!;
    const index = new Uint16Array(128 * 6);
    for (let i = 0; i < 128; i++) index.set([2*i, 2*i+1, 2*i+2, 2*i+1, 2*i+3, 2*i+2], i*6);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    gl.useProgram(this.program);
    for (const [name, count, offset] of [['a_position', 2, 0], ['a_localY', 1, 8], ['a_uv', 2, 12]] as const) {
      const location = gl.getAttribLocation(this.program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, count, gl.FLOAT, false, 20, offset);
    }
    for (const name of ['viewport', 'center', 'size', 'fit', 'dpr', 'alpha', 'belt', 'aperture', 'inset']) this.uniforms[name] = gl.getUniformLocation(this.program, `u_${name}`);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  begin(width: number, height: number, center: number) {
    const gl = this.gl;
    this.width = width; this.height = height; this.center = center;
    const overscan = 64, renderHeight = height + overscan * 2;
    this.canvas.style.top = `${-overscan}px`;
    this.canvas.style.height = `${renderHeight}px`;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width*this.dpr) || this.canvas.height !== Math.round(renderHeight*this.dpr)) {
      this.canvas.width = Math.round(width*this.dpr); this.canvas.height = Math.round(renderHeight*this.dpr);
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.uniforms.viewport, width, renderHeight);
    gl.uniform1f(this.uniforms.inset, overscan);
    gl.uniform1f(this.uniforms.center, center + overscan);
    gl.uniform1f(this.uniforms.dpr, this.dpr);
    this.frame++; this.draws = 0;
  }

  draw(img: HTMLImageElement, left: number, width: number, shift = 0, curved = true, belt = false, aperture = 0) {
    if (!img.complete || !img.naturalWidth) return false;
    const gl = this.gl, height = width * 9 / 16;
    if (this.center + shift + height < 0 || this.center + shift - height > this.height) return false;
    const key = img.currentSrc || img.src;
    let cached = this.textures.get(key);
    if (!cached) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      cached = { texture, used: this.frame, bytes: img.naturalWidth * img.naturalHeight * 4 }; this.textures.set(key, cached);
      this.textureBytes += cached.bytes;
    }
    cached.used = this.frame;
    gl.bindTexture(gl.TEXTURE_2D, cached.texture);
    const cardCenter = left + width / 2 - this.width / 2;
    for (let i = 0; i <= 128; i++) {
      const u = i / 128, s = left + u*width - this.width/2;
      for (let row = 0; row < 2; row++) {
        const localY = (row-.5)*height;
        const [x, y] = curved ? galleryWarpPoint(s, localY, cardCenter, width, this.width, this.restrained) : [s, localY];
        const offset = (i*2+row)*5;
        this.vertices[offset] = x; this.vertices[offset+1] = shift+y;
        this.vertices[offset+2] = shift+localY; this.vertices[offset+3] = u; this.vertices[offset+4] = row;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
    const fitWidth = Math.min(width, height*img.naturalWidth/img.naturalHeight);
    gl.uniform2f(this.uniforms.size, width, height);
    gl.uniform2f(this.uniforms.fit, fitWidth/width, fitWidth*img.naturalHeight/img.naturalWidth/height);
    const side = Math.min(1, Math.abs(cardCenter) / width);
    const alpha = this.restrained && !belt ? 1 - .18 * side * side * (3 - 2 * side) : 1;
    gl.uniform1f(this.uniforms.alpha, alpha); gl.uniform1f(this.uniforms.belt, belt ? 1 : 0); gl.uniform1f(this.uniforms.aperture, aperture);
    gl.drawElements(gl.TRIANGLES, 128*6, gl.UNSIGNED_SHORT, 0);
    this.draws++;
    return true;
  }

  end() {
    // Covers + a few neighboring pages; avoid accumulating every deck on the GPU.
    if (this.textures.size > 24 || this.textureBytes > 64 * 1024 * 1024) {
      const oldest = [...this.textures].sort((a,b) => a[1].used-b[1].used);
      for (const [key, value] of oldest) {
        if ((this.textures.size <= 24 && this.textureBytes <= 64 * 1024 * 1024) || value.used === this.frame) break;
        this.gl.deleteTexture(value.texture); this.textureBytes -= value.bytes; this.textures.delete(key);
      }
    }
  }

  destroy() {
    for (const value of this.textures.values()) this.gl.deleteTexture(value.texture);
    this.textures.clear(); this.gl.deleteBuffer(this.buffer); this.gl.deleteBuffer(this.indices); this.gl.deleteProgram(this.program);
  }
}
