# Независимый эталон анализа Anki (по правилам) против ankiAnalysis_ на случайных коллекциях.
import json, math, sys
from datetime import date, timedelta
D = lambda s: date.fromisoformat(s); S = lambda d: d.isoformat(); add = lambda s, n: S(D(s) + timedelta(n))
jr = lambda x: math.floor(x + 0.5); r1 = lambda x: jr(x * 10) / 10
pct = lambda ok, n: jr(ok / n * 1000) / 10 if n > 0 else None
KEYS = ['n', 'm', 'nw', 'a', 'h', 'g', 'e', 'yn', 'yk', 'mn', 'mk', 'ln', 'lk']
def vd(s):
    try: D(str(s)[:10]); return len(str(s)) >= 10 and str(s)[4] == '-'
    except Exception: return False
def analyze(c):
    daily = c['daily']; meta = c['meta'] or {}; REF = c['REF']; by = {x['d']: x for x in daily}
    if not daily: return {'hasDaily': False}
    def win(frm, to):
        acc = {'days': 0, 'studied': 0, **{k: 0 for k in KEYS}}
        for k in range(frm, to - 1, -1):
            x = by.get(add(REF, -k)); acc['days'] += 1
            if x:
                for kk in KEYS: acc[kk] += x[kk]
                if x['n'] > 0: acc['studied'] += 1
        return acc
    zero = {k: 0 for k in KEYS}; t0 = by.get(REF, zero); w7 = win(6, 0); p7 = win(13, 7); d14 = win(13, 0); d30 = win(29, 0)
    fr = meta.get('first_review'); first = str(fr)[:10] if (fr and vd(fr)) else min(x['d'] for x in daily)
    elapsed = max(0, (D(REF) - D(first)).days); avail = lambda ln: max(1, min(ln, elapsed + 1))
    o = {'hasDaily': True, 'ref': REF}
    o['today'] = {'present': REF in by, 'n': t0['n'], 'm': r1(t0['m']), 'nw': t0['nw'], 'secPer': r1(t0['m'] * 60 / t0['n']) if t0['n'] else 0, 'buttons': {'a': t0['a'], 'h': t0['h'], 'g': t0['g'], 'e': t0['e']}}
    o['w7'] = {'n': w7['n'], 'm': r1(w7['m']), 'nw': w7['nw'], 'avgN': r1(w7['n'] / avail(7)), 'avgM': r1(w7['m'] / avail(7)), 'studied': w7['studied']}
    o['p7'] = {'n': p7['n'], 'm': r1(p7['m']), 'nw': p7['nw']}
    c7 = win(7, 1); pc7 = win(14, 8); full = elapsed >= 14
    o['delta'] = {'n': jr((c7['n'] - pc7['n']) / pc7['n'] * 100) if (full and pc7['n']) else None, 'm': jr((c7['m'] - pc7['m']) / pc7['m'] * 100) if (full and pc7['m']) else None}
    o['d30'] = {'n': d30['n'], 'm': r1(d30['m']), 'nw': d30['nw'], 'studied': d30['studied'], 'avgN': r1(d30['n'] / avail(30)), 'avgM': r1(d30['m'] / avail(30)), 'secPer': r1(d30['m'] * 60 / d30['n']) if d30['n'] else 0, 'consistency': jr(d30['studied'] / avail(30) * 100)}
    bt = d30['a'] + d30['h'] + d30['g'] + d30['e']
    o['buttons30'] = {'total': bt, 'a': d30['a'], 'h': d30['h'], 'g': d30['g'], 'e': d30['e'], 'pct': {k: pct(d30[k], bt) for k in 'ahge'}}
    o['retention'] = {'young': {'n': d30['yn'], 'ok': d30['yk'], 'pct': pct(d30['yk'], d30['yn'])}, 'mature': {'n': d30['mn'], 'ok': d30['mk'], 'pct': pct(d30['mk'], d30['mn'])}, 'learn': {'n': d30['ln'], 'ok': d30['lk'], 'pct': pct(d30['lk'], d30['ln'])},
        'review': {'n': d30['yn'] + d30['mn'], 'ok': d30['yk'] + d30['mk'], 'pct': pct(d30['yk'] + d30['mk'], d30['yn'] + d30['mn'])}, 'review7': {'n': w7['yn'] + w7['mn'], 'ok': w7['yk'] + w7['mk'], 'pct': pct(w7['yk'] + w7['mk'], w7['yn'] + w7['mn'])}}
    wr = []; wv = []
    for w in range(11, -1, -1):
        s = win(w * 7 + 6, w * 7); start = add(REF, -(w * 7 + 6)); wv.append({'start': start, 'n': s['n'], 'm': r1(s['m']), 'studied': s['studied']})
        if w <= 7: wr.append({'start': start, 'n': s['yn'] + s['mn'], 'pct': pct(s['yk'] + s['mk'], s['yn'] + s['mn'])})
    o['weeklyRetention'] = wr; o['weeklyReviews'] = wv
    hrs = [{'h': h, 'n': (x or {}).get('n', 0) or 0, 'pct': pct((x or {}).get('ok', 0) or 0, (x or {}).get('n', 0) or 0)} for h, x in enumerate(meta.get('hours') or [])]
    o['hours'] = hrs; best = peak = None
    for x in hrs:
        if x['n'] >= 30 and (best is None or x['pct'] > best['pct'] or (x['pct'] == best['pct'] and x['n'] > best['n'])): best = x
        if x['n'] > 0 and (peak is None or x['n'] > peak['n']): peak = x
    o['bestHour'] = best; o['peakHour'] = peak; o['hoursTotal'] = sum(x['n'] for x in hrs)
    f = [x or 0 for x in (meta.get('forecast') or [])]
    if f:
        n7 = n30 = 0; pk = None
        for i in range(1, min(len(f), 31)):
            n30 += f[i]
            if i <= 7: n7 += f[i]
            if pk is None or f[i] > pk['n']: pk = {'day': i, 'n': f[i]}
        sp = o['d30']['secPer']
        o['forecast'] = {'days': f, 'dueNow': f[0], 'next7': n7, 'next30': n30, 'avg7': r1(n7 / 7), 'avg30': r1(n30 / 30), 'peak': pk, 'minutes7': r1((n7 / 7) * sp / 60) if sp else None}
    lenC = max(1, min(14, elapsed)); sumC = sum(by[add(REF, -k)]['nw'] for k in range(lenC, 0, -1) if add(REF, -k) in by); lenI = avail(14); p14 = max(sumC / lenC, d14['nw'] / lenI)
    o['newPace'] = {'p7': r1(w7['nw'] / avail(7)), 'p14': r1(p14), 'p30': r1(d30['nw'] / avail(30))}
    last = c['last']; remaining = ((meta.get('states') or {}).get('new_all') or 0)
    if last: remaining = last.get('remaining') or 0
    dl = c['daysLeft']; need = math.ceil(remaining / dl) if (dl is not None and dl > 0 and remaining > 0) else None; rt = c['realToday'] or REF; fin = None
    if remaining > 0 and p14 > 0: n = math.ceil(remaining / p14); fin = {'days': n, 'date': add(rt, n)}
    o['finish'] = {'remaining': remaining, 'perDay': r1(p14), 'need': need, 'days': fin['days'] if fin else None, 'date': fin['date'] if fin else None, 'ok': (p14 >= need) if (need is not None and p14 > 0) else None}
    o['streak'] = {'current': meta.get('streak') or 0, 'longest': meta.get('longest_streak') or 0}
    o['totals'] = {'reviews': meta.get('rev_total') or 0, 'hours': r1((meta.get('min_total') or 0) / 60), 'first': fr or '', 'spanDays': (D(REF) - D(str(fr)[:10])).days if (fr and vd(fr)) else 0}
    sy = str(meta['synced_at'])[:10] if meta.get('synced_at') else ''
    o['sync'] = {'at': meta.get('synced_at') or '', 'scope': meta.get('activity_scope') or '', 'staleDays': max(0, (D(rt) - D(sy)).days) if (vd(sy) and rt) else None, 'historyDays': len(daily)}
    return o
