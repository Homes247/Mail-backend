# Implementation Plan: Document/Sheet Storage Migration + Real-Time Collaboration

**Project:** Vmail WorkDrive (Zoho-style office suite clone)
**Stack (observed):** PHP backend, MySQL (`vmail` database, `documents` table), Univer.js frontend (doc + sheet editor)
**Author intent:** Hand this to an AI coding assistant (Gemini) to implement changes correctly, in stages, without breaking existing functionality.

---

## 0. Context / Problem Statement

Currently, the `documents` table stores the **entire document/sheet content** (HTML for docs, cell JSON for sheets) directly in a `content` column (LONGTEXT/JSON).

Problems with this:
1. Table bloats fast — every edit rewrites a huge blob, causing slow queries, large backups, and MySQL page fragmentation.
2. No CDN/file-level caching possible.
3. No real-time collaboration (presence, live cursors, conflict-safe concurrent edits) exists at all today — even single full-sheet overwrite saves risk data loss when two users save at once.

This plan has **three independent phases**. They can be implemented and deployed separately, in order. Do not skip ahead — each phase depends on the previous one being stable.

| Phase | Goal | Risk | Est. effort |
|---|---|---|---|
| 1 | Move content out of DB column into file storage; DB stores only path | Low | Small |
| 2 | Add live presence (who's viewing, which cell/cursor) via WebSocket | Low-Medium | Medium |
| 3 | Add real conflict-safe concurrent editing (mutation sync) | High | Large |

---

## Phase 1 — Storage Migration (DB → File + Path)

### 1.1 Schema change

```sql
ALTER TABLE documents 
  ADD COLUMN file_path VARCHAR(500) NULL AFTER content,
  ADD COLUMN file_size INT UNSIGNED NULL AFTER file_path,
  ADD COLUMN content_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER file_size;

-- Keep `content` column until migration is verified. Do NOT drop yet.
```

`content_version` is added now because Phase 3 will need optimistic-locking / version checks later. Cheap to add now, painful to add later.

### 1.2 Storage layout

Store files **outside the public web root**. Suggested layout:

```
/var/vmail-storage/documents/{owner_id}/{document_id}.json
```

- Split by `owner_id` to avoid one giant folder with millions of files.
- Use `.json` extension regardless of `doc_type` (doc content is stored as `{"html": "..."}`, sheet content as Univer's snapshot JSON) — keep it consistent.
- Do **not** put this folder inside `/var/www/html` or any Apache/Nginx served directory. If it must be under the web root for some reason, block direct access via `.htaccess` / nginx `location` deny rule.

### 1.3 Backend helper functions (PHP)

Create `lib/DocumentStorage.php`:

```php
<?php

class DocumentStorage {
    private static string $baseDir = '/var/vmail-storage/documents';

    public static function pathFor(string $ownerId, string $docId): string {
        $dir = self::$baseDir . '/' . $ownerId;
        if (!is_dir($dir)) {
            mkdir($dir, 0750, true);
        }
        return $dir . '/' . $docId . '.json';
    }

    public static function relativePath(string $ownerId, string $docId): string {
        return $ownerId . '/' . $docId . '.json';
    }

    public static function save(string $ownerId, string $docId, string $jsonContent): array {
        $fullPath = self::pathFor($ownerId, $docId);
        $tmpPath = $fullPath . '.tmp';

        // Atomic write: write to temp file, then rename (avoids partial/corrupt reads
        // if the process crashes mid-write or another request reads concurrently)
        $bytesWritten = file_put_contents($tmpPath, $jsonContent, LOCK_EX);
        if ($bytesWritten === false) {
            throw new RuntimeException("Failed to write document file: $fullPath");
        }
        rename($tmpPath, $fullPath);

        return [
            'relative_path' => self::relativePath($ownerId, $docId),
            'size' => $bytesWritten,
        ];
    }

    public static function load(string $ownerId, string $docId): string {
        $fullPath = self::pathFor($ownerId, $docId);
        if (!file_exists($fullPath)) {
            throw new RuntimeException("Document file not found: $fullPath");
        }
        $content = file_get_contents($fullPath);
        if ($content === false) {
            throw new RuntimeException("Failed to read document file: $fullPath");
        }
        return $content;
    }

    public static function delete(string $ownerId, string $docId): void {
        $fullPath = self::pathFor($ownerId, $docId);
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }
    }
}
```

**Important implementation notes for Gemini:**
- Use the **write-to-temp-then-rename** pattern shown above. `rename()` on the same filesystem is atomic on Linux — this prevents a reader from ever seeing a half-written file.
- `$ownerId` and `$docId` must be validated/sanitized before being used in a path (they should already be UUIDs/ints from the DB — never take these raw from user input without checking they match expected format, to prevent path traversal).

### 1.4 Update save endpoint

Find the existing endpoint that handles document/sheet save (likely something like `route=/document/save` or similar REST handler). Change:

**Before (conceptual):**
```php
$stmt = $pdo->prepare("UPDATE documents SET content = ?, updated_at = NOW() WHERE id = ?");
$stmt->execute([$contentJson, $docId]);
```

**After:**
```php
$result = DocumentStorage::save($ownerId, $docId, $contentJson);

$stmt = $pdo->prepare(
    "UPDATE documents 
     SET file_path = ?, file_size = ?, content_version = content_version + 1, updated_at = NOW() 
     WHERE id = ?"
);
$stmt->execute([$result['relative_path'], $result['size'], $docId]);
```

Order matters: **write the file first**, then update the DB row. If the file write throws, the DB update never runs, so you never end up with a DB row pointing at a file that doesn't exist.

### 1.5 Update load endpoint

**Before:**
```php
$stmt = $pdo->prepare("SELECT content FROM documents WHERE id = ?");
$row = $stmt->fetch();
echo json_encode(['content' => $row['content']]);
```

**After:**
```php
$stmt = $pdo->prepare("SELECT owner_id, file_path FROM documents WHERE id = ?");
$row = $stmt->fetch();

if ($row['file_path']) {
    $content = DocumentStorage::load($row['owner_id'], $docId);
} else {
    // fallback during migration window — old rows may still have DB content
    $stmt2 = $pdo->prepare("SELECT content FROM documents WHERE id = ?");
    $content = $stmt2->execute([$docId])->fetch()['content'];
}

echo json_encode(['content' => $content]);
```

The frontend response shape (`{ content: "..." }`) stays **identical**, so no frontend/Univer changes are needed for this phase.

### 1.6 One-time migration script

Create `scripts/migrate_content_to_files.php`, run once via CLI:

```php
<?php
require __DIR__ . '/../lib/DocumentStorage.php';
require __DIR__ . '/../lib/db.php'; // however $pdo is bootstrapped

$stmt = $pdo->query(
    "SELECT id, owner_id, content FROM documents WHERE content IS NOT NULL AND file_path IS NULL"
);

$migrated = 0;
$failed = 0;

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    try {
        $result = DocumentStorage::save($row['owner_id'], $row['id'], $row['content']);
        $update = $pdo->prepare(
            "UPDATE documents SET file_path = ?, file_size = ? WHERE id = ?"
        );
        $update->execute([$result['relative_path'], $result['size'], $row['id']]);
        $migrated++;
        echo "[OK] {$row['id']}\n";
    } catch (Exception $e) {
        $failed++;
        echo "[FAIL] {$row['id']}: {$e->getMessage()}\n";
    }
}

echo "\nDone. Migrated: $migrated, Failed: $failed\n";
```

Run it:
```bash
php scripts/migrate_content_to_files.php > migration_log.txt 2>&1
```

**Verification steps before dropping the `content` column:**
1. Check `migration_log.txt` has zero `[FAIL]` lines.
2. Spot-check 5-10 random documents: open them in the app UI and confirm content loads correctly.
3. Compare row count: `SELECT COUNT(*) FROM documents WHERE file_path IS NOT NULL` should equal total row count with non-null original `content`.
4. Only after all of the above: `ALTER TABLE documents DROP COLUMN content;`

### 1.7 Web server config (block direct access if storage is ever under web root)

If storage must live under web root for infra reasons, add to `.htaccess` inside `/documents/` storage folder:
```apache
Require all denied
```
Or Nginx:
```nginx
location /storage/documents/ {
    deny all;
    return 403;
}
```

Prefer keeping storage entirely outside web root instead — simpler and safer.

---

## Phase 2 — Live Presence (Cursors / Who's Viewing What)

This does **not** touch document content or storage. It's purely ephemeral, in-memory, real-time metadata.

### 2.1 Add a WebSocket server

Recommended: Node.js + `socket.io` (easiest to integrate with a PHP backend since it runs as a separate lightweight service; PHP itself is poorly suited for long-lived WebSocket connections).

```bash
mkdir /var/vmail-realtime && cd /var/vmail-realtime
npm init -y
npm install socket.io express jsonwebtoken
```

`server.js`:
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // tighten this to your actual frontend origin in production
});

