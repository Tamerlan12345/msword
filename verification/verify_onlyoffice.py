from playwright.sync_api import sync_playwright

def verify_editor(page):
    page.goto("http://localhost:5173/login")

    # Login
    page.fill("input[type='email']", "veronik7@admin.com")
    page.fill("input[type='password']", "Veronika77777")
    page.click("button[type='submit']")

    # Wait for dashboard
    page.wait_for_selector("text=Мои задачи")

    # Go to document detail (mocked document ID from seed or created via UI)
    # First, let's create a new document
    page.click("text=Новый документ")
    page.fill("input[placeholder='Название документа']", "Test Document ONLYOFFICE")
    page.click("button:has-text('Создать')")

    # Wait for editor to load (Tiptap initially)
    page.wait_for_selector(".ProseMirror")
    page.screenshot(path="verification/tiptap_editor.png")

    print("Verification script finished.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_editor(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
