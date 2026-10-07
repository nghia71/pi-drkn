"""Minimal MathType MTEF v5 -> LaTeX decoder (prototype)."""
import struct, sys, olefile

FENCE = {0:('\\langle','\\rangle'),1:('(',')'),2:('\\{','\\}'),3:('[',']'),4:('|','|'),
         5:('\\|','\\|'),6:('\\lfloor','\\rfloor'),7:('\\lceil','\\rceil'),8:('[','['),9:('(',']')}
BIGOP = {15:'\\int',16:'\\sum',17:'\\prod',18:'\\coprod',19:'\\bigcup',20:'\\bigcap',21:'\\int',22:'\\sum'}
CH = {0x2264:'\\le ',0x2265:'\\ge ',0x2260:'\\ne ',0x00D7:'\\times ',0x22C5:'\\cdot ',0x00B7:'\\cdot ',
      0x2208:'\\in ',0x2209:'\\notin ',0x2282:'\\subset ',0x2286:'\\subseteq ',0x222A:'\\cup ',0x2229:'\\cap ',
      0x2192:'\\to ',0x21D2:'\\Rightarrow ',0x21D4:'\\Leftrightarrow ',0x2194:'\\leftrightarrow ',
      0x221E:'\\infty ',0x2212:'-',0x00B1:'\\pm ',0x2213:'\\mp ',0x2026:'\\ldots ',0x22EF:'\\cdots ',
      0x2261:'\\equiv ',0x2248:'\\approx ',0x2245:'\\cong ',0x223C:'\\sim ',0x2220:'\\angle ',
      0x25B3:'\\triangle ',0x2206:'\\triangle ',0x22A5:'\\perp ',0x2225:'\\parallel ',0x00B0:'^\\circ ',
      0x2200:'\\forall ',0x2203:'\\exists ',0x2205:'\\varnothing ',0x2115:'\\mathbb{N}',0x2124:'\\mathbb{Z}',
      0x211D:'\\mathbb{R}',0x211A:'\\mathbb{Q}',0x00F7:'\\div ',0x2223:'\\mid ',0x22EE:'\\vdots ',
      0x2032:"'",0x2033:"''",0xEF04:'\\,',0xEF05:'\\;',0xEF01:'\\,',0xEF02:'\\,',0xEF03:'\\:',0xEF08:'\\!',
      0x007B:'\\{',0x007D:'\\}',0x0025:'\\%',0x0023:'\\#',0x0026:'\\&',0x005F:'\\_'}
GREEK = dict(zip(range(0x3B1,0x3CA),'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi o pi rho varsigma sigma tau upsilon phi chi psi omega'.split()))
GREEKU = {0x393:'Gamma',0x394:'Delta',0x398:'Theta',0x39B:'Lambda',0x39E:'Xi',0x3A0:'Pi',0x3A3:'Sigma',0x3A6:'Phi',0x3A8:'Psi',0x3A9:'Omega'}
EMB = {2:'\\dot',3:'\\ddot',4:'\\dddot',5:"'",6:"''",8:'\\tilde',9:'\\hat',11:'\\vec',12:'\\overleftarrow',13:'\\overleftrightarrow',17:'\\overline',16:'\\overline'}

class R:
    def __init__(s,b): s.b=b; s.i=0
    def u8(s): v=s.b[s.i]; s.i+=1; return v
    def u16(s): v=struct.unpack_from('<H',s.b,s.i)[0]; s.i+=2; return v
    def cstr(s):
        j=s.b.index(0,s.i); v=s.b[s.i:j]; s.i=j+1; return v.decode('latin1')

def nudge(r,opt):
    if opt & 0x08:
        dx,dy=r.u8(),r.u8()
        if dx==128 or dy==128: r.u16(); r.u16()

def nibble_array(r,n):
    vals=0; half=None
    def nib():
        nonlocal half
        if half is None:
            b=r.u8(); half=b&0xF; return b>>4
        v=half; half=None; return v
    for _ in range(n):
        nib()            # unit
        while nib()!=0xF: pass
    # remaining half nibble discarded

