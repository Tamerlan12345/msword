import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Mock Login
    def handle_login(route):
        route.fulfill(status=200, json={"token": "fake-token", "user": {"id": "1", "name": "Test User", "role": "ADMIN"}})
    page.route("**/api/auth/login", handle_login)

    # Mock User List (if needed by dashboard)
    def handle_users(route):
        route.fulfill(status=200, json=[])
    page.route("**/api/users", handle_users)

    # Mock Documents List
    def handle_docs(route):
        print("Handling /api/documents")
        route.fulfill(status=200, json=[
            {"id": "doc1", "title": "Test Doc", "status": "DRAFT", "authorId": "1", "updatedAt": "2023-01-01T00:00:00Z", "versions": [], "author": {"name": "Test User"}}
        ])
    page.route("**/api/documents", handle_docs)

    # Mock Single Document
    def handle_doc(route):
        print("Handling /api/documents/doc1")
        route.fulfill(status=200, json={
            "id": "doc1", "title": "Test Doc", "status": "DRAFT", "authorId": "1", "updatedAt": "2023-01-01T00:00:00Z",
            "versions": [{"version": 1, "filePath": "path/to/file", "createdAt": "2023-01-01T00:00:00Z"}],
            "author": {"name": "Test User"},
            "approvers": [],
            "comments": []
        })
    page.route("**/api/documents/doc1", handle_doc)

    # Mock Approvers (create endpoint)
    page.route("**/api/documents/doc1/approvers", lambda route: route.fulfill(status=200, json={"message": "ok"}))

    # Go to login
    print("Navigating to login...")
    page.goto("http://localhost:5173/login")

    # Login
    print("Logging in...")
    page.get_by_placeholder("veronik7@admin.com").fill("test@test.com")
    page.get_by_placeholder("••••••••").fill("password")
    page.get_by_role("button", name="Войти").click()

    # Wait for navigation
    page.wait_for_url("**/")
    print("Logged in, on dashboard.")

    # Click on document
    print("Opening document...")
    try:
        page.wait_for_selector("text=Test Doc", timeout=5000)
        page.get_by_text("Test Doc").click()
    except Exception as e:
        print("Failed to find document on dashboard. Taking screenshot.")
        page.screenshot(path="/home/jules/verification/dashboard_error.png")
        raise e

    # Wait for document page
    page.wait_for_url("**/documents/doc1")
    print("On document page.")

    # Check for iframe
    print("Checking for iframe...")
    try:
        iframe = page.locator("iframe[title='Collabora Editor']")
        iframe.wait_for(state="visible", timeout=10000)

        src = iframe.get_attribute("src")
        print(f"Iframe src: {src}")

        # Expected: https://fake-collabora.com/browser/dist/cool.html?WOPISrc=https%3A%2F%2Ffake-api.com%2Fwopi%2Ffiles%2Fdoc1&access_token=fake-token
        if "cool.html" in src and "doc1" in src and "access_token" in src and "fake-collabora.com" in src:
            print("Verification SUCCESS: Iframe src is correct.")
        else:
            print(f"Verification FAILED: Iframe src incorrect: {src}")

    except Exception as e:
        print(f"Iframe not found or timed out: {e}")

    # Screenshot
    page.screenshot(path="/home/jules/verification/verification.png")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
