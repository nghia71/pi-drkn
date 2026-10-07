#!/usr/bin/env python3
"""check.py — hiển thị hàng loạt bài trong một tệp nhập (tools/convert/stage.py) bằng Chromium không giao diện
và báo bài nào có công thức MathJax lỗi hoặc lệnh LaTeX chưa hỗ trợ. Chạy trên máy, dữ liệu không rời máy.

Chuẩn bị một lần:  (cd tools/render-test && npm i mathjax@3 && pip install playwright && playwright install chromium)
Dùng:              python3 tools/render-test/check.py <tệp_nhập.json>
"""
import asyncio, json, os, sys, tempfile
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MATHJAX = os.path.join(HERE, 'node_modules', 'mathjax', 'es5', 'tex-chtml.js')


def page(items):
    render = open(os.path.join(REPO, 'shared', 'pi-render.js'), encoding='utf8').read()
    data = json.dumps([{'ma': i['problem']['ma_bai'], 'src': [i['problem'].get('de_bai') or '', i['problem'].get('loi_giai') or '']} for i in items],
                      ensure_ascii=False).replace('</', '<\\/')
    return ('<!doctype html><meta charset="utf-8"><script>window.MathJax={tex:{inlineMath:[["\\\\(","\\\\)"]],displayMath:[["\\\\[","\\\\]"]]},startup:{typeset:false}};</script>'
            '<script>' + render + '</script><script>MathJax.tex.macros=PiRender.MATH_MACROS;</script>'
            '<script src="file://' + MATHJAX + '"></script><body><script>var D=' + data + ';var W={};'
            'D.forEach(function(d){var s=document.createElement("section");s.dataset.ma=d.ma;var w=[];'
            'd.src.forEach(function(x){var r=PiRender.render(x);w=w.concat(r.warnings);s.innerHTML+=r.html});W[d.ma]=w;document.body.appendChild(s)});'
            'MathJax.startup.promise.then(function(){return MathJax.typesetPromise()}).then(function(){var o=[];'
            'document.querySelectorAll("section").forEach(function(s){var n=s.querySelectorAll("mjx-merror").length;'
            'if(n||W[s.dataset.ma].length)o.push({ma:s.dataset.ma,loi:n,canh_bao:W[s.dataset.ma]})});window.__out=o});</script>')


async def main():
    items = json.load(open(sys.argv[1], encoding='utf8'))
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf8') as f:
        f.write(page(items))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto('file://' + f.name)
        await pg.wait_for_function('window.__out', timeout=180000)
        out = await pg.evaluate('window.__out')
        await b.close()
    os.unlink(f.name)
    print('%d bài, %d bài có vấn đề' % (len(items), len(out)))
    for o in out:
        print(' ', o['ma'], 'lỗi công thức:', o['loi'], '| cảnh báo:', '; '.join(o['canh_bao']))
    sys.exit(1 if out else 0)

asyncio.run(main())
