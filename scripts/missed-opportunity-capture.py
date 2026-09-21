"""Read a stopped PAPER capture. No network, ledger mutation, or new fills.

Keep raw evidence local. Ask depth beyond 1,000 contracts cannot affect the
executed maker engine's 1,000-contract work limit. All bid levels are retained.
"""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def bounded_asks(levels):
    result, total = [], 0
    for level in levels:
        result.append(level)
        total += level['quantity']
        if total >= 1000:
            break
    return result


def extract(capture, output):
    output.mkdir(parents=True, exist_ok=False)
    read = lambda name: json.loads((capture / name).read_text())
    status, launch, frozen = read('status.json'), read('launch.json'), read('frozen.json')
    assert status['phase'] == 'STOPPED' and status['exitCode'] == 0
    for name, expected in [('frozen.json', launch['freezeHash']), ('observer.config.json', launch['configHash']), ('launch.mjs', launch['launcherHash']), ('supervisor.mjs', launch['supervisorHash'])]:
        assert digest(capture / name) == expected, name
    for name, expected in frozen['files'].items():
        assert digest(Path(frozen['source']) / name) == expected, name
    dbpath = capture / 'observer.sqlite'
    if Path(str(dbpath) + '-wal').exists():
        raise RuntimeError('Immutable extraction requires a stopped, checkpointed database without a WAL')
    db = sqlite3.connect(f'file:{dbpath.resolve()}?mode=ro&immutable=1', uri=True)
    session = db.execute('select id,started_at,ended_at,config from sessions where started_at>=? order by started_at limit 1', (status['startedAt'],)).fetchone()
    assert session and session[2] is not None
    sid = session[0]
    control = {'session': {'id': sid, 'start': session[1], 'end': session[2], 'config': json.loads(session[3])}, 'launch': launch, 'frozen': frozen,
               'approval': read('approval-readiness.json'), 'discovery': read('discovery-summary.json'), 'screen': read('screen-summary.json'),
               'mappings': [json.loads(row[0]) for row in db.execute('select body from mapping_history order by id')], 'events': []}
    with (output / 'selections.ndjson').open('w') as stream:
        for ident, at, kind, body in db.execute('select id,at,kind,body from diagnostics where session_id=? order by id', (sid,)):
            row = {'id': ident, 'at': at, 'kind': kind, 'body': json.loads(body)}
            if kind == 'PAPER_MAKER_SELECTION':
                stream.write(json.dumps(row, separators=(',', ':')) + '\n')
            else:
                control['events'].append(row)
    count = 0
    with (output / 'books.ndjson').open('w') as stream:
        for ident, body in db.execute('select id,body from book_updates where session_id=? order by id', (sid,)):
            book = json.loads(body)
            assert book.get('capture', {}).get('sessionId') == sid
            book['yes'], book['no'] = bounded_asks(book['yes']), bounded_asks(book['no'])
            stream.write(json.dumps({'id': ident, 'book': book}, separators=(',', ':')) + '\n')
            count += 1
    control['books'] = count
    control['observerSha256'] = digest(dbpath)
    control['paperSha256'] = digest(capture / 'paper.sqlite')
    control['historicalSha256'] = digest(capture.parent / 'fill-first-20260919' / 'paper.sqlite')
    assert control['historicalSha256'] == frozen['historicalPaperSha256']
    (output / 'control.json').write_text(json.dumps(control, separators=(',', ':')) + '\n')
    db.close()
    print(json.dumps({'session': sid, 'bookRows': count, 'controlEvents': len(control['events']), 'sourceHashesVerified': len(frozen['files'])}))


if __name__ == '__main__':
    extract(Path(sys.argv[1]), Path(sys.argv[2]))
