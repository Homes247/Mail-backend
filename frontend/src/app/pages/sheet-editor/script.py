import re
content = open('c:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts', encoding='utf-8').read()
start_index = content.find('<div class="main-content"')
print(f'Start index: {start_index}')
tags = []
for m in re.finditer(r'<(div|/div)', content[start_index:]):
    if m.group(1) == 'div':
        tags.append(m.start())
    else:
        if not tags: continue
        tags.pop()
        if not tags:
            end_index = start_index + m.end()
            line_no = content[:end_index].count('\n') + 1
            print(f'Closing div found at line {line_no}')
            break
