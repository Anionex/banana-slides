// Run with playwright-cli run-code --filename frontend/scripts/landing-cover.js.
// Requires the online build at 4178. Captures existing brand artwork, not a generated mockup.
async (page) => {
 await page.setViewportSize({width:1200,height:630});
 await page.emulateMedia({reducedMotion:'reduce'});
 for (const language of ['zh','en']) {
 await page.goto('http://127.0.0.1:4178/');
 await page.evaluate(()=>{localStorage.setItem('banana-landing-theme','light');localStorage.setItem('banana-slides-language','zh')});
 await page.reload();
 await page.locator('.landing-hero-art .grain-steps').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(language=>{
  const art=document.querySelector('.landing-hero-art').cloneNode(true);
  art.querySelector('.landing-art-label').remove();
  const logo=document.querySelector('.brand img').src;
  document.documentElement.dataset.landingTheme='light';
  document.body.innerHTML='<div class="landing-page share-cover"><div class="share-brand"><img src="'+logo+'" alt=""/>Banana Slides</div><h1>'+ (language==='zh' ? '让 PPT 创作<br>回归直觉' : 'Describe it<br>AI renders it') +'</h1><p>Turn ideas into presentations.</p><small>bananaslides.online</small></div>';
  document.querySelector('.share-cover').append(art);
  const style=document.createElement('style');
  style.textContent='.share-cover{position:relative;width:1200px;height:630px;overflow:hidden;background:#fffefa!important;padding:60px 64px}.share-brand{display:flex;align-items:center;gap:14px;font-size:29px;font-weight:700}.share-brand img{width:46px;height:46px}.share-cover h1{position:relative;z-index:2;margin-top:88px;font-size:65px;font-weight:650;line-height:1.28;letter-spacing:-2px}.share-cover p{position:relative;z-index:2;margin-top:24px;color:#64666f;font-size:24px}.share-cover small{position:absolute;left:64px;bottom:48px;color:#64666f;font-size:19px}.share-cover .landing-hero-art{position:absolute!important;left:660px!important;top:92px!important;width:570px!important;height:630px!important;opacity:1!important;filter:none!important;transform:none!important}.share-cover *{animation:none!important}';
  document.head.append(style);
 }, language);
 await page.screenshot({path:`frontend/public/social/cover${language==='en'?'-en':''}.png`});
 }
 return {width:1200,height:630,paths:['frontend/public/social/cover.png','frontend/public/social/cover-en.png']};
}
