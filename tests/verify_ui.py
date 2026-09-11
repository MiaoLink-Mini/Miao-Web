"""UI checks. Default: offline in-memory fixture, not an HTTP/WebGL integration test.
For the real site in an unrestricted browser: --url http://127.0.0.1:8080 --require-three
Dependencies: Python 3, playwright, beautifulsoup4, installed Chromium.
"""
from pathlib import Path
import argparse, json, shutil, time
from playwright.sync_api import sync_playwright, TimeoutError as BrowserTimeout
from offline_fixture import build_fixture, load_fixture
from renderer_contract import validate_renderer, assert_frame_progress

parser=argparse.ArgumentParser()
parser.add_argument('--url', help='Load a real HTTP page instead of the offline fixture')
expectation=parser.add_mutually_exclusive_group()
expectation.add_argument('--require-three', action='store_true')
expectation.add_argument('--require-fallback', action='store_true')
parser.add_argument('--browser', default=shutil.which('chromium') or shutil.which('google-chrome'))
parser.add_argument('--output', default=str(Path(__file__).resolve().parent/'results'))
args=parser.parse_args()
if args.require_three and not args.url: parser.error('--require-three requires --url')
output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
fixture=None if args.url else build_fixture()
report={'mode':'http' if args.url else 'offline-in-memory','webgl_tested':False,'checks':[],'page_errors':[],'console_errors':[],'console_warnings':[]}

def record(name, fn):
    print('CHECK:',name,flush=True)
    try:
        result=fn()
        report['checks'].append({'name':name,'status':'skip' if isinstance(result,dict) and result.get('skip') else 'pass','details':result})
    except Exception as error:
        report['checks'].append({'name':name,'status':'fail','details':str(error)})

def require(value, message):
    if not value: raise AssertionError(message)

def load(page,javascript=True):
    if args.url: page.goto(args.url,wait_until='domcontentloaded')
    else: load_fixture(page,fixture,javascript=javascript)

def wait_for(page, expression, *, arg=None, timeout=6000):
    """Poll through the automation protocol, without injecting CSP-blocked eval."""
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        if page.evaluate(expression, arg): return
        page.wait_for_timeout(100)
    raise BrowserTimeout('Condition did not become true before timeout')

def image_ready(page, selector):
    wait_for(page, '(selector)=>{const img=document.querySelector(selector);return img.complete&&img.naturalWidth>0}',arg=selector)