// docId -> Map<socketId, { userId, userName, cellRef, color }>
const presenceByDoc = new Map();

io.on('connection', (socket) => {
  let currentDocId = null;
  let currentUser = null;

  socket.on('join-document', ({ docId, userId, userName }) => {
    currentDocId = docId;
    currentUser = { userId, userName, cellRef: null, color: colorForUser(userId) };

    if (!presenceByDoc.has(docId)) presenceByDoc.set(docId, new Map());
    presenceByDoc.get(docId).set(socket.id, currentUser);

    socket.join(docId);

    // tell everyone else in the room who just joined
    socket.to(docId).emit('presence-update', getPresenceList(docId));
    // tell the joining user who's already here
    socket.emit('presence-update', getPresenceList(docId));
  });

  socket.on('cursor-update', ({ cellRef }) => {
    if (!currentDocId || !currentUser) return;
    currentUser.cellRef = cellRef;
    io.to(currentDocId).emit('presence-update', getPresenceList(currentDocId));
  });

  socket.on('disconnect', () => {
    if (currentDocId && presenceByDoc.has(currentDocId)) {
      presenceByDoc.get(currentDocId).delete(socket.id);
      io.to(currentDocId).emit('presence-update', getPresenceList(currentDocId));
    }
  });
});

function getPresenceList(docId) {
  return Array.from(presenceByDoc.get(docId)?.values() || []);
}

