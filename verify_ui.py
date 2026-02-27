import json
from playwright.sync_api import sync_playwright

def verify_document_detail():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()

        # Inject mock user and token
        user = {
            "id": "user1",
            "name": "Test User",
            "email": "test@example.com",
            "role": "USER"
        }

        # Add init script to set localStorage before page load
        context.add_init_script(f"""
            localStorage.setItem('user', '{json.dumps(user)}');
            localStorage.setItem('token', 'mock-token');
        """)

        page = context.new_page()

        # Mock the document API response
        page.route("**/api/documents/doc1", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "id": "doc1",
                "title": "Test Document for UI Verification",
                "status": "ON_APPROVAL",
                "authorId": "user1",
                "versions": [],
                "content": "<p>Test content</p>",
                "createdAt": "2024-03-20T10:00:00Z",
                "approvers": [
                    {
                        "id": "app1",
                        "userId": "user2",
                        "status": "APPROVED",
                        "serialNumber": 0,
                        "isCurrent": False,
                        "comment": "Looks good to me",
                        "actionDate": "2024-03-20T11:00:00Z",
                        "user": {"name": "Alice Manager", "department": "Management"}
                    },
                    {
                        "id": "app2",
                        "userId": "user1",
                        "status": "PENDING",
                        "serialNumber": 1,
                        "isCurrent": True,
                        "comment": "",
                        "user": {"name": "Test User", "department": "Engineering"}
                    },
                    {
                        "id": "app3",
                        "userId": "user3",
                        "status": "PENDING",
                        "serialNumber": 2,
                        "isCurrent": False,
                        "comment": "",
                        "user": {"name": "Bob Director", "department": "Executive"}
                    }
                ]
            })
        ))

        # Mock users API
        page.route("**/api/users", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([
                {"id": "user1", "name": "Test User"},
                {"id": "user2", "name": "Alice Manager"},
                {"id": "user3", "name": "Bob Director"}
            ])
        ))

        # Navigate to the document detail page
        page.goto("http://localhost:5173/documents/doc1")

        # Wait for the document title to appear
        page.wait_for_selector("text=Test Document for UI Verification")

        # Wait for the sidebar and approvers to load
        page.wait_for_selector("text=Маршрут согласования")

        # Take a screenshot
        page.screenshot(path="verification_document_detail.png")
        print("Screenshot saved to verification_document_detail.png")

        browser.close()

if __name__ == "__main__":
    verify_document_detail()
