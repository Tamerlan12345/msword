from playwright.sync_api import sync_playwright
import time

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
            page.fill("input#password", "securePassword123")

            # 3. Setup network mock with MANUAL delay using time.sleep
            def handle_route(route):
                time.sleep(1) # Python side delay
                route.fulfill(status=201, body='{"id": 2}')

            page.route("**/api/users", handle_route)

            # 4. Submit (Clicking triggers the route handler)
            # Since the route handler blocks the network request, the UI should show 'Loading...'
            # However, time.sleep in the route handler blocks the Playwright thread?
            # No, because Playwright runs the handler in a separate task?
            # Actually, sync_playwright runs in a single thread, so time.sleep might block everything.
            # Let's try without the manual delay first to just get the success state.

            page.click("button:has-text('Создать')")

            # 5. Wait for Success Message
            page.wait_for_selector("div[role='alert']", timeout=5000)

            # 6. Capture Success State
            page.screenshot(path="frontend_verification/admin_page_success_real.png")
            print("Screenshot taken: frontend_verification/admin_page_success_real.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="frontend_verification/error_state_3.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_page()
