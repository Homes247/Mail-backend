# Implementation Plan: Version History for Spreadsheet Engine

## (a) Findings from Phase 0

1. **Full-state serialization**: The engine serializes the entire sheet state in `backend/app/lib/document_storage.py` via the `DocumentStorage.save()` method. The state is represented as a JSON array of sheet objects, which is stringified, compressed using `gzip`, and uploaded to Cloudflare R2 as a binary blob. 
2. **Read-only / view-mode rendering**: There is **no existing robust read-only or view mode** for the spreadsheet grid. The frontend only contains preview modes for images (`previewImageUrl`) and charts. *Proposed smallest addition:* Rather than building a parallel read-only renderer, we can reuse the live `SheetEditorComponent` grid but apply an overlay with `pointer-events: none; opacity: 0.8` (or similar CSS) to disable interaction while a snapshot is being previewed.
3. **R2 upload pattern**: R2 uploads are managed using a `boto3.client('s3')` initialized with `R2_ENDPOINT_URL`. The key naming convention currently maps to `Drive/{doc_type}/{owner_id}/{doc_id}.json`. I will reuse this client and bucket (`R2_BUCKET_NAME`) for versions, using a distinct path pattern like `Drive/Sheet/{owner_id}/versions/{doc_id}_{version_id}.json`.
4. **Mutation choke point**: Audit Trail hooks into mutations via the frontend's `pushHistory` buffer, which is periodically flushed to `backend/app/api/documents.py` -> `save_audit_events()`. This endpoint is the exact, optimal server-side choke point for the auto-checkpoint logic since it processes every batch of live mutations.
5. **The dead "Version History" link**: Located in `sheet-editor.component.ts` (line 2972). There is an existing modal template bound to `*ngIf="activeModal === 'version'"` containing a hardcoded `dummyList` of versions.

---

## (b) The Checkpoint-Trigger Logic

The trigger hooks directly into `save_audit_events` in `backend/app/api/documents.py`. To capture the full in-memory state without duplicating logic or causing circular imports, we perform a local import of the websocket `manager`.

```python
# backend/app/api/documents.py (Snippet to insert into save_audit_events)
from datetime import timezone, timedelta, datetime

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))
def now_ist() -> datetime:
    return datetime.now(IST_OFFSET).replace(tzinfo=None)

@router.post("/{doc_id}/audit-events")
async def save_audit_events(
    doc_id: str,
    events: list[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    # [Existing Audit Trail insertion logic here...]

    # --- NEW: Version Checkpoint Trigger ---
    last_version = await db.execute(
        select(SheetVersion)
        .where(SheetVersion.document_id == doc_id)
        .order_by(SheetVersion.created_at.desc())
        .limit(1)
    )
    last_version = last_version.scalar_one_or_none()

    needs_checkpoint = False
    if not last_version:
        needs_checkpoint = True
    elif (now_ist() - last_version.created_at).total_seconds() > 600:
        needs_checkpoint = True
    elif last_version.created_by_user_id != current_user.id:
        needs_checkpoint = True

    if needs_checkpoint:
        # MINOR NOTE: 'import main' is used here as a correctness-over-elegance workaround
        # for circular imports. In the final PR, evaluate replacing this with Dependency 
        # Injection (e.g. passing manager via request.app.state) for a cleaner architecture.
        import main
        state = main.manager.doc_states.get(doc_id)
        if state and state.get("data"):
            # FIX: We use state["data"][0] here to capture the full workbook because main.py's
            # WS 'update' handler wraps the frontend's root payload (which contains _importedSheets) 
            # in a 1-element list via `state["data"] = [parsed]`. Thus, index 0 *is* the full document.
            content_str = json.dumps(state["data"][0]) if isinstance(state["data"], list) else json.dumps(state["data"])
            
            # Reusing existing serializer pattern
            import gzip
            from app.lib.document_storage import _s3_client, R2_BUCKET_NAME
            import uuid
            version_id = str(uuid.uuid4())
            # FIX: Rename r2_key to sheet_snapshot_url
            sheet_snapshot_url = f"Drive/Sheet/{doc.owner_id}/versions/{doc_id}_{version_id}.json"
            body_bytes = gzip.compress(content_str.encode("utf-8"), compresslevel=1)
            
            # FIX: Upload synchronously but off-thread to avoid blocking the event loop
            # and prevent the race condition where the DB row exists before R2 is ready.
            import asyncio
            def upload_to_r2():
                _s3_client.put_object(
                    Bucket=R2_BUCKET_NAME,
                    Key=sheet_snapshot_url,
                    Body=body_bytes,
                    ContentType="application/json",
                )
            await asyncio.to_thread(upload_to_r2)
            
            # Determine contributors since last checkpoint
            contributors = [current_user.id]
            if last_version:
                recent_audits = await db.execute(
                    select(AuditEvent.user_id)
                    .where(AuditEvent.document_id == doc_id, AuditEvent.created_at > last_version.created_at)
                )
                contributors = list(set([u for u in recent_audits.scalars().all()] + [current_user.id]))

            new_version = SheetVersion(
                id=version_id,
                document_id=doc_id,
                created_by_user_id=current_user.id,
                contributors=contributors,
                is_named=False,
                sheet_snapshot_url=sheet_snapshot_url,
                created_at=now_ist()
            )
            db.add(new_version)
    
    await db.commit()
    return {"status": "success"}
```

