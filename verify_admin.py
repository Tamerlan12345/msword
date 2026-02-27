from playwright.sync_api import sync_playwright

def verify_admin_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a new context with a larger viewport for better screenshots
        context = browser.new_context(viewport={"width": 1280, "height": 1024})
        page = context.new_page()

        try:
            # 1. Navigate to the Admin page
            # Note: The frontend likely redirects to /login if not authenticated.
            # We might need to simulate a login or inject a token if the page is protected.
            # However, for visual verification of the structure, we can try accessing it directly
            # or we might see the redirect.
            # Let's try to simulate a logged-in state by injecting a mock token/user into localStorage
            # before navigating.

            page.goto("http://localhost:5173/")

            # Inject mock user data to bypass login and simulate ADMIN role
            page.evaluate("""() => {
                localStorage.setItem('token', 'mock-token');
                localStorage.setItem('user', JSON.stringify({
                    id: 1,
                    name: 'Admin User',
                    email: 'admin@example.com',
                    role: 'ADMIN'
                }));
            }""")

            # Now navigate to the Admin page
            page.goto("http://localhost:5173/admin")

            # Wait for the page to load key elements
            # We look for the new header icon and title
            page.wait_for_selector("h1:has-text('Создание пользователя')")

            # 2. Interact with the form to show active states or validation if possible
            # Let's type something into the name field to see the input styling
            page.fill("input#name", "Test User")
            page.fill("input#email", "test@example.com")

            # 3. Take a screenshot of the initial state
            page.screenshot(path="frontend_verification/admin_page_initial.png")
            print("Screenshot taken: frontend_verification/admin_page_initial.png")

            # 4. Simulate a loading state (optional, hard to capture without network intercept)
            # But we can try to click the button and capture the immediate state if it triggers
            # a network request. Since we don't have a backend running, the request will fail fast.
            # We can mock the network request to delay it and capture the loader.

            page.route("**/api/users", lambda route: route.fulfill(status=200, body='{"id": 2}', delay=1000))

            # Click create
            page.click("button:has-text('Создать')")

            # Wait a bit for the loader to appear (it should be immediate)
            page.wait_for_timeout(200)

            # Take a screenshot of the loading state
            page.screenshot(path="frontend_verification/admin_page_loading.png")
            print("Screenshot taken: frontend_verification/admin_page_loading.png")

            # Wait for the success message (after the 1s delay)
            page.wait_for_selector("div[role='alert']")

            # Take a screenshot of the success state
            page.screenshot(path="frontend_verification/admin_page_success.png")
            print("Screenshot taken: frontend_verification/admin_page_success.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            # Take a screenshot even on error to see what happened
            page.screenshot(path="frontend_verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_page()
