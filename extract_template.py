import re
with open('frontend/src/app/pages/sheet-editor/sheet-editor.component.ts', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'template:\s*`(.*?)`', content, re.DOTALL)
if m:
    with open('frontend/scratch_template.html', 'w', encoding='utf-8') as out:
        out.write(m.group(1))
    print("Template extracted to scratch_template.html")
else:
    print("Template not found")
