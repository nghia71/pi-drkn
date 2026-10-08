/* pi-render.js — turn a problem's LaTeX/Markdown source into HTML for MathJax.
   Same code is meant to run in the browser page of the Apps Script web app.
   Math is left to MathJax; text-mode LaTeX and Pi's macros are converted here.
   Returns {html, warnings}. Nothing is ever changed in the stored source. */
(function (root) {
  var TEXT_MACROS = {
    kck: 'khi và chỉ khi ', dtr: 'đường tròn ', Dtr: 'Đường tròn ', dtrj: 'đường tròn.',
    dth: 'đường thẳng ', dthj: 'đường thẳng.', dthp: 'đường thẳng,', Dth: 'Đường thẳng ',
    dgl: 'được gọi là ', vt: 'vectơ ', Vt: 'Vectơ ', ptr: 'phương trình ', dkh: 'đường kính ',
    Dpcm: 'Điều phải chứng minh.', dpcm: 'điều phải chứng minh ', Dpcmj: 'Điều phải chứng minh.',
    dpcmj: 'điều phải chứng minh.', cmr: 'Chứng minh rằng ', lgi: '<b>Lời giải.</b>',
    n: '<br>', newline: '<br>', noindent: '', indent: '', par: '\n\n', medskip: '\n\n',
    bigskip: '\n\n', smallskip: '\n\n', raggedbottom: '', centering: '', hfill: ' ', quad: ' ',
    qquad: '  ', ldots: '…', dots: '…', LaTeX: 'LaTeX', TeX: 'TeX', clearpage: '', newpage: ''
  };
  // MathJax macro table (used by the page's MathJax config)
  var MATH_MACROS = {
    vto: ['\\overrightarrow{#1}', 1], lhop: ['\\overline{#1}', 1], goc: ['\\widehat{#1}', 1],
    cung: ['\\overset{\\frown}{#1}', 1], cungdh: ['\\overset{\\curvearrowright}{#1}', 1],
    bmod: '\\mathrm{mod}\\;', backsim: '\\sim', heva: ['\\left\\{\\begin{aligned}#1\\end{aligned}\\right.', 1],
    hoac: ['\\left[\\begin{aligned}#1\\end{aligned}\\right.', 1]
  };
  var MATH_ENVS = 'align\\*?|aligned|equation\\*?|gather\\*?|multline\\*?|eqnarray\\*?|cases|array|matrix|pmatrix|bmatrix|split';

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // only data URIs of images (built by the server) — never a URL, never markup
  var DATA_URI = /^data:image\/(svg\+xml|png|jpeg);base64,[A-Za-z0-9+\/]+=*$/;
  function figHtml(f) {
    if (f && typeof f.uri === 'string' && DATA_URI.test(f.uri)) return '<img class="fig-img" alt="' + esc(f.label).replace(/"/g, '&quot;') + '" src="' + f.uri + '">';
    return '<span class="fig">[' + esc(f ? f.missing : 'hình') + ']</span>';
  }

  // read a balanced {...} group starting at i (s[i] === '{'); returns [content, endIndex]
  function group(s, i) {
    var d = 0;
    for (var j = i; j < s.length; j++) {
      if (s[j] === '\\') { j++; continue; }
      if (s[j] === '{') d++;
      else if (s[j] === '}') { d--; if (d === 0) return [s.slice(i + 1, j), j + 1]; }
    }
    return [s.slice(i + 1), s.length];
  }
  // replace \cmd{arg} (n args) by f(args...)
  function replaceCmd(s, name, nargs, f) {
    var re = new RegExp('\\\\' + name + '\\s*(?=\\{)', 'g'), out = '', last = 0, m;
    while ((m = re.exec(s))) {
      var i = m.index + m[0].length, args = [];
      for (var k = 0; k < nargs; k++) {
        while (s[i] === ' ') i++;
        if (s[i] !== '{') break;
        var g = group(s, i); args.push(g[0]); i = g[1];
      }
      if (args.length < nargs) continue;
      out += s.slice(last, m.index) + f.apply(null, args); last = i; re.lastIndex = i;
    }
    return out + s.slice(last);
  }
  // replace {\bf ...} style groups
  function replaceDecl(s, decl, open, close) {
    var re = new RegExp('\\{\\\\' + decl + '\\b\\s*', 'g'), out = '', last = 0, m;
    while ((m = re.exec(s))) {
      var g = group(s, m.index);
      out += s.slice(last, m.index) + open + g[0].replace(new RegExp('^\\\\' + decl + '\\b\\s*'), '') + close;
      last = g[1]; re.lastIndex = g[1];
    }
    return out + s.slice(last);
  }

  function render(src, opts) {
    opts = opts || {};
    var warnings = [], math = [];
    var s = (src || '').normalize ? (src || '').normalize('NFC') : (src || '');
    s = s.replace(/\r\n?/g, '\n');
    // 0. figures: TikZ blocks become the SVG built by the figure pipeline (opts.figs: block → data URI), else a placeholder;
    //    \includegraphics{name} becomes the picture (opts.pics: name → data URI) when the server sent it
    var figs = [];
    function figOut(uri, label, missing) { figs.push({ uri: uri, label: label, missing: missing || label }); return '\u0000FIG' + (figs.length - 1) + '\u0000'; }
    s = s.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, function (b) {
      return figOut(opts.figs && opts.figs[b], 'hình', 'hình TikZ — chưa dựng');
    });
    s = s.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g, function (_, o, f) {
      return figOut(opts.pics && opts.pics[f], 'hình: ' + f);
    });
    // 1. protect math
    function keep(tex, display) {
      tex = tex.replace(/\\eqno\s*\(?\s*([^)$\n]*?)\s*\)?\s*$/, '\\tag{$1}')
               .replace(/\\eqno\s*\(([^)]*)\)/g, '\\tag{$1}');
      math.push({ tex: tex, display: display });
      return '\u0001' + (math.length - 1) + '\u0001';
    }
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (_, t) { return keep(t, true); });
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, function (_, t) { return keep(t, true); });
    s = s.replace(new RegExp('\\\\begin\\{(' + MATH_ENVS + ')\\}[\\s\\S]*?\\\\end\\{\\1\\}', 'g'), function (t) { return keep(t, true); });
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (_, t) { return keep(t, false); });
    s = s.replace(/(^|[^\\])\$((?:\\\$|[^$])+?)\$/g, function (_, p, t) { return p + keep(t, false); });
    if (/(^|[^\\])\$/.test(s)) warnings.push('dấu $ lẻ (công thức chưa đóng)');
    // văn bản ngoài công thức là dữ liệu, không phải HTML: thoát mọi ký tự HTML trước khi dựng thẻ của ta
    s = esc(s);
    // 2. markdown (records converted from Word by pandoc)
    s = s.replace(/\\\*/g, '*').replace(/\\([\[\]_#&%])/g, '$1');
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<i>$2</i>');
    // 3. text-mode LaTeX
    s = s.replace(/\\label\{[^}]*\}/g, '');
    s = replaceCmd(s, 'eqref', 1, function (t) { return '(' + t + ')'; });
    s = replaceCmd(s, 'ref', 1, function (t) { return t; });
    s = replaceCmd(s, 'textcolor', 2, function (c, t) { return t; });
    s = replaceCmd(s, 'color', 1, function () { return ''; });
    ['textbf', 'mathbf'].forEach(function (c) { s = replaceCmd(s, c, 1, function (t) { return '<b>' + t + '</b>'; }); });
    ['emph', 'textit', 'textsl'].forEach(function (c) { s = replaceCmd(s, c, 1, function (t) { return '<i>' + t + '</i>'; }); });
    s = replaceCmd(s, 'texttt', 1, function (t) { return '<code>' + t + '</code>'; });
    s = replaceCmd(s, 'underline', 1, function (t) { return '<u>' + t + '</u>'; });
    ['text', 'mbox', 'textrm', 'textnormal'].forEach(function (c) { s = replaceCmd(s, c, 1, function (t) { return t; }); });
    s = replaceDecl(s, 'bf', '<b>', '</b>'); s = replaceDecl(s, 'bfseries', '<b>', '</b>');
    s = replaceDecl(s, 'itshape', '<i>', '</i>'); s = replaceDecl(s, 'it', '<i>', '</i>');
    s = replaceDecl(s, 'em', '<i>', '</i>');
    s = s.replace(/\\begin\{(itemize|enumerate)\}(\[[^\]]*\])?/g, function (_, e) { return e === 'itemize' ? '<ul>' : '<ol>'; })
         .replace(/\\end\{itemize\}/g, '</li></ul>').replace(/\\end\{enumerate\}/g, '</li></ol>')
         .replace(/\\item\s*(\[[^\]]*\])?/g, function (_, l) { return '</li><li>' + (l ? '<b>' + l.slice(1, -1) + '</b> ' : ''); })
         .replace(/<(ul|ol)>\s*<\/li>/g, '<$1>');
    s = s.replace(/\\begin\{center\}/g, '<div class="c">').replace(/\\end\{center\}/g, '</div>')
         .replace(/\\begin\{flushright\}/g, '<div class="r">').replace(/\\end\{flushright\}/g, '</div>')
         .replace(/\\begin\{quote\}/g, '<blockquote>').replace(/\\end\{quote\}/g, '</blockquote>');
    s = s.replace(/\\\\(\[[^\]]*\])?/g, '<br>').replace(/~/g, '\u00a0')
         .replace(/``/g, '“').replace(/''/g, '”').replace(/---/g, '—').replace(/--/g, '–')
         .replace(/\\([%&#_$])/g, '$1').replace(/\\[,;: ]/g, ' ');
    s = s.replace(/\\([A-Za-z]+)\b\s?/g, function (m, c) {
      if (Object.prototype.hasOwnProperty.call(TEXT_MACROS, c)) return TEXT_MACROS[c];
      warnings.push('lệnh chưa hỗ trợ ngoài công thức: \\' + c);
      return '<code class="unk">\\' + c + '</code>';
    });
    s = s.replace(/[{}]/g, '');
    // 4. paragraphs, figures, restore math
    s = s.split(/\n\s*\n/).map(function (p) { p = p.trim(); return p ? (/^<(ul|ol|div|blockquote)/.test(p) ? p : '<p>' + p.replace(/\n/g, ' ') + '</p>') : ''; }).join('\n');
    s = s.replace(/\u0000FIG(\d+)\u0000/g, function (_, i) { return figHtml(figs[+i]); });
    s = s.replace(/\u0001(\d+)\u0001/g, function (_, k) {
      var m = math[+k], t = m.tex, guard = 0;
      while (/\u0001\d+\u0001/.test(t) && guard++ < 10) t = t.replace(/\u0001(\d+)\u0001/g, function (_, j) { return math[+j].tex; });
      m = { tex: t, display: m.display };
      return m.display ? '<span class="dm">\\[' + esc(m.tex) + '\\]</span>' : '\\(' + esc(m.tex) + '\\)';
    });
    return { html: s, warnings: warnings };
  }
  var api = { render: render, MATH_MACROS: MATH_MACROS };
  if (typeof module !== 'undefined') module.exports = api; else root.PiRender = api;
})(this);
