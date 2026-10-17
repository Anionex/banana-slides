// Open the built site first, then run with playwright-cli run-code --filename.
async (page) => {
  const origin = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const browser = page.context().browser();
  const context = await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',colorScheme:'light'});
  const p = await context.newPage();
  const errors = [], results = {interactions:[],assets:0};
  p.on('pageerror', error => errors.push(error.message));
  const settle = async (id) => {
    await p.waitForFunction(id => location.search.includes(`deck=${id}`),id);
    await p.waitForTimeout(750);
  };
  const capture = async (name) => {
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => [...document.images].filter(img => {const r=img.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).every(img=>img.complete&&img.naturalWidth));
    await p.screenshot({path:`.impeccable/review/${name}.png`});
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflows');
  };
  try {
    await p.goto(origin+'/en/gallery/?deck=money'); await settle('money');
    await capture('wheel-browse');
    assert(await p.locator('.gallery-reading').count()===0,'No separate long deck section');
    assert(await p.getByRole('button',{name:'Back to gallery',exact:true}).count()===0,'No explicit preview/return mode');
    const titleBefore = await p.locator('#gallery-title').boundingBox();
    await p.locator('.gallery-cover[aria-pressed="true"]').hover(); await p.mouse.wheel(0,100);
    await p.locator('.gallery-wheel').waitFor(); await p.waitForTimeout(850);
    assert(await p.locator('.gallery-wheel').getAttribute('data-page')==='1','First gesture rearranges without skipping cover');
    const titleAfter = await p.locator('#gallery-title').boundingBox();
    assert(Math.abs(titleAfter.y-titleBefore.y)<1,'Website heading stays visible and stable');
    assert(await p.locator('.gallery-wheel-page[data-painted="true"]').count()>=3,'Reading pages share the cover canvas');
    await capture('wheel-read');
    const restingBelt = await p.locator('.gallery-wheel-viewport').evaluate(el => {
      const next=el.querySelector('[data-slot="1"]').getBoundingClientRect(), viewport=el.getBoundingClientRect();
      return {nextVisible:(viewport.bottom-next.top)/next.height,outline:getComputedStyle(el).outlineStyle};
    });
    assert(Math.abs(restingBelt.nextVisible-.5)<.02,'Next half-page remains visible while resting');
    assert(restingBelt.outline==='none','Artwork has no outer frame');
    const subtitle = await p.locator('.gallery-intro p').boundingBox();
    const current = await p.locator('.gallery-wheel-page[data-slot="0"]').boundingBox();
    assert(current.y - subtitle.y - subtitle.height <= 85, 'Main artwork stays close to subtitle');
    const scrollBefore=await p.evaluate(()=>scrollY);
    await p.locator('.gallery-wheel-viewport').hover(); await p.mouse.wheel(0,100);
    await p.waitForTimeout(1500);
    assert(Number(await p.locator('.gallery-wheel').getAttribute('data-page'))>1,'Wheel advances pages with inertia; platform wheel scaling may cross multiple pages');
    assert(await p.evaluate(()=>scrollY)===scrollBefore,'Wheel does not scroll document');
    assert(Math.abs((await p.locator('#gallery-title').boundingBox()).y-titleAfter.y)<1,'Title remains fixed during reading');
    await p.mouse.wheel(0,90); await p.waitForTimeout(40);
    const belt = await p.locator('.gallery-wheel-viewport').evaluate(el => {
      const pages=[...el.querySelectorAll('.gallery-wheel-page')];
      return {mask:getComputedStyle(el).maskImage, transforms:pages.map(page=>getComputedStyle(page).transform)};
    });
    assert(belt.mask.includes('linear-gradient')&&belt.mask.includes('rgba(0, 0, 0, 0)'),'Belt fades at both edges');
    assert(belt.transforms.every(value=>value==='none'||value.startsWith('matrix(1, 0, 0, 1,')),'Pages only translate without rotation or scaling');
    await p.screenshot({path:'.impeccable/review/wheel-motion.png'});
    await p.waitForTimeout(1500);
    await p.locator('.gallery-wheel-viewport').focus(); await p.keyboard.press('End');await p.waitForTimeout(850);
    assert(await p.locator('.gallery-wheel').getAttribute('data-page')==='8','Keyboard reaches last slide');
    await p.keyboard.press('ArrowDown');await p.waitForTimeout(850);
    assert(await p.locator('.gallery-wheel').getAttribute('data-page')==='1','Last slide wraps to first');
    await p.keyboard.press('ArrowUp');await p.waitForTimeout(850);
    assert(await p.locator('.gallery-wheel').getAttribute('data-page')==='8','First slide wraps backward to last');
    assert(await p.evaluate(()=>scrollY)===scrollBefore,'Ring gestures do not move document');
    // Track the pointer continuously, then snap after release while the outgoing pages rewind.
    const box=await p.locator('.gallery-wheel-viewport').boundingBox();
    await p.mouse.move(box.x+box.width*.65,box.y+box.height/2);await p.mouse.down();
    await p.mouse.move(box.x+box.width*.65-40,box.y+box.height/2,{steps:5});
    await p.waitForTimeout(60);
    const drag40=await p.locator('.gallery-wheel-viewport').boundingBox();
    assert(Math.abs(drag40.x-box.x+40)<3,'Reading card follows 40px of drag immediately');
    await p.mouse.move(box.x+box.width*.65-120,box.y+box.height/2,{steps:8});
    await p.waitForTimeout(60);
    const drag120=await p.locator('.gallery-wheel-viewport').boundingBox();
    assert(Math.abs(drag120.x-box.x+120)<3,'Reading card follows full drag distance continuously');
    await p.mouse.up();await settle('deepseek-tech');
    assert(await p.locator('.gallery-wheel').count()===0,'Horizontal drag returns to carousel without an exit action');
    results.interactions.push('stable website heading and subtitle, flat ring pages, two-edge fade, inertia, keyboard wrap, continuous pointer-following drag and release snap');
    await p.getByRole('button',{name:'Previous presentation',exact:true}).click();await settle('money');
    await p.locator('.gallery-cover[aria-pressed="true"]').click();await p.waitForTimeout(800);
    assert(await p.locator('.gallery-wheel').getAttribute('data-page')==='1','Returning to deck starts at cover');
    await p.locator('.gallery-wheel-viewport').hover();await p.mouse.wheel(200,0);await settle('deepseek-tech');
    assert(await p.locator('.gallery-wheel').count()===0,'Horizontal wheel returns to carousel');
    await p.getByRole('button',{name:'Previous presentation',exact:true}).click();await settle('money');
    await p.getByRole('button',{name:'Previous presentation',exact:true}).click();await settle('gen-z');
    await p.getByRole('button',{name:'Next presentation',exact:true}).click();await settle('money');
    await p.getByRole('button',{name:'Next presentation',exact:true}).click();await settle('deepseek-tech');await p.getByRole('button',{name:'Next presentation',exact:true}).click();await settle('ecology');await p.reload();await settle('ecology');
    results.interactions.push('cover click, horizontal wheel, cover reset, wrapping, refresh');
    const assets=await p.evaluate(async()=>{
      const urls=await (await fetch('/gallery/asset-index.json')).json(),failed=[];
      for(let i=0;i<urls.length;i+=8) await Promise.all(urls.slice(i,i+8).map(src=>new Promise(resolve=>{const img=new Image();img.onload=resolve;img.onerror=()=>{failed.push(src);resolve();};img.src=src;})));
      return {count:urls.length,failed};
    });
    assert(!assets.failed.length,'Broken assets: '+assets.failed);results.assets=assets.count;
    await p.setViewportSize({width:390,height:844});await p.goto(origin+'/en/gallery/?deck=money');await settle('money');await capture('wheel-mobile');
    await p.locator('.gallery-cover[aria-pressed="true"]').click();await p.waitForTimeout(850);await capture('wheel-mobile-read');
    await p.getByRole('button',{name:'Dark theme',exact:true}).click();await p.waitForTimeout(350);await capture('wheel-mobile-dark');
    await p.emulateMedia({reducedMotion:'reduce'});await p.getByRole('button',{name:'Next slide',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('.gallery-wheel')?.dataset.page==='2');
    await p.locator('.gallery-wheel-viewport').focus();await p.keyboard.press('Escape');
    await p.route('**/gallery/money/1.webp',route=>route.abort());await p.reload();await settle('money');
    await p.locator('.gallery-cover[aria-pressed="true"]').click();
    await p.getByRole('button',{name:'Retry',exact:true}).waitFor();await p.unroute('**/gallery/money/1.webp');await p.getByRole('button',{name:'Retry',exact:true}).click();
    await p.waitForFunction(()=>{const img=document.querySelector('.gallery-wheel-page:not([aria-hidden="true"]) img');return img?.complete&&img.naturalWidth>0;});
    results.interactions.push('mobile, dark theme, reduced motion, image retry');
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'en-US'});
    try {
      const touch=await mobile.newPage();await touch.goto(origin+'/en/gallery/?deck=money');await touch.waitForTimeout(800);
      const session=await mobile.newCDPSession(touch);
      const swipe=async(dx,dy,selector)=>{
        const b=await touch.locator(selector).boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2+Math.max(0,-dy/2);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/10,y:y+dy*i/10}]});await touch.waitForTimeout(18);}
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(800);
      };
      await swipe(0,-100,'.gallery-cover[aria-pressed="true"]');
      assert(await touch.locator('.gallery-wheel').count()===1,'Vertical swipe starts in-place scroll');
      const scroll=await touch.evaluate(()=>scrollY);
      await swipe(0,-140,'.gallery-wheel-viewport');
      assert(Number(await touch.locator('.gallery-wheel').getAttribute('data-page'))>1,'Touch advances pages');
      assert(await touch.evaluate(()=>scrollY)===scroll,'Touch does not scroll document');
      await swipe(-130,0,'.gallery-wheel-viewport');
      assert(touch.url().includes('deepseek-tech'),'Touch horizontal switches deck');
      assert(await touch.locator('.gallery-wheel').count()===0,'Touch restores cover carousel');
      results.interactions.push('real touch vertical reading and horizontal return');
    } finally {await mobile.close();}
    const fallback=await context.newPage();await fallback.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});await fallback.goto(origin+'/en/gallery/');
    assert(await fallback.locator('.gallery-cover img').nth(1).evaluate(img=>getComputedStyle(img).opacity)==='1','Canvas fallback');await fallback.close();
    assert(!errors.length,'Browser errors: '+errors.join(';'));
    return {...results,errors,status:'passed'};
  } finally {await context.close();}
}