class Dec:
    def __init__(s,data):
        s.r=R(data); s.warn=[]
    def run(s):
        r=s.r
        hlen=struct.unpack_from('<H',r.b,0)[0]; r.i=hlen
        ver=r.u8(); r.u8(); r.u8(); r.u8(); r.u8()
        if ver!=5: s.warn.append('MTEF version %d'%ver)
        r.cstr(); r.u8()
        out=[]
        while r.i < len(r.b):
            t=s.record(out)
            if t=='END': break
        return ''.join(out).strip()
    def record(s,out):
        r=s.r; tag=r.u8()
        if tag==0: return 'END'
        if tag==1: out.append(s.line()); return
        if tag==2: s.char(out); return
        if tag==3: s.tmpl(out); return
        if tag==4: out.append(s.pile()); return
        if tag==5: out.append(s.matrix()); return
        if tag==7: s.ruler(); return
        if tag==8: r.u8(); r.u8(); return
        if tag==9:
            b=r.u8()
            if b==101: r.u16()
            elif b==100: r.u8(); r.u16()
            else: r.u8()
            return
        if tag in (10,11,12,13,14): return
        if tag==15: r.u8(); return
        if tag==16:
            o=r.u8(); [r.u16() for _ in range(4 if o&1 else 3)]
            if o&4: r.cstr()
            return
        if tag==17: r.u8(); r.cstr(); return
        if tag==18:
            r.u8()
            n=r.u8(); nibble_array(r,n)
            n=r.u8(); nibble_array(r,n)
            n=r.u8()
            for _ in range(n):
                if r.u8(): r.u8()
            return
        if tag==19: r.cstr(); return
        if tag>=100:
            l=r.u16(); r.i+=l; return
        s.warn.append('unknown tag %d at %d'%(tag,r.i)); raise ValueError(s.warn[-1])
    def objlist(s):
        out=[]
        while True:
            if s.record(out)=='END': break
        return out
    def line(s):
        r=s.r; o=r.u8(); nudge(r,o)
        if o&0x04: r.u16()
        if o&0x02:
            r.u8(); s.ruler()
        if o&0x01: return ''
        return ''.join(s.objlist())
    def ruler(s):
        r=s.r; n=r.u8()
        for _ in range(n): r.u8(); r.u16()
    def char(s,out):
        r=s.r; o=r.u8(); nudge(r,o)
        tf=r.u8()-128
        code=None
        if not o&0x20: code=r.u16()
        if o&0x04: c8=r.u8(); code = code if code is not None else c8
        if o&0x10: c16=r.u16(); code = code if code is not None else c16
        txt=s.map(code,tf)
        if o&0x01:
            embs=s.objlist_emb()
            for e in embs:
                if e in ("'","''"): txt=txt+e
                else: txt=e+'{'+txt+'}'
        out.append(txt)
    def objlist_emb(s):
        r=s.r; res=[]
        while True:
            tag=r.u8()
            if tag==0: break
            if tag!=6: raise ValueError('expected EMBELL got %d'%tag)
            o=r.u8(); nudge(r,o); e=r.u8(); res.append(EMB.get(e,'\\emb%d'%e))
        return res
    def map(s,code,tf):
        if code is None: return '?'
        if code in CH: return CH[code]
        if code in GREEK: return '\\'+GREEK[code]+' '
        if code in GREEKU: return '\\'+GREEKU[code]+' '
        c=chr(code)
        if tf==1 and c.isalpha(): return '\\text{'+c+'}'
        return c
    def tmpl(s,out):
        r=s.r; o=r.u8(); nudge(r,o)
        sel=r.u8(); var=r.u8()
        if var&0x80: var=(var&0x7F)|(r.u8()<<8)
        r.u8()  # template-specific options
        sub=s.objlist()
        def g(k): return sub[k] if k<len(sub) else ''
        if sel<=9:
            L,Rr=FENCE[sel]
            body=g(0)
            # use the fence characters actually stored in the equation when present
            lf,rf=g(1).strip(),g(2).strip()
            if sel==9 or lf or rf:
                L = lf or L; Rr = rf or Rr
                if L=='{': L='\\{'
                if Rr=='}': Rr='\\}'
                out.append('\\left%s %s \\right%s'%(L or '.',body,Rr or '.')); return
            # var bits: 1=left fence present, 2=right fence present (both by default)
            l = L if (var & 1 or var==0) else '.'
            rr= Rr if (var & 2 or var==0) else '.'
            out.append('\\left%s %s \\right%s'%(l,body,rr) if sel!=1 or True else '')
        elif sel==10:
            out.append('\\sqrt[%s]{%s}'%(g(1),g(0)) if g(1) else '\\sqrt{%s}'%g(0))
        elif sel==11:
            out.append('\\dfrac{%s}{%s}'%(g(0),g(1)))
        elif sel==12: out.append('\\underline{%s}'%g(0))
        elif sel==13: out.append('\\overline{%s}'%g(0))
        elif sel in BIGOP:
            op=BIGOP[sel]; lo,hi=g(1),g(2)
            t=op+('_{%s}'%lo if lo else '')+('^{%s}'%hi if hi else '')+' '+g(0)
            out.append(t)
        elif sel==23:
            out.append('\\lim_{%s} %s'%(g(1),g(0)))
        elif sel==24: out.append('\\overbrace{%s}^{%s}'%(g(0),g(1)) if var&1 else '\\underbrace{%s}_{%s}'%(g(0),g(1)))
        elif sel in (27,28,29):
            sb,sp=g(0),g(1)
            t=''
            if sb: t+='_{%s}'%sb
            if sp: t+='^{%s}'%sp
            out.append(t)
        elif sel==31: out.append('\\overrightarrow{%s}'%g(0))
        elif sel==32: out.append('\\widetilde{%s}'%g(0))
        elif sel==33: out.append('\\widehat{%s}'%g(0))
        elif sel==34: out.append('\\overset\\frown{%s}'%g(0))
        else:
            s.warn.append('template %d var %d'%(sel,var)); out.append('\\UNKNOWNTMPL{%d}{%s}'%(sel,'}{'.join(sub)))
    def pile(s):
        r=s.r; o=r.u8(); nudge(r,o); r.u8(); r.u8()
        if o&0x02: r.u8(); s.ruler()
        rows=s.objlist()
        return '\\begin{array}{l}'+' \\\\ '.join(rows)+'\\end{array}'
    def matrix(s):
        r=s.r; o=r.u8(); nudge(r,o); r.u8(); r.u8(); r.u8()
        rows=r.u8(); cols=r.u8()
        r.i += (2*(rows+1)+7)//8 + (2*(cols+1)+7)//8
        cells=s.objlist()
        rr=[' & '.join(cells[i*cols:(i+1)*cols]) for i in range(rows)]
        return '\\begin{matrix}'+' \\\\ '.join(rr)+'\\end{matrix}'

def from_ole(path):
    o=olefile.OleFileIO(path)
    d=Dec(o.openstream('Equation Native').read())
    try: res=d.run()
    except Exception as e: res='ERROR: %r'%e
    return res,d.warn

if __name__=='__main__':
    for p in sys.argv[1:]:
        res,w=from_ole(p); print(p.split('/')[-1],'=>',res, w if w else '')
