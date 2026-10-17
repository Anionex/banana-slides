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
    const reset = async (deck, reading) => {
      await p.goto(origin + '/en/gallery/?deck=' + deck);
      await p.waitForTimeout(300);
      if (reading) { await p.locator('.gallery-cover[aria-pressed="true"]').click(); await p.waitForTimeout(200); }
    };
    for (const deck of ['money', 'ecology', 'software']) {
      for (const reading of [false, true]) {
        for (const region of ['side', 'blank', 'gap', 'center', ...(reading ? ['upper', 'lower'] : [])]) {
          await reset(deck, reading);
          const cover = await p.locator('.gallery-cover[aria-pressed="true"]').boundingBox();
          const track = await p.locator('.gallery-track').boundingBox();
          const x = ['side', 'blank'].includes(region) ? 1260 : cover.x + cover.width / 2;
          const y = region === 'blank' ? track.y + track.height - 25 : region === 'gap' ? cover.y + cover.height + 8 : region === 'upper' ? cover.y - 20 : region === 'lower' ? cover.y + cover.height + 30 : cover.y + cover.height / 2;
          const inside = ['center', 'upper', 'lower'].includes(region);
          const documentY = await p.evaluate(() => scrollY);
          await p.mouse.move(x, y); await p.mouse.wheel(0, 100); await p.waitForTimeout(220);
          const moved = await p.evaluate(() => scrollY) - documentY;
          const position = await p.evaluate(() => Number(document.querySelector('.gallery-wheel-viewport')?.getAttribute('data-position') || 0));
          assert(inside ? moved === 0 : moved > 0, deck + ': ' + reading + '/' + region + ' routed wheel input incorrectly');
          if (inside) assert(reading ? position > .01 : await p.locator('.gallery-wheel').count() === 1, 'Wheel over the actual page must advance it');
          else assert(position === 0, 'Outside input must not advance the deck');
          wheelRegions.push({ deck, reading, region, documentMoved: moved });
        }
      }
    }
    const movingBounds = [];
    for (const reading of [false, true]) {
      await reset('money', reading);
      const before = await p.locator('.gallery-cover[aria-pressed="true"]').boundingBox();
      await p.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await p.mouse.down();
      await p.mouse.move(before.x + before.width / 2 - 200, before.y + before.height / 2, { steps: 6 });
      await p.waitForTimeout(80);
      const after = await p.locator('.gallery-cover[aria-pressed="true"]').boundingBox();
      assert(after.x < before.x - 190, 'Slide must move with horizontal dragging');
      // Dispatch at fixed coordinates without moving the held pointer (which would drag again).
      const hit = await p.evaluate(({ before, after }) => {
        const stage = document.querySelector('.gallery-stage');
        const probe = x => {
          const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 30, clientX: x, clientY: after.y + after.height / 2 });
          stage.dispatchEvent(event); return event.defaultPrevented;
        };
        return { oldArea: probe(before.x + before.width - 20), newArea: probe(after.x + 20) };
      }, { before, after });
      assert(!hit.oldArea && hit.newArea, 'Wheel ownership must follow the moving slide, not its original center');
      movingBounds.push({ reading, shift: after.x - before.x, ...hit });
      await p.mouse.up();
    }
    return { wheelRegions, movingBounds, status: 'passed', longestPauseMs: longestPause, maxDrawsPerFrame: maxDraws, snapSpeed: snap.speed, start, forward, backward };
  } finally { await context.close(); }
}
