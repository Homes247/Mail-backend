const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Re-add isSparklineCell
if (!content.includes('isSparklineCell(r: number, c: number)')) {
  // Let's add it right after getCellData()
  content = content.replace(/getCellData\(r: number, c: number\) \{/, `isSparklineCell(r: number, c: number): boolean {\n    const sheet = this.sheets[this.currentSheetIdx];\n    if (!sheet || !sheet.sparklines) return false;\n    return !!sheet.sparklines[\`\${r},\${c}\`];\n  }\n\n  getCellData(r: number, c: number) {`);
}

// 2. Fix sourceRange and destinationRange in template
content = content.replace(/editSparklineConfig = \{ source: sparklineConfig\.sourceRange, dest: sparklineConfig\.destinationRange/g, `editSparklineConfig = { source: sparklineConfig.sourceRange || '', dest: sparklineConfig.destinationRange || ''`);

// 3. Move Sparkline modals out of version modal nesting
// The problem is that the sparkline modals were inserted after <!-- Custom Name Version Modal --> but inside its container, or inside the activeModal === 'version' container.
// Let's extract them.

const sparklineModalsRegex = /      <!-- Insert Sparkline Modal -->[\s\S]*?<!-- Edit Sparkline Modal -->[\s\S]*?<\/div>\s*<\/div>/;
const match = content.match(sparklineModalsRegex);

if (match) {
  let modalsText = match[0];
  content = content.replace(sparklineModalsRegex, '');
  
  // Now we need to append modalsText somewhere safe, like right before <!-- Right-click Context Menu --> or similar, which is outside the main shell and modals.
  // Wait, let's just append it to the end of the template (before closing backtick).
  // I will look for \n  \`,\n  styles: [\`
  content = content.replace(/\n  \`,\n  styles: \[`/, `\n${modalsText}\n  \`,\n  styles: [\``);
}

// 4. Also we need to make sure the missing </div> from showNameVersionPrompt is added.
// Wait, if I extract the modals, does showNameVersionPrompt still miss a </div>?
// Let's check showNameVersionPrompt:
//       <!-- Custom Name Version Modal -->
//       <div *ngIf="showNameVersionPrompt" style="...">
//         <div style="background: #fff; ...">
//           <div style="padding: ...">...</div>
//           <div style="padding: ...">...</div>
//         </div>
//       <!-- Insert Sparkline Modal -->
// If I extract the Insert Sparkline Modal, the showNameVersionPrompt will just be:
//       <!-- Custom Name Version Modal -->
//       <div *ngIf="showNameVersionPrompt" style="...">
//         <div style="background: #fff; ...">
//           <div style="padding: ...">...</div>
//           <div style="padding: ...">...</div>
//         </div>
//       </div>
// Wait, is there a </div> missing? Yes, the outer div *ngIf="showNameVersionPrompt" wasn't closed!
// Let's add the missing </div>
content = content.replace(/<!-- Custom Name Version Modal -->[\s\S]*?<button \(click\)="submitNameVersion\(\)".*?>\s*Save\s*<\/button>\s*<\/div>\s*<\/div>/, `$&
      </div>`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed typescript errors step 11!');
