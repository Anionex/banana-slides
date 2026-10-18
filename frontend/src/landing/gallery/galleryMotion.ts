/** One continuous axis for pointer, wheel, free inertia and low-speed capture. */
export class GalleryMotion {
  position = 0;
  velocity = 0;
  phase: 'idle' | 'drag' | 'wheel' | 'coast' | 'snap' = 'idle';
  target = 0;
  lastInput = 0;
  private lastPointer = 0;
  private snapSpeed = 3; // CSS pixels/second; never capture a fast release.

  constructor(public step: number) {}

  jump(position: number) {
    this.position = this.target = position;
    this.velocity = 0;
    this.phase = 'idle';
  }

  begin(time: number) {
    this.phase = 'drag';
    this.velocity = 0;
    this.lastPointer = this.lastInput = time;
  }

  drag(position: number, time: number) {
    const dt = Math.max(.001, (time - this.lastPointer) / 1000);
    const observed = (position - this.position) / dt;
    const weight = 1 - Math.exp(-dt / .035);
    this.velocity += (observed - this.velocity) * weight;
    this.position = position;
    this.lastPointer = this.lastInput = time;
  }

  release(time: number) {
    if (time - this.lastInput > 90) this.velocity = 0;
    this.phase = 'coast';
  }

  wheel(delta: number, time: number) {
    if (this.phase !== 'wheel') this.target = this.position;
    this.target += delta;
    this.lastInput = time;
    this.phase = 'wheel';
  }

  snap(target = Math.round(this.position / this.step) * this.step) {
    this.target = target;
    this.phase = 'snap';
  }

  tick(dt: number, time: number) {
    if (this.phase === 'idle' || this.phase === 'drag') return;
    if (this.phase === 'wheel' && time - this.lastInput >= 90) this.phase = 'coast';
    if (this.phase === 'coast') {
      const decay = Math.exp(-4.2 * dt);
      this.position += this.velocity * (1 - decay) / 4.2;
      const nextSpeed = this.velocity * decay;
      const decelerating = Math.abs(nextSpeed) <= Math.abs(this.velocity);
      this.velocity = nextSpeed;
      if (decelerating && Math.abs(nextSpeed) <= this.snapSpeed) this.snap();
      return;
    }
    // Closed-form critically damped spring: frame-rate independent, no overshoot
    // from rest, and velocity survives both interruption and coast-to-snap.
    const omega = this.phase === 'wheel' ? 24 : 10;
    const offset = this.position - this.target;
    const term = (this.velocity + omega * offset) * dt;
    const decay = Math.exp(-omega * dt);
    this.position = this.target + (offset + term) * decay;
    this.velocity = (this.velocity - omega * term) * decay;
    if (this.phase === 'snap' && Math.abs(this.position - this.target) < .025 && Math.abs(this.velocity) < .1) this.jump(this.target);
  }
}

export const modulo = (value: number, size: number) => ((value % size) + size) % size;
