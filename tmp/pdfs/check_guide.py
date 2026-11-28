from pathlib import Path
import re,json
from PIL import Image,ImageOps,ImageDraw
from pypdf import PdfReader
import pdfplumber
root=Path(__file__).resolve().parents[2]
pdf=root/'output/pdf/tailor_ai_interview_guide.pdf'
reader=PdfReader(str(pdf));text='\n'.join(p.extract_text() or '' for p in reader.pages)
assert len(reader.pages)==40
for prefix,n in [('P',40),('F',36)]:
    headings=re.findall(r'^'+prefix+r'(\d{2})\.',text,re.MULTILINE)
    assert sorted(headings)==[f'{i:02}' for i in range(1,n+1)],(prefix,headings)
assert 'QUICK REVISION / PAGE 1 OF 2' in reader.pages[36].extract_text()
assert 'QUICK REVISION / PAGE 2 OF 2' in reader.pages[37].extract_text()
problems=[]
with pdfplumber.open(pdf) as doc:
    for i,page in enumerate(doc.pages,1):
        for ch in page.chars:
            if ch['x0']<45 or ch['x1']>550 or ch['top']<35 or ch['bottom']>820:
                problems.append((i,ch['text'],ch['x0'],ch['top']))
links=sum(len(p.get('/Annots',[])) for p in reader.pages)
for start in range(1,41,8):
    sheet=Image.new('RGB',(900,4*665),'#dce4e8');draw=ImageDraw.Draw(sheet)
    for j,pnum in enumerate(range(start,min(start+8,41))):
        im=Image.open(root/f'tmp/pdfs/page-{pnum:02}.png').convert('RGB')
        im.thumbnail((430,625))
        x=10+(j%2)*450;y=26+(j//2)*665
        sheet.paste(im,(x,y));draw.text((x,y-19),f'PAGE {pnum}',fill='#17293e')
    sheet.save(root/f'tmp/pdfs/contact-{start:02}.jpg',quality=90)
report={'pages':40,'project_questions':40,'fundamental_questions':36,'words':len(text.split()),'pdf_links':links,'outline_entries':len(reader.outline),'out_of_bounds_characters':problems[:30]}
(root/'tmp/pdfs/qa_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
assert not problems
