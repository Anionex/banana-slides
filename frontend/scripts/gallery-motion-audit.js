// Run against the built gallery using playwright-cli run-code --filename.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage();
  const assert = (value, message) => { if (!value) throw Error(message); };
  try {
    await p.goto(origin + '/en/gallery/?deck=money');
    await p.locator('.gallery-cover[aria-pressed="true"]').click();
    await p.waitForTimeout(500);
    await p.locator('.gallery-wheel-viewport').hover();
    await p.evaluate(() => {
      window.galleryMotionSamples = [];
      window.galleryDrawCalls = 0;
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) { window.galleryDrawCalls++; return draw.apply(this, args); };
      const start = performance.now();
      const tick = time => {
        const viewport = document.querySelector('.gallery-wheel-viewport');
        window.galleryMotionSamples.push({ time: time - start, position: Number(viewport.dataset.position || 0), phase: viewport.dataset.motion, speed: Number(viewport.dataset.speed), draws: window.galleryDrawCalls });
        window.galleryDrawCalls = 0;
        if (time - start < 3000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(3100);
    const samples = await p.evaluate(() => window.galleryMotionSamples);
    const moving = samples.filter(s => s.position > .001);
    const first = moving[0];
    assert(first && first.position < .15, 'Wheel notch is smoothed rather than teleporting the page');
    let lastMovement = first.time, longestPause = 0;
    for (let i = 1; i < moving.length && moving[i].time < first.time + 300; i++) {
      if (moving[i].position !== moving[i - 1].position) lastMovement = moving[i].time;
      else longestPause = Math.max(longestPause, moving[i].time - lastMovement);
    }
    assert(longestPause < 40, 'Input-to-coast transition must not freeze for 100ms');
    const snap = moving.find(s => s.phase === 'snap');
    assert(snap && snap.speed <= .012, 'Snap only starts after low-speed deceleration');
    const maxDraws = Math.max(...moving.map(s => s.draws));
    assert(maxDraws < 1000, 'Flat pages must use whole-image drawing, not hundreds of slices');
    const start = Number(await p.locator('.gallery-wheel-viewport').getAttribute('data-position'));
    for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 40); await p.waitForTimeout(25); }
    await p.waitForTimeout(200);
    const forward = Number(await p.locator('.gallery-wheel-viewport').getAttribute('data-position'));
    for (let i = 0; i < 7; i++) { await p.mouse.wheel(0, -60); await p.waitForTimeout(25); }
    await p.waitForTimeout(400);
    const backward = Number(await p.locator('.gallery-wheel-viewport').getAttribute('data-position'));
    assert(forward > start && backward < forward, 'Repeated wheel input and reversal remain responsive');
    const box = await p.locator('.gallery-wheel-viewport').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + 120); await p.mouse.down();
    const held = Number(await p.locator('.gallery-wheel-viewport').getAttribute('data-position'));
    await p.waitForTimeout(120);
    assert(Math.abs(Number(await p.locator('.gallery-wheel-viewport').getAttribute('data-position')) - held) < .001, 'Pointer down interrupts wheel inertia without a competing loop');
    await p.mouse.move(box.x + box.width / 2 - 100, box.y + 120, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(900);
    assert(p.url().includes('deck=deepseek-tech'), 'Horizontal dragging can take over from wheel inertia');
    const wheelRegions = [];
    await p.setViewportSize({ width: 1440, height: 800 });
    for (const deck of ['money', 'ecology', 'software']) {
      await p.goto(origin + '/en/gallery/?deck=' + deck); await p.waitForTimeout(400);
      const track = await p.locator('.gallery-track').boundingBox();
      const cover = await p.locator('.gallery-cover[aria-pressed="true"]').boundingBox();
      const regions = [
        ['left cover', 180, cover.y + cover.height / 2],
        ['right cover', 1260, cover.y + cover.height / 2],
        ['upper fade', 720, track.y + 12],
        ['lower fade', 720, track.y + track.height - 12],
      ];
      for (const [region, x, y] of regions) {
        const documentY = await p.evaluate(() => scrollY);
        await p.mouse.move(x, y); await p.mouse.wheel(0, 40); await p.waitForTimeout(150);
        assert(await p.evaluate(() => scrollY) === documentY, deck + ': ' + region + ' leaked wheel input to the document');
        assert(await p.locator('.gallery-wheel').count() === 1, 'Side-cover wheel starts in-place reading');
        wheelRegions.push(deck + ': ' + region);
      }
      assert(Number(await p.locator('.gallery-wheel-viewport').getAttribute('data-position')) > .01, 'Wheel input over the artwork advances the active deck');
    }
    await p.mouse.move(720, 150); await p.mouse.wheel(0, 100); await p.waitForTimeout(300);
    assert(await p.evaluate(() => scrollY) > 0, 'Outside the artwork, normal page scrolling remains available');
    return { wheelRegions, status: 'passed', longestPauseMs: longestPause, maxDrawsPerFrame: maxDraws, snapSpeed: snap.speed, start, forward, backward };
  } finally { await context.close(); }
}