---

## (c) FastAPI Pydantic Models + Endpoints

```python
# backend/app/models/sheet_version.py (New SQLAlchemy Model)
import uuid
from sqlalchemy import Column, String, Integer, JSON, Boolean, DateTime
from app.database import Base
from datetime import timezone, timedelta, datetime

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))
def now_ist() -> datetime:
    return datetime.now(IST_OFFSET).replace(tzinfo=None)

class SheetVersion(Base):
    __tablename__ = "sheet_versions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), nullable=False, index=True)
    version_name = Column(String(255), nullable=True)
    created_by_user_id = Column(Integer, nullable=False)
    contributors = Column(JSON, nullable=False)
    is_named = Column(Boolean, default=False)
    sheet_snapshot_url = Column(String(500), nullable=False)
    base_version_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=now_ist, index=True)

# backend/app/api/documents.py (New Endpoints)
from pydantic import BaseModel
from typing import Optional, List
import json
from sqlalchemy import select

class VersionResponse(BaseModel):
    id: str
    version_name: Optional[str]
    created_by_user_id: int
    contributors: List[int]
    is_named: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class VersionCreateRequest(BaseModel):
    version_name: str

@router.get("/{doc_id}/versions", response_model=List[VersionResponse])
async def get_sheet_versions(doc_id: str, limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SheetVersion)
        .where(SheetVersion.document_id == doc_id)
        .order_by(SheetVersion.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()

@router.get("/{doc_id}/versions/{version_id}")
async def get_sheet_version_snapshot(doc_id: str, version_id: str, db: AsyncSession = Depends(get_db)):
    version = await db.get(SheetVersion, version_id)
    if not version or version.document_id != doc_id:
        raise HTTPException(404, "Version not found")
        
    from app.lib.document_storage import _s3_client, R2_BUCKET_NAME
    import gzip
    try:
        response = _s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=version.sheet_snapshot_url)
        body_bytes = response["Body"].read()
        content = gzip.decompress(body_bytes).decode("utf-8")
        return {"content": json.loads(content)}
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch snapshot: {str(e)}")

@router.post("/{doc_id}/versions")
async def create_named_version(
    doc_id: str, 
    body: VersionCreateRequest, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    doc = await db.get(Document, doc_id)
    if not doc: raise HTTPException(404, "Not found")
    
    # MINOR NOTE: 'import main' is used here as a correctness-over-elegance workaround
    # for circular imports. In the final PR, evaluate replacing this with Dependency 
    # Injection (e.g. passing manager via request.app.state) for a cleaner architecture.
    import main
    import uuid
    state = main.manager.doc_states.get(doc_id)
    if not state or not state.get("data"):
        raise HTTPException(400, "Document state is empty or not in memory")
        
    # FIX: We use state["data"][0] because main.py wraps the full workbook root object 
    # (containing _importedSheets) in a 1-element list.
    content_str = json.dumps(state["data"][0]) if isinstance(state["data"], list) else json.dumps(state["data"])
    
    import gzip
    from app.lib.document_storage import _s3_client, R2_BUCKET_NAME
    version_id = str(uuid.uuid4())
    sheet_snapshot_url = f"Drive/Sheet/{doc.owner_id}/versions/{doc_id}_{version_id}.json"
    body_bytes = gzip.compress(content_str.encode("utf-8"), compresslevel=1)
    
    _s3_client.put_object(
        Bucket=R2_BUCKET_NAME, Key=sheet_snapshot_url, Body=body_bytes, ContentType="application/json",
    )
    
    new_version = SheetVersion(
        id=version_id,
        document_id=doc_id,
        version_name=body.version_name,
        created_by_user_id=current_user.id,
        contributors=[current_user.id],
        is_named=True,
        sheet_snapshot_url=sheet_snapshot_url,
        created_at=now_ist()
    )
    db.add(new_version)
    await db.commit()
    return {"status": "success", "id": version_id}

@router.post("/{doc_id}/versions/{version_id}/restore")
async def restore_sheet_version(
    doc_id: str, 
    version_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch snapshot from R2
    version = await db.get(SheetVersion, version_id)
    if not version or version.document_id != doc_id:
        raise HTTPException(404, "Version not found")
        
    doc = await db.get(Document, doc_id)
    from app.lib.document_storage import DocumentStorage, _s3_client, R2_BUCKET_NAME
    import gzip
    import uuid
    
    response = _s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=version.sheet_snapshot_url)
    snapshot_bytes = response["Body"].read()
    snapshot_content = gzip.decompress(snapshot_bytes).decode("utf-8")
    
    # 2. Append a new version representing the restoration checkpoint
    new_version_id = str(uuid.uuid4())
    new_sheet_snapshot_url = f"Drive/Sheet/{doc.owner_id}/versions/{doc_id}_{new_version_id}.json"
    
    _s3_client.put_object(
        Bucket=R2_BUCKET_NAME, Key=new_sheet_snapshot_url, Body=snapshot_bytes, ContentType="application/json",
    )
    
    new_version = SheetVersion(
        id=new_version_id,
        document_id=doc_id,
        version_name=f"Restored from {version.created_at.strftime('%b %d, %H:%M')}",
        created_by_user_id=current_user.id,
        contributors=[current_user.id],
        is_named=True,
        sheet_snapshot_url=new_sheet_snapshot_url,
        base_version_id=version.id,
        created_at=now_ist()
    )
    db.add(new_version)
    
    # 3. Explicitly persist restored state to long-term storage
    # FIX: We must push the change directly to the actual document's R2 path,
    # ensuring that if the server crashes before the next websocket flush, data isn't lost.
    storage_res = DocumentStorage.save(doc.owner_id, doc.id, snapshot_content, doc_type=doc.doc_type)
    doc.file_path = storage_res["relative_path"]
    doc.file_size = storage_res["size"]
    doc.content_version = (doc.content_version or 1) + 1
    
    await db.commit()
    
    # 4. Force live document to update via websockets
    import main
    state = main.manager.doc_states.get(doc_id)
    if state:
        # FIX: The frontend sends the root payload (which holds _importedSheets), and main.py
        # wraps it in a 1-element list via `state["data"] = [parsed]`. We mirror that structure here.
        state["data"] = [json.loads(snapshot_content)]
        state["seq"] += 1
        state["dirty"] = False  # Already persisted above
        
        # We broadcast state["data"][0], which natively contains the full multi-sheet workbook,
        # matching the exact schema used in main.py's `connect()` and WS updates.
        payload = json.dumps({
            "type": "update",
            "content": json.dumps(state["data"][0]) if isinstance(state["data"], list) else json.dumps(state["data"]),
            "seq": state["seq"]
        })
        await main.manager.broadcast(doc_id, payload)
        
    return {"status": "success"}
```

