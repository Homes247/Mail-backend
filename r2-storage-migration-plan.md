# Implementation Plan: Migrate Document Storage to Cloudflare R2

**Goal:** Replace local-disk file storage (`storage/documents/{owner_id}/{doc_id}.json`) with Cloudflare R2 object storage, organized as `Drive/{Doc|Sheet|Slide}/{owner_id}/{doc_id}.json`, while keeping the DB schema and all API contracts unchanged.

**Current state (verified from code):**
- `document_storage.py` — writes/reads JSON files on local disk via `os.path` + `open()`
- `documents.py` — calls `DocumentStorage.save/load/delete` with `(owner_id, doc_id, content)`; DB row stores `file_path`, `file_size`, `content_version`
- R2 bucket `vsnapmail` already exists in Cloudflare, with `Drive/Doc/`, `Drive/Sheet/`, `Drive/Slide/` folders already created
- R2 API token already created and scoped to this bucket (Access Key ID + Secret Access Key obtained)

**Out of scope for this change:** no DB schema changes needed — `file_path`, `file_size`, `content_version` columns already exist and are reused as-is, just now storing an R2 object key instead of a local relative path.

---

## 1. Dependencies

Add to `requirements.txt`:
```
boto3>=1.34.0
```

Install:
```bash
pip install boto3
```

---

## 2. Environment variables

Add to `.env` (and `.env.example` with placeholder values, do NOT commit real secrets):

```
R2_ACCOUNT_ID=526cb6cff3fef8ee10043692ecb532f8
R2_ACCESS_KEY_ID=__set_me__
R2_SECRET_ACCESS_KEY=__set_me__
R2_BUCKET_NAME=vsnapmail
R2_ENDPOINT_URL=https://526cb6cff3fef8ee10043692ecb532f8.r2.cloudflarestorage.com
```

Confirm `.env` is already in `.gitignore`. If not, add it now, before committing any of this work.

---

## 3. Replace `document_storage.py`

Full replacement — keep the class name `DocumentStorage` and its public method names identical (`save`, `load`, `delete`, `relative_path`) so no other file needs to change its import statements.

```python
import os
import boto3
from botocore.exceptions import ClientError

R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

_s3_client = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)

# Maps the `doc_type` DB column to the existing bucket folder names
_DOC_TYPE_FOLDERS = {
    "doc": "Doc",
    "sheet": "Sheet",
    "slide": "Slide",
}


class DocumentStorage:
    @staticmethod
    def _key_for(owner_id: int, doc_id: str, doc_type: str = "doc") -> str:
        folder = _DOC_TYPE_FOLDERS.get(doc_type, "Doc")
        return f"Drive/{folder}/{owner_id}/{doc_id}.json"

    @staticmethod
    def relative_path(owner_id: int, doc_id: str, doc_type: str = "doc") -> str:
        """Returns the R2 object key. Kept as `relative_path` for naming
        continuity with the old local-disk implementation, but this is now
        the actual S3/R2 key stored in documents.file_path."""
        return DocumentStorage._key_for(owner_id, doc_id, doc_type)

    @staticmethod
    def save(owner_id: int, doc_id: str, content: str, doc_type: str = "doc") -> dict:
        key = DocumentStorage._key_for(owner_id, doc_id, doc_type)
        body_bytes = content.encode("utf-8")

        _s3_client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=body_bytes,
            ContentType="application/json",
        )

        return {
            "relative_path": key,
            "size": len(body_bytes),
        }

    @staticmethod
    def load(owner_id: int, doc_id: str, doc_type: str = "doc", file_path: str = None) -> str:
        # Always prefer the DB's stored file_path as the source of truth —
        # only fall back to recomputing the key if file_path wasn't passed
        # (keeps backward compatibility with any call site not yet updated).
        key = file_path or DocumentStorage._key_for(owner_id, doc_id, doc_type)

        try:
            response = _s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=key)
            return response["Body"].read().decode("utf-8")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("NoSuchKey", "404"):
                raise FileNotFoundError(f"Document not found in R2: {key}")
            raise

    @staticmethod
    def delete(owner_id: int, doc_id: str, doc_type: str = "doc", file_path: str = None) -> None:
        key = file_path or DocumentStorage._key_for(owner_id, doc_id, doc_type)
        try:
            _s3_client.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
        except ClientError as e:
            # Deleting a non-existent key is not an error we need to surface —
            # log and continue so delete_document endpoint doesn't 500.
            print(f"R2 delete warning for key {key}: {e}")
```

