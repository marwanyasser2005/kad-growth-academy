from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width":1440,"height":1080}, device_scale_factor=1)
    errors=[]
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.evaluate("""() => {
      const memory = new Map();
      Object.defineProperty(window, 'localStorage', {value: {
        getItem: k => memory.has(k) ? memory.get(k) : null,
        setItem: (k,v) => memory.set(k,String(v)),
        removeItem: k => memory.delete(k),
        clear: () => memory.clear()
      }});
    }""")
    page.set_content((root/"dist/index.html").read_text(),wait_until="load")
    page.wait_for_selector("main h1")
    page.locator('[data-action="choose-language"][data-lang="ar"]').click()
    page.wait_for_function("document.documentElement.lang==='ar'")
    page.screenshot(path=str(root/"evidence/home-desktop-ar.png"),full_page=True)
    print("Title",page.title())
    print("AR overflow",page.evaluate("({doc:document.documentElement.scrollWidth,win:innerWidth})"))
    page.locator('[data-action="language"]').first.click()
    page.screenshot(path=str(root/"evidence/home-desktop-en.png"),full_page=True)
    print("EN overflow",page.evaluate("({doc:document.documentElement.scrollWidth,win:innerWidth})"))
    page.set_viewport_size({"width":390,"height":844})
    page.screenshot(path=str(root/"evidence/home-mobile-en.png"),full_page=True)
    page.locator('[data-action="language"]').first.click()
    page.screenshot(path=str(root/"evidence/home-mobile-ar.png"),full_page=True)
    print("Mobile overflow",page.evaluate("({doc:document.documentElement.scrollWidth,win:innerWidth})"))
    print("Errors",json.dumps(errors))
    browser.close()