---

## (d) Angular Service + Version History Panel Component

**1. Service Update (`frontend/src/app/services/api.service.ts`)**
```typescript
  getSheetVersions(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/documents/${id}/versions`);
  }

  getSheetVersionSnapshot(docId: string, versionId: string): Observable<any> {
    return this.http.get<any>(`${this.base}/documents/${docId}/versions/${versionId}`);
  }

  createNamedVersion(id: string, name: string): Observable<any> {
    return this.http.post(`${this.base}/documents/${id}/versions`, { version_name: name });
  }

  restoreSheetVersion(docId: string, versionId: string): Observable<any> {
    return this.http.post(`${this.base}/documents/${docId}/versions/${versionId}/restore`, {});
  }
```

**2. Component Logic (`frontend/src/app/pages/sheet-editor/sheet-editor.component.ts`)**
```typescript
  // Component State Additions
  versions: any[] = [];
  previewVersionId: string | null = null;
  newVersionName: string = '';
  // FIX: Dedicated property for read-only preview data to avoid mutating live editor state
  previewData: any = null;
  previewActiveSheetIdx: number = 0;
  
  // Dynamic getter to extract sheets from the snapshot (handles both root object and legacy array)
  get previewSheets() {
    if (!this.previewData) return [];
    if (this.previewData._importedSheets) return this.previewData._importedSheets;
    return Array.isArray(this.previewData) ? this.previewData : [this.previewData];
  }

  // FIX: Dynamically parses snapshot JSON into a 2D array sized exactly to the sheet's bounds
  get previewCells() {
    const sheets = this.previewSheets;
    if (sheets.length === 0) return [];
    const sheet = sheets[this.previewActiveSheetIdx] || sheets[0];
    const cells = sheet?.cells || {};
    
    // Find dynamic bounds
    let maxR = 20; // default minimum visual rows
    let maxC = 10; // default minimum visual cols
    
    // Cells are keyed as nested objects by stringified row and col indices: cells[r][c]
    Object.keys(cells).forEach(rKey => {
      const r = parseInt(rKey, 10);
      if (!isNaN(r) && r > maxR) maxR = r;
      if (cells[rKey]) {
        Object.keys(cells[rKey]).forEach(cKey => {
          const c = parseInt(cKey, 10);
          if (!isNaN(c) && c > maxC) maxC = c;
        });
      }
    });
    
    const rows = [];
    // Render up to max bounds with minor padding
    for (let r = 0; r <= maxR + 2; r++) {
      const row = [];
      for (let c = 0; c <= maxC + 2; c++) {
        row.push(cells[r]?.[c] || '');
      }
      rows.push(row);
    }
    return rows;
  }

  // Derived getters for Zoho Sheet / Google Sheets visual grouping style
  get namedVersions() {
    return this.versions.filter(v => v.is_named);
  }
  get autoVersions() {
    return this.versions.filter(v => !v.is_named);
  }

  openEditHistory() {
    this.activeModal = 'version';
    this.previewVersionId = null;
    this.previewData = null;
    this.loadVersions();
  }

  loadVersions() {
    if (this.docId) {
      this.api.getSheetVersions(this.docId).subscribe({
        next: (res) => this.versions = res,
        error: (err) => console.error(err)
      });
    }
  }

  saveNamedVersion() {
    if (!this.newVersionName.trim() || !this.docId) return;
    this.api.createNamedVersion(this.docId, this.newVersionName).subscribe(() => {
      this.newVersionName = '';
      this.loadVersions();
    });
  }

  previewVersion(versionId: string) {
    if (!this.docId) return;
    this.previewVersionId = versionId;
    this.api.getSheetVersionSnapshot(this.docId, versionId).subscribe(res => {
      // FIX: Store snapshot in isolated state rather than mutating live grid properties.
      this.previewData = typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
      this.previewActiveSheetIdx = 0;
      this.cdr.detectChanges();
    });
  }

  restoreVersion(versionId: string) {
    if (!this.docId) return;
    this.api.restoreSheetVersion(this.docId, versionId).subscribe(() => {
      this.activeModal = null;
      this.previewVersionId = null;
      this.previewData = null;
      this.showToast('Version restored successfully');
      // The websocket will automatically broadcast the 'update' event to reload our grid
    });
  }

  exitPreview() {
    this.previewVersionId = null;
    this.previewData = null;
    // FIX: Do NOT use sendUpdate('{}') which risks broadcasting blank data.
    // The live state was never mutated, so we can just hide the preview overlay.
  }
