import json
import uuid
from typing import Optional
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel

from app.database import get_db
from app.models.document import Document
from app.models.document_share import DocumentShare
from app.models.user import User
from app.api.auth import get_current_user, get_optional_current_user
from app.lib.document_storage import DocumentStorage
from fastapi import UploadFile, File, Form
import datetime as _dt
import io

router = APIRouter()


class DocumentCreate(BaseModel):
    title: str = "Untitled"
    doc_type: str  # sheet | doc | slide


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_trashed: Optional[int] = None

class DocumentShareCreate(BaseModel):
    email: str
    permission: str = "view"


def _default_content(doc_type: str, title: str) -> str:
    if doc_type == "doc":
        return json.dumps({"html": "<br>"})
    if doc_type == "sheet":
        return json.dumps({"cells": {}, "formats": {"0,0": {"size": "13px"}}})
    if doc_type == "slide":
        page_id = str(uuid.uuid4())
        return json.dumps({
            "id":        page_id,
            "title":     title,
            "pages":     {page_id: {"title": "", "body": ""}},
            "pageOrder": [page_id],
        })
    return "{}"


@router.post("")
async def create_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_val = _default_content(body.doc_type, body.title)
    doc = Document(
        title=body.title,
        doc_type=body.doc_type,
        owner_id=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    
    try:
        storage_res = await asyncio.to_thread(
            DocumentStorage.save, doc.owner_id, doc.id, content_val, doc_type=doc.doc_type
        )
        doc.file_path = storage_res["relative_path"]
        doc.file_size = storage_res["size"]
        doc.content_version = 1
        await db.commit()
    except Exception as e:
        print(f"Error saving document to storage: {e}")
        
    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type}

def resolve_validation_options(formula, wb, ws):
    try:
        with open("backend/debug_validation.log", "a") as f_log:
            f_log.write(f"Resolving validation: formula={formula}, sheet={ws.title}\n")
    except:
        pass
        
    if not formula:
        return []
    formula = formula.strip('"')
    if not formula.startswith('='):
        # Comma-separated list
        return [{"label": x.strip()} for x in formula.split(',') if x.strip()]
    
    # It is a reference. E.g. =Sheet2!$A$1:$A$10 or =$A$1:$A$10
    ref = formula[1:] # strip '='
    sheet_name = ws.title
    if '!' in ref:
        sheet_name, ref = ref.split('!', 1)
        sheet_name = sheet_name.strip("'")
    
    ref = ref.replace('$', '') # remove absolute references
    
    try:
        with open("backend/debug_validation.log", "a") as f_log:
            f_log.write(f"  Parsed sheet_name={sheet_name}, ref={ref}\n")
    except:
        pass

    if sheet_name in wb.sheetnames:
        target_ws = wb[sheet_name]
        try:
            cells_range = target_ws[ref]
            options = []
            if hasattr(cells_range, 'value'): # Single cell
                val = cells_range.value
                if val is not None:
                    options.append({"label": str(val)})
            else:
                for row in cells_range:
                    if isinstance(row, tuple) or isinstance(row, list):
                        for cell in row:
                            if cell.value is not None:
                                options.append({"label": str(cell.value)})
                    elif hasattr(row, 'value') and row.value is not None:
                        options.append({"label": str(row.value)})
            
            try:
                with open("backend/debug_validation.log", "a") as f_log:
                    f_log.write(f"  Success, options={options}\n")
            except:
                pass
            return options
        except Exception as e:
            try:
                with open("backend/debug_validation.log", "a") as f_log:
                    f_log.write(f"  Error resolving range: {e}\n")
            except:
                pass
            return []
    else:
        try:
            with open("backend/debug_validation.log", "a") as f_log:
                f_log.write(f"  Sheet name {sheet_name} not found in {wb.sheetnames}\n")
        except:
            pass
    return []

