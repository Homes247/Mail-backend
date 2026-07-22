const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const oldFuncRegex = /showCtxSubmenu\(type: 'insert' \| 'delete' \| 'clear' \| 'filter' \| 'paste', event: MouseEvent\) \{[\s\S]*?this\.ctxSubTop = margin;\s+this\.ctxSubBottom = null;\s+\}\s+\}/;

const newFunc = `showCtxSubmenu(type: 'insert' | 'delete' | 'clear' | 'filter' | 'paste', event: MouseEvent) {
    clearTimeout(this.ctxSubmenuTimer);
    this.activeCtxSubmenu = type;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const submenuWidth = 220;
    // Decide left/right side based on available space
    if (this.ctxX + 220 + submenuWidth > window.innerWidth) {
      this.ctxSubX = this.ctxX - submenuWidth + 4;
    } else {
      this.ctxSubX = this.ctxX + 220 - 4;
    }
    // Clamp X so submenu never goes off-screen
    this.ctxSubX = Math.max(4, Math.min(this.ctxSubX, window.innerWidth - submenuWidth - 4));

    // Use accurate estimated height per submenu type
    const heightMap: Record<string, number> = {
      clear: 360,   
      paste: 400,
      insert: 350,
      delete: 180,
      filter: 100
    };
    const estimatedHeight = heightMap[type] ?? 200;
    const margin = 8; // minimum gap from screen edge

    // Try to open downward from the hovered item
    if (rect.top + estimatedHeight + margin <= window.innerHeight) {
      this.ctxSubTop = rect.top;
      this.ctxSubBottom = null;
      this.ctxSubMaxHeight = window.innerHeight - rect.top - margin;
    } else if (rect.bottom - estimatedHeight - margin >= 0) {
      // Not enough space below - open upward
      this.ctxSubTop = Math.max(margin, rect.bottom - estimatedHeight);
      this.ctxSubBottom = null;
      this.ctxSubMaxHeight = window.innerHeight - this.ctxSubTop - margin;
    } else {
      // Not enough space either way - pin to top with margin
      this.ctxSubTop = margin;
      this.ctxSubBottom = null;
      this.ctxSubMaxHeight = window.innerHeight - 2 * margin;
    }
  }`;

content = content.replace(oldFuncRegex, newFunc);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced function body!');
