import zipfile
import xml.etree.ElementTree as ET
import os
import sys
import openpyxl
from openpyxl.drawing.image import Image as OpenpyxlImage
import tempfile
import shutil

# namespaces
NS = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'xlrd': 'http://schemas.microsoft.com/office/spreadsheetml/2017/richdata',
    'xldr': 'http://schemas.microsoft.com/office/spreadsheetml/2017/richdata2',
    'xlrr': 'http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel'
}

def fix_zoho_sheet(input_path, output_path):
    print(f"Reading {input_path}...")
    
    with zipfile.ZipFile(input_path, 'r') as z:
        namelist = z.namelist()
        
        # 1. Read workbook rels to map rId -> target
        wb_rels_path = 'xl/_rels/workbook.xml.rels'
        sheet_targets = {}
        if wb_rels_path in namelist:
            root = ET.fromstring(z.read(wb_rels_path))
            for rel in root.findall('.//r:Relationship', namespaces={'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}):
                sheet_targets[rel.attrib['Id']] = 'xl/' + rel.attrib['Target']

        # 2. Read workbook.xml to map sheet name -> rId
        wb_path = 'xl/workbook.xml'
        sheet_info = {}
        if wb_path in namelist:
            root = ET.fromstring(z.read(wb_path))
            for sheet in root.findall('.//main:sheet', namespaces=NS):
                name = sheet.attrib['name']
                rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
                sheet_info[name] = sheet_targets.get(rid)

        # 3. Read metadata.xml
        metadata_path = 'xl/metadata.xml'
        rc_list = []
        future_metadata_bk = []
        if metadata_path in namelist:
            root = ET.fromstring(z.read(metadata_path))
            
            # valueMetadata
            value_meta = root.find('.//main:valueMetadata', namespaces=NS)
            if value_meta is not None:
                for bk in value_meta.findall('.//main:bk', namespaces=NS):
                    for rc in bk.findall('.//main:rc', namespaces=NS):
                        rc_list.append(int(rc.attrib['v']))
                        
            # futureMetadata
            future_meta = root.find('.//main:futureMetadata', namespaces=NS)
            if future_meta is not None:
                for bk in future_meta.findall('.//main:bk', namespaces=NS):
                    future_metadata_bk.append(bk)
                    
        # 4. Read rich values
        rdrichvalue_path = 'xl/richData/rdrichvalue.xml'
        rv_list = []
        if rdrichvalue_path in namelist:
            root = ET.fromstring(z.read(rdrichvalue_path))
            for rv in root.findall('.//xlrd:rv', namespaces=NS):
                v_tags = rv.findall('.//xlrd:v', namespaces=NS)
                if v_tags:
                    rv_list.append(int(v_tags[0].text))
                else:
                    rv_list.append(None)
                    
        # 5. Read rich value rels
        richvaluerel_path = 'xl/richData/richValueRel.xml'
        rel_list = []
        if richvaluerel_path in namelist:
            root = ET.fromstring(z.read(richvaluerel_path))
            for rel in root.findall('.//xlrr:rel', namespaces=NS):
                rel_list.append(rel.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'])
                
        # 6. Read rich value rels targets
        richvaluerel_rels_path = 'xl/richData/_rels/richValueRel.xml.rels'
        rv_targets = {}
        if richvaluerel_rels_path in namelist:
            root = ET.fromstring(z.read(richvaluerel_rels_path))
            for rel in root.findall('.//r:Relationship', namespaces={'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}):
                rv_targets[rel.attrib['Id']] = rel.attrib['Target']
                
        # Build image map per sheet
        images_to_insert = []
        
        for sheet_name, target in sheet_info.items():
            if target not in namelist:
                continue
            root = ET.fromstring(z.read(target))
            for c in root.findall('.//main:c', namespaces=NS):
                if 'vm' in c.attrib:
                    vm_idx = int(c.attrib['vm']) - 1
                    if vm_idx < len(rc_list):
                        v_idx = rc_list[vm_idx] - 1
                        if v_idx < len(future_metadata_bk):
                            bk = future_metadata_bk[v_idx]
                            ext = bk.find('.//main:ext', namespaces=NS)
                            if ext is not None:
                                rvb = ext.find('.//xlrd:rvb', namespaces=NS)
                                if rvb is None:
                                    rvb = ext.find('.//xldr:rvb', namespaces=NS)
                                if rvb is not None:
                                    rv_idx = int(rvb.attrib['i'])
                                    if rv_idx < len(rv_list):
                                        local_img_id = rv_list[rv_idx]
                                        if local_img_id is not None and local_img_id < len(rel_list):
                                            r_id = rel_list[local_img_id]
                                            img_target = rv_targets.get(r_id)
                                            if img_target:
                                                # e.g., "../media/image1.png" -> "xl/media/image1.png"
                                                img_path = img_target.replace('../', 'xl/')
                                                if img_path in namelist:
                                                    cell_ref = c.attrib['r']
                                                    images_to_insert.append((sheet_name, cell_ref, img_path))
                                                    
        # Use openpyxl to apply changes
        print(f"Found {len(images_to_insert)} images to recover.")
        
        if not images_to_insert:
            print("No images found. Exiting.")
            return

        print("Extracting images and loading workbook...")
        temp_dir = tempfile.mkdtemp()
        try:
            wb = openpyxl.load_workbook(input_path)
            
            for sheet_name, cell_ref, img_path in images_to_insert:
                ws = wb[sheet_name]
                ws[cell_ref].value = None
                
                # Extract image
                img_temp_path = os.path.join(temp_dir, os.path.basename(img_path))
                with open(img_temp_path, 'wb') as f:
                    f.write(z.read(img_path))
                    
                img = OpenpyxlImage(img_temp_path)
                img.width = 90
                img.height = 90
                
                ws.add_image(img, cell_ref)
                
                # Widen column and heighten row
                col_letter = ''.join([char for char in cell_ref if char.isalpha()])
                row_number = ''.join([char for char in cell_ref if char.isdigit()])
                
                ws.column_dimensions[col_letter].width = 12
                ws.row_dimensions[int(row_number)].height = 70
                
            print(f"Saving to {output_path}...")
            wb.save(output_path)
            print("Done!")
            
        finally:
            shutil.rmtree(temp_dir)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python fix_zoho_sheet.py <input.xlsx> <output.xlsx>")
        sys.exit(1)
    fix_zoho_sheet(sys.argv[1], sys.argv[2])
