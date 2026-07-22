const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const sparklineConfigType = `
export interface SparklineConfig {
  sourceRange?: string;
  destinationRange?: string;
  type: 'line' | 'column' | 'winloss'; // We use 'column' instead of 'bar' as per our previous logic
  baseColor: string;
  highlights: {
    high: { enabled: boolean; color: string };
    low: { enabled: boolean; color: string };
    first: { enabled: boolean; color: string };
    last: { enabled: boolean; color: string };
    negative: { enabled: boolean; color: string };
    markers: { enabled: boolean; color: string };
  };
  emptyCellMode: 'gap' | 'zero' | 'connect' | 'skip';
  includeHiddenRowsColumns: boolean;
  horizontalAxis: {
    displayAxis: boolean;
    rightToLeft: boolean;
  };
  verticalAxis: {
    min: { mode: 'auto' | 'same' | 'custom'; customValue: number | null };
    max: { mode: 'auto' | 'same' | 'custom'; customValue: number | null };
  };
  isGrouped: boolean;
  groupId: string;
}
`;

// Insert after export interface CellBorder
if (!content.includes('export interface SparklineConfig')) {
  const insertIndex = content.indexOf('export interface CellBorder');
  if (insertIndex !== -1) {
    content = content.slice(0, insertIndex) + sparklineConfigType + content.slice(insertIndex);
  }
}

// Update the sheets array declaration
content = content.replace('sparklines?: Record<string, any>', 'sparklines?: Record<string, SparklineConfig>');

// Update the sparklineConfig property initialization
const initRegex = /sparklineConfig = \{\s*source: '',\s*locationR: 0,\s*locationC: 0,\s*locationLabel: '',\s*type: 'line' as 'line' \| 'column' \| 'winloss',\s*color: '#4285f4',\s*emptyCells: 'gap' as 'gap' \| 'zero' \| 'connect' \| 'skip',\s*includeHidden: false,\s*highColor: '',\s*lowColor: '',\s*firstColor: '',\s*lastColor: '',\s*negativeColor: '',\s*markerColor: '',\s*error: ''\s*\};/;

const newInit = `sparklineConfig: SparklineConfig = {
  type: 'line',
  baseColor: '#4285f4',
  highlights: {
    high: { enabled: false, color: '#34A853' },
    low: { enabled: false, color: '#F4B400' },
    first: { enabled: false, color: '#4A86E8' },
    last: { enabled: false, color: '#7BAAF7' },
    negative: { enabled: false, color: '#EA4335' },
    markers: { enabled: false, color: '#4A86E8' }
  },
  emptyCellMode: 'gap',
  includeHiddenRowsColumns: false,
  horizontalAxis: { displayAxis: false, rightToLeft: false },
  verticalAxis: {
    min: { mode: 'auto', customValue: null },
    max: { mode: 'auto', customValue: null }
  },
  isGrouped: false,
  groupId: ''
};
// Add state for UI
insertSparklineConfig = { source: '', dest: '', error: '' };
editSparklineConfig = { source: '', dest: '', error: '', tab: 'selected' as 'selected' | 'group' };
colorPickerState: { active: boolean, top: number, left: number, target: 'base' | 'high' | 'low' | 'first' | 'last' | 'negative' | 'markers' | null } = { active: false, top: 0, left: 0, target: null };
customColorInput = '';
recentColors: string[] = [];
`;

content = content.replace(initRegex, newInit);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done data model update!');
