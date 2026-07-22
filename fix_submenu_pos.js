const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const oldHeightMap = /const heightMap: Record<string, number> = \{\s+clear: 360, \s*\/\/ All \+ Formats \+ Contents \+ sep \+ Notes \+ Hyperlinks \+ Checkboxes \+ sep \+ DataValidations \+ ConditionalFormats \+ RichText \+ sep \+ ClearAllFilters\s+paste: 400,\s+insert: 120,\s+delete: 100,\s+filter: 100\s+\};/s;

const newHeightMap = `const heightMap: Record<string, number> = {
      clear: 360,   
      paste: 400,
      insert: 350,
      delete: 180,
      filter: 100
    };`;

content = content.replace(oldHeightMap, newHeightMap);

// Also add a max-height dynamically to submenu
const oldHtml = /style="position: fixed; z-index: 100001; min-width: 220px; max-height: calc\(100vh - 16px\); overflow-y: auto; overflow-x: hidden;"/g;
const newHtml = `style="position: fixed; z-index: 100001; min-width: 220px; max-height: calc(100vh - 16px); overflow-y: auto; overflow-x: hidden;"
           [style.maxHeight.px]="ctxSubMaxHeight"`;

// Need to define ctxSubMaxHeight in component
content = content.replace('ctxSubBottom: number | null = null;', 'ctxSubBottom: number | null = null;\n  ctxSubMaxHeight: number = 800;');

// Update showCtxSubmenu to calculate ctxSubMaxHeight
const oldLogic = /if \(rect\.top \+ estimatedHeight \+ margin <= window\.innerHeight\) \{\s+this\.ctxSubTop = rect\.top;\s+this\.ctxSubBottom = null;\s+\} else if \(rect\.bottom - estimatedHeight - margin >= 0\) \{\s+\/\/ Not enough space below - open upward\s+this\.ctxSubTop = Math\.max\(margin, rect\.bottom - estimatedHeight\);\s+this\.ctxSubBottom = null;\s+\} else \{\s+\/\/ Not enough space either way - pin to top with margin\s+this\.ctxSubTop = margin;\s+this\.ctxSubBottom = null;\s+\}/;

const newLogic = `if (rect.top + estimatedHeight + margin <= window.innerHeight) {
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
    }`;

content = content.replace(oldLogic, newLogic);
content = content.replace(oldHtml, newHtml);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed submenu positioning');