function colorForUser(userId) {
  const palette = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac'];
  let hash = 0;
  for (const ch of String(userId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

server.listen(3001, () => console.log('Realtime presence server on :3001'));
```

Run with `pm2` or `systemd` so it stays alive: `pm2 start server.js --name vmail-realtime`.

### 2.2 Frontend integration (wherever Univer is initialized)

```javascript
import { io } from 'socket.io-client';

const socket = io('https://your-domain:3001');

socket.emit('join-document', {
  docId: currentDocId,
  userId: currentUserId,
  userName: currentUserName,
});

// When local user selects a cell in Univer
univerAPI.onSelectionChanged((selection) => {
  socket.emit('cursor-update', { cellRef: selection.rangeRef }); // adapt to actual Univer selection API
});

// When presence updates arrive, render overlays
socket.on('presence-update', (users) => {
  renderRemoteCursors(users.filter(u => u.userId !== currentUserId));
});

function renderRemoteCursors(users) {
  // Use Univer's custom render / decoration API to draw a colored border + name tag
  // on each user's cellRef. Exact API depends on Univer version — check:
  // - univer facade `getActiveSheet().getRange(cellRef)` for positioning
  // - a floating absolutely-positioned <div> overlay synced to cell coordinates
  // is the simplest cross-version-compatible approach if Univer's native
  // decoration API is unavailable in the installed version.
}
```

**Note for Gemini:** the exact Univer API for selection-change events and cell decoration differs between Univer versions (facade API vs core API). Before implementing `renderRemoteCursors`, check the installed `@univerjs/*` package versions in `package.json` and consult the matching Univer docs for:
- Sheet: `Facade.onSelectionChanged`, or core `SheetSkeletonManagerService`
- Doc: cursor/selection change hooks differ; Univer Doc uses a different selection model than Sheet.

If the native decoration API proves difficult, a simpler fallback is a plain absolutely-positioned HTML overlay div per remote user, repositioned on scroll/selection using the cell's bounding rect from Univer's DOM.

### 2.3 Authentication for the WebSocket

Don't allow arbitrary `userId`/`userName` from the client unchecked — validate the session:
- Pass the existing PHP session cookie or a short-lived JWT (minted by PHP on page load) to the Node server on `join-document`.
- Node server verifies the JWT signature before trusting `userId`.

---

## Phase 3 — Conflict-Safe Concurrent Editing (Mutation Sync)

This is the hard part. Two realistic approaches, in order of recommended preference:

### Option A (recommended): Univer Pro's built-in collaboration

Univer offers a commercial "Univer Pro" tier with real-time collaborative editing (operational transform) already implemented, including a collaboration server component. Before building this yourself:

1. Check current Univer Pro pricing/licensing and whether it fits budget.
2. Check its collaboration server's self-hosting requirements — it may or may not be self-hostable depending on license tier.

**Gemini should verify current Univer Pro capabilities and pricing directly from Univer's official docs/site at implementation time, since these details change and must not be guessed.**

If Univer Pro fits: integrate their collaboration server per their docs, and skip the custom implementation below entirely.

### Option B: Custom mutation-based sync (only if Option A is not viable)

Instead of saving/loading whole-document JSON snapshots, sync individual **mutations** (the same command objects Univer's own internal command system already produces).

High-level architecture:

```
Client A ---(local edit)---> Univer command executed locally (optimistic)
                           -> mutation broadcast via WebSocket to server
Server ---> append mutation to per-doc ordered log (in Redis or DB table `document_mutations`)
        ---> broadcast mutation to all other connected clients in that doc room
Client B ---> receives mutation ---> applies it to local Univer instance via its command/mutation execution API
```

Key components to build:

1. **`document_mutations` table** (or Redis stream) — append-only log of `{ doc_id, sequence_number, mutation_payload, user_id, timestamp }`.
2. **Sequence numbers** — every mutation gets a monotonically increasing sequence number per document, so clients can detect if they've missed one and request a re-sync.
3. **Periodic snapshot checkpoint** — every N mutations or M seconds, serialize the full Univer state and save it via Phase 1's file storage, then truncate the mutation log up to that point. This bounds recovery time (a client reconnecting after being offline replays: last snapshot + mutations since).
4. **Conflict handling** — Univer's internal command system does **not** include CRDT/OT logic for merging concurrent edits authored independently. Applying remote mutations in received order works correctly for non-overlapping edits (different cells/paragraphs) but can produce incorrect results for genuinely concurrent edits to the *same* cell/text range. Decide the acceptable behavior:
   - Simplest: last-mutation-wins on the same cell (acceptable for most spreadsheet use — cell-level granularity rarely has two people typing into the exact same cell at the exact same millisecond).
   - More correct: implement per-cell versioning and reject/merge conflicting mutations — significantly more engineering effort.

**This option is a multi-week engineering effort done properly. Do not attempt a shortcut version that silently drops or overwrites data — that is worse than not having the feature.**

### Recommended path forward for Gemini

1. Implement Phase 1 completely and verify in production first.
2. Implement Phase 2 (presence only) — ships visible value fast, zero data-integrity risk.
3. Before starting Phase 3, research Univer Pro's current collaboration offering (check official Univer docs/pricing at the time of implementation — do not rely on outdated assumptions). Only build Option B from scratch if Univer Pro genuinely doesn't fit.

---

## Testing Checklist

**Phase 1:**
- [ ] Create new document → verify row has `file_path` set, `content` stays NULL (or matches fallback logic)
- [ ] Open existing pre-migration document → loads correctly via fallback path
- [ ] Edit and save → file on disk updates, `content_version` increments
- [ ] Delete document → file removed from disk (extend delete endpoint to call `DocumentStorage::delete()`)
- [ ] Attempt direct URL access to storage path → confirm blocked (403 or not web-accessible at all)

**Phase 2:**
- [ ] Two browser sessions (different users) open same doc → each sees the other's presence indicator
- [ ] User selects different cells → live cursor position updates for the other user within ~200ms
- [ ] One user disconnects (closes tab) → their presence indicator disappears for the other user
- [ ] Confirm unauthenticated/forged `userId` is rejected by the WebSocket server

**Phase 3 (if built):**
- [ ] Two users edit different cells simultaneously → both changes persist correctly
- [ ] Two users edit the same cell within the same second → document behavior matches the chosen conflict policy (documented, not undefined)
- [ ] Client disconnects mid-session and reconnects → recovers correct current state (snapshot + replayed mutations)
- [ ] Load test: measure mutation broadcast latency with 10+ concurrent users on one document

---

## Summary for Gemini

Implement in this exact order, and do not proceed to the next phase until the current one is verified with the checklist above:

1. **Phase 1** — schema change, `DocumentStorage` class, update save/load endpoints, run migration script, verify, then drop old column.
2. **Phase 2** — standalone Node/socket.io presence server, frontend cursor broadcast + overlay rendering.
3. **Phase 3** — research Univer Pro's collaboration feature first; only build custom mutation sync if Pro doesn't fit, and treat conflict handling as a first-class design decision, not an afterthought.