```

**3. Component Template (`sheet-editor.component.ts` modal HTML)**
```html
<div *ngIf="activeModal === 'version'" style="width: 700px; max-width: 90vw;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="material-symbols-outlined" style="color:#1a73e8;font-size:24px;">manage_history</span>
      <h3 style="margin:0;font-size:18px;font-weight:600;">Version History</h3>
    </div>
    <button (click)="activeModal=null" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined">close</span></button>
  </div>

  <div style="display:flex; gap:10px; margin-bottom:16px;">
    <input type="text" [(ngModel)]="newVersionName" placeholder="Name current version..." style="flex:1; padding:8px; border:1px solid #e0e0e0; border-radius:4px; outline:none;">
    <button (click)="saveNamedVersion()" [disabled]="!newVersionName.trim()" style="background:#1a73e8; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Save</button>
  </div>

  <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden; height:400px; overflow-y:auto; background:#f9f9f9;">
    <!-- Current Version Pinned -->
    <div style="padding:12px 16px; border-bottom:1px solid #e2e8f0; background:#f0fdf4;">
      <div style="font-weight:600; color:#0f9d58;">Current Version</div>
      <div style="font-size:12px; color:#5f6368;">Live document state</div>
    </div>

    <!-- Named Versions -->
    <div *ngIf="namedVersions.length > 0" style="padding:8px 16px; background:#e8f0fe; color:#1a73e8; font-weight:600; font-size:12px; text-transform:uppercase;">Named Versions</div>
    <div *ngFor="let v of namedVersions" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; background:#fff; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:500;">{{ v.version_name }}</div>
        <div style="font-size:12px; color:#5f6368;">{{ v.created_at | date:'medium' }}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button (click)="previewVersion(v.id)" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:12px;">Preview</button>
        <button (click)="restoreVersion(v.id)" style="background:#1a73e8; color:#fff; border:none; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:12px;">Restore</button>
      </div>
    </div>

    <!-- Auto Checkpoints -->
    <div *ngIf="autoVersions.length > 0" style="padding:8px 16px; background:#f1f5f9; color:#5f6368; font-weight:600; font-size:12px; text-transform:uppercase;">Auto-Saved Checkpoints</div>
    <div *ngFor="let v of autoVersions" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; background:#fff; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:500;">{{ v.created_at | date:'medium' }}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button (click)="previewVersion(v.id)" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:12px;">Preview</button>
        <button (click)="restoreVersion(v.id)" style="background:#1a73e8; color:#fff; border:none; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:12px;">Restore</button>
      </div>
    </div>
  </div>
