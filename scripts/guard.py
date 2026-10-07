#!/usr/bin/env python3
"""guard.py — refuse commits that would put problem data, personal data or identifiers into this repo.

Usage:
  scripts/guard.py --staged      # pre-commit hook: check files staged for commit
  scripts/guard.py --all         # CI: check every tracked file
Exit code 1 (with a list of reasons) if anything is suspicious.  False positives are fixed by
moving real examples into tests/fixtures/ (invented problems only) or by adding a narrow pattern
to ALLOW below — never by switching the guard off.
"""
import os, re, subprocess, sys

BLOCKED_DIRS = ('data/', 'staging/', 'exports/', 'figures/')
BLOCKED_EXT = {'.docx', '.doc', '.pdf', '.wmf', '.emf', '.png', '.jpg', '.jpeg', '.svg', '.tikz',
               '.xlsx', '.csv', '.zip', '.gz'}
JSON_OK = re.compile(r'^(apps/[^/]+/appsscript\.json|package(-lock)?\.json|tests/fixtures/[^/]+\.json)$')
TEXT_EXT = {'.gs', '.js', '.html', '.md', '.py', '.json', '.txt', '.tex', '.sh', '.yml', '.yaml', '.css'}

PATTERNS = [
    ('số điện thoại', re.compile(r'(?<![\w.])(?:\+?84|0)(?:[\s.\-]?\d){9,10}(?!\d)')),
    ('chuỗi số dài (tài khoản/CCCD?)', re.compile(r'(?<![\w.])\d{9,16}(?![\w.])')),
    ('địa chỉ email', re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')),
    ('ID triển khai Apps Script', re.compile(r'AKfycb[\w-]{20,}')),
    ('ID Google Drive/Sheet', re.compile(r'(?<![\w-])1[\w-]{32,43}(?![\w-])')),
    ('khoá bí mật', re.compile(r'SECRET\s*[:=]\s*["\'][^"\']{12,}["\']')),
]
ALLOW = [
    re.compile(r'@example\.(com|org)'), re.compile(r'noreply@'), re.compile(r'@anthropic\.com'),
    re.compile(r'@users\.noreply\.github\.com'),
]
# a line that looks like a problem statement / solution (Vietnamese keywords + real math)
PROBLEM_WORDS = re.compile(r'(Chứng minh rằng|Tìm tất cả|Tìm giá trị|Lời giải|Cho (tam giác|các số|số nguyên|đa thức|hàm số))')
MATHY = re.compile(r'\$[^$\n]*(\\frac|\\sqrt|\^|_\{|\\le|\\ge|\\sum|\\prod)[^$\n]*\$')


def files(mode):
    if mode == '--staged':
        out = subprocess.run(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], capture_output=True, text=True).stdout
    else:
        out = subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout
    return [f for f in out.splitlines() if f]


def content(path, mode):
    if mode == '--staged':
        r = subprocess.run(['git', 'show', ':' + path], capture_output=True)
        return r.stdout
    with open(path, 'rb') as fh:
        return fh.read()


def check(path, mode):
    reasons = []
    low = path.lower()
    ext = os.path.splitext(low)[1]
    if low.startswith(BLOCKED_DIRS):
        reasons.append('thư mục dữ liệu không được commit')
    if ext in BLOCKED_EXT:
        reasons.append('loại tệp dữ liệu (%s) không được commit' % ext)
    if ext == '.json' and not JSON_OK.match(path):
        reasons.append('tệp .json ngoài danh sách cho phép (dữ liệu?)')
    if path.startswith('tests/fixtures/'):
        return reasons  # fixtures are invented; only path/type rules apply
    if ext in TEXT_EXT or ext == '':
        try:
            text = content(path, mode).decode('utf8', 'replace')
        except Exception:
            return reasons
        for name, rx in PATTERNS:
            for m in rx.finditer(text):
                if any(a.search(m.group(0)) for a in ALLOW):
                    continue
                line = text.count('\n', 0, m.start()) + 1
                reasons.append('%s ở dòng %d' % (name, line))
                break
        hits = [i + 1 for i, ln in enumerate(text.splitlines()) if PROBLEM_WORDS.search(ln) and MATHY.search(ln)]
        if len(hits) >= 2:
            reasons.append('có vẻ chứa đề bài/lời giải thật (dòng %s) — dùng bài bịa trong tests/fixtures' % ', '.join(map(str, hits[:5])))
    return reasons


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else '--staged'
    bad = {}
    for f in files(mode):
        if f == 'scripts/guard.py':
            continue
        if mode != '--staged' and not os.path.exists(f):
            continue
        r = check(f, mode)
        if r:
            bad[f] = r
    if bad:
        print('guard.py: TỪ CHỐI — có thể lộ dữ liệu:')
        for f, rs in bad.items():
            for r in rs:
                print('  %s: %s' % (f, r))
        print('Xem docs/data-policy.md.')
        sys.exit(1)
    print('guard.py: OK (%d tệp)' % len(files(mode)))


if __name__ == '__main__':
    main()
