from playwright.sync_api import sync_playwright
import sys

def scrape():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(sys.argv[1], wait_until="networkidle")
        
        # Extract the text content of the page
        text = page.evaluate("document.body.innerText")
        print(text)
        browser.close()

if __name__ == "__main__":
    scrape()
