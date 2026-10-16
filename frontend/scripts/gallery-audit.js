// Open the built site first, then run with playwright-cli run-code --filename.
async (page) => {
  const origin = new URL(page.url()).origin;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const context = await page.context().browser().newContext({viewport:{width:1440,height:1000},locale:'zh-CN',colorScheme:'light'});
  const p = await context.newPage();
  const errors = [], requests = [], results = {interactions:[],layouts:[],assets:0};
  p.on('pageerror',error=>errors.push(error.message));
  p.on('request',request=>requests.push(request.url()));
  const settled = async (id) => {
    await p.waitForFunction(id=>location.search.includes(`deck=${id}`),id);
    await p.waitForFunction(()=>{
      const track=document.querySelector('.gallery-track');
      const active=track.querySelector('[aria-pressed="true"]');
      return Math.abs(active.offsetLeft+active.offsetWidth/2-track.scrollLeft-track.clientWidth/2)<2;
    });
    // Scroll-end callback also synchronizes the reading pane.
    await p.waitForTimeout(220);
  };
  const capture = async (name) => {
    await p.evaluate(()=>document.fonts.ready);
    await p.waitForFunction(()=>Array.from(document.querySelectorAll('.gallery-cover img')).every(img=>img.complete&&img.naturalWidth));
    await p.waitForFunction(()=>Array.from(document.querySelectorAll('.gallery-slides img')).filter(img=>{const r=img.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).every(img=>img.complete&&img.naturalWidth));
    await p.waitForTimeout(400);
    await p.screenshot({path:`.impeccable/review/${name}.png`});
    const layout=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight}));
    assert(layout.scroll<=layout.width,`${name}: horizontal document overflow`);
    results.layouts.push({name,...layout});
  };
  try {
    await p.goto(origin+'/gallery/');
    await settled('money');
    await capture('desktop');
    assert(!requests.some(url=>/\/api\/(config|access|projects)/.test(url)), 'Gallery must not bootstrap the editor');
    await p.getByRole('button',{name:'下一个作品',exact:true}).click(); await settled('deepseek-tech');
    assert(await p.locator('.gallery-slides figure').count()===16,'Next updates full deck');
    await p.getByRole('button',{name:'上一个作品',exact:true}).click(); await settled('money');
    await p.getByRole('button',{name:'上一个作品',exact:true}).click(); await settled('gen-z');
    await p.getByRole('button',{name:'下一个作品',exact:true}).click(); await settled('money');
    results.interactions.push('buttons, previous/next wrap, complete deck sync');
    await p.getByRole('region',{name:'作品画廊，左右方向键切换作品'}).focus();
    await p.keyboard.press('ArrowRight');await settled('deepseek-tech');
    await p.keyboard.press('End');await settled('gen-z');
    await p.keyboard.press('Home');await settled('money');
    results.interactions.push('keyboard arrows, Home, End');
    await p.locator('.gallery-track').hover();
    await p.mouse.wheel(566,0); await settled('deepseek-tech');
    const before=await p.evaluate(()=>scrollY);
    await p.mouse.wheel(0,450);await p.waitForFunction(before=>scrollY>before+100,before);
    assert(p.url().includes('deck=deepseek-tech'),'Vertical wheel must preserve deck');
    results.interactions.push('horizontal wheel changes deck; vertical wheel reads deck');
    await p.evaluate(()=>scrollTo(0,0));
    const box=await p.locator('.gallery-track').boundingBox();
    await p.mouse.move(box.x+box.width*.65,box.y+box.height/2);await p.mouse.down();
    await p.mouse.move(box.x+box.width*.65-566,box.y+box.height/2,{steps:20});await p.mouse.up();
    await settled('ecology');results.interactions.push('mouse drag selects next deck');
    await p.getByRole('combobox',{name:'选择作品'}).selectOption('5');await settled('xian');
    await capture('desktop-selected');
    await p.getByRole('link',{name:'向下浏览整套'}).click();
    await p.locator('.gallery-slides img').first().waitFor();
    await capture('reading');
    const ratios=await p.locator('.gallery-slides img').evaluateAll(images=>images.filter(img=>img.complete&&img.naturalWidth).map(img=>({actual:img.getBoundingClientRect().width/img.getBoundingClientRect().height,natural:img.naturalWidth/img.naturalHeight})));
    assert(ratios.every(x=>Math.abs(x.actual-x.natural)<.01),'Reading preserves slide proportions');
    await p.reload();await settled('xian');assert(await p.locator('.gallery-slides figure').count()===7,'Refresh preserves deck');
    // All image files referenced by every curated deck must decode successfully.
    const allAssets=await p.evaluate(async()=>{
      const response=await fetch('/gallery/asset-index.json');
      if(!response.ok) throw new Error('Gallery asset index unavailable');
      const urls=await response.json();
      const failed=[];
      for(let i=0;i<urls.length;i+=8) await Promise.all(urls.slice(i,i+8).map(src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>{failed.push(src);resolve();};img.src=src;})));
      return {count:urls.length,failed};
    });
    if(allAssets){assert(!allAssets.failed.length,'Broken gallery assets: '+allAssets.failed);results.assets=allAssets.count;}
    await p.setViewportSize({width:390,height:844});await p.goto(origin+'/gallery/?deck=xian');await settled('xian');await capture('mobile');
    await p.goto(origin+'/en/gallery/?deck=saas');await settled('saas');
    assert(await p.locator('h1').textContent()==='Every idea has a look of its own.','English deep route');
    await p.getByRole('button',{name:'Dark theme',exact:true}).click();await capture('mobile-dark');
    await p.emulateMedia({reducedMotion:'reduce'});await p.getByRole('button',{name:'Next presentation',exact:true}).click();await settled('quantum');
    results.interactions.push('mobile layout, English route, dark theme, reduced motion');
    await p.route('**/gallery/quantum/1.webp',route=>route.abort());await p.reload();
    await p.getByRole('link',{name:'Explore the full deck'}).click();
    await p.getByRole('button',{name:'Retry',exact:true}).waitFor();
    await p.unroute('**/gallery/quantum/1.webp');await p.getByRole('button',{name:'Retry',exact:true}).click();
    await p.waitForFunction(()=>{const img=document.querySelector('.gallery-slides img');return img&&img.complete&&img.naturalWidth>0;});
    results.interactions.push('image failure and retry');
    const fallback=await context.newPage();
    await fallback.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
    await fallback.goto(origin+'/gallery/');
    assert(await fallback.locator('.gallery-cover img').nth(1).evaluate(img=>getComputedStyle(img).opacity)==='1','No-canvas cover fallback');
    await fallback.close();
    // Real touch gestures through Chromium's input path, not synthetic DOM events.
    const touchContext=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-CN'});
    const touch=await touchContext.newPage();await touch.goto(origin+'/gallery/?deck=money');
    await touch.locator('.gallery-cover[aria-pressed="true"]').waitFor();
    const session=await touchContext.newCDPSession(touch);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:400}]});
    for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:320-i*28,y:400}]});await touch.waitForTimeout(20);}
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.waitForFunction(()=>location.search.includes('deepseek-tech'));
    await touch.waitForTimeout(350);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:460}]});
    for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:460-i*35}]});await touch.waitForTimeout(20);}
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.waitForFunction(()=>scrollY>100);
    assert(touch.url().includes('deepseek-tech'),'Vertical swipe preserves deck');
    await touchContext.close();results.interactions.push('mobile horizontal swipe then vertical reading swipe');
    await p.goto(origin+'/');
    assert(await p.locator('a[href="/en/gallery/"]').count()>0 || await p.locator('a[href="/gallery/"]').count()>0,'Homepage gallery links');
    await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'.impeccable/review/home.png'});
    assert(errors.length===0,'Browser errors: '+errors.join(';'));
    return {...results,errors,status:'passed'};
  } finally {await context.close();}
}
