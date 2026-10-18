// Run against the built gallery using playwright-cli run-code --filename.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 800 } });
  const p = await context.newPage();
  const assert = (value, message) => { if (!value) throw Error(message); };
  const results = [];
  const nearest = () => p.evaluate(() => Array.from(document.querySelectorAll('.gallery-cover')).map(button => {
    const rect = button.getBoundingClientRect();
    return { deck: button.dataset.deck, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }).sort((a, b) => Math.abs(a.x + a.width / 2 - innerWidth / 2) - Math.abs(b.x + b.width / 2 - innerWidth / 2))[0]);
  const state = () => p.evaluate(() => ({
    position: Number(document.querySelector('.gallery-wheel-viewport')?.getAttribute('data-position') || 0),
    phase: document.querySelector('.gallery-stage').dataset.motion,
    horizontal: document.querySelector('.gallery-stage').dataset.horizontal,
    deck: new URLSearchParams(location.search).get('deck'), y: scrollY,
  }));
  try {
    for (const mode of ['first-wheel', 'arrow', 'drag']) {
      for (const reading of mode === 'first-wheel' ? [false] : [false, true]) {
        await p.goto(origin + '/en/gallery/?deck=money'); await p.waitForTimeout(300);
        if (reading) await p.locator('.gallery-cover[aria-pressed="true"]').click();
        if (mode === 'arrow') {
          await p.getByRole('button', { name: 'Next presentation', exact: true }).click();
          await p.waitForTimeout(350);
        } else if (mode === 'drag') {
          const start = await nearest();
          await p.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
          await p.mouse.down();
          await p.mouse.move(start.x + start.width / 2 - start.width - 26, start.y + start.height / 2, { steps: 12 });
          await p.waitForTimeout(110); await p.mouse.up();
        }
        const cover = await nearest(), before = await state();
        if (mode === 'arrow') assert(before.phase === 'snap', 'Exercise the horizontal settling tail, before idle');
        if (mode !== 'first-wheel') assert(cover.deck !== 'money', 'New work must be under the pointer');
        await p.mouse.move(cover.x + cover.width / 2, cover.y + cover.height / 2);
        await p.mouse.wheel(0, 100); await p.waitForTimeout(90);
        const immediate = await state();
        assert(immediate.position > .01, mode + ': the first wheel notch must advance pages immediately');
        assert(immediate.deck === cover.deck, mode + ': vertical input must select the work currently displayed');
        assert(immediate.y === before.y, mode + ': input over the slide must not scroll the document');
        await p.waitForTimeout(1300);
        const settled = await state();
        assert(settled.position > .5 && settled.deck === cover.deck, 'Finishing the horizontal settle must not reset the vertical gesture');
        if (mode === 'first-wheel') {
          await p.waitForTimeout(2200);
          const beforePreference = await state();
          await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(100);
          assert(Math.abs((await state()).position - beforePreference.position) < .001, 'Changing motion preference must not replay the first wheel delta');
          await p.emulateMedia({ reducedMotion: 'no-preference' });
        }
        results.push({ mode, reading, before, immediate, settled });
      }
    }
    return { status: 'passed', results };
  } finally { await context.close(); }
}