**Key implementation notes for Gemini:**
- No more temp-file-then-rename dance — `put_object` on S3/R2 is already atomic per object, so that local-disk-specific safety mechanism is no longer needed.
- `load`/`delete` now accept an optional `file_path` param — **always pass the DB's stored `file_path` value when calling these**, don't let them recompute the key from `doc_type`, since that guards against any future folder-naming change breaking access to already-saved documents.

---

## 4. Update `documents.py` call sites

There are 5 places calling `DocumentStorage` methods. Update each to pass `doc_type`, and pass `file_path` on load/delete calls.

### 4.1 `create_document` (around line 70)
```python
# before
storage_res = DocumentStorage.save(doc.owner_id, doc.id, content_val)

# after
storage_res = DocumentStorage.save(doc.owner_id, doc.id, content_val, doc_type=doc.doc_type)
```

### 4.2 `import_document` (around line 373)
```python
# before
storage_res = DocumentStorage.save(doc.owner_id, doc.id, content_json)

# after
storage_res = DocumentStorage.save(doc.owner_id, doc.id, content_json, doc_type=doc.doc_type)
```

### 4.3 `get_document` (around line 452)
```python
# before
content = DocumentStorage.load(doc.owner_id, doc.id)

# after
content = DocumentStorage.load(
    doc.owner_id, doc.id,
    doc_type=doc.doc_type,
    file_path=doc.file_path,
)
```

### 4.4 `update_document` (around line 487)
```python
# before
storage_res = DocumentStorage.save(doc.owner_id, doc.id, body.content)

# after
storage_res = DocumentStorage.save(doc.owner_id, doc.id, body.content, doc_type=doc.doc_type)
```

### 4.5 `delete_document` (around line 515)
```python
# before
DocumentStorage.delete(doc.owner_id, doc.id)

# after
DocumentStorage.delete(
    doc.owner_id, doc.id,
    doc_type=doc.doc_type,
    file_path=doc.file_path,
)
```

**No other files need changes.** `export.py` reads `doc.content` directly from the DB row in some cases — check whether `process_export` in `export.py` should instead call `DocumentStorage.load(...)` if `doc.content` is now always empty/stale post-migration (see Section 6 below — this is an important gap to check).

---

## 5. Gap to fix: `export.py` currently reads the wrong field

Looking at `process_export` in `export.py`:
```python
doc = await db.get(Document, doc_id)
content = json.loads(doc.content or "{}")
```

This reads `doc.content` — the **old DB column** — not the file/R2 storage. Since Phase 1 already moved content off this column (per the earlier storage migration), this is likely already stale or empty for any document saved after that migration, meaning **exports may currently be broken or exporting outdated content**.

**Fix required in `export.py`:**
```python
from app.lib.document_storage import DocumentStorage

async def process_export(doc_id: str, format: str, db: AsyncSession, password: str = None):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    content_str = "{}"
    if doc.file_path:
        try:
            content_str = DocumentStorage.load(
                doc.owner_id, doc.id,
                doc_type=doc.doc_type,
                file_path=doc.file_path,
            )
        except FileNotFoundError:
            content_str = "{}"
    elif doc.content:
        # fallback for any legacy un-migrated rows
        content_str = doc.content

    content = json.loads(content_str)
    # ... rest of function unchanged
```

**Flag this explicitly to Gemini as a required fix**, not optional — this is a pre-existing bug independent of the R2 migration, but it should be fixed in the same pass since you're touching this storage layer anyway.

---

## 6. Migration script: local disk → R2

Create `scripts/migrate_local_to_r2.py`:

```python
import os
import asyncio
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import AsyncSessionLocal  # adjust import to actual session factory name
from app.models.document import Document
from app.lib.document_storage import _s3_client, R2_BUCKET_NAME, _DOC_TYPE_FOLDERS
from sqlalchemy import select

LOCAL_STORAGE_BASE = os.path.join(os.getcwd(), "storage", "documents")


async def migrate():
    migrated = 0
    skipped = 0
    failed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document).where(Document.file_path.isnot(None))
        )
        docs = result.scalars().all()

        for doc in docs:
            local_path = os.path.join(LOCAL_STORAGE_BASE, doc.file_path)

            if not os.path.exists(local_path):
                print(f"[SKIP] No local file for {doc.id}: {local_path}")
                skipped += 1
                continue

            try:
                with open(local_path, "r", encoding="utf-8") as f:
                    content = f.read()

                folder = _DOC_TYPE_FOLDERS.get(doc.doc_type, "Doc")
                new_key = f"Drive/{folder}/{doc.owner_id}/{doc.id}.json"

                _s3_client.put_object(
                    Bucket=R2_BUCKET_NAME,
                    Key=new_key,
                    Body=content.encode("utf-8"),
                    ContentType="application/json",
                )

                doc.file_path = new_key
                doc.file_size = len(content.encode("utf-8"))
                migrated += 1
                print(f"[OK] {doc.id} -> {new_key}")

            except Exception as e:
                failed += 1
                print(f"[FAIL] {doc.id}: {e}")

        await db.commit()

    print(f"\nDone. Migrated: {migrated}, Skipped: {skipped}, Failed: {failed}")


if __name__ == "__main__":
    asyncio.run(migrate())
```

Run once:
```bash
python scripts/migrate_local_to_r2.py > migration_log.txt 2>&1
```

**Verification before considering migration complete:**
1. Zero `[FAIL]` entries in the log.
2. Spot check 5-10 documents (mix of doc/sheet/slide types, different owners) by opening them in the actual app UI.
3. Confirm object count in the R2 bucket via Cloudflare dashboard matches expected migrated count for each of `Drive/Doc/`, `Drive/Sheet/`, `Drive/Slide/`.
4. Only after all of the above: archive or delete the local `storage/documents/` folder (keep a backup copy elsewhere for a few days before permanently deleting, as a safety net).

---

## 7. Testing checklist

- [ ] Create a new **doc** → verify object appears at `Drive/Doc/{owner_id}/{doc_id}.json` in R2 dashboard
- [ ] Create a new **sheet** → verify object appears at `Drive/Sheet/{owner_id}/{doc_id}.json`
- [ ] Create a new **slide** → verify object appears at `Drive/Slide/{owner_id}/{doc_id}.json`
- [ ] Open/load each of the above → content displays correctly in the editor
- [ ] Edit and save each → confirm updated content persists (re-open and check) and `content_version` increments in DB
- [ ] Import an `.xlsx` file → verify sheet content saved to R2 correctly under `Drive/Sheet/`
- [ ] Export a sheet to `.xlsx`/`.csv`/`.pdf` → confirm exported content matches what's actually saved (this validates the `export.py` fix in Section 5)
- [ ] Delete a document (trash, then permanently delete) → confirm R2 object is removed on permanent delete, but still exists after just trashing
- [ ] Attempt to load a document with a stale/incorrect `file_path` → confirm graceful `FileNotFoundError` handling, not a 500 crash
- [ ] Confirm `.env` secrets are not committed to git (`git status` / `git diff` check before pushing)
- [ ] Load test: create/save a large sheet (many cells) and confirm save/load latency is acceptable (R2 network calls add a small amount of latency vs local disk — should still be well under 1s for typical document sizes)

---

## 8. Rollback plan

If something goes wrong post-migration:
1. The old local `storage/documents/` folder should be kept as a backup (not deleted) until Section 6's verification steps fully pass — restoring is as simple as pointing `document_storage.py` back to the local-disk implementation and updating `file_path` values back to the old relative paths, since both were captured in the migration log.
2. Keep `migration_log.txt` — it's the mapping of doc ID → old local path → new R2 key, needed for any rollback.

---

## Summary for Gemini

1. Add `boto3` to dependencies, set up R2 env vars.
2. Replace `document_storage.py` entirely with the R2/boto3 version in Section 3 — keep method signatures backward compatible (`doc_type` and `file_path` as optional params with defaults) so nothing else breaks if a call site is missed.
3. Update the 5 call sites in `documents.py` per Section 4 to pass `doc_type` (and `file_path` for load/delete).
4. **Fix the pre-existing bug in `export.py`** (Section 5) — it currently reads `doc.content` directly instead of loading from storage, which is likely broken or stale since the earlier file-storage migration.
5. Run the one-time migration script (Section 6), verify thoroughly, keep local files as backup until fully verified.
6. Run through the full testing checklist (Section 7) before considering this done.
