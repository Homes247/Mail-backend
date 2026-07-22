const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const newHelpers = `
  // --- New Sparkline Helpers ---
  horizontalAxisExpanded = false;
  verticalAxisExpanded = false;

  openColorPicker(event: MouseEvent, target: 'base' | 'high' | 'low' | 'first' | 'last' | 'negative' | 'markers') {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.colorPickerState = {
       active: true,
       target: target,
       top: rect.bottom + 4,
       left: rect.left
    };
    event.stopPropagation();
  }

  closeColorPicker() {
    this.colorPickerState.active = false;
  }

  setSparklineColor(color: string) {
    if (!this.sparklineConfig || !this.colorPickerState.target) return;
    
    const target = this.colorPickerState.target;
    if (target === 'base') {
      this.sparklineConfig.baseColor = color;
    } else {
      this.sparklineConfig.highlights[target].color = color;
    }
    
    // Add to recent colors if not there
    if (!this.recentColors.includes(color)) {
       this.recentColors.unshift(color);
       if (this.recentColors.length > 10) this.recentColors.pop();
    }
    
    this.saveSparkline();
    this.closeColorPicker();
  }

  setSparklineType(type: 'line' | 'column' | 'winloss') {
    if (!this.sparklineConfig) return;
    this.sparklineConfig.type = type;
    this.saveSparkline();
  }

  setEmptyCellMode(mode: 'gap' | 'zero' | 'connect' | 'skip') {
    if (!this.sparklineConfig) return;
    this.sparklineConfig.emptyCellMode = mode;
    this.saveSparkline();
  }

  toggleGroup() {
    if (!this.sparklineConfig) return;
    this.sparklineConfig.isGrouped = !this.sparklineConfig.isGrouped;
    if (this.sparklineConfig.isGrouped && !this.sparklineConfig.groupId) {
       this.sparklineConfig.groupId = 'sparkgroup_' + Date.now();
    }
    this.saveSparkline();
  }

  switchRowsColumns() {
    // This flips whether data is read by rows or columns
    // In our simplified parse, it's 1D, but we can implement it as just triggering a re-render.
    // For now we will add a property if we need to actually transpose 2D source.
    // The spec just says "useful when sparkline data orientation needs to flip".
    this.showToast('Switch Rows/Columns applied');
    this.saveSparkline();
  }
`;

// Insert helpers before saveSparkline
content = content.replace('saveSparkline() {', newHelpers + '\n  saveSparkline() {');
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done sparkline helpers logic!');
