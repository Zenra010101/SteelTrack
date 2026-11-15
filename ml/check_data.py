import sqlite3
import re
import json

conn = sqlite3.connect('CSV_for_LSTM/monthly_series_cache.sqlite')
c = conn.cursor()
c.execute('SELECT distinct item_code FROM monthly_points')
cache_skus = set(r[0] for r in c.fetchall())

with open('backend/sql/03_data_insertions.sql', 'r', encoding='utf-8', errors='ignore') as f:
    sql = f.read()

# Pattern for product insertions: ('UUID', 'SKU', 'Name', ...)
prod_section = re.search(r'-- Data for Name: Products.*?(?=-- Data for Name:|\Z)', sql, re.DOTALL)
products = []
if prod_section:
    for line in prod_section.group(0).splitlines():
        line = line.strip()
        if line.startswith('('):
            # Parse row
            # Format: ('id', 'sku', 'name', ...)
            parts = re.findall(r"'([^']*)'|NULL|(\d+\.?\d*)", line)
            # Find UUID and SKU
            id_match = re.search(r"'([0-9a-fA-F-]{36})'", line)
            if id_match:
                prod_id = id_match.group(1)
                # Next string after prod_id is SKU
                rest = line[line.find(prod_id) + len(prod_id) + 1:]
                sku_match = re.search(r"'([^']*)'", rest)
                if sku_match:
                    sku = sku_match.group(1)
                    rest2 = rest[rest.find(sku) + len(sku) + 1:]
                    name_match = re.search(r"'([^']*)'", rest2)
                    name = name_match.group(1) if name_match else sku
                    products.append({'id': prod_id, 'sku': sku, 'name': name})

print(f"Total Products parsed from SQL: {len(products)}")
db_skus = set(p['sku'] for p in products)
overlap = cache_skus.intersection(db_skus)
print(f"Total SKUs in SQLite cache: {len(cache_skus)}")
print(f"Matching SKUs: {len(overlap)}")

# Save products catalog JSON
with open('ml/products_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, indent=2)
print("Saved ml/products_catalog.json")