</div>
```

**4. The Minimal Overlay Hack for Read-Only Previews**
To fulfill the requirement of locking the grid during a snapshot preview and *not* mutating live editor state, we conditionally render an isolated preview container over the core `.grid-wrap`:

```html
<!-- Inside sheet-editor.component.ts template around the grid -->
<div style="position:relative; width:100%; height:100%;">
  
  <!-- The overlay block -->
  <div *ngIf="previewVersionId" style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.98); z-index:9999; display:flex; flex-direction:column;">
    
    <div style="background:#333; color:#fff; padding:12px 24px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-weight:600;">Previewing Version Snapshot (Read-Only)</span>
      <div style="display:flex; gap:16px;">
        <button (click)="restoreVersion(previewVersionId)" style="background:#0f9d58; color:#fff; border:none; padding:6px 16px; border-radius:4px; cursor:pointer;">Restore This Version</button>
        <button (click)="exitPreview()" style="background:rgba(255,255,255,0.2); color:#fff; border:none; padding:6px 16px; border-radius:4px; cursor:pointer;">Exit Preview</button>
      </div>
    </div>
    
    <!-- Isolated Read-Only Render -->
    <!-- FIX: Basic HTML table grid rendering to display snapshot content natively instead of raw JSON -->
    <div style="flex:1; overflow:auto; padding:20px; background:#f8f9fa; display:flex; flex-direction:column;">
      <div style="color:#666; font-style:italic; margin-bottom:12px;">This is a read-only preview of the document state.</div>
      
      <!-- Sheet Tabs -->
      <div style="display:flex; gap:4px; margin-bottom:8px;" *ngIf="previewSheets.length > 1">
        <button *ngFor="let sheet of previewSheets; let i = index" 
                (click)="previewActiveSheetIdx = i"
                [style.background]="previewActiveSheetIdx === i ? '#fff' : '#e2e8f0'"
                [style.borderBottom]="previewActiveSheetIdx === i ? 'none' : '1px solid #ccc'"
                style="padding:6px 16px; border:1px solid #ccc; border-radius:4px 4px 0 0; cursor:pointer;">
          {{ sheet.name || 'Sheet ' + (i + 1) }}
        </button>
      </div>

      <div style="flex:1; overflow:auto;">
        <table style="border-collapse:collapse; background:#fff; border:1px solid #ccc; font-size:13px; font-family:sans-serif;">
          <tr *ngFor="let row of previewCells; let r = index">
            <td style="background:#f1f3f4; color:#666; text-align:center; padding:4px 8px; border:1px solid #ccc; min-width:30px;">{{ r + 1 }}</td>
            <td *ngFor="let cell of row" style="border:1px solid #ccc; padding:4px 8px; min-width:80px; height:24px; white-space:nowrap; overflow:hidden;">
              {{ cell }}
            </td>
          </tr>
        </table>
      </div>
    </div>
  </div>

  <!-- Existing Grid content goes here -->
  <div class="grid-wrap">
    ...
  </div>
</div>
```
