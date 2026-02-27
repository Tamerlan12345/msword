from playwright.sync_api import sync_playwright

def verify_admin_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1024})
        page = context.new_page()

        try:
            # 1. Setup
            page.goto("http://localhost:5173/")
            page.evaluate("""() => {
                localStorage.setItem('token', 'mock-token');
                localStorage.setItem('user', JSON.stringify({
                    id: 1,
                    name: 'Admin User',
                    email: 'admin@example.com',
                    role: 'ADMIN'
                }));
            }""")
            page.goto("http://localhost:5173/admin")
            page.wait_for_selector("h1:has-text('Создание пользователя')")

            # 2. Interact - Fill ALL required fields
            page.fill("input#name", "Test User")
            page.fill("input#email", "test@example.com")
            page.fill("input#password", "securePassword123") # Added this

            # 3. Setup network mock for success
            # We delay it slightly to try and catch the loading state, though it's hard with screenshots in headless
            page.route("**/api/users", lambda route: route.fulfill(status=201, body='{"id": 2}', delay=1000))

            # 4. Submit
            page.click("button:has-text('Создать')")

            # 5. Capture Loading State immediately
            # We wait a tiny bit to ensure the React state update has processed
            page.wait_for_timeout(200)
            page.screenshot(path="frontend_verification/admin_page_loading_real.png")
            print("Screenshot taken: frontend_verification/admin_page_loading_real.png")

            # 6. Wait for Success Message
            # The mock delays for 1000ms, so we wait for the alert to appear
            page.wait_for_selector("div[role='alert']", timeout=5000)

            # 7. Capture Success State
            page.screenshot(path="frontend_verification/admin_page_success_real.png")
            print("Screenshot taken: frontend_verification/admin_page_success_real.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="frontend_verification/error_state_2.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_page()
