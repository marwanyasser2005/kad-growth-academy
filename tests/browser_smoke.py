from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT/"dist/index.html").read_text()
CURRICULUM = json.loads((ROOT/"src/data/curriculum.mjs").read_text().split("=",1)[1].strip().rstrip(";"))
LESSONS = CURRICULUM["lessons"]
results={"environment":"Chromium DOM rendering via set_content; navigation is blocked by host policy, so browser storage is a test-only in-memory localStorage implementation.","checks":[],"page_errors":[],"overflow":[]}
def check(name,condition):
    results["checks"].append({"name":name,"passed":bool(condition)})
    if not condition: raise AssertionError(name)
def bootstrap(page):
    page.evaluate("""() => {
      const memory=new Map();
      Object.defineProperty(window,'localStorage',{value:{
        getItem:k=>memory.has(k)?memory.get(k):null,
        setItem:(k,v)=>memory.set(k,String(v)),
        removeItem:k=>memory.delete(k),clear:()=>memory.clear()
      }});
    }""")
    page.set_content(HTML,wait_until="load")
    page.wait_for_selector("main h1")
def nav(page,path):
    page.evaluate("(p)=>{location.hash=p}",path)
    page.wait_for_function("(p)=>location.hash==='#'+p",arg=path)
    page.wait_for_timeout(35)
