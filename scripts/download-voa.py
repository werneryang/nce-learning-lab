#!/usr/bin/env python3
"""Bounded, local-only VOA article collector. Python standard library + ffmpeg."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE = 'https://learningenglish.voanews.com'
ROOT = Path(__file__).resolve().parents[1]

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.walk()
    def raw_text(self):
        if self.tag == 'br':
            return '\n'
        return ''.join(c.raw_text() if isinstance(c, Node) else c for c in self.children)
    def text(self):
        return re.sub(r'\s+', ' ', self.raw_text()).strip()

class DOM(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].children.append(n)
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:
            self.stack.append(n)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break
    def handle_data(self, text):
        self.stack[-1].children.append(text)

def safe_url(url):
    u = urllib.parse.urlsplit(url)
    if u.scheme != 'https' or u.hostname not in {'learningenglish.voanews.com', 'voa-audio.voanews.eu'} or u.username or u.password:
        raise ValueError('Unexpected resource host')
    return url

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

OPENER = urllib.request.build_opener(SafeRedirect)
def fetch(url, maximum=3_000_000):
    safe_url(url)
    for attempt in range(3):
        time.sleep(0.7 if attempt == 0 else 2 ** attempt)
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'NCE-Learning-Lab/1.0 (personal local study)'})
            with OPENER.open(req, timeout=40) as r:
                data = r.read(maximum + 1)
                if len(data) > maximum:
                    raise ValueError('Resource exceeds size limit')
                return data
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise

def article_links(source):
    out = []
    for n in DOM(source).root.walk():
        href = urllib.parse.urljoin(BASE, n.attrs.get('href', ''))
        if n.tag == 'a' and re.fullmatch(r'https://learningenglish\.voanews\.com/a/(?:[^/]+/)?\d+\.html', href) and href not in out:
            out.append(href)
    return out

def extract(source, url):
    nodes = list(DOM(source).root.walk())
    title = next(n.text() for n in nodes if n.tag == 'h1')
    published = next(n.attrs['datetime'] for n in nodes if n.tag == 'time' and 'datetime' in n.attrs)
    body = next(n for n in nodes if n.tag == 'div' and 'wsw' in n.attrs.get('class','').split())
    paragraphs, vocabulary, credits = [], [], []
    vocab = False
    # Only direct body paragraphs/headings: exclude nested players, image captions and recommendations.
    for n in body.children:
        if not isinstance(n, Node) or n.tag not in {'p','h2','h3'}:
            continue
        text = n.text()
        if 'words in this story' in text.lower():
            vocab = True
            continue
        if not text or re.fullmatch(r'[_\s]+',text):
            continue
        if vocab:
            vocabulary.extend(re.sub(r'\s+', ' ', part).strip() for part in n.raw_text().split('\n') if part.strip())
        elif re.search(r'\b(reported|adapted|edited|wrote|produced)\b', text, re.I) and any(c.tag == 'em' for c in n.walk()):
            credits.append(re.sub(r'_{3,}', '', text).strip())
        else:
            paragraphs.append(text)
    audios = []
    for n in body.walk():
        u = n.attrs.get('href','')
        if n.tag == 'a' and u.startswith('https://voa-audio.voanews.eu/') and u.endswith('.mp3'):
            audios.append((u, n.text()))
    if not audios or len(paragraphs) < 3:
        raise ValueError('Missing article audio or insufficient body text')
    audio = next((u for u,label in audios if '64' in label), audios[0][0])
    article_id = re.search(r'/(\d+)\.html$',url).group(1)
    return {
        'lesson': {'id': f'VOA-{article_id}', 'series':'VOA', 'title':title,
                   'summary':'Health & Lifestyle · personal listening and reading',
                   'originalUrl':url, 'publishedAt':published, 'vocabulary':vocabulary,
                   'attribution':' '.join(credits) or 'VOA Learning English; authorship requires review.',
                   'pairingStatus':'page_linked_unreviewed'},
        'paragraphs': paragraphs,
        'audio': {'file':f'VOA-{article_id}.mp3', 'url':safe_url(audio)},
    }

def sha(data):
    return hashlib.sha256(data).hexdigest()

def verify_audio(path):
    result = subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','null','-'], capture_output=True, timeout=120)
    if result.returncode:
        raise ValueError('MP3 decode failed: ' + result.stderr.decode(errors='replace')[:300])

def collect(url, output):
    article_id = re.search(r'/(\d+)\.html$',url).group(1)
    dest = output / f'VOA-{article_id}'
    if dest.exists():
        entry = json.loads((dest/'metadata.json').read_text())
        audio = dest / entry['audio']['file']
        if sha(audio.read_bytes()) != entry['audio']['sha256'] or sha((dest/'transcript.txt').read_bytes()) != entry['transcriptSha256']:
            raise ValueError(f'Existing files changed in {dest}; preserved, not overwritten')
        verify_audio(audio)
        return entry, 'reused'
    raw = fetch(url)
    entry = extract(raw.decode('utf-8'), url)
    audio = fetch(entry['audio']['url'], 50_000_000)
    entry['audio'].update(sha256=sha(audio), bytes=len(audio))
    transcript = ('\n\n'.join(entry['paragraphs'])+'\n').encode()
    entry.update(fetchedAt=datetime.now(timezone.utc).isoformat(), transcriptSha256=sha(transcript),
                 htmlSha256=sha(raw), rightsStatus='unverified', audioDecoded=True)
    with tempfile.TemporaryDirectory(prefix='.voa-',dir=output) as tmp:
        stage = Path(tmp)
        (stage/entry['audio']['file']).write_bytes(audio)
        verify_audio(stage/entry['audio']['file'])
        (stage/'transcript.txt').write_bytes(transcript)
        (stage/'vocabulary.txt').write_text('\n'.join(entry['lesson']['vocabulary'])+'\n')
        (stage/'article.html').write_bytes(raw)
        (stage/'metadata.json').write_text(json.dumps(entry,ensure_ascii=False,indent=2)+'\n')
        # Destination must not exist; never replace a previous article directory.
        if dest.exists():
            raise ValueError('Article directory appeared during download')
        stage.rename(dest)
    return entry, 'downloaded'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit',type=int,default=10)
    parser.add_argument('--max-pages',type=int,default=3)
    parser.add_argument('--output',type=Path,default=ROOT/'private'/'voa-health')
    args = parser.parse_args()
    if not 1 <= args.limit <= 20 or not 1 <= args.max_pages <= 20:
        parser.error('limit and max-pages must be between 1 and 20')
    output = args.output.resolve()
    if output.is_relative_to(ROOT) and not output.is_relative_to(ROOT/'private'):
        parser.error('Inside the repository, output must be under private/ (never public or content).')
    if not shutil.which('ffmpeg'):
        parser.error('ffmpeg is required for complete MP3 decoding validation')
    output.mkdir(parents=True,exist_ok=True)
    entries, outcomes, seen = [], [], set()
    for page in range(args.max_pages):
        links = article_links(fetch(f'{BASE}/z/955?p={page}').decode())
        fresh = [u for u in links if re.search(r'/(\d+)\.html$',u).group(1) not in seen]
        if not fresh:
            break
        for url in fresh:
            seen.add(re.search(r'/(\d+)\.html$',url).group(1))
            try:
                entry,status = collect(url,output)
                entries.append(entry)
                outcomes.append({'url':url,'status':status,'bytes':entry['audio']['bytes'],'paragraphs':len(entry['paragraphs'])})
                print(status,entry['lesson']['id'],entry['lesson']['title'],flush=True)
            except Exception as e:
                outcomes.append({'url':url,'status':'failed','error':str(e)})
                print('failed',url,str(e),flush=True)
            if len(entries) >= args.limit:
                break
        if len(entries) >= args.limit:
            break
    package = {'format':'nce-voa-package','version':1,'entries':entries}
    manifest = output/'library.json'
    serialized = json.dumps(package,ensure_ascii=False,indent=2)+'\n'
    if entries:
        if manifest.exists() and manifest.read_text() != serialized:
            raise ValueError('Existing library.json differs; preserved. Select a new output directory for a different collection.')
        if not manifest.exists():
            with manifest.open('x') as f:
                f.write(serialized)
    report = {'requested':args.limit,'collected':len(entries),'pairingStatus':'page_linked_unreviewed','outcomes':outcomes}
    report_path = output / ('report-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'collected':len(entries),'manifest':str(manifest),'report':str(report_path)}))
    return 0 if len(entries) == args.limit else 1

if __name__ == '__main__':
    raise SystemExit(main())
