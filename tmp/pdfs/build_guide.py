from pathlib import Path
import re, json, html
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/tailor_ai_interview_guide.pdf'
SRC = ROOT / 'tmp/pdfs/guide_content.txt'
OUT.parent.mkdir(parents=True, exist_ok=True)
fonts = Path('C:/Windows/Fonts')
for name, filename in [('Guide','arial.ttf'),('GuideBold','arialbd.ttf'),('GuideItalic','ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(fonts/filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='GuideItalic', boldItalic='GuideBold')
INK=HexColor('#17293E'); TEAL=HexColor('#087F8C'); MUTED=HexColor('#526173')
styles = {
 'title':ParagraphStyle('title',fontName='GuideBold',fontSize=23,leading=28,textColor=INK,spaceAfter=15),
 'sub':ParagraphStyle('sub',fontName='GuideBold',fontSize=11.5,leading=15,textColor=TEAL,spaceBefore=10,spaceAfter=6,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Guide',fontSize=10.4,leading=14.6,textColor=INK,spaceAfter=8),
 'bullet':ParagraphStyle('bullet',fontName='Guide',fontSize=10.4,leading=14.6,textColor=INK,leftIndent=12,firstLineIndent=0,bulletIndent=0,spaceAfter=9),
 'small':ParagraphStyle('small',fontName='Guide',fontSize=8.4,leading=11.5,textColor=MUTED,spaceAfter=5),
 'kicker':ParagraphStyle('kicker',fontName='GuideBold',fontSize=9,leading=12,textColor=TEAL,spaceAfter=9),
 'code':ParagraphStyle('code',fontName='Courier',fontSize=8.5,leading=11,textColor=INK,spaceAfter=0),
}
def fmt(s):
    s=html.escape(s,quote=False)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'`(.+?)`',r'<font name="Courier">\1</font>',s)
    s=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',r'<link href="\2" color="#087F8C">\1</link>',s)
    return s

class Diagram(Flowable):
    def __init__(self):
        super().__init__(); self.width=475; self.height=210
    def draw(self):
        c=self.canv
        def box(x,y,w,h,title,detail):
            c.setFillColor(HexColor('#EDF6F7'));c.setStrokeColor(TEAL);c.roundRect(x,y,w,h,6,fill=1,stroke=1)
            c.setFillColor(INK);c.setFont('GuideBold',10);c.drawCentredString(x+w/2,y+h-17,title)
            c.setFont('Guide',8);c.drawCentredString(x+w/2,y+11,detail)
        def arrow(x1,y1,x2,y2):
            c.setStrokeColor(TEAL);c.line(x1,y1,x2,y2)
            if x2>x1:c.line(x2,y2,x2-5,y2+3);c.line(x2,y2,x2-5,y2-3)
            elif y2<y1:c.line(x2,y2,x2-3,y2+5);c.line(x2,y2,x2+3,y2+5)
        box(0,152,134,48,'React PWA','Phone / browser; Vercel config')
        box(170,152,140,48,'Supabase Edge API','Deno + TypeScript')
        box(346,152,129,48,'Google Gemini API','Embedding / chat / voice')
        arrow(134,176,170,176);arrow(310,176,346,176)
        box(0,30,134,54,'Supabase Auth','Verified account identity')
        box(170,30,140,54,'PostgreSQL + pgvector','Profiles / chats / knowledge')
        box(346,30,129,54,'External services','Upstash / Tavily / YouTube')
        arrow(240,152,240,84)
        c.setStrokeColor(TEAL);c.line(195,152,67,84);c.line(285,152,410,84)
        c.setFont('GuideItalic',8);c.setFillColor(MUTED);c.drawString(0,5,'Conceptual dependencies; not a claim that every service is live or configured.')

pages=[]
for block in SRC.read_text(encoding='utf-8').split('\n@@ '):
    if not block.strip():continue
    head,*lines=block.splitlines()
    head=head.removeprefix('@@ ')
    part,title=head.split(' | ',1)
    pages.append((part,title,lines))

def footer(c,doc):
    page=c.getPageNumber(); c.saveState()
    c.setStrokeColor(HexColor('#D8E3E8'));c.line(48,43,547,43)
    c.setFont('Guide',8);c.setFillColor(MUTED)
    c.drawString(48,29,'TAILOR AI  /  INTERVIEW STUDY GUIDE')
    c.drawRightString(547,29,f'{page:02d}')
    c.restoreState()

story=[]
for idx,(part,title,lines) in enumerate(pages):
    if idx:story.append(PageBreak())
    story.append(Paragraph(fmt(part.upper()),styles['kicker']))
    story.append(Paragraph(fmt(title),styles['title']))
    for line in lines:
        line=line.strip()
        if not line:continue
        if line=='[DIAGRAM]':story.append(Diagram());story.append(Spacer(1,10))
        elif line.startswith('## '):story.append(Paragraph(fmt(line[3:]),styles['sub']))
        elif line.startswith('- '):story.append(Paragraph(fmt(line[2:]),styles['bullet'],bulletText='\u2022'))
        elif line.startswith('~ '):story.append(Paragraph(fmt(line[2:]),styles['small']))
        elif line.startswith('> '):story.append(Paragraph(fmt(line[2:]),styles['code']))
        else:story.append(Paragraph(fmt(line),styles['body']))

doc=SimpleDocTemplate(str(OUT),pagesize=(595.28,841.89),leftMargin=48,rightMargin=48,topMargin=43,bottomMargin=57,title='Tailor AI - AI/ML Engineer Interview Guide',author='Prepared for the Tailor AI project owner',subject='Repository-grounded project explanation, 40 project questions, and 36 AI/ML fundamentals')
def bookmark(flowable):
    if isinstance(flowable,Paragraph) and flowable.style.name=='title':
        key='page_'+str(doc.page)
        doc.canv.bookmarkPage(key)
        doc.canv.addOutlineEntry(flowable.getPlainText(),key,level=0,closed=False)
doc.afterFlowable=bookmark
doc.build(story,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(str(OUT)); actual=len(r.pages)
audit=[]
for i,p in enumerate(r.pages):
    text=p.extract_text() or ''
    audit.append({'page':i+1,'chars':len(text),'start':text[:120]})
(ROOT/'tmp/pdfs/page_audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print(json.dumps({'pdf':str(OUT),'planned_pages':len(pages),'actual_pages':actual,'bytes':OUT.stat().st_size},indent=2))
if actual!=len(pages):raise SystemExit('Unexpected overflow: inspect page_audit.json')
