const fs = require('fs');
let s = fs.readFileSync('c:\\\\Users\\\\Homes247\\\\Desktop\\\\vmail - Copy (2)\\\\frontend\\\\src\\\\app\\\\pages\\\\chat\\\\chat.component.ts', 'utf8');

s = s.replace(/<canvas #stagingCanvas class=\\\
staging-canvas\\\\\s*\\(mousedown\\)/, '<canvas #stagingCanvas class=\\\staging-canvas\\\ [style.display]=\\\cropper
?
\\none\\
:
\\block\\\\\\\n          (mousedown)');

s = s.replace(
  '.staging-bottombar { position:absolute;bottom:0;left:0;right:0;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom, 0px));display:flex;align-items:center;z-index:10;box-sizing:border-box; gap: 12px; }',
  '.staging-bottombar { position:absolute;bottom:0;left:0;right:0;height:70px;background:rgba(0,0,0,0.7);display:flex;align-items:center;padding:0 16px;z-index:99999;box-sizing:border-box;gap:12px; }'
);

fs.writeFileSync('c:\\\\Users\\\\Homes247\\\\Desktop\\\\vmail - Copy (2)\\\\frontend\\\\src\\\\app\\\\pages\\\\chat\\\\chat.component.ts', s);
console.log('done');

