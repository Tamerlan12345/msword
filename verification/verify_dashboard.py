from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)

    # Helper to setup user
    def setup_user(page):
        page.add_init_script("""
            localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test User' }));
            localStorage.setItem('token', 'fake-token');
        """)

    # 1. Loading State
    print("Testing Loading State...")
    context = browser.new_context()
    page = context.new_page()
    setup_user(page)

    # Hang the request
    page.route("**/api/documents", lambda route: None)

    page.goto("http://localhost:4173/", wait_until="domcontentloaded")

    try:
        page.wait_for_selector("text=Загрузка документов...", timeout=5000)
        page.screenshot(path="verification/1_loading.png")
        print("Success: Loading state captured.")
    except Exception as e:
        print(f"Failed to capture loading state: {e}")
        page.screenshot(path="verification/1_loading_fail.png")

    context.close()

    # 2. Error State
    print("Testing Error State...")
    context = browser.new_context()
    page = context.new_page()
    setup_user(page)

    # Fail the request
    page.route("**/api/documents", lambda route: route.abort())

    page.goto("http://localhost:4173/", wait_until="domcontentloaded")
    try:
        page.wait_for_selector("text=Ошибка загрузки", timeout=5000)
        page.screenshot(path="verification/2_error.png")
        print("Success: Error state captured.")
    except Exception as e:
        print(f"Failed to capture error state: {e}")
        page.screenshot(path="verification/2_error_fail.png")

    context.close()

    # 3. Empty State
    print("Testing Empty State...")
    context = browser.new_context()
    page = context.new_page()
    setup_user(page)

    # Return empty list
    page.route("**/api/documents", lambda route: route.fulfill(status=200, body="[]", headers={"Content-Type": "application/json"}))

    page.goto("http://localhost:4173/", wait_until="domcontentloaded")
    try:
        page.wait_for_selector("text=У вас пока нет документов", timeout=5000)
        page.screenshot(path="verification/3_empty.png")
        print("Success: Empty state captured.")
    except Exception as e:
        print(f"Failed to capture empty state: {e}")
        page.screenshot(path="verification/3_empty_fail.png")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