@router.post("/import")
async def import_document(
    file: UploadFile = File(...),
    replace_doc_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = file.filename
    content_bytes = await file.read()
    
    doc_type = "doc"
    filename_lower = filename.lower()
    if filename_lower.endswith(".xlsx") or filename_lower.endswith(".csv"):
        doc_type = "sheet"
    elif filename_lower.endswith(".pptx"):
        doc_type = "slide"
        
    title = filename.rsplit(".", 1)[0]
    content_json = "{}"
    
    if doc_type == "sheet" and filename_lower.endswith(".xlsx"):
        try:
            with open("backend/debug_uploaded_sheet.xlsx", "wb") as f_debug:
                f_debug.write(content_bytes)
        except Exception as save_err:
            pass
            
        try:
            from openpyxl import load_workbook
            from openpyxl.utils import column_index_from_string
            wb = load_workbook(io.BytesIO(content_bytes), data_only=True)
            sheets = []
            
            for ws in wb.worksheets:
                ROWS = max(1000, ws.max_row + 5)
                COLS = max(26, ws.max_column + 5)
                
                cells = [["" for _ in range(COLS)] for _ in range(ROWS)]
                formats = {}
                validations = {}
                colWidths = {}
                rowHeights = {}
                
                for row in ws.iter_rows():
                    for cell in row:
                        if cell.value is not None:
                            r = cell.row - 1
                            c = cell.column - 1
                            if r < ROWS and c < COLS:
                                val = cell.value
                                if isinstance(val, (_dt.datetime, _dt.date)):
                                    cells[r][c] = val.strftime("%d/%m/%Y")
                                else:
                                    cells[r][c] = str(val)
                            
                            fmt = {}
                            if cell.font:
                                if cell.font.bold: fmt["bold"] = True
                                if cell.font.italic: fmt["italic"] = True
                                if cell.font.strike: fmt["strikethrough"] = True
                                try:
                                    rgb = cell.font.color.rgb
                                    if isinstance(rgb, str) and len(rgb) in [6, 8]:
                                        if len(rgb) == 8: fmt["color"] = f"#{rgb[2:]}"
                                        elif len(rgb) == 6: fmt["color"] = f"#{rgb}"
                                except:
                                    pass
                            if cell.alignment:
                                if cell.alignment.wrapText: fmt["wrap"] = True
                            if cell.fill and cell.fill.fill_type and cell.fill.fill_type != 'none':
                                fgColor = cell.fill.fgColor
                                if fgColor:
                                    rgb = None
                                    if fgColor.type == 'rgb':
                                        rgb = fgColor.rgb
                                    elif hasattr(fgColor, 'value') and isinstance(fgColor.value, str) and len(fgColor.value) in [6, 8]:
                                        rgb = fgColor.value
                                    if rgb and isinstance(rgb, str):
                                        if len(rgb) == 8: fmt["bg"] = f"#{rgb[2:]}"
                                        elif len(rgb) == 6: fmt["bg"] = f"#{rgb}"
                            if fmt:
                                formats[f"{r},{c}"] = fmt
                                
                if ws.merged_cells:
                    for merged_range in ws.merged_cells.ranges:
                        min_col, min_row, max_col, max_row = merged_range.bounds
                        min_r, min_c = min_row - 1, min_col - 1
                        max_r, max_c = max_row - 1, max_col - 1
                        
                        tl_ref = f"{min_r},{min_c}"
                        if tl_ref not in formats:
                            formats[tl_ref] = {}
                        formats[tl_ref]["_mergeSpan"] = {
                            "rows": max_r - min_r + 1,
                            "cols": max_c - min_c + 1
                        }
                        
                        for r in range(min_r, max_r + 1):
                            for c in range(min_c, max_c + 1):
                                if r == min_r and c == min_c:
                                    continue
                                slave_ref = f"{r},{c}"
                                if slave_ref not in formats:
                                    formats[slave_ref] = {}
                                formats[slave_ref]["_mergedInto"] = tl_ref

                if hasattr(ws, '_images') and ws._images:
                    import base64
                    for img in ws._images:
                        try:
                            anchor = img.anchor
                            if hasattr(anchor, '_from'):
                                row_idx = anchor._from.row
                                col_idx = anchor._from.col
                            elif hasattr(anchor, 'row') and hasattr(anchor, 'col'):
                                row_idx = anchor.row - 1
                                col_idx = anchor.col - 1
                            else:
                                continue
                            
                            # Get image format (default to png)
                            fmt = getattr(img, 'format', 'png')
                            if not fmt:
                                fmt = 'png'
                            
                            # Get bytes
                            img_bytes = img._data()
                            b64_data = base64.b64encode(img_bytes).decode('utf-8')
                            mime = f"image/{fmt.lower()}"
                            if row_idx < ROWS and col_idx < COLS:
                                cells[row_idx][col_idx] = f"data:{mime};base64,{b64_data}"
                        except Exception as img_err:
                            try:
                                with open("backend/debug_validation.log", "a") as f_log:
                                    f_log.write(f"  Error parsing image: {img_err}\n")
                            except:
                                pass

                if ws.data_validations:
                    for dv in ws.data_validations.dataValidation:
                        if dv.type == "list":
                            options = resolve_validation_options(dv.formula1, wb, ws)
                            if options:
                                sqref = dv.sqref
                                ranges_list = []
                                if isinstance(sqref, str):
                                    for ref_part in sqref.split(' '):
                                        try:
                                            from openpyxl.utils.cell import range_boundaries
                                            min_col, min_row, max_col, max_row = range_boundaries(ref_part)
                                            ranges_list.append((min_row, max_row, min_col, max_col))
                                        except:
                                            pass
                                elif hasattr(sqref, 'ranges'):
                                    for r_obj in sqref.ranges:
                                        ranges_list.append((r_obj.min_row, r_obj.max_row, r_obj.min_col, r_obj.max_col))
                                else:
                                    # Fallback
                                    try:
                                        sqref_str = str(sqref)
                                        for ref_part in sqref_str.split(' '):
                                            from openpyxl.utils.cell import range_boundaries
                                            min_col, min_row, max_col, max_row = range_boundaries(ref_part)
                                            ranges_list.append((min_row, max_row, min_col, max_col))
                                    except:
                                        pass
                                        
                                for min_row, max_row, min_col, max_col in ranges_list:
                                    for r in range(min_row - 1, max_row):
                                        for c in range(min_col - 1, max_col):
                                            if r < ROWS and c < COLS:
                                                validations[f"{r},{c}"] = {"type": "list", "options": options}
                
                for col_letter, col_dim in ws.column_dimensions.items():
                    try:
                        c = column_index_from_string(col_letter) - 1
                        if col_dim.width:
                            colWidths[str(c)] = int(col_dim.width * 7)
                    except:
                        pass
                        
                for row_num, row_dim in ws.row_dimensions.items():
                    r = row_num - 1
                    if row_dim.height:
                        rowHeights[str(r)] = int(row_dim.height * 1.3)
                            
                sparse_cells: dict = {}
                for ri, row_data in enumerate(cells):
                    for ci, v in enumerate(row_data):
                        if v:
                            if ri not in sparse_cells:
                                sparse_cells[ri] = {}
                            sparse_cells[ri][ci] = v

                sheets.append({
                    "name": ws.title,
                    "cells": sparse_cells,
                    "formats": formats,
                    "validations": validations,
                    "colWidths": colWidths,
                    "rowHeights": rowHeights
                })
                
            content_json = json.dumps({
                "_importedSheets": sheets
            })
        except Exception as e:
            try:
                import traceback
                with open("c:/Users/Homes247/Desktop/office-suite/backend/import_error.log", "w") as f_log:
                    f_log.write(f"Global import error: {e}\n{traceback.format_exc()}\n")
            except:
                pass
            content_json = _default_content(doc_type, title)
    elif doc_type == "doc":
        parsed = False
        try:
            import docx
            import base64
            doc_file = docx.Document(io.BytesIO(content_bytes))
            html = ""
            for p in doc_file.paragraphs:
                p_html = ""
                for run in p.runs:
                    # check for images
                    drawing_elements = run._element.xpath('.//w:drawing')
                    for drawing in drawing_elements:
                        blips = drawing.xpath('.//a:blip')
                        for blip in blips:
                            embed_id = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                            if embed_id and embed_id in doc_file.part.related_parts:
                                part = doc_file.part.related_parts[embed_id]
                                image_bytes = part.blob
                                b64 = base64.b64encode(image_bytes).decode('utf-8')
                                mime = part.content_type
                                if p_html.strip():
                                    style_str = ""
                                    if p.alignment == 1: style_str = ' style="text-align: center;"'
                                    elif p.alignment == 2: style_str = ' style="text-align: right;"'
                                    elif p.alignment == 3: style_str = ' style="text-align: justify;"'
                                    html += f"<p{style_str}>{p_html}</p>"
                                    p_html = ""
                                html += f'<img src="data:{mime};base64,{b64}" style="max-width: 100%; height: auto; display: block; margin: 12px auto;" />'
                    
                    text = run.text.replace('<', '&lt;').replace('>', '&gt;')
                    if text:
                        if run.bold: text = f"<b>{text}</b>"
                        if run.italic: text = f"<i>{text}</i>"
                        if run.underline: text = f"<u>{text}</u>"
                        p_html += text
                        
                if p_html.strip():
                    style_str = ""
                    if p.alignment == 1:
                        style_str = ' style="text-align: center;"'
                    elif p.alignment == 2:
                        style_str = ' style="text-align: right;"'
                    elif p.alignment == 3:
                        style_str = ' style="text-align: justify;"'
                        
                    html += f"<p{style_str}>{p_html}</p>"
            if not html:
                html = "<br>"
            content_json = json.dumps({"html": html})
            parsed = True
        except Exception as e:
            pass
            
        if not parsed:
            if filename_lower.endswith(".html"):
                try:
                    html_content = content_bytes.decode('utf-8', errors='replace')
                    content_json = json.dumps({"html": html_content})
                    parsed = True
                except:
                    pass
            elif filename_lower.endswith(".txt") or not parsed:
                try:
                    text = content_bytes.decode('utf-8', errors='replace')
                    html_content = "".join([f"<p>{line}</p>" for line in text.splitlines()])
                    content_json = json.dumps({"html": html_content or "<br>"})
                    parsed = True
                except:
                    pass

                    
        if not parsed:
            content_json = _default_content(doc_type, title)
            
    elif doc_type == "slide":
        try:
            from pptx import Presentation
            import zipfile
            prs = Presentation(io.BytesIO(content_bytes))
            pages = {}
            page_order = []
            for slide in prs.slides:
                pid = str(uuid.uuid4())
                page_order.append(pid)
                text_content = ""
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        text_content += f"<p>{shape.text}</p>"
                pages[pid] = {"title": f"Slide {len(page_order)}", "body": text_content}
            if not pages:
                content_json = _default_content(doc_type, title)
            else:
                content_json = json.dumps({
                    "id": page_order[0] if page_order else str(uuid.uuid4()),
                    "title": title,
                    "pages": pages,
                    "pageOrder": page_order
                })
        except Exception as e:
            content_json = _default_content(doc_type, title)
    else:
        content_json = _default_content(doc_type, title)
        
    if replace_doc_id:
        doc = await db.get(Document, replace_doc_id)
        if not doc or doc.owner_id != current_user.id:
            raise HTTPException(404, "Document not found or access denied")
        doc.title = title
    else:
        doc = Document(
            title=title,
            doc_type=doc_type,
            owner_id=current_user.id,
        )
        db.add(doc)
    await db.commit()
    await db.refresh(doc)

    try:
        storage_res = await asyncio.to_thread(
            DocumentStorage.save, doc.owner_id, doc.id, content_json, doc_type=doc.doc_type
        )
        doc.file_path = storage_res["relative_path"]
        doc.file_size = storage_res["size"]
        doc.content_version = 1
        await db.commit()
    except Exception as e:
        print(f"Error saving imported document to storage: {e}")

    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type, "content": content_json}


