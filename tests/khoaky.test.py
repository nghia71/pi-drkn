#!/usr/bin/env python3
"""Kiểm thử tools/khoaky/build.py: kiểm tra tệp .tex và giải nén an toàn (đề bịa). Biên dịch thật chỉ khi máy có xelatex."""
import contextlib
import importlib.util
import io
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('build', os.path.join(ROOT, 'tools', 'khoaky', 'build.py'))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)

HEAD = '\\input{structure/dinhdang}\n\\newcounter{stthuc}\n\\newcommand{\\thachthuc}{\\refstepcounter{stthuc}P\\arabic{stthuc}. }\n'
BODY = ('\\begin{document}\n\\setcounter{stthuc}{9000}\n\\thachthuc (Mức $B$)\n  Bài bịa: tính $1+1$.\n'
        '\\begin{flushright}\n\\textit{Tác Giả Thử (Trường Thử)}\n\\end{flushright}\n\\end{document}\n')
fails = []


def case(name, cond):
    if not cond:
        fails.append(name)


def check(text, raw=None, pics=()):
    d = tempfile.mkdtemp()
    p = os.path.join(d, 't.tex')
    open(p, 'wb').write(raw if raw is not None else text.encode('utf-8'))
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            return B.check_text(p, list(pics))
    finally:
        shutil.rmtree(d)


e, n = check(HEAD + BODY)
case('tệp đúng: không lỗi, không lưu ý', not e and not n)
e, n = check(HEAD + BODY.replace('Mức', 'Mu\u031bc'))
case('NFD bị báo lỗi', any('NFC' in x for x in e))
e, n = check('', raw=b'\xef\xbb\xbf' + (HEAD + BODY).encode('utf-8'))
case('BOM bị báo lỗi', any('BOM' in x for x in e))
e, n = check('', raw=(HEAD + BODY).encode('utf-8').replace('Bài'.encode(), b'\xff'))
case('không phải UTF-8 bị báo lỗi', any('UTF-8' in x for x in e))
e, n = check(HEAD + BODY.replace('\\end{document}', '\\lgi Lời giải bịa.\n\\end{document}'))
case('"Lời giải" trong thân tệp được báo', any('Lời giải' in x for x in n))
e, n = check(HEAD + BODY.replace('Trường Thử', 'thu@example.com'))
case('email trong thân tệp được báo', any('email' in x for x in n))
e, n = check(HEAD + BODY.replace('\\end{document}', '\\includegraphics{hinh-mat}\n\\end{document}'), pics=['khac.png'])
case('hình thiếu trong pic/ được báo', any('hinh-mat' in x for x in n))
e, n = check(HEAD + BODY.replace('\\end{document}', '\\includegraphics{hinh}\n\\end{document}'), pics=['hinh.png'])
case('hình có trong pic/ (không đuôi) thì không báo', not n)

# zip có đường dẫn ra ngoài thư mục bị từ chối
d = tempfile.mkdtemp()
zp = os.path.join(d, 'x.zip')
with zipfile.ZipFile(zp, 'w') as z:
    z.writestr('a.tex', HEAD + BODY)
    z.writestr('../ngoai.txt', 'x')
r = subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'khoaky', 'build.py'), zp, '--out', d], capture_output=True, text=True)
case('zip có "../" bị từ chối', r.returncode != 0 and 'đường dẫn lạ' in r.stderr)
case('không ghi gì ra ngoài', not os.path.exists(os.path.join(os.path.dirname(d), 'ngoai.txt')))
shutil.rmtree(d)

# biên dịch thật (nếu có xelatex): gói ra có .tex, pic/, .pdf
if shutil.which('xelatex'):
    d = tempfile.mkdtemp()
    zp = os.path.join(d, 'de-thu.zip')
    with zipfile.ZipFile(zp, 'w') as z:
        z.writestr('de-thu.tex', HEAD + BODY)
    # như máy Mac: XeLaTeX không thấy phông nào của hệ thống theo tên (FontAwesome phải được tìm theo tên tệp)
    conf = os.path.join(d, 'fonts.conf')
    open(conf, 'w').write('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>%s</dir>'
                          '<cachedir>%s</cachedir></fontconfig>' % (os.path.join(d, 'khong-co'), os.path.join(d, 'fc-cache')))
    env = dict(os.environ, FONTCONFIG_FILE=conf)
    r = subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'khoaky', 'build.py'), zp], capture_output=True, text=True, env=env)
    out = os.path.join(d, 'de-thu-btk.zip')
    case('biên dịch được (xelatex): ' + r.stderr.strip()[:200], r.returncode == 0 and os.path.exists(out))
    if os.path.exists(out):
        case('gói có .tex và .pdf', sorted(zipfile.ZipFile(out).namelist()) == ['de-thu.pdf', 'de-thu.tex'])
    shutil.rmtree(d)
    extra = ' (có biên dịch thật)'
else:
    extra = ' (máy không có xelatex — bỏ qua biên dịch)'

if fails:
    print('LỖI: ' + '; '.join(fails))
    sys.exit(1)
print('build.py: mọi trường hợp đều đạt' + extra)
