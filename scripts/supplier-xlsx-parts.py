"""Accept a deliberately small bounded XLSX profile; never extract files."""
import sys
import resource
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
if sys.platform == 'linux':
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1048576, 256 * 1048576))
elif sys.platform != 'darwin':
    raise RuntimeError('unsupported platform')

import base64
import io
import json
import re
import struct
import zipfile
import zlib
import xml.etree.ElementTree as ET

MAX_ARCHIVE = 8 * 1048576
MAX_PART = 2 * 1048576
MAX_TOTAL = 8 * 1048576
MAX_COUNT = 128
NAME = re.compile(r'(?:\[Content_Types\]\.xml|_rels/\.rels|docProps/(?:app|core)\.xml|xl/(?:workbook|styles|sharedStrings)\.xml|xl/_rels/workbook\.xml\.rels|xl/theme/theme[1-9][0-9]*\.xml|xl/worksheets/sheet[1-9][0-9]*\.xml|xl/worksheets/_rels/sheet[1-9][0-9]*\.xml\.rels|xl/drawings/drawing[1-9][0-9]*\.xml|xl/drawings/_rels/drawing[1-9][0-9]*\.xml\.rels)\Z')
MEDIA = re.compile(r'xl/media/image[1-9][0-9]*\.(?:png|jpeg|jpg|gif)\Z', re.I)
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'

def fail():
    raise ValueError('invalid XLSX')

