#!/usr/bin/env python3
"""حوّل CSV المصدّر من ملف Excel إلى SQL للاستيراد الخاص في Supabase.
لا تحفظ ملف SQL الناتج داخل مستودع GitHub العام."""
import csv, re, sys
from pathlib import Path
if len(sys.argv) != 3:
    raise SystemExit('الاستخدام: python tools/import_grades.py input.csv output.sql')
source, target = map(Path, sys.argv[1:])
rows = list(csv.reader(source.open(encoding='utf-8-sig')))
section = None; records = []
for row in rows:
    if len(row) > 1 and re.fullmatch(r'\s*Section\s*\d+\s*', row[1] or '', re.I):
        section = int(re.search(r'\d+', row[1]).group()); continue
    if section and len(row) > 13 and row[1].strip().isdigit() and row[2].strip():
        raw = row[13].strip()
        try: work = float(raw.replace(',', '.')) if raw else 0
        except ValueError: work = 0
        name = row[2].strip().replace("'", "''")
        records.append(f"({section}, {int(row[1])}, '{name}', {work:g})")
with target.open('w', encoding='utf-8') as out:
    out.write('truncate table public.student_grades restart identity;\n')
    for i in range(0, len(records), 200):
        out.write('insert into public.student_grades (section, serial, name, semester_work) values\n')
        out.write(',\n'.join(records[i:i+200]) + ';\n')
print(f'تم تجهيز {len(records)} طالباً. الخانات الفارغة حُوّلت إلى صفر.')
