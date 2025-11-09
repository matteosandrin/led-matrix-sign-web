/**
 * WebGL LED Matrix Renderer
 *
 * Takes a source canvas (160x32) and renders it with realistic LED matrix effects:
 * - Circular LED dots with smooth edges
 * - Glow/bloom around bright pixels
 * - Physical separation between LEDs
 * - Adjustable scaling and parameters
 */

export interface LEDShaderParams {
  ledSize: number;        // Size of LED relative to cell (0-1, default 0.75)
  glowIntensity: number;  // Strength of glow effect (0-2, default 0.8)
  glowRadius: number;     // Radius of glow in pixels (default 2.5)
  separationGap: number;  // Gap between LEDs (0-1, default 0.25)
}

const DEFAULT_PARAMS: LEDShaderParams = {
  ledSize: 0.85,
  glowIntensity: 0.3,
  glowRadius: 1.5,
  separationGap: 0.15,
};

export class WebGLLEDRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private sourceTexture: WebGLTexture | null = null;

  // Shader locations
  private locations: {
    position?: number;
    texCoord?: number;
    uSourceTexture?: WebGLUniformLocation | null;
    uSourceSize?: WebGLUniformLocation | null;
    uDisplaySize?: WebGLUniformLocation | null;
    uLEDSize?: WebGLUniformLocation | null;
    uGlowIntensity?: WebGLUniformLocation | null;
    uGlowRadius?: WebGLUniformLocation | null;
    uSeparationGap?: WebGLUniformLocation | null;
  } = {};

  private params: LEDShaderParams;

  constructor(
    private displayCanvas: HTMLCanvasElement,
    private sourceWidth: number,
    private sourceHeight: number,
    params: Partial<LEDShaderParams> = {}
  ) {
    this.params = { ...DEFAULT_PARAMS, ...params };

    const gl = displayCanvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    this.initShaders();
    this.initGeometry();
    this.initTexture();
  }

  private initShaders(): void {
    const gl = this.gl;

    // Vertex shader - simple full-screen quad
    const vertexShaderSource = `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
      }
    `;

    // Fragment shader - LED matrix effect
    const fragmentShaderSource = `
      precision mediump float;

      uniform sampler2D uSourceTexture;
      uniform vec2 uSourceSize;      // Source texture size (160x32)
      uniform vec2 uDisplaySize;     // Display size (640x128)
      uniform float uLEDSize;        // LED size relative to cell (0-1)
      uniform float uGlowIntensity;  // Glow strength
      uniform float uGlowRadius;     // Glow radius in source pixels
      uniform float uSeparationGap;  // Gap between LEDs (0-1)

      varying vec2 vTexCoord;

      // Calculate distance from point to nearest LED center
      float getDistanceToLED(vec2 sourceCoord) {
        vec2 ledCoord = sourceCoord * uSourceSize;
        vec2 ledCell = floor(ledCoord);
        vec2 ledCenter = ledCell + 0.5;
        vec2 delta = ledCoord - ledCenter;
        return length(delta);
      }

      // Smooth circle falloff for LED shape - very tight transition for sharp, HD appearance
      float ledShape(float dist, float radius) {
        // Use a very tight smoothstep for crisp, high-definition LEDs
        return smoothstep(radius + 0.05, radius - 0.05, dist);
      }

      // Gaussian blur approximation for glow
      vec3 sampleGlow(vec2 sourceCoord, float radius) {
        vec3 glow = vec3(0.0);
        float totalWeight = 0.0;

        // Sample in a cross pattern for performance
        int samples = 8;
        for (int i = -4; i <= 4; i++) {
          if (i == 0) continue;

          float offset = float(i) * 0.25;
          vec2 sampleCoord1 = sourceCoord + vec2(offset / uSourceSize.x, 0.0);
          vec2 sampleCoord2 = sourceCoord + vec2(0.0, offset / uSourceSize.y);

          float weight = exp(-abs(offset) / radius);

          glow += texture2D(uSourceTexture, sampleCoord1).rgb * weight;
          glow += texture2D(uSourceTexture, sampleCoord2).rgb * weight;
          totalWeight += weight * 2.0;
        }

        return glow / max(totalWeight, 0.001);
      }

      void main() {
        vec2 sourceCoord = vTexCoord;

        // Get distance from nearest LED center
        float distToLED = getDistanceToLED(sourceCoord);

        // Sample the source color at LED center
        vec2 ledCell = floor(sourceCoord * uSourceSize);
        vec2 ledCenterUV = (ledCell + 0.5) / uSourceSize;
        vec3 ledColor = texture2D(uSourceTexture, ledCenterUV).rgb;

        // LED base shape with separation gap
        float ledRadius = (0.5 - uSeparationGap * 0.5) * uLEDSize;
        float ledMask = ledShape(distToLED, ledRadius);

        // Apply LED color with shape mask
        vec3 color = ledColor * ledMask;

        // Add glow/bloom effect
        if (uGlowIntensity > 0.0) {
          vec3 glow = sampleGlow(sourceCoord, uGlowRadius);
          float brightness = dot(glow, vec3(0.299, 0.587, 0.114));
          color += glow * uGlowIntensity * brightness;
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Link program
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error('Failed to link program: ' + info);
    }

    this.program = program;
    gl.useProgram(program);

    // Get attribute and uniform locations
    this.locations = {
      position: gl.getAttribLocation(program, 'aPosition'),
      texCoord: gl.getAttribLocation(program, 'aTexCoord'),
      uSourceTexture: gl.getUniformLocation(program, 'uSourceTexture'),
      uSourceSize: gl.getUniformLocation(program, 'uSourceSize'),
      uDisplaySize: gl.getUniformLocation(program, 'uDisplaySize'),
      uLEDSize: gl.getUniformLocation(program, 'uLEDSize'),
      uGlowIntensity: gl.getUniformLocation(program, 'uGlowIntensity'),
      uGlowRadius: gl.getUniformLocation(program, 'uGlowRadius'),
      uSeparationGap: gl.getUniformLocation(program, 'uSeparationGap'),
    };
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Failed to compile shader: ' + info);
    }

    return shader;
  }

  private initGeometry(): void {
    const gl = this.gl;

    // Full-screen quad (two triangles)
    const vertices = new Float32Array([
      // Position (x, y)  TexCoord (u, v)
      -1, -1,             0, 1,  // Bottom-left
       1, -1,             1, 1,  // Bottom-right
      -1,  1,             0, 0,  // Top-left
       1,  1,             1, 0,  // Top-right
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Setup attributes
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;

    if (this.locations.position !== undefined) {
      gl.enableVertexAttribArray(this.locations.position);
      gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, stride, 0);
    }

    if (this.locations.texCoord !== undefined) {
      gl.enableVertexAttribArray(this.locations.texCoord);
      gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    }
  }

  private initTexture(): void {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) throw new Error('Failed to create texture');

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use nearest-neighbor filtering for crisp pixels
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.sourceTexture = texture;
  }

  /**
   * Update shader parameters
   */
  setParams(params: Partial<LEDShaderParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Render the LED matrix effect from source canvas
   */
  render(sourceCanvas: HTMLCanvasElement): void {
    const gl = this.gl;

    if (!this.program || !this.sourceTexture) return;

    // Update texture from source canvas
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

    // Set uniforms
    gl.uniform1i(this.locations.uSourceTexture!, 0);
    gl.uniform2f(this.locations.uSourceSize!, this.sourceWidth, this.sourceHeight);
    gl.uniform2f(this.locations.uDisplaySize!, this.displayCanvas.width, this.displayCanvas.height);
    gl.uniform1f(this.locations.uLEDSize!, this.params.ledSize);
    gl.uniform1f(this.locations.uGlowIntensity!, this.params.glowIntensity);
    gl.uniform1f(this.locations.uGlowRadius!, this.params.glowRadius);
    gl.uniform1f(this.locations.uSeparationGap!, this.params.separationGap);

    // Set viewport and clear
    gl.viewport(0, 0, this.displayCanvas.width, this.displayCanvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Clean up WebGL resources
   */
  destroy(): void {
    const gl = this.gl;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }

    if (this.sourceTexture) {
      gl.deleteTexture(this.sourceTexture);
      this.sourceTexture = null;
    }
  }
}
