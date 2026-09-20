"""Read-only export of the fixed historical window; never opens a paper ledger."""
import json
import pathlib
import sqlite3
import sys

source, destination = map(pathlib.Path, sys.argv[1:3])
with sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True) as db:
    records = db.execute(
        'select id,at,body from book_updates where session_id=? '
        'and market_id in (?,?) and at between ? and ? order by id',
        ('acf6e470-ded5-4527-a6e8-42f63b65d8d6',
         'KXNCAAFGAME-26SEP19CCSUMTST-CCSU',
         'aec-cfb-cencon-monst-2026-09-19', 1789852142000, 1789852147500),
    )
    rows = [dict(id=i, at=at, book=json.loads(body)) for i, at, body in records]
destination.write_text(json.dumps(dict(
    sessionId='acf6e470-ded5-4527-a6e8-42f63b65d8d6',
    scope='RECEIPT_INDEXED_CAPTURE_PROCESSING_AVAILABILITY_UNKNOWN', rows=rows,
), separators=(',', ':')) + '\n')
print(f'Exported {len(rows)} existing book records; no experiment executed.')
