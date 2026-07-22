const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const generateShortcutItem = (desc, keys) => {
  const keyHtml = keys.map(k => `<span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">${k}</span>`).join('');
  return `
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">${desc}</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    ${keyHtml}
                  </div>
                </div>`;
};

const shortcutsHtmlContent = `
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:16px 0 8px;">File operations</div>
                ${generateShortcutItem('Save file', ['Ctrl', 'S'])}
                ${generateShortcutItem('Print file', ['Ctrl', 'P'])}
                
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:24px 0 8px;">Edit actions</div>
                ${generateShortcutItem('Undo last action', ['Ctrl', 'Z'])}
                ${generateShortcutItem('Redo last action', ['Ctrl', 'Y'])}
                ${generateShortcutItem('Cut', ['Ctrl', 'X'])}
                ${generateShortcutItem('Copy', ['Ctrl', 'C'])}
                ${generateShortcutItem('Paste', ['Ctrl', 'V'])}
                ${generateShortcutItem('Cancel cell entry', ['Esc'])}
                ${generateShortcutItem('Delete content of selected cell', ['Backspace'])}
                
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:24px 0 8px;">Formatting</div>
                ${generateShortcutItem('Bold toggle for selection', ['Ctrl', 'B'])}
                ${generateShortcutItem('Italic toggle for selection', ['Ctrl', 'I'])}
                ${generateShortcutItem('Underline toggle for selection', ['Ctrl', 'U'])}
                ${generateShortcutItem('Strikethrough toggle for selection', ['Ctrl', 'Shift', 'X'])}
                ${generateShortcutItem('Add / Edit Hyperlink', ['Ctrl', 'K'])}
                ${generateShortcutItem('Insert the current date in cell', ['Ctrl', ';'])}
                ${generateShortcutItem('Insert the current time in cell', ['Ctrl', 'Shift', ';'])}
                ${generateShortcutItem('Increase Indentation', ['Ctrl', 'M'])}
                ${generateShortcutItem('Decrease Indentation', ['Ctrl', 'Shift', 'M'])}
                
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:24px 0 8px;">Navigation & Data</div>
                ${generateShortcutItem('Fill down', ['Ctrl', 'D'])}
                ${generateShortcutItem('Fill to the right', ['Ctrl', 'R'])}
                ${generateShortcutItem('Find within spreadsheet', ['Ctrl', 'F'])}
                ${generateShortcutItem('Move to next cell in row', ['Tab'])}
                ${generateShortcutItem('Move to previous cell in row', ['Shift', 'Tab'])}
                
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:24px 0 8px;">Selection</div>
                ${generateShortcutItem('Select whole spreadsheet', ['Ctrl', 'A'])}
`;

const startTag = '<div style="flex:1;overflow-y:auto;padding-top:12px;font-size:13px;color:{{ currentTheme === \\\'dark\\\' ? \\\'#bdc1c6\\\' : \\\'#5f6368\\\' }};">';
const endTag = '</div>\\n              \\n              <div style="padding-top:16px;border-top:1px solid';

const regex = new RegExp('<div style="flex:1;overflow-y:auto;padding-top:12px;font-size:13px;color:{{ currentTheme === \'dark\' \\? \'#bdc1c6\' : \'#5f6368\' }};">.*?(?=</div>\\s*<div style="padding-top:16px;border-top:1px solid)', 's');

const replacement = `<div style="flex:1;overflow-y:auto;padding-top:12px;font-size:13px;color:{{ currentTheme === 'dark' ? '#bdc1c6' : '#5f6368' }};">\n${shortcutsHtmlContent}\n              `;

content = content.replace(regex, replacement);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Shortcuts updated!');