def validate(raw):
    if not 0 < len(raw) <= MAX_ARCHIVE or len(raw) < 22 or raw[-22:-18] != b'PK\x05\x06': fail()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if not 1 <= len(entries) <= MAX_COUNT or archive.comment: fail()
        names = [entry.filename for entry in entries]
        if len(set(names)) != len(names) or len({name.lower() for name in names}) != len(names): fail()
        if not {'[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels'} <= set(names): fail()
        ordered = sorted(entries, key=lambda entry: entry.header_offset)
        offset = 0
        parts = {}
        roots = {}
        total = 0
        for entry in ordered:
            name = entry.filename
            if not (NAME.fullmatch(name) or MEDIA.fullmatch(name)) or entry.is_dir() or entry.flag_bits & ~0x800 or entry.compress_type not in (0, 8) or entry.file_size > MAX_PART or entry.extra or entry.comment: fail()
            if entry.header_offset != offset or offset + 30 > archive.start_dir: fail()
            signature, version, flags, method, _, _, crc, compressed, size, name_len, extra_len = struct.unpack_from('<IHHHHHIIIHH', raw, offset)
            if signature != 0x04034b50 or version >= 45 or flags != entry.flag_bits or method != entry.compress_type or crc != entry.CRC or compressed != entry.compress_size or size != entry.file_size: fail()
            name_end = offset + 30 + name_len
            start = name_end + extra_len
            if start + compressed > archive.start_dir or raw[offset+30:name_end] != name.encode('utf-8'): fail()
            # This exact OPC padding is ignored; other extra fields can change ZIP interpretation.
            if extra_len and raw[name_end:start] != bytes.fromhex('20a2180028a01400') + bytes(20): fail()
            data = raw[start:start+compressed]
            if MEDIA.fullmatch(name):
                total += size
                if total > MAX_TOTAL: fail()
                offset = start + compressed
                continue
            if method == 8:
                decoder = zlib.decompressobj(-15)
                plain = decoder.decompress(data, MAX_PART + 1)
                if len(plain) > MAX_PART or decoder.unconsumed_tail or not decoder.eof or decoder.unused_data: fail()
                plain += decoder.flush()
            else:
                plain = data
            if len(plain) != size or len(plain) > MAX_PART or zlib.crc32(plain) & 0xffffffff != crc: fail()
            total += len(plain)
            if total > MAX_TOTAL: fail()
            text = plain.decode('utf-8-sig', errors='strict')
            if '\x00' in text or '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper(): fail()
            root = ET.fromstring(text)
            roots[name] = root
            if name == '[Content_Types].xml':
                ns = '{http://schemas.openxmlformats.org/package/2006/content-types}'
                if root.tag != ns + 'Types': fail()
            if name == 'xl/workbook.xml' and root.tag != '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}workbook': fail()
            for element in root.iter():
                if element.tag == REL and element.get('TargetMode', '').lower() == 'external': fail()
                for value in element.attrib.values():
                    if any(word in value.lower() for word in ('macroenabled', 'vbaproject', 'oleobject', 'externallink')): fail()
            if name in ('xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml'):
                parts[name] = base64.b64encode(plain).decode('ascii')
            offset = start + compressed
        if offset != archive.start_dir: fail()
        content_ns = '{http://schemas.openxmlformats.org/package/2006/content-types}'
        overrides = [e for e in roots['[Content_Types].xml'] if e.tag == content_ns + 'Override']
        defaults = [e for e in roots['[Content_Types].xml'] if e.tag == content_ns + 'Default']
        for entries, attribute in ((overrides, 'PartName'), (defaults, 'Extension')):
            keys = [e.get(attribute, '').lower() for e in entries]
            if '' in keys or len(keys) != len(set(keys)): fail()
        if len(overrides) + len(defaults) != len(roots['[Content_Types].xml']): fail()
        for path, kind, present in [('xl/workbook.xml', 'sheet.main', True), ('xl/worksheets/sheet1.xml', 'worksheet', True), ('xl/sharedStrings.xml', 'sharedStrings', 'xl/sharedStrings.xml' in parts)]:
            if any(e.get('PartName', '').lower() == ('/' + path).lower() and e.get('PartName') != '/' + path for e in overrides): fail()
            declared = [e.get('ContentType') for e in overrides if e.get('PartName') == '/' + path]
            if not present:
                if declared: fail()
                continue
            if not declared:
                declared = [e.get('ContentType') for e in defaults if e.get('Extension', '').lower() == 'xml']
            expected = 'application/vnd.openxmlformats-officedocument.spreadsheetml.' + kind + '+xml'
            if declared != [expected]: fail()
        sheet_ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        rel_ns = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
        workbook = roots['xl/workbook.xml']
        sheets = workbook.findall('./' + sheet_ns + 'sheets/' + sheet_ns + 'sheet')
        package_ns = '{http://schemas.openxmlformats.org/package/2006/relationships}'
        package_root = roots['_rels/.rels']
        workbook_rels = roots['xl/_rels/workbook.xml.rels']
        if package_root.tag != package_ns + 'Relationships' or workbook_rels.tag != package_ns + 'Relationships': fail()
        root_ids = [e.get('Id') for e in package_root]
        if not all(e.tag == REL for e in package_root) or any(not value for value in root_ids) or len(root_ids) != len(set(root_ids)): fail()
        office_docs = [e for e in package_root if e.tag == REL and e.get('Type') == rel_ns[1:-1] + '/officeDocument']
        if len(office_docs) != 1 or office_docs[0].get('Target') not in ('xl/workbook.xml', '/xl/workbook.xml') or office_docs[0].get('TargetMode', 'Internal') != 'Internal': fail()
        relationships = list(workbook_rels)
        if not sheets or not all(e.tag == REL for e in relationships): fail()
        ids = [e.get('Id') for e in relationships]
        if any(not value for value in ids) or len(ids) != len(set(ids)): fail()
        first_id = sheets[0].get(rel_ns + 'id')
        match = [e for e in relationships if e.get('Id') == first_id]
        if len(match) != 1 or match[0].get('Type') != rel_ns[1:-1] + '/worksheet' or match[0].get('Target') not in ('worksheets/sheet1.xml', '/xl/worksheets/sheet1.xml'): fail()
        if 'xl/worksheets/sheet1.xml' not in parts or roots['xl/worksheets/sheet1.xml'].tag != sheet_ns + 'worksheet': fail()
        string_rels = [e for e in relationships if e.get('Type') == rel_ns[1:-1] + '/sharedStrings']
        if len(string_rels) > 1 or bool(string_rels) != ('xl/sharedStrings.xml' in parts): fail()
        if string_rels and (string_rels[0].get('Target') not in ('sharedStrings.xml', '/xl/sharedStrings.xml') or roots['xl/sharedStrings.xml'].tag != sheet_ns + 'sst'): fail()
        return [{'name': name, 'data': data} for name, data in parts.items()]

try:
    raw = sys.stdin.buffer.read(MAX_ARCHIVE + 1)
    result = validate(raw)
    sys.stdout.write(json.dumps({'parts': result}, separators=(',', ':')))
except Exception:
    sys.exit(1)