@router.get("")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Select only the columns we need — NOT content (can be 50 MB+)
    result = await db.execute(
        select(
            Document.id,
            Document.title,
            Document.doc_type,
            Document.updated_at,
            Document.is_trashed,
            Document.owner_id,
            User.name.label('owner_name'),
        )
        .join(User, Document.owner_id == User.id)
        .outerjoin(DocumentShare, Document.id == DocumentShare.document_id)
        .where(
            or_(
                Document.owner_id == current_user.id,
                DocumentShare.user_id == current_user.id,
            ),
        )
        .order_by(Document.updated_at.desc())
        .distinct()
    )
    docs = result.all()
    return [
        {
            "id": row.id,
            "title": row.title,
            "doc_type": row.doc_type,
            "updated_at": row.updated_at,
            "is_trashed": row.is_trashed,
            "owner_id": row.owner_id,
            "owner_name": row.owner_name,
        }
        for row in docs
    ]


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    if not doc.is_public:
        if not current_user:
            raise HTTPException(401, "Not authenticated")
        if doc.owner_id != current_user.id:
            existing = await db.execute(
                select(DocumentShare).where(
                    DocumentShare.document_id == doc_id,
                    DocumentShare.user_id == current_user.id,
                )
            )
            if not existing.scalar_one_or_none():
                raise HTTPException(403, "Access denied")

    content = "{}"
    if doc.file_path:
        try:
            content = await asyncio.to_thread(
                DocumentStorage.load,
                doc.owner_id, doc.id,
                doc_type=doc.doc_type,
                file_path=doc.file_path,
            )
        except Exception as e:
            print(f"Failed to load doc {doc.id} from storage: {e}")
            pass

    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type, "content": content}


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    # Allow owner or users with edit permission
    if doc.owner_id != current_user.id:
        share = await db.execute(
            select(DocumentShare).where(
                DocumentShare.document_id == doc_id,
                DocumentShare.user_id == current_user.id,
                DocumentShare.permission.in_(["edit", "Edit", "EDIT"]),
            )
        )
        if not share.scalar_one_or_none():
            raise HTTPException(403, "Forbidden")

    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        try:
            storage_res = await asyncio.to_thread(
                DocumentStorage.save, doc.owner_id, doc.id, body.content, doc_type=doc.doc_type
            )
            doc.file_path = storage_res["relative_path"]
            doc.file_size = storage_res["size"]
            doc.content_version = (doc.content_version or 1) + 1
        except Exception as e:
            print(f"Failed to save document {doc.id} to storage: {e}")
            
    if body.is_trashed is not None:
        doc.is_trashed = body.is_trashed
        
    await db.commit()
    return {"id": doc.id, "title": doc.title}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.owner_id != current_user.id:
        raise HTTPException(403, "Only the owner can delete this document")
    
    if doc.is_trashed:
        try:
            await asyncio.to_thread(
                DocumentStorage.delete,
                doc.owner_id, doc.id,
                doc_type=doc.doc_type,
                file_path=doc.file_path,
            )
        except Exception as e:
            print(f"Failed to delete document {doc.id} from storage: {e}")
        await db.delete(doc)
    else:
        doc.is_trashed = 1
        
    await db.commit()
    return {"deleted": True}

@router.post("/{doc_id}/share")
async def share_document(
    doc_id: str,
    body: DocumentShareCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(404, "Not found or not owner")
    
    # Find user by email
    result = await db.execute(select(User).where(User.email == body.email))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, "User not found")
        
    # Check if already shared
    existing = await db.execute(select(DocumentShare).where(
        DocumentShare.document_id == doc_id,
        DocumentShare.user_id == target_user.id
    ))
    share = existing.scalar_one_or_none()
    if share:
        share.permission = body.permission
    else:
        share = DocumentShare(document_id=doc_id, user_id=target_user.id, permission=body.permission)
        db.add(share)
    
    await db.commit()
    return {"shared": True, "permission": body.permission, "user_id": target_user.id}