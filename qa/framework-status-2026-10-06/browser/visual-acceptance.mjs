import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '/Users/solvia/Documents/cowork/medium/articles/sveltekit-server-boundaries/example/node_modules/playwright/index.mjs';

/* global CSS, document, getComputedStyle, innerHeight, innerWidth, location, requestAnimationFrame, window */

const baseURL = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(baseURL || '')) throw new Error('Pass the agreed local preview URL ending in /.');
const output = path.dirname(new URL(import.meta.url).pathname);
const report = { date: new Date().toISOString(), baseURL, buildProfile: process.env.QA_BUILD_PROFILE || 'catalog-preview (isolated source snapshot)', browser: '', profile: 'Playwright fresh ephemeral Chromium profile; no user profile', tool: 'existing Playwright + installed Google Chrome headless', viewport: [], componentSourceParity: [], dialogs: [], keyboard: [], form: [], theme: [], requests: [], nonGetRequests: [], errors: [], limitations: ['No screen reader is connected; AX/DOM observations do not establish spoken output.', 'Actual browser text-only zoom is not exposed by this headless session; 200% browser text zoom is unverified.', 'Authentic translated or RTL page instances are absent; no translations were synthesized.', 'Contrast sampling excludes image/gradient backgrounds and opacity; spot checks do not establish WCAG conformance.', 'Autocomplete and editable semantics are observed; native clipboard paste and real password-manager autofill were not exercised.', 'Native modal Tab traversal briefly returns document.activeElement=body; the next Tab returns to the modal. No underlying page control was reached; strict APG wrap was not established.'] };
const routes = process.argv[3] ? process.argv[3].split(',') : ['/demos/saas/', '/demos/agency/', '/demos/saas/sign-in/', '/commerce/catalog/', '/markdown/', '/components/', '/dashboard/', '/commerce/', '/commerce/products/arc-glass-set/'];
let browser;

function slug(route) { return route.replace(/^\/+|\/+$/g, '').replaceAll('/', '-'); }

async function inspect(page,scopeSelector='body') {
  return page.evaluate((scopeSelector) => {
    const root = document.documentElement;
    const scope=document.querySelector(scopeSelector);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const composite = (front, back) => { const a = front[3] + back[3] * (1 - front[3]); return a ? [0, 1, 2].map(i => (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / a).concat(a) : [0, 0, 0, 0]; };
    const luminance = color => color.slice(0, 3).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const selector = el => el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase() + [...el.classList].map(c => '.' + CSS.escape(c)).join('');
    const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility === 'visible' && s.display !== 'none' && !el.closest('[hidden], [aria-hidden="true"], .sr-only'); };
    const all = [...scope.querySelectorAll('*')];
    const offscreen = all.filter(visible).map(el => { const r = el.getBoundingClientRect(); return { selector: selector(el), left: r.left, right: r.right, width: r.width, text: el.innerText?.slice(0, 100) }; }).filter(r => r.left < -1 || r.right > root.clientWidth + 1);
    const clippedText = all.filter(visible).filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).filter(el => { const s = getComputedStyle(el); return (el.scrollWidth > el.clientWidth + 1 && ['hidden','clip'].includes(s.overflowX)) || (el.scrollHeight > el.clientHeight + 1 && ['hidden','clip'].includes(s.overflowY)); }).map(el => ({ selector: selector(el), text: el.innerText.slice(0, 100), width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }));
    const contrast = all.filter(visible).filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).filter(el => !el.closest('pre, code, svg')).map(el => {
      const s = getComputedStyle(el), layers = [], uncertainty = [];
      for (let p = el; p; p = p.parentElement) {
        const ps = getComputedStyle(p), color = rgba(ps.backgroundColor);
        if (ps.backgroundImage !== 'none') uncertainty.push('background image at ' + selector(p));
        if (Number(ps.opacity) !== 1) uncertainty.push('opacity at ' + selector(p));
        layers.push(color); if (color[3] === 1) break;
      }
      let background = [255,255,255,1]; for (let i = layers.length - 1; i >= 0; i--) background = composite(layers[i], background);
      const foreground = composite(rgba(s.color), background), a = luminance(foreground), b = luminance(background), ratio = (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
      const fontSize = parseFloat(s.fontSize), fontWeight = Number(s.fontWeight), threshold = fontSize >= 24 || fontSize >= 18.6667 && fontWeight >= 700 ? 3 : 4.5;
      return { selector: selector(el), text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0,120), foregroundCSS: s.color, backgroundRGB: background.slice(0,3).map(v => Math.round(v)), fontSize, fontWeight, ratio: Number(ratio.toFixed(3)), threshold, measured: !uncertainty.length, uncertainty, pass: !uncertainty.length && ratio >= threshold };
    });
    const targets = [...scope.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary')].filter(visible).filter(el => !el.disabled).map(el => {
      let effective = el; if (el.matches('input[type=checkbox],input[type=radio]') && el.labels?.length) effective = el.labels[0];
      const r = effective.getBoundingClientRect();
      return { selector: selector(el), text: (el.getAttribute('aria-label') || el.innerText || el.labels?.[0]?.innerText || el.name || '').trim().slice(0,100), element: el.tagName.toLowerCase(), effectiveSelector: selector(effective), width: Number(r.width.toFixed(2)), height: Number(r.height.toFixed(2)), project44: r.width >= 44 && r.height >= 44, minimum24: r.width >= 24 && r.height >= 24, inlineContext: el.parentElement?.matches('p,li,dd,figcaption') || false, href: el.getAttribute('href') };
    });
    const surfaces = ['body','.marketing','.marketing-hero','.agency','.agency-band','.agency-footer'].map(sel=>{const el=document.querySelector(sel);if(!el)return null;const s=getComputedStyle(el);return {selector:sel,color:s.color,background:s.backgroundColor,backgroundImage:s.backgroundImage};}).filter(Boolean);
    return { path: location.pathname, scopeSelector, title: document.title, lang: root.lang, dir: root.dir, scheme: root.dataset.colorScheme, preference: root.dataset.colorSchemePreference, brand: root.dataset.theme, surfaces, width: root.clientWidth, scrollWidth: root.scrollWidth, horizontalOverflow: root.scrollWidth > root.clientWidth + 1, offscreen: offscreen.slice(0,40), clippedText, contrast, targets, localFonts: performance.getEntriesByType('resource').filter(r => /\.woff2(?:$|\?)/.test(r.name)).map(r => r.name), mainCount: document.querySelectorAll('main').length };
  },scopeSelector);
}

async function focusRecord(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  return page.evaluate(() => { const el = document.activeElement, r = el.getBoundingClientRect(), s = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), id: el.id, className: el.className, name: el.getAttribute('aria-label') || el.innerText?.trim().slice(0,70), focusVisible: el.matches(':focus-visible'), outline: [s.outlineStyle,s.outlineWidth,s.outlineColor].join(' '), boxShadow:s.boxShadow, inModal:Boolean(el.closest('dialog[open]')), rect: { x:r.x,y:r.y,width:r.width,height:r.height }, obscured: r.width && r.height ? !el.contains(document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.x+r.width/2)),Math.min(innerHeight-1,Math.max(0,r.y+r.height/2)))) : null }; });
}

try {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check'] });
  report.browser = await browser.version();
  for (const scheme of ['dark','light']) {
    const context = await browser.newContext({ viewport:{width:1440,height:900}, colorScheme:scheme, reducedMotion:'reduce' });
    const page = await context.newPage();
    page.on('request', r => { if (!r.url().startsWith(baseURL) && !r.url().startsWith('data:')) report.requests.push(r.url()); if(r.method()!=='GET') report.nonGetRequests.push({url:r.url(),method:r.method()}); });
    page.on('pageerror', e => report.errors.push(e.message));
    for (const route of routes) for (const width of [320,768,1440]) {
      await page.setViewportSize({width,height:900});
      const response = await page.goto(new URL(route,baseURL).href, {waitUntil:'networkidle'});
      if (response.status() !== 200) throw new Error(route + ' returned ' + response.status());
      await page.evaluate(() => document.fonts.ready);
      await page.locator('html').waitFor({state:'attached'});
      if (route === '/components/') {
        const parityChecks = await page.evaluate(() => {
          const examples = [
            { name: 'quick-start', codeId: 'quick-start-code', selectors: ['.anatomy-stage > button'] },
            { name: 'layout', codeId: 'layout-code', selectors: ['.layout-demo'] },
            { name: 'buttons', codeId: 'button-code', selectors: ['#button-variant-preview button'] },
            { name: 'tabs', codeId: 'tabs-code', selectors: ['.tabs-example-source'] },
            { name: 'forms', codeId: 'form-code', selectors: ['#demo-form'] },
            { name: 'content', codeId: 'content-code', selectors: ['#content-example-source'] },
          ];

          return examples.map(({ name, codeId, selectors }) => {
            const code = document.getElementById(codeId);
            const sources = selectors.flatMap(selector => [...document.querySelectorAll(selector)]);
            const expected = sources.map(source => source.outerHTML).join('\n');
            return {
              example: name,
              codeId,
              sourceCount: sources.length,
              displayedMatchesRenderedSource: Boolean(sources.length && code && code.textContent === expected),
              displayedAsText: Boolean(code && code.childElementCount === 0),
            };
          });
        });

        for (const parity of parityChecks) {
          report.componentSourceParity.push({ path: route, scheme, width, ...parity });
          if (!parity.displayedMatchesRenderedSource || !parity.displayedAsText) {
            throw new Error(`${parity.example} source snippet does not match safe text serialization at ${route} (${scheme}, ${width}px).`);
          }
        }
      }
      const observed = await inspect(page); observed.schemeInput=scheme; observed.viewportHeight=900;
      if (observed.scheme !== scheme) throw new Error('Expected system ' + scheme + ' at ' + route);
      report.viewport.push(observed);
      if (route === '/demos/saas/' || route === '/demos/agency/') {
        observed.screenshot = path.join(output,slug(route) + '-' + scheme + '-' + width + '-full.png');
        await page.screenshot({path:observed.screenshot,fullPage:true});
        observed.viewportScreenshot = path.join(output,slug(route) + '-' + scheme + '-' + width + '-top.png');
        await page.screenshot({path:observed.viewportScreenshot});
      } else if(width===320) {
        observed.viewportScreenshot=path.join(output,slug(route)+'-'+scheme+'-'+width+'-top.png');
        await page.screenshot({path:observed.viewportScreenshot});
      }
    }
    for(const width of [320,1440]) {
      await page.setViewportSize({width,height:900});
      await page.goto(new URL('/commerce/products/arc-glass-set/',baseURL).href,{waitUntil:'networkidle'});
      await page.locator('#detail-quantity').fill('2'); await page.locator('[data-detail-add]').click();
      await page.goto(new URL('/commerce/catalog/',baseURL).href,{waitUntil:'networkidle'});
      await page.locator('[data-open-cart]').first().click();
      const cart=await inspect(page,'#store-cart'); cart.kind='cart'; cart.viewportInput=width; cart.text=await page.locator('#store-cart-items').innerText(); cart.screenshot=path.join(output,'commerce-cart-'+scheme+'-'+width+'.png'); await page.screenshot({path:cart.screenshot}); report.dialogs.push(cart);
      await page.keyboard.press('Escape');
      await page.goto(new URL('/commerce/',baseURL).href,{waitUntil:'networkidle'});
      await page.locator('.store-product__details [data-quick-view]').first().click();
      const quick=await inspect(page,'#quick-view-dialog'); quick.kind='quickview'; quick.viewportInput=width; quick.screenshot=path.join(output,'commerce-quickview-'+scheme+'-'+width+'.png'); await page.screenshot({path:quick.screenshot}); report.dialogs.push(quick); await page.keyboard.press('Escape');
    }
    for (const width of [320,1440]) {
      await page.setViewportSize({width,height:900});
      await page.goto(new URL('/demos/saas/',baseURL).href,{waitUntil:'networkidle'});
      await page.keyboard.press('Tab'); const skip = await focusRecord(page);
      await page.keyboard.press('Enter'); const skipTarget = await focusRecord(page);
      const trail=[];
      await page.goto(new URL('/demos/saas/',baseURL).href,{waitUntil:'networkidle'});
      for (let i=0;i<8;i++) { await page.keyboard.press('Tab'); trail.push(await focusRecord(page)); }
      const keyboard={scheme,width,skip,skipTarget,trail};
      if (width===320) {
        await page.locator('.nav-toggle').focus(); await page.keyboard.press('Space');
        keyboard.menuOpen=await page.locator('.nav-toggle').getAttribute('aria-expanded');
        await page.keyboard.press('Tab'); keyboard.menuFirst=await focusRecord(page);
        await page.keyboard.press('Shift+Tab'); keyboard.menuReturn=await focusRecord(page);
        await page.keyboard.press('Escape'); keyboard.menuClosed=await page.locator('.nav-toggle').getAttribute('aria-expanded'); keyboard.menuEscape=await focusRecord(page);
      }
      await page.goto(new URL('/components/',baseURL).href,{waitUntil:'networkidle'});
      await page.locator('#open-dialog').focus(); await page.keyboard.press('Enter');
      keyboard.dialogFirst=await focusRecord(page); keyboard.dialogTrail=[];
      for (let i=0;i<5;i++) { await page.keyboard.press('Tab'); keyboard.dialogTrail.push(await focusRecord(page)); }
      await page.keyboard.press('Shift+Tab'); keyboard.dialogReverse=await focusRecord(page);
      await page.keyboard.press('Escape'); keyboard.dialogReturn=await focusRecord(page);
      keyboard.dialogClosed=await page.locator('#component-dialog').evaluate(el=>!el.open);
      report.keyboard.push(keyboard);
    }
    await page.goto(new URL('/demos/saas/sign-in/',baseURL).href,{waitUntil:'networkidle'});
    report.form.push({scheme,path:'/demos/saas/sign-in/',mode:'intentional static prototype',disabled:await page.locator('#orbit-sign-in-email').isDisabled(),autocomplete:await page.locator('#orbit-sign-in-password').getAttribute('autocomplete')});
    await page.goto(new URL('/auth/login/',baseURL).href,{waitUntil:'networkidle'});
    await page.locator('#login-email').fill('invalid');
    await page.locator('#login-password').fill('test');
    await page.locator('.auth-submit').click();
    report.form.push({scheme,path:'/auth/login/',mode:'enhanced demo validation',observations:await page.evaluate(()=>({ active:document.activeElement.id, invalid:[...document.querySelectorAll('[aria-invalid=true]')].map(el=>({id:el.id,description:el.getAttribute('aria-describedby'),validationMessage:el.validationMessage})), messages:[...document.querySelectorAll('[role=alert],[role=status],[aria-live]')].map(el=>({id:el.id,role:el.getAttribute('role'),live:el.getAttribute('aria-live'),text:el.innerText.trim()})),fields:[...document.querySelectorAll('input[type=email],input[type=password]')].map(el=>({id:el.id,autocomplete:el.autocomplete,disabled:el.disabled,readOnly:el.readOnly}))}))});
    await page.locator('#login-email').fill('qa-demo@example.invalid');
    await page.locator('#login-password').fill('Demo-only-pass-123!');
    await page.locator('.auth-submit').click();
    await page.locator('#login-feedback').filter({hasText:'Demo modu:'}).waitFor();
    report.form.push({scheme,path:'/auth/login/',mode:'valid local demo submit',status:await page.locator('#login-feedback').innerText()});
    const passwordToggle=page.locator('[data-password-toggle]').first();
    const loginPassword=page.locator('#login-password');
    const passwordToggleBefore={type:await loginPassword.getAttribute('type'),pressed:await passwordToggle.getAttribute('aria-pressed'),label:await passwordToggle.getAttribute('aria-label')};
    await passwordToggle.click();
    const passwordToggleRevealed={type:await loginPassword.getAttribute('type'),pressed:await passwordToggle.getAttribute('aria-pressed'),label:await passwordToggle.getAttribute('aria-label'),visibleLabel:await passwordToggle.locator('[data-password-toggle-label]').innerText()};
    if(passwordToggleRevealed.type!=='text'||passwordToggleRevealed.pressed!=='true'||passwordToggleRevealed.label!=='Şifreyi gizle')throw new Error('Password reveal state did not synchronize input type and accessible label.');
    await passwordToggle.click();
    const passwordToggleHidden={type:await loginPassword.getAttribute('type'),pressed:await passwordToggle.getAttribute('aria-pressed'),label:await passwordToggle.getAttribute('aria-label'),visibleLabel:await passwordToggle.locator('[data-password-toggle-label]').innerText()};
    if(passwordToggleHidden.type!=='password'||passwordToggleHidden.pressed!=='false'||passwordToggleHidden.label!=='Şifreyi göster')throw new Error('Password conceal state did not restore input type and accessible label.');
    report.form.push({scheme,path:'/auth/login/',mode:'password visibility toggle',before:passwordToggleBefore,revealed:passwordToggleRevealed,hidden:passwordToggleHidden});
    await context.close();
  }
  report.authFallback ||= [];
  for (const mode of ['javascript-disabled','page-scripts-failed','storage-denied']) {
    const context=await browser.newContext({viewport:{width:1280,height:900},javaScriptEnabled:mode!=='javascript-disabled',colorScheme:'light'});
    if(mode==='storage-denied') await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage blocked by test fixture.','SecurityError');}}));
    const page=await context.newPage(); const nonGet=[]; const external=[]; const failed=[]; const apiRequests=[];
    page.on('request',request=>{if(request.method()!=='GET')nonGet.push({url:request.url(),method:request.method()});if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push({url:request.url(),method:request.method()});if(!request.url().startsWith(baseURL)&&!request.url().startsWith('data:'))external.push(request.url());});
    page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText||''}));
    if(mode==='page-scripts-failed') await page.route('**/*.js',route=>route.abort());
    const response=await page.goto(new URL('/auth/login/',baseURL).href,{waitUntil:'networkidle'});
    if(response.status()!==200)throw new Error(`${mode} auth page returned ${response.status()}`);
    const initial=await page.evaluate(()=>({fieldsetDisabled:document.querySelector('[data-auth-fields]')?.disabled,emailDisabled:document.querySelector('#login-email')?.matches(':disabled'),passwordDisabled:document.querySelector('#login-password')?.matches(':disabled'),submitDisabled:document.querySelector('.auth-submit')?.matches(':disabled')}));
    const observation={mode,status:response.status(),initial,nonGet,apiRequests,external,failed};
    if(mode!=='storage-denied') {
      if(!initial.fieldsetDisabled||!initial.emailDisabled||!initial.passwordDisabled||!initial.submitDisabled)throw new Error(`${mode} must leave auth controls safely disabled.`);
    } else {
      if(initial.fieldsetDisabled||initial.emailDisabled||initial.passwordDisabled||initial.submitDisabled)throw new Error('Storage-denied mode should still enhance the safe local demo form.');
      await page.locator('#login-email').fill('qa-demo@example.invalid');
      await page.locator('#login-password').fill('Demo-only-pass-123!');
      await page.locator('.auth-submit').click();
      await page.locator('#login-feedback').filter({hasText:'Demo modu:'}).waitFor();
      observation.demoFeedback=await page.locator('#login-feedback').innerText();
      if(nonGet.length||apiRequests.length)throw new Error('Storage-denied auth demo unexpectedly sent an authentication request.');
    }
    report.authFallback.push(observation); await context.close();
  }
  for (const route of ['/demos/saas/','/demos/agency/']) {
    const context=await browser.newContext({viewport:{width:320,height:900},colorScheme:'light',reducedMotion:'reduce'}); const page=await context.newPage();
    await page.goto(new URL(route,baseURL).href,{waitUntil:'networkidle'});
    const state=()=>page.evaluate(()=>({preference:document.documentElement.dataset.colorSchemePreference,scheme:document.documentElement.dataset.colorScheme,controls:document.querySelectorAll('.theme-toggle').length}));
    const initial=await state(); await page.emulateMedia({colorScheme:'dark'}); await page.waitForTimeout(100); const afterOSDark=await state();
    await page.emulateMedia({colorScheme:'light'}); await page.waitForTimeout(100); const afterOSLight=await state();
    const observed={route,initial,afterOSDark,afterOSLight};
    if(await page.locator('.theme-toggle').count()) { await page.locator('.theme-toggle').click(); observed.explicit=await state(); await page.emulateMedia({colorScheme:'dark'}); await page.waitForTimeout(100); observed.explicitAfterOSDark=await state(); await page.emulateMedia({colorScheme:'light'}); await page.waitForTimeout(100); observed.explicitAfterOSLight=await state(); await page.reload({waitUntil:'networkidle'}); observed.explicitReload=await state(); }
    report.theme.push(observed); await context.close();
  }
  report.completed = true;
  report.geometryRuntimePass = report.viewport.every(r=>!r.horizontalOverflow) && !report.errors.length;
} catch (error) { report.completed=false; report.geometryRuntimePass=false; report.failure=error.stack; process.exitCode=1; }
finally {
  report.requests=[...new Set(report.requests)];
  await fs.writeFile(path.join(output,'visual-report.json'), JSON.stringify(report,null,2)+'\n');
  await browser?.close();
  console.log(JSON.stringify({ completed:report.completed,geometryRuntimePass:report.geometryRuntimePass,browser:report.browser,observations:report.viewport.length,componentSourceParity:{checks:report.componentSourceParity.length,allPass:report.componentSourceParity.every(check=>check.displayedMatchesRenderedSource&&check.displayedAsText),failures:report.componentSourceParity.filter(check=>!check.displayedMatchesRenderedSource||!check.displayedAsText)},authFallback:report.authFallback,overflows:report.viewport.filter(r=>r.horizontalOverflow).map(r=>({path:r.path,scheme:r.scheme,width:r.width})),contrastFailures:report.viewport.reduce((n,r)=>n+r.contrast.filter(c=>c.measured&&!c.pass).length,0),targetBelow44:report.viewport.reduce((n,r)=>n+r.targets.filter(t=>!t.project44).length,0),externalRequests:report.requests,nonGetRequests:report.nonGetRequests,theme:report.theme,errors:report.errors,failure:report.failure,report:path.join(output,'visual-report.json')},null,2));
}