def norm(x):
    if isinstance(x, float) and x == int(x): return int(x)
    if isinstance(x, dict): return {k: norm(v) for k, v in x.items()}
    if isinstance(x, list): return [norm(v) for v in x]
    return x
def diff(a, b, path='', out=None):
    out = [] if out is None else out
    if isinstance(a, dict) and isinstance(b, dict):
        for k in set(a) | set(b):
            if k not in a: out.append((path + '.' + k, '<нет>', b[k]))
            elif k not in b: out.append((path + '.' + k, a[k], '<нет>'))
            else: diff(a[k], b[k], path + '.' + k, out)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b): out.append((path, 'len %d' % len(a), 'len %d' % len(b)))
        else:
            for i, (x, y) in enumerate(zip(a, b)): diff(x, y, '%s[%d]' % (path, i), out)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        if abs(a - b) > 1e-9: out.append((path, a, b))
    elif a != b: out.append((path, a, b))
    return out
if __name__ == '__main__':
    cases = json.load(open('/tmp/diff_anki.json', encoding='utf-8')); bad = 0; kinds = {}
    for c in cases:
        if 'error' in c['A']: bad += 1; print('сценарий', c['sc'], 'исключение:', c['A']['error']); continue
        d = diff(norm(analyze(c)), norm(c['A']))
        if d:
            bad += 1
            for p, e, a in d: kinds[p.split('[')[0]] = kinds.get(p.split('[')[0], 0) + 1
            if bad <= 4: print('сценарий', c['sc'], 'расхождений', len(d), d[:3])
    print('сценариев:', len(cases), '| с расхождениями:', bad, '| виды:', dict(sorted(kinds.items(), key=lambda x: -x[1])[:8])); sys.exit(1 if bad else 0)
