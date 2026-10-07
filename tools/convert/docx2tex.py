#!/usr/bin/env python3
"""docx2tex.py — chuyển một tệp Word (.docx, hoặc .doc qua LibreOffice) của tác giả sang văn bản có LaTeX.
  - công thức MathType (đối tượng OLE) → bộ giải mã MTEF riêng (mtef.py)
  - chữ và công thức Word gốc (OMML) → pandoc
Dùng: python3 tools/convert/docx2tex.py <tệp.docx|tệp.doc> <thư_mục_ra>
Kết quả: <thư_mục_ra>/<tên>.tex.txt. Chỉ chạy trên máy; KHÔNG commit tệp vào kho mã (scripts/guard.py chặn).
Toán học không bao giờ bị sửa; chỉ chuẩn hoá cách gõ. Công thức không giải mã được hiện là [[CÔNG THỨC LỖI …]].
"""
import sys, os, re, zipfile, subprocess, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mtef import from_ole
src_path, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
if src_path.lower().endswith('.doc'):
    subprocess.run(['soffice', '--headless', '--convert-to', 'docx', '--outdir', out, src_path], check=True, capture_output=True)
    src_path = os.path.join(out, os.path.splitext(os.path.basename(src_path))[0] + '.docx')
fid = os.path.splitext(os.path.basename(src_path))[0]
raw = open(src_path, 'rb').read()
if raw[:2] != b'PK': sys.exit('không phải tệp .docx')
path = os.path.join(out, fid + '.docx')
if os.path.abspath(path) != os.path.abspath(src_path): shutil.copy(src_path, path)
tmp = tempfile.mkdtemp()
with zipfile.ZipFile(path) as z: z.extractall(tmp)
docxml = open(tmp + '/word/document.xml', encoding='utf8').read()
rels = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', open(tmp + '/word/_rels/document.xml.rels', encoding='utf8').read()))
eqs = {}; bad = 0
def repl(m):
    global bad
    blk = m.group(0)
    r = re.search(r'<o:OLEObject[^>]*r:id="(rId\d+)"', blk)
    if not r: return blk
    tgt = rels.get(r.group(1), '')
    try: tex, w = from_ole(tmp + '/word/' + tgt)
    except Exception as e: tex, w = 'ERROR %r' % e, ['x']
    if tex.startswith('ERROR') or w: bad += 1; tex = '\\text{[[CÔNG THỨC LỖI: %s]]}' % tgt
    k = 'ZZEQ%dZZ' % len(eqs); eqs[k] = tex
    return '<w:t xml:space="preserve">%s</w:t>' % k
docxml2 = re.sub(r'<w:object\b.*?</w:object>', repl, docxml, flags=re.S)
open(tmp + '/word/document.xml', 'w', encoding='utf8').write(docxml2)
conv = path[:-5] + '.pre.docx'
with zipfile.ZipFile(conv, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, dn, fn in os.walk(tmp):
        for f in fn:
            full = os.path.join(dp, f); z.write(full, os.path.relpath(full, tmp))
txt = subprocess.run(['pandoc', '-f', 'docx', '-t', 'markdown-smart', '--wrap=none', conv], capture_output=True, text=True).stdout
for k, v in eqs.items(): txt = txt.replace(k, '$' + v + '$')
omml = docxml.count('<m:oMath>') + docxml.count('<m:oMath ')
open(path[:-5] + '.tex.txt', 'w', encoding='utf8').write(txt)
os.remove(conv); shutil.rmtree(tmp)
print('converted: MathType equations %d (failed %d), Word equations %d -> %s' % (len(eqs), bad, omml, path[:-5] + '.tex.txt'))