def stored(page):
    return page.evaluate("JSON.parse(localStorage.getItem('kad-growth.open.v1'))")
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path="/usr/bin/chromium",headless=True,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1440,"height":1000})
    page.set_default_timeout(5000)
    page.on("pageerror",lambda e:results["page_errors"].append(str(e)))
    bootstrap(page)
    check("First run shows a language gate",page.locator(".lang-gate").count()==1)
    page.locator('[data-action="choose-language"][data-lang="ar"]').click()
    page.wait_for_function("document.documentElement.lang==='ar'")
    check("Arabic journey chosen, RTL applied",page.evaluate("document.documentElement.dir")=="rtl")
    check("No external video iframe before consent",page.locator("iframe").count()==0)
    nav(page,"/library")
    page.wait_for_function("document.querySelectorAll('.lesson-card').length===11")
    check("Arabic journey shows 11 Arabic lessons only",page.locator(".lesson-card").count()==11)
    nav(page,"/library?q=NO-SUCH-LESSON")
    check("Empty search handled",page.locator(".empty-state").count()==1)
    nav(page,"/learn/what-is-leadership")
    check("Lesson starts incomplete",page.locator(".completion-message").count()==0)
    check("Quiz is locked before 90% measured viewing",page.locator('[data-action="start-quiz"]').count()==0)
    nav(page,"/settings")
    with page.expect_download() as seed_dl:
        page.locator('[data-action="export-data"]').click()
    seed_dl.value.save_as(str(ROOT/"evidence/seed-base.json"))
    seed=json.loads((ROOT/"evidence/seed-base.json").read_text())
    seed["progress"]["what-is-leadership"]={"duration":100,"watched":list(range(90)),"bestScore":0,"reflection":"","attempts":[]}
    seed.pop("checksum",None)
    (ROOT/"evidence/seed-coverage.json").write_text(json.dumps(seed))
    page.locator("#import-data").set_input_files(str(ROOT/"evidence/seed-coverage.json"))
    page.locator('[data-action="import-replace"]').click()
    nav(page,"/learn/what-is-leadership")
    page.locator('[data-action="start-quiz"]').click()
    check("First quiz contains 5 questions",page.locator(".quiz-question").count()==5)
    page.locator('#quiz-form button[type="submit"]').click()
    check("Unanswered quiz rejected",bool(page.locator("#quiz-error").inner_text()))
    # Choose the stable correct option IDs through visible label elements.
    for field in page.locator(".quiz-question").all():
        field.locator('input[value="o0"]').evaluate("(el)=>el.closest('label').click()")
    page.locator('#quiz-form button[type="submit"]').click()
    check("Perfect quiz is scored 100",stored(page)["progress"]["what-is-leadership"]["bestScore"]==100)
    check("Explanations shown for every answer",page.locator(".answer-explanation").count()==5)
    check("Quiz alone does not complete lesson",page.locator(".completion-message").count()==0)
    page.locator("#lesson-reflection").fill("In my next coordination meeting, I will confirm the owner, deadline, and unresolved decision before closing.")
    check("Reflection persists before explicit save or delayed callbacks",stored(page)["progress"]["what-is-leadership"]["reflection"].startswith("In my next coordination"))
    page.locator('[data-action="save-reflection"]').click()
    check("Lesson completes with all three requirements",page.locator(".completion-message").count()==1)
    page.locator('[data-action="save-lesson"]').first.click()
    check("Bookmark persisted", "what-is-leadership" in stored(page)["saved"])
    nav(page,"/saved")
    check("Saved library displays bookmarked item",page.locator(".lesson-card").count()==1)
    nav(page,"/learn/what-is-leadership")
    check("Quiz result and reflection survive navigation",page.locator(".answer-explanation").count()==5 and len(page.locator("#lesson-reflection").input_value())>40)
    page.locator('[data-action="retry-quiz"]').click()
    check("Retake clears active answers, retains best score",len(stored(page)["quizDrafts"]["what-is-leadership"]["answers"])==0 and stored(page)["progress"]["what-is-leadership"]["bestScore"]==100)
    nav(page,"/notes")
    page.locator("#note-text").fill('<img src=x onerror="window.__xss=1"> A safe literal note.')
    page.locator('#note-form button[type="submit"]').click()
    check("Notes are escaped, not executable",page.locator(".note-card img").count()==0 and page.evaluate("window.__xss===undefined"))
    check("Note persisted",len(stored(page)["notes"])==1)
    nav(page,"/practice/case-1")
    page.locator('button[value="submit"]').click()
    check("Empty practice submission rejected",bool(page.locator("#practice-error").inner_text()))
    for field in page.locator("#practice-form textarea").all():
        field.fill("I will confirm the current revision, clarify the decision owner, and agree a specific next review time.")
    for box in page.locator("#practice-form input[type=checkbox]").all():box.check()
    page.locator('button[value="submit"]').click()
    check("Practice submission is recorded locally",stored(page)["practices"]["case-1"]["status"]=="submitted")
    nav(page,"/toolkit/delegation")
    page.locator("#field-f1").fill("A coordinated package with an agreed revision and acceptance criteria.")
    page.locator('#tool-form button[type="submit"]').click()
    check("Editable tool saves",len(stored(page)["toolValues"]["delegation"]["f1"])>30)
    nav(page,"/assessment")
    for group in page.locator(".assessment-item").all():
        group.locator('input[value="3"]').evaluate("(el)=>el.closest('label').click()")
    page.locator('#assessment-form button[type="submit"]').click()
    check("Nine self-ratings saved separately",len(stored(page)["assessments"]["pre"]["values"])==9)
    nav(page,"/profile")
    page.locator("#profile-name").fill("Test Learner")
    page.locator("#profile-department").select_option("Architecture")
    page.locator('#profile-form button[type="submit"]').click()
    check("Local profile saves without account",stored(page)["profile"]["name"]=="Test Learner")
    nav(page,"/capstone")
    page.locator('button[value="submit"]').click()
    check("Capstone submission validates required fields",bool(page.locator("#capstone-error").inner_text()))
    for field in page.locator("#capstone-form textarea").all():
        field.fill("I tested a clearer handoff in one coordination cycle and will review the specific outcome with a colleague.")
    page.locator('#capstone-form input[name="honest"]').check()
    page.locator('button[value="submit"]').click()
    check("Capstone is a local submitted record",stored(page)["capstone"]["status"]=="submitted")
    nav(page,"/certificate")
    check("Certificate remains locked for partial completion",page.locator("#print-record").count()==0)
    nav(page,"/admin/content")
    page.locator('[data-action="edit-content"]').first.click()
    page.locator("#edit-video-id").fill("bad")
    page.locator('#content-edit-form button[type="submit"]').click()
    check("Invalid video ID rejected",bool(page.locator("#content-error").inner_text()))
    page.locator("#edit-video-id").fill("LU84BFFqKvI")
    page.locator("#edit-review-note").fill("Test-only replacement; requires review.")
    page.locator('#content-edit-form button[type="submit"]').click()
    check("Content override remains local",stored(page)["contentOverrides"]["what-is-leadership"]["youtubeId"]=="LU84BFFqKvI")
    nav(page,"/help")
    page.locator("#issue-text").fill("Test issue: the sample video could not be reached on this network.")
    page.locator('#issue-form button[type="submit"]').click()
    check("Issue saved locally, not sent",len(stored(page)["issues"])==1)
    # Complete route inventory and overflow checks on both desktop and mobile.
    routes=["/","/welcome","/leadership","/library","/saved","/practice","/toolkit","/assessment","/progress","/notes","/capstone","/achievements","/certificate","/profile","/settings","/help","/about","/sources","/privacy","/terms","/login","/register","/forgot-password","/reset-password","/manager","/admin","/admin/content","/admin/questions","/admin/roadmap","/admin/reports"]
    routes += ["/learn/"+l["id"] for l in LESSONS]
    routes += ["/practice/case-"+str(i) for i in range(1,10)]
    routes += ["/toolkit/"+x for x in ["manual","reflection","pause","meeting","speak-up","delegation","feedback","decision","agreement"]]
    routes += ["/admin/roadmap/communication","/communication","/tracks/advanced-leadership","/learn/not-real"]
    for width in [1440,390]:
        page.set_viewport_size({"width":width,"height":1000 if width==1440 else 844})
        for lang in ["ar","en"]:
            current=page.evaluate("document.documentElement.lang")
            if current!=lang:page.locator('[data-action="language"]').first.click()
            for path in routes:
                nav(page,path)
                check(f"Renders {lang} {width} {path}",page.locator("main h1").count()==1)
                overflow=page.evaluate("document.documentElement.scrollWidth>innerWidth+1")
                if overflow:results["overflow"].append({"path":path,"language":lang,"width":width})
    check("No horizontal page overflow",len(results["overflow"])==0)
    check("No JavaScript page errors",len(results["page_errors"])==0)
    nav(page,"/communication")
    check("Future public route is hidden",page.locator(".not-found").count()==1)
    for path in ["/login","/register","/forgot-password","/reset-password"]:
        nav(page,path)
        check("Credentials disabled "+path,page.locator(".auth-preview-form input:enabled").count()==0)
    nav(page,"/settings")
    with page.expect_download() as d:
        page.locator('[data-action="export-data"]').click()
    download=d.value
    download.save_as(str(ROOT/"evidence/test-backup.json"))
    check("Backup export produces valid JSON",json.loads((ROOT/"evidence/test-backup.json").read_text())["schemaVersion"]==2)
    # Invalid import does not alter state.
    before=stored(page)
    page.locator("#import-data").set_input_files({"name":"bad.json","mimeType":"application/json","buffer":b'{"schemaVersion":999}'})
    page.wait_for_timeout(100)
    check("Invalid import preserves local record",stored(page)==before)
    # Import a legitimate edited backup after confirmation.
    backup=json.loads((ROOT/"evidence/test-backup.json").read_text())
    backup["profile"]["name"]="Imported Learner"
    backup.pop("checksum",None)
    page.locator("#import-data").set_input_files({"name":"valid.json","mimeType":"application/json","buffer":json.dumps(backup).encode()})
    page.locator('[data-action="import-replace"]').click()
    check("Valid import replaces after confirmation",stored(page)["profile"]["name"]=="Imported Learner")
    # Reset requires confirmation; cancel then accept.
    page.locator('[data-action="reset-data"]').click()
    page.locator('[data-action="close-modal"]').last.click()
    check("Cancel reset preserves progress",len(stored(page)["progress"])>0)
    page.locator('[data-action="reset-data"]').click()
    page.locator("#confirm-dialog").click()
    check("Confirmed reset clears progress and notes",stored(page)["progress"]=={} and stored(page)["notes"]==[])
    # Clean screenshots, no test names or records.
    page.set_viewport_size({"width":1440,"height":1080})
    nav(page,"/")
    if page.evaluate("document.documentElement.lang")!="ar":page.locator('[data-action="language"]').first.click()
    page.screenshot(path=str(ROOT/"evidence/home-desktop-ar.png"),full_page=True)
    page.locator('[data-action="language"]').first.click()
    page.screenshot(path=str(ROOT/"evidence/home-desktop-en.png"),full_page=True)
    nav(page,"/learn/active-listening")
    page.screenshot(path=str(ROOT/"evidence/lesson-desktop-en.png"),full_page=True)
    nav(page,"/admin")
    page.screenshot(path=str(ROOT/"evidence/admin-desktop-en.png"),full_page=True)
    page.set_viewport_size({"width":390,"height":844})
    nav(page,"/")
    page.screenshot(path=str(ROOT/"evidence/home-mobile-en.png"),full_page=True)
    page.locator('[data-action="language"]').first.click()
    page.screenshot(path=str(ROOT/"evidence/home-mobile-ar.png"),full_page=True)
    nav(page,"/learn/what-is-leadership")
    page.screenshot(path=str(ROOT/"evidence/lesson-mobile-ar.png"),full_page=True)
    browser.close()
results["summary"]={"passed":sum(r["passed"] for r in results["checks"]),"total":len(results["checks"]),"routesPerVariant":len(routes),"variants":4,"externalVideoPlayback":"NOT VERIFIED: network/navigation restricted in the build environment"}
(ROOT/"evidence/browser-report.json").write_text(json.dumps(results,indent=2))
print(json.dumps(results["summary"],indent=2))
