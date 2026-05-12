import urllib.request
import json
import re

url = "https://claude.ai/share/1aa4476d-c1df-4dea-9fc6-e5ddc192fad0"
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        # find <script id="__NEXT_DATA__" type="application/json">...</script>
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if match:
            print("Found __NEXT_DATA__")
            data = json.loads(match.group(1))
            # navigate JSON to find chat messages
            # typically in props.pageProps.initialState.chat.messages
            try:
                # Just print a portion of it to see the structure or extract text
                print(json.dumps(data)[:500])
            except Exception as e:
                print("Error parsing JSON:", e)
        else:
            print("No NEXT DATA found")
            # print some html to debug
            print(html[:500])
except Exception as e:
    print("Error:", e)
