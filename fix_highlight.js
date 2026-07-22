const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');
content = content.replace(/\r\n/g, '\n');

// 1. Update highlightLocks method
const t1 = `  highlightLocks() {
    this.showToast('Highlight Locks is not implemented yet.');
  }`;
const r1 = `  highlightLocks() {
    this.showLockPattern = !this.showLockPattern;
  }`;
content = content.replace(t1, r1);

// 2. Update the Highlight Locks menu item (two occurrences expected, one in main menu, one in context menu)
// Actually we only added it to the main menu and context menu in previous steps.
// Main menu:
const t2 = `<div class="mdi" (click)="highlightLocks(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">highlight</span> Highlight Locks
                  </div>`;
const r2 = `<div class="mdi" (click)="highlightLocks(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">highlight</span> {{ showLockPattern ? 'Hide Locked Cells' : 'Highlight Locks' }}
                  </div>`;
content = content.replace(t2, r2);

// Context menu:
const t3 = `<div class="mdi" (click)="highlightLocks(); closeMenus()">Highlight Locks</div>`;
const r3 = `<div class="mdi" (click)="highlightLocks(); closeMenus()">{{ showLockPattern ? 'Hide Locked Cells' : 'Highlight Locks' }}</div>`;
content = content.replace(t3, r3);

// 3. Update getCellStyle to apply background image
const t4 = `    if (fmt.borders) {
      const getB = (b: boolean | CellBorder | undefined): string | null => {
        if (!b) return null;
        if (b === true) return '1px solid #000';
        return \`\${b.width || '1px'} \${b.style || 'solid'} \${b.color || '#000'}\`;
      };
      if (fmt.borders.all) {
        const s = getB(fmt.borders.all);
        if (s) {
          style['border-top'] = s;
          style['border-bottom'] = s;
          style['border-left'] = s;
          style['border-right'] = s;
        }
      } else {
        const t = getB(fmt.borders.top); if (t) style['border-top'] = t;
        const b = getB(fmt.borders.bottom); if (b) style['border-bottom'] = b;
        const l = getB(fmt.borders.left); if (l) style['border-left'] = l;
        const r = getB(fmt.borders.right); if (r) style['border-right'] = r;
      }
    }

    return style;
  }`;
const r4 = `    if (fmt.borders) {
      const getB = (b: boolean | CellBorder | undefined): string | null => {
        if (!b) return null;
        if (b === true) return '1px solid #000';
        return \`\${b.width || '1px'} \${b.style || 'solid'} \${b.color || '#000'}\`;
      };
      if (fmt.borders.all) {
        const s = getB(fmt.borders.all);
        if (s) {
          style['border-top'] = s;
          style['border-bottom'] = s;
          style['border-left'] = s;
          style['border-right'] = s;
        }
      } else {
        const t = getB(fmt.borders.top); if (t) style['border-top'] = t;
        const b = getB(fmt.borders.bottom); if (b) style['border-bottom'] = b;
        const l = getB(fmt.borders.left); if (l) style['border-left'] = l;
        const r = getB(fmt.borders.right); if (r) style['border-right'] = r;
      }
    }

    if (this.showLockPattern && fmt.locked) {
      style['background-image'] = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 10px, transparent 10px, transparent 20px)';
    }

    return style;
  }`;
content = content.replace(t4, r4);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Highlight Locks fix applied!');
