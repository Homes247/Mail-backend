import re
content = open('c:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts', encoding='utf-8').read()
start_index = content.find('<div class="main-content"')
lines = content[start_index:].split('\n')
tags = []
tag_stack = []
for i, line in enumerate(lines):
    for m in re.finditer(r'<(div|/div)', line):
        if m.group(1) == 'div':
            tag_stack.append(f'line {1722+i}')
        else:
            if tag_stack:
                popped = tag_stack.pop()
                tags.append(f'closed {popped} at line {1722+i}')
            if not tag_stack:
                for t in tags[-5:]:
                    print(t)
                break
    if not tag_stack and i > 0:
        break