with sync_playwright() as pw:
    launch={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader']}
    if args.browser: launch['executable_path']=args.browser
    browser=pw.chromium.launch(**launch)
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.set_default_timeout(6000)
    page.on('pageerror', lambda e: report['page_errors'].append(str(e)))
    def console(message):
        if message.type=='error': report['console_errors'].append(message.text)
        elif message.type=='warning': report['console_warnings'].append(message.text)
    page.on('console',console)
    load(page)
    record('Nonblank page / one primary heading',lambda: require(len(page.locator('body').inner_text())>1500 and page.locator('h1').count()==1,'Page is empty or primary heading is missing'))
    wait_for(page, "['three','fallback'].includes(document.querySelector('#orbitStage').dataset.renderer)",timeout=20000)
    if args.require_three:
        try:
            wait_for(page, 'document.querySelector("#orbitStage").dataset.renderer==="three"',timeout=20000)
        except BrowserTimeout:
            pass  # The mode assertion below records failure instead of accepting a loading fallback.
    observed=page.locator('#orbitStage').get_attribute('data-renderer')
    expected='three' if args.require_three else 'fallback' if args.require_fallback or not args.url else 'auto'
    report['renderer']=observed
    page.evaluate("document.documentElement.style.scrollBehavior='auto'")
    record('Renderer matches requested mode',lambda:validate_renderer(observed,expected))
    if observed=='three':
        def frames():
            return int(page.locator('#orbitStage').get_attribute('data-rendered-frames') or 0)
        def three():
            require(page.locator('#sceneMount canvas').count()==1,'Expected one WebGL canvas')
            revision=page.locator('#orbitStage').get_attribute('data-three-revision')
            require(bool(revision),'Missing actual Three.js revision')
            page.mouse.move(0,0)
            wait_for(page, 'Number(document.querySelector("#orbitStage").dataset.renderedFrames)>2')
            canvas=page.locator('#sceneMount canvas')
            before=frames(); image_before=canvas.screenshot(animations='disabled'); page.wait_for_timeout(350)
            after=frames(); image_after=canvas.screenshot(animations='disabled')
            assert_frame_progress(before,after,True)
            require(image_before!=image_after,'Playing scene pixels did not change')
            page.locator('#motionToggle').click(); page.mouse.move(0,0); page.wait_for_timeout(150)
            paused=frames(); still=canvas.screenshot(animations='disabled'); page.wait_for_timeout(350)
            assert_frame_progress(paused,frames(),False)
            require(still==canvas.screenshot(animations='disabled'),'Paused canvas pixels changed')
            page.locator('#motionToggle').click(); page.mouse.move(0,0)
            wait_for(page, '(n)=>Number(document.querySelector("#orbitStage").dataset.renderedFrames)>n',arg=paused)
            assert_frame_progress(paused,frames(),True)
            report['webgl_tested']=True
            return {'revision':revision,'paused_frame':paused,'pixel_comparison':True}
        record('Real rendering / changing pixels / pause / resume',three)

        def offscreen():
            page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)'); page.wait_for_timeout(250)
            before=frames(); page.wait_for_timeout(350); assert_frame_progress(before,frames(),False)
            page.evaluate('window.scrollTo(0,0)')
            wait_for(page, '(n)=>Number(document.querySelector("#orbitStage").dataset.renderedFrames)>n',arg=before)
        record('Offscreen scene stops producing frames and resumes onscreen',offscreen)
    else:
        def fallback():
            require(page.locator('#motionToggle').is_disabled(),'Static mode animation control should be disabled')
            require(page.locator('#sceneMount canvas').count()==0,'Fallback retained an orphaned WebGL canvas')
            return 'Static fallback only; not evidence of successful WebGL rendering'
        record('Dependency failure preserves static scene without orphaned canvas',fallback)

    def agents():
        for key in ['claude','pi','codex']:
            page.locator(f'[data-orbit-agent="{key}"]').click()
            require(page.locator('#orbitStage').get_attribute('data-active-agent')==key,'Agent selection mismatch')
            require(page.locator('[data-orbit-agent][aria-pressed="true"]').count()==1,'Agent state is ambiguous')
    record('All three agent labels / selected state',agents)

    def tabs():
        for key in ['sessions','request','session','home']:
            page.locator(f'[data-view="{key}"]').click()
            require(page.locator('#workspaceView').get_attribute('aria-labelledby')==f'tab-{key}','Tab panel label mismatch')
            require(page.locator('[data-view][aria-selected="true"]').count()==1,'Tab selection is ambiguous')
            image_ready(page,'#workspaceShot')
        page.locator('#tab-home').focus()
        page.keyboard.press('ArrowRight')
        require(page.locator('#tab-sessions').get_attribute('aria-selected')=='true','Arrow navigation failed')
        page.keyboard.press('End')
        require(page.locator('#tab-session').get_attribute('aria-selected')=='true','End navigation failed')
        page.keyboard.press('Home')
        require(page.locator('#tab-home').get_attribute('aria-selected')=='true','Home navigation failed')
    record('Four workspace views / keyboard / source images',tabs)

    def gallery():
        page.locator('#openGallery').click()
        require(page.locator('#galleryDialog').is_visible(),'Gallery did not open')
        for key in ['home','sessions','session','inbox','request','login','me','diff','share']:
            page.locator(f'[data-shot="{key}"]').click()
            image_ready(page,'#galleryImage')
            require(page.locator(f'[data-shot="{key}"]').get_attribute('aria-pressed')=='true','Gallery state mismatch')
        page.keyboard.press('Escape')
        require(not page.locator('#galleryDialog').is_visible(),'Gallery did not close with Escape')
        require(page.evaluate('document.activeElement.id')=='openGallery','Gallery did not restore focus')
    record('Nine current UI previews / dialog / focus restoration',gallery)

    def approval():
        for choice,cls in [('allow','allowed'),('deny','denied')]:
            page.locator(f'[data-decision="{choice}"]').click()
            require(cls in page.locator('#approvalStatus').get_attribute('class'),'Decision state mismatch')
            require(page.locator('#resetApproval').is_visible(),'Reset unavailable')
            page.locator('#resetApproval').click()
            require(page.locator('#approvalActions').is_visible(),'Reset failed')
    record('Local approval allow / reject / reset',approval)

    def guide():
        page.locator('[data-open-guide]').first.click()
        require(page.locator('#guideDialog').is_visible(),'Guide did not open')
        page.locator('#copyCommand').click()
        wait_for(page, "document.querySelector('#copyStatus').textContent.length > 0")
        feedback=page.locator('#copyStatus').inner_text()
        page.keyboard.press('Escape')
        require(not page.locator('#guideDialog').is_visible(),'Guide did not close')
        require(page.evaluate('document.activeElement.hasAttribute("data-open-guide")'),'Guide did not restore focus')
        return {'copy_feedback':feedback,'clipboard_success_not_assumed':True}
    record('Setup guide / clipboard feedback / Escape',guide)

    def installer_platforms():
        page.locator('[data-open-guide]').first.click()
        commands={'posix':'bash WeAgent-Node/install.sh --start','windows':'powershell -NoProfile -File .\\WeAgent-Node\\install.ps1 --start'}
        for key,text in commands.items():
            page.locator('[data-install-platform="'+key+'"]').click()
            require(page.locator('#nodeCommand').inner_text()==text,'Installer command differs from actual entry point')
            require(page.locator('[data-install-platform][aria-pressed="true"]').count()==1,'Platform selection ambiguous')
        page.locator('[data-install-platform="posix"]').click();page.keyboard.press('Escape')
    record('Installer platform choices preserve exact executable paths',installer_platforms)
    def clipboard_failure():
        page.locator('[data-open-guide]').first.click()
        if page.evaluate('window.isSecureContext&&!!navigator.clipboard'):
            page.keyboard.press('Escape')
            return {'skip':True,'reason':'Secure clipboard bypasses the legacy fallback'}
        page.evaluate('()=>{window.__savedCopy=document.execCommand;document.execCommand=()=>{throw Error("Injected clipboard denial")};}')
        try:
            page.locator('#copyCommand').click()
            wait_for(page, 'document.querySelector("#copyStatus").textContent.length>0')
            require(page.locator('#guideDialog textarea').count()==0,'Clipboard fallback retained temporary textarea')
        finally:
            page.evaluate('document.execCommand=window.__savedCopy;delete window.__savedCopy');page.keyboard.press('Escape')
    record('Clipboard exception removes temporary control',clipboard_failure)

    def faq():
        faqs=page.locator('.faq')
        for i in range(faqs.count()):
            faqs.nth(i).locator('summary').click()
            page.wait_for_timeout(80)
            require(faqs.nth(i).get_attribute('open') is not None,'FAQ failed to open')
            require(page.locator('.faq[open]').count()==1,'FAQ accordion allows overlapping open state')
        faqs.last.locator('summary').click()
    record('Five FAQ sections / native accordion',faq)

    def responsive():
        measurements=[]
        for width in [320,390,640,768,1024,1440,1920]:
            page.set_viewport_size({'width':width,'height':900})
            page.wait_for_timeout(120)
            result=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})')
            measurements.append(result)
            require(result['scrollWidth']<=result['clientWidth']+1, f'Horizontal overflow at {width}: {result}')
        return measurements
    record('Seven responsive widths / no horizontal overflow',responsive)

    def menu():
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate('window.scrollTo(0,0)')
        page.locator('#navBurger').click()
        require(page.locator('#navBurger').get_attribute('aria-expanded')=='true','Mobile menu did not open')
        page.keyboard.press('Escape')
        require(page.locator('#navBurger').get_attribute('aria-expanded')=='false','Mobile menu Escape failed')
        page.locator('#navBurger').click()
        page.locator('.globalnav-links a[href="#tech"]').click()
        require(page.locator('#navBurger').get_attribute('aria-expanded')=='false','Mobile menu did not close after navigation')
    record('Mobile menu / Escape / section navigation',menu)

    if observed=='three':
        def context_restore():
            page.evaluate('window.scrollTo(0,0)')
            supported=page.locator('#sceneMount canvas').evaluate("canvas=>{const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');window.__weagentTestContext=ext;return !!ext;}")
            if not supported: return {'skip':True,'reason':'WEBGL_lose_context is unavailable'}
            page.evaluate('window.__weagentTestContext.loseContext()')
            wait_for(page, 'document.querySelector("#orbitStage").dataset.renderer==="fallback"')
            before=frames(); page.wait_for_timeout(250); assert_frame_progress(before,frames(),False)
            page.evaluate('window.__weagentTestContext.restoreContext()')
            wait_for(page, 'document.querySelector("#orbitStage").dataset.renderer==="three"')
            wait_for(page, '(n)=>Number(document.querySelector("#orbitStage").dataset.renderedFrames)>n',arg=before)
            return 'Context loss stopped frames; restore produced new frames'
        record('Real context loss / restoration',context_restore)

        def teardown():
            page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))")
            require(page.locator('#sceneMount canvas').count()==0,'Scene canvas survived disposal')
            before=frames(); page.wait_for_timeout(200); assert_frame_progress(before,frames(),False)
            page.evaluate("window.dispatchEvent(new Event('resize'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}))")
            page.wait_for_timeout(150)
            require(page.locator('#sceneMount canvas').count()==0,'Disposed scene was revived by an old listener')
        record('Page disposal releases canvas and stops callbacks',teardown)

    record('No uncaught UI JavaScript errors', lambda: require(not report['page_errors'],str(report['page_errors'])))
    record('No UI console errors',lambda:require(not report['console_errors'],str(report['console_errors'])))

    # Fresh reduced-motion pages give deterministic, fully revealed captures.
    preview=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,reduced_motion='reduce')
    load(preview)
    record('Reduced-motion content remains visible',lambda:require(preview.locator('.has-reveal').count()==0,'Reveal animation should not hide content'))
    wait_for(preview, "['three','fallback'].includes(document.querySelector('#orbitStage').dataset.renderer)",timeout=20000)
    preview_mode=preview.locator('#orbitStage').get_attribute('data-renderer')
    preview.screenshot(path=str(output/f'desktop-{preview_mode}.png'))
    image_ready(preview,'#workspaceShot')
    preview.screenshot(path=str(output/f'desktop-full-{preview_mode}.png'),full_page=True)
    from PIL import Image
    full=Image.open(output/f'desktop-full-{preview_mode}.png')
    for section,filename in [('#features',f'workspace-{preview_mode}.png'),('#timeline',f'features-{preview_mode}.png')]:
        box=preview.locator(section).bounding_box()
        full.crop((0,round(box['y']),full.width,round(box['y']+box['height']))).save(output/filename)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,reduced_motion='reduce')
    load(mobile)
    wait_for(mobile, "['three','fallback'].includes(document.querySelector('#orbitStage').dataset.renderer)",timeout=20000)
    mobile_mode=mobile.locator('#orbitStage').get_attribute('data-renderer')
    mobile.screenshot(path=str(output/f'mobile-{mobile_mode}.png'))
    mobile.screenshot(path=str(output/f'mobile-full-{mobile_mode}.png'),full_page=True)
    if not args.url:
        nojs=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
        load(nojs,javascript=False)
        record('No-JavaScript content and FAQ remain readable',lambda:require(len(nojs.locator('main').inner_text())>1200 and nojs.locator('.faq').count()==5,'No-JS content missing'))
        nojs.close()
    report['browser']=browser.version
    browser.close()

report['passed']=sum(c['status']=='pass' for c in report['checks'])
report['failed']=sum(c['status']=='fail' for c in report['checks'])
report['skipped']=sum(c['status']=='skip' for c in report['checks'])
(output/'ui-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(1 if report['failed'] else 0)
