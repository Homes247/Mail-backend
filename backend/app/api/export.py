import io, json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db
from app.models.document import Document

router = APIRouter()

class ExportRequest(BaseModel):
    doc_id: str
    format: str  # csv | docx | pptx

@router.post("/export")
async def export_document(body: ExportRequest, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, body.doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    content = json.loads(doc.content or "{}")

    if body.format == "csv":
        return _export_csv(doc.title, content)
    elif body.format == "docx":
        return _export_docx(doc.title, content)
    elif body.format == "pptx":
        return _export_pptx(doc.title, content)
    else:
        raise HTTPException(400, "Unsupported format")


def _export_csv(title: str, content: dict) -> StreamingResponse:
    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)

    cells = content.get("cells", {})
    if cells:
        max_row = max((int(r) for r in cells.keys()), default=-1)
        max_col = max((int(c) for r in cells.values() for c in r.keys()), default=-1)
        
        for r in range(max_row + 1):
            row_data = []
            for c in range(max_col + 1):
                val = cells.get(str(r), {}).get(str(c), "")
                row_data.append(val)
            writer.writerow(row_data)

    buf = io.BytesIO(output.getvalue().encode('utf-8'))
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{title}.csv"'}
    )



def _export_docx(title: str, content: dict) -> StreamingResponse:
    from docx import Document as DocxDocument
    import re

    doc = DocxDocument()
    doc.add_heading(title, 0)

    # New format: { html: "<p>...</p>" }
    html = content.get("html", "")
    if html:
        # Strip tags and split into paragraphs for basic export
        clean = re.sub(r'<br\s*/?>', '\n', html)
        clean = re.sub(r'<[^>]+>', '', clean)
        for line in clean.split('\n'):
            stripped = line.strip()
            if stripped:
                doc.add_paragraph(stripped)
    else:
        doc.add_paragraph("(empty document)")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{title}.docx"'}
    )


def _export_pptx(title: str, content: dict) -> StreamingResponse:
    from pptx import Presentation
    from pptx.util import Pt

    prs = Presentation()
    slide_layout = prs.slide_layouts[1]  # Title + Content

    pages = content.get("pages", {})
    page_order = content.get("pageOrder", list(pages.keys()))

    if not page_order:
        slide = prs.slides.add_slide(prs.slide_layouts[0])
        slide.shapes.title.text = title
    else:
        for page_id in page_order:
            page = pages.get(page_id, {})
            slide = prs.slides.add_slide(slide_layout)
            if slide.shapes.title:
                slide.shapes.title.text = page.get("title", "")
            # Write body text into content placeholder
            body_text = page.get("body", "")
            if body_text and len(slide.placeholders) > 1:
                slide.placeholders[1].text = body_text

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{title}.pptx"'}
    )