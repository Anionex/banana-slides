import { describe, expect, it } from 'vitest';
import { GalleryMotion, modulo } from './galleryMotion';
import { galleryWarpPoint } from './gallerySurface';

describe('gallery simulated curve', () => {
  it('keeps the restrained showcase center unchanged and neighbors smaller', () => {
    for (const viewport of [390, 1272]) {
      const width = viewport < 768 ? viewport * .74 : 460;
      for (const x of [-width / 2, 0, width / 2]) {
        expect(galleryWarpPoint(x, 100, 0, width, viewport, true)).toEqual([x, 100]);
      }
      const center = width + 24;
      const left = galleryWarpPoint(center - width / 2, 100, center, width, viewport, true);
      const right = galleryWarpPoint(center + width / 2, 100, center, width, viewport, true);
      expect(right[0] - left[0]).toBeCloseTo(width * .9);
      expect(galleryWarpPoint(viewport / 2, 100, center, width, viewport, true)[1]).toBeLessThan(100);
      const mirrored = galleryWarpPoint(-center + width / 2, -100, -center, width, viewport, true);
      expect(mirrored[0]).toBeCloseTo(-left[0]);
      expect(mirrored[1]).toBeCloseTo(-left[1]);
    }
  });
  it('keeps the centered cover flat and the original side silhouette', () => {
    for (const x of [-216, 0, 216]) expect(galleryWarpPoint(x, 121.5, 0, 432, 1272)).toEqual([x, 121.5]);
    expect(galleryWarpPoint(636, 100, 460, 432, 1272)).toEqual([636, 155]);
    expect(galleryWarpPoint(195, 100, 310, 304, 390)).toEqual([195, 120]);
  });
  it('preserves horizontal widths at every point throughout dragging', () => {
    for (const viewport of [390, 768, 1272, 2560]) {
      const width = viewport < 768 ? viewport * .78 : 432;
      for (let center = -viewport; center <= viewport; center += 5) {
        const left = galleryWarpPoint(center-width/2, 100, center, width, viewport);
        const right = galleryWarpPoint(center+width/2, 100, center, width, viewport);
        expect(right[0]-left[0]).toBeCloseTo(width, 8);
        expect(Number.isFinite(left[1]) && Number.isFinite(right[1])).toBe(true);
      }
    }
  });
  it('bends immediately with smooth departure, reversal and arrival', () => {
    const edge = (center: number) => galleryWarpPoint(216+center, 121.5, center, 432, 1272)[1];
    expect(edge(.1)).toBeGreaterThan(edge(0));
    for (const center of [-432, 0, 432]) {
      const h=.001, before=(edge(center)-edge(center-h))/h, after=(edge(center+h)-edge(center))/h;
      expect(Math.abs(after-before)).toBeLessThan(.00001);
    }
    for (const center of [1, 50, 300, 600]) {
      const left=galleryWarpPoint(-216-center, -121.5, -center, 432, 1272);
      const right=galleryWarpPoint(216+center, 121.5, center, 432, 1272);
      expect(left[0]).toBe(-right[0]); expect(left[1]).toBe(-right[1]);
    }
  });
});

describe('gallery inertial axis', () => {
  const release=()=>{const m=new GalleryMotion(480);m.begin(0);for(let t=16;t<=160;t+=16)m.drag(t*2,t);m.release(160);return m;};
  it('coasts then captures only while decelerating below 30px/s', () => {
    const m=release();expect(m.position).toBe(320);expect(m.phase).toBe('coast');let snap=false;
    for(let t=176;t<5000;t+=16){const prior=m.velocity,phase=m.phase;m.tick(.016,t);if(phase==='coast'&&m.phase==='snap'){expect(Math.abs(m.velocity)).toBeLessThanOrEqual(30);expect(Math.abs(m.velocity)).toBeLessThan(Math.abs(prior));snap=true;}}
    expect(snap).toBe(true);expect(m.phase).toBe('idle');expect(modulo(m.position,480)).toBe(0);
  });
  it('is frame-rate independent at 60 and 120Hz', () => {
    const a=release(),b=release();for(let i=1;i<=60;i++)a.tick(1/60,160+i*1000/60);for(let i=1;i<=120;i++)b.tick(1/120,160+i*1000/120);
    expect(a.position).toBeCloseTo(b.position,8);expect(a.velocity).toBeCloseTo(b.velocity,8);
  });
  it('interrupts without a position jump and accepts immediate reversal', () => {
    const m=release();m.tick(.016,176);const p=m.position;m.begin(180);expect(m.position).toBe(p);m.drag(p-50,200);expect(m.position).toBe(p-50);expect(m.velocity).toBeLessThan(0);m.release(400);expect(m.velocity).toBe(0);
  });
  it('captures a slow release promptly and settles within one second', () => {
    const m = new GalleryMotion(480);
    m.position = 380; m.velocity = 25; m.phase = 'coast';
    m.tick(.016, 16);
    expect(m.phase).toBe('snap');
    for (let t = 32; t <= 1000; t += 16) m.tick(.016, t);
    expect(m.phase).toBe('idle');
    expect(m.position).toBe(480);
  });
  it('keeps velocity at capture and converges without oscillation from rest', () => {
    const m=new GalleryMotion(480);m.position=100;m.velocity=2;m.phase='coast';m.tick(.016,16);expect(m.phase).toBe('snap');expect(m.velocity).toBeGreaterThan(0);
    m.jump(100);m.snap(480);let last=100;for(let i=0;i<200;i++){m.tick(.016,i*16);expect(m.position).toBeGreaterThanOrEqual(last);expect(m.position).toBeLessThanOrEqual(480);last=m.position;}expect(m.phase).toBe('idle');
  });
  it('smooths wheel notches and hands their actual velocity to inertia', () => {
    const m=new GalleryMotion(480);m.wheel(100,0);m.tick(.016,16);expect(m.position).toBeGreaterThan(0);expect(m.position).toBeLessThan(15);
    for(let t=32;t<=80;t+=16)m.tick(.016,t);const prior=m.velocity;m.tick(.016,96);expect(m.phase).toBe('coast');expect(m.velocity).toBeCloseTo(prior*Math.exp(-4.2*.016),8);
  });
  it('wraps equivalent copies without changing velocity or spacing', () => {
    const cycle=480*12;for(const p of [-cycle-.1,-.1,0,cycle-.1,cycle,cycle+.1,cycle*1000+.1]){expect(modulo(p,cycle)).toBeGreaterThanOrEqual(0);expect(modulo(p,cycle)).toBeLessThan(cycle);expect(modulo(p+cycle,cycle)).toBeCloseTo(modulo(p,cycle),6);}
  });
});
