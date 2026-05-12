import urllib.request
import json
import re
import sys

url = sys.argv[1]
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            # try to find messages
            try:
                messages = data['props']['pageProps']['initialState']['sharedChat']['messages']
                for m in messages:
                    print(f"Role: {m['role']}")
                    for content in m['content']:
                        if content['type'] == 'text':
                            print(content['text'])
                    print("-" * 40)
            except KeyError:
                print("Could not find messages in expected path. Dumping first 1000 chars of JSON:")
                print(json.dumps(data)[:1000])
        else:
            print("No NEXT DATA found")
except Exception as e:
    print("Error:", e)
