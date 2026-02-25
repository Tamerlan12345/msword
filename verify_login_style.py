from playwright.sync_api import sync_playwright

def verify_login_styles():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the login page
        page.goto("http://localhost:4173/login")

        # Wait for the page to load
        page.wait_for_selector("text=Вход в систему")

        # Fill in the password
        page.fill("input[id='password']", "secret123")

        # Take a screenshot of the initial state
        page.screenshot(path="verification_login_initial.png")
        print("Initial screenshot taken.")

        # Click the show password toggle
        # The button has aria-label="Показать пароль"
        page.click("button[aria-label='Показать пароль']")

        # Verify the input type changed to text
        password_input = page.locator("input[id='password']")
        input_type = password_input.get_attribute("type")

        if input_type == "text":
            print("SUCCESS: Password input type changed to 'text'.")
        else:
            print(f"FAILURE: Password input type is '{input_type}'.")

        # Take a screenshot of the revealed password
        page.screenshot(path="verification_login_revealed.png")
        print("Revealed screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_login_styles()
