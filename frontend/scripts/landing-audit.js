async (page) => {
 const assert=(condition,message)=>{if(!condition)throw new Error(message)};
 const results={layouts:[],axe:[],forms:[],seo:[],keyboard:{}};
 const browser=page.context().browser();
 const context=await browser.newContext({viewport:{width:1440,height:960},locale:'zh-CN',reducedMotion:'reduce'});
 const p=await context.newPage();
 try {
 await p.route('**/api.github.com/**',route=>route.fulfill({json:{stargazers_count:15734,forks_count:1000}}));
 const fontRequests=[];p.on('request',req=>{if(req.url().includes('.woff2'))fontRequests.push(req.url())});
 await p.goto('http://127.0.0.1:4178/?preview=accessibility-theme');
 await p.locator('.landing-theme-trigger').waitFor(); await p.evaluate(()=>document.fonts.ready);
 results.fontRequests=fontRequests;
 assert(!fontRequests.some(x=>/landing-rounded-[A-Z]/.test(x)), 'Full font loaded on first visit');
 await p.keyboard.press('Tab');results.keyboard.first=await p.locator(':focus').textContent();assert(results.keyboard.first==='跳到主要内容','Skip link must be first');
 await p.keyboard.press('Enter');assert(await p.locator('#landing-main').evaluate(el=>el===document.activeElement),'Skip link focus');
 await p.goto('http://127.0.0.1:4178/');await p.locator('.landing-theme-trigger').waitFor();
 for(const theme of ['light','dark']) {
  if(await p.evaluate(()=>document.documentElement.dataset.landingTheme)!==theme) await p.locator('.landing-theme-trigger').click();
  assert(await p.evaluate(()=>document.documentElement.dataset.landingTheme)===theme,'Theme selection');
  await p.reload();await p.locator('.landing-theme-trigger').waitFor();assert(await p.evaluate(()=>document.documentElement.dataset.landingTheme)===theme,'Theme persistence');
  await p.addScriptTag({path:'frontend/node_modules/axe-core/axe.min.js'});
  const violations=await p.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})));
  results.axe.push({theme,violations});assert(violations.length===0,'Axe '+theme);
  for(const width of [1440,1024,768,390,320]) {
   await p.setViewportSize({width,height:960});await p.evaluate(()=>window.scrollTo(0,0));
   const layout=await p.evaluate(()=>{
    const nodes=[...document.querySelectorAll('.landing-nav-brand,.landing-nav-actions,.landing-header nav')].filter(el=>getComputedStyle(el).display!=='none').map(el=>({class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,nav:nodes};
   });
   assert(layout.scrollWidth<=width,'Overflow '+width);
   const sorted=layout.nav.sort((a,b)=>a.left-b.left);assert(sorted.every((r,i)=>i===0||r.left>=sorted[i-1].right-1),'Nav collision '+width);
   results.layouts.push({theme,...layout});
   if(width===1440||width===390) await p.screenshot({path:`output/playwright/theme-review/${theme}-${width}.png`});
  }
  await p.setViewportSize({width:1440,height:960});
  await p.getByRole('button',{name:'反馈问题',exact:true}).click();
  for(let i=0;i<15;i++){await p.keyboard.press('Tab');await p.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));}
  await p.keyboard.press('Escape');await p.waitForTimeout(100);assert(await p.locator(':focus').textContent()==='反馈问题','Feedback focus restoration');
  results.keyboard.dialog=true;
 }
 await p.evaluate(()=>localStorage.removeItem('banana-landing-theme'));await p.reload();await p.locator('.landing-theme-trigger').waitFor();await p.emulateMedia({colorScheme:'light'});await p.waitForFunction(()=>document.documentElement.dataset.landingTheme==='light');assert(await p.evaluate(()=>document.documentElement.dataset.landingTheme)==='light','System light');await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(100);assert(await p.evaluate(()=>document.documentElement.dataset.landingTheme)==='dark','System dark');
 await p.getByRole('link',{name:'常见问题',exact:true}).click();assert(await p.evaluate(()=>document.activeElement.id)==='faq','Section anchor focus');
 const q=p.locator('#faq h3 button').first();await q.click();assert(await q.getAttribute('aria-expanded')==='true','FAQ expansion');await q.click();
 for(const status of [400,429,500,200]) {
  await p.route('**/api/waitlist',route=>route.fulfill({status,json:{success:status===200}}));
  await p.locator('#landing-cta-email').fill('test@example.com');await p.locator('#landing-cta button[type=submit]').click();
  const feedback=p.locator('#landing-cta-status');await feedback.filter({hasText:/./}).waitFor();
  results.forms.push({status,state:await feedback.getAttribute('data-state'),text:await feedback.textContent()});
  assert(await feedback.getAttribute('data-state')===({400:'invalid',429:'rate-limited',500:'error',200:'success'})[status],'Waitlist state '+status);
  await p.unroute('**/api/waitlist');
 }
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.getByRole('button',{name:'选择语言'}).click();await p.getByRole('menuitemradio',{name:'English',exact:true}).click();
 await p.waitForURL('**/en/**');assert(await p.locator('html').getAttribute('lang')==='en','English lang');assert((await p.title()).includes('intuitively'),'English title');
 for(const width of [1440,1024,390,320]){await p.setViewportSize({width,height:960});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'English overflow '+width)}
 results.language=true;
 } finally {await context.close()}
 const staticContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:960}});
 try{for(const path of ['/','/en/']){
  const s=await staticContext.newPage();await s.goto('http://127.0.0.1:4178'+path);
  const result={path,title:await s.title(),heading:await s.locator('h1').textContent(),cover:await s.locator('meta[property="og:image"]').getAttribute('content'),canonical:await s.locator('link[rel=canonical]').getAttribute('href')};
  assert(result.heading.length>4,'No-JS content');results.seo.push(result);await s.close();
 }}finally{await staticContext.close()}
 return results;
}
