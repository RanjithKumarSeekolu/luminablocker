from playwright.sync_api import sync_playwright

def scrape():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://claude.ai/share/1aa4476d-c1df-4dea-9fc6-e5ddc192fad0", wait_until="networkidle")
        
        # Extract the text content of the page
        text = page.evaluate("document.body.innerText")
        print(text)
        browser.close()

if __name__ == "__main__":
    scrape()
