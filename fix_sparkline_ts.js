const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex1 = /sparklineConfig = \{\s*source: '',\s*locationR: 0,\s*locationC: 0,\s*locationLabel: '',\s*type: 'line' as 'line' \| 'column' \| 'winloss',\s*color: '#4285f4',\s*emptyCells: 'gap' as 'gap' \| 'zero' \| 'connect' \| 'skip',\s*highColor: '',\s*lowColor: '',\s*firstColor: '',\s*lastColor: '',\s*negativeColor: '',\s*markerColor: '',\s*error: ''\s*\};/;

const newInit1 = `sparklineConfig = {
    source: '',
    locationR: 0,
    locationC: 0,
    locationLabel: '',
    type: 'line' as 'line' | 'column' | 'winloss',
    color: '#4285f4',
    emptyCells: 'gap' as 'gap' | 'zero' | 'connect' | 'skip',
    includeHidden: false,
    highColor: '',
    lowColor: '',
    firstColor: '',
    lastColor: '',
    negativeColor: '',
    markerColor: '',
    error: ''
  };`;

content = content.replace(regex1, newInit1);

const regex2 = /this\.sparklineConfig = \{\s*source: '',\s*locationR: this\.selectedRow,\s*locationC: this\.selectedCol,\s*locationLabel: `'\$\{this\.sheets\[this\.currentSheetIdx\]\.name\}'\.\$\{this\.colLabel\(this\.selectedCol\)\}\$\{this\.selectedRow \+ 1\}`,\s*type: 'line',\s*color: '#4285f4',\s*emptyCells: 'gap',\s*highColor: '',\s*lowColor: '',\s*firstColor: '',\s*lastColor: '',\s*negativeColor: '',\s*markerColor: '',\s*error: ''\s*\};/;

const newInit2 = `this.sparklineConfig = {
      source: '',
      locationR: this.selectedRow,
      locationC: this.selectedCol,
      locationLabel: \`'\${this.sheets[this.currentSheetIdx].name}'.\${this.colLabel(this.selectedCol)}\${this.selectedRow + 1}\`,
      type: 'line',
      color: '#4285f4',
      emptyCells: 'gap',
      includeHidden: false,
      highColor: '',
      lowColor: '',
      firstColor: '',
      lastColor: '',
      negativeColor: '',
      markerColor: '',
      error: ''
    };`;

content = content.replace(regex2, newInit2);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed TypeScript error!');
