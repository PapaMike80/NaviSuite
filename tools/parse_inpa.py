import urllib.request
import re
import json

url = 'https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id=d45517744c9041e59f647892608c36ee'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

with open('tools/inpa_page.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Saved tools/inpa_page.html, size:", len(html))

# Also let's check inPA API directly:
# The concorso_id is d45517744c9041e59f647892608c36ee
api_url = 'https://portale.inpa.gov.it/api/concorso/d45517744c9041e59f647892608c36ee'
req_api = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
try:
    with urllib.request.urlopen(req_api) as resp_api:
        api_data = json.loads(resp_api.read().decode('utf-8'))
        with open('tools/inpa_api.json', 'w', encoding='utf-8') as f:
            json.dump(api_data, f, indent=2, ensure_ascii=False)
        print("API successfully fetched and saved to tools/inpa_api.json")
except Exception as e:
    print("API fetch error:", e)

# Parse links in HTML
links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"', html)
print(f"\nFound {len(links)} href-title pairs in HTML:")
for href, title in links:
    print(f"- {title} -> {href}")

# Also check for title then href
links2 = re.findall(r'<a[^>]+title="([^"]+)"[^>]*href="([^"]+)"', html)
for title, href in links2:
    if (href, title) not in links:
        print(f"- {title} -> {href}")
