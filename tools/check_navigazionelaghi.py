import urllib.request
import re

url = 'https://www.navigazionelaghi.it/bandi'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

pos = html.find('C163')
if pos != -1:
    snippet = html[max(0, pos-500):pos+2500]
    links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', snippet, re.DOTALL)
    print('Snippet around C163 links:')
    for h, t in links:
        clean_t = re.sub(r'<[^>]+>', ' ', t).strip()
        print(f'- [{clean_t}] -> {h}')
