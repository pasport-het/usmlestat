# Независимый эталон прогнозов: считает из сырых данных по ПРАВИЛАМ и сверяет с серверным результатом.
import json, math, sys
from datetime import date, timedelta
D = lambda s: date.fromisoformat(s)
def add(s, n): return (D(s) + timedelta(n)).isoformat()
def days_between(a, b): return (D(b) - D(a)).days
def jr(x): return math.floor(x + 0.5)                      # Math.round в JS: .5 вверх
def r1(x): return jr(x * 10) / 10
def r2(x): return jr(x * 100) / 100
def valid(s): return isinstance(s, str) and len(s) == 10 and s[4] == '-' and s[7] == '-'

def pace_win(items, T, maxW):                              # items: [(date, value)]
    ds = [d for d, v in items if valid(d) and d <= T]
    if not ds: return {'W': maxW, 'from': add(T, -maxW), 'to': add(T, -1), 'sum': 0}
    first = min(ds)
    ssum = lambda a, b: sum(v for d, v in items if valid(d) and a <= d <= b)
    if first >= T: return {'W': 1, 'from': T, 'to': T, 'sum': ssum(T, T)}
    span = days_between(first, T); Wc = max(1, min(maxW, span)); Wi = max(1, min(maxW, span + 1))
    c = {'W': Wc, 'from': add(T, -Wc), 'to': add(T, -1)}; c['sum'] = ssum(c['from'], c['to'])
    w = {'W': Wi, 'from': add(T, -(Wi - 1)), 'to': T}; w['sum'] = ssum(w['from'], w['to'])
    return w if w['sum'] / w['W'] > c['sum'] / c['W'] else c
def proj(left, pace, T):
    if not pace or not left > 0: return None
    n = math.ceil(left / pace); return {'days': n, 'date': add(T, n)}
def slack(days, left, pace):
    if days is None: return None
    if not left > 0: return days
    if not pace > 0: return None
    return days - math.ceil(left / pace)
def pct_change(cur, prev): return jr((cur - prev) / prev * 100) if prev > 0 else None
def rng_sum(items, T, frm, to): return sum(v for d, v in items if add(T, -frm) <= d <= add(T, -to))
def hist_days(items, T):
    ds = [d for d, v in items if valid(d) and d <= T]; return days_between(min(ds), T) if ds else 0
def backtest(items, T, H):
    by = {}
    for d, v in items:
        if valid(d): by[d] = by.get(d, 0) + v
    dates = sorted(d for d, v in by.items() if v > 0)
    if not dates: return None
    first = dates[0]; get = lambda d: by.get(d, 0); n = 0; err = bias = act = 0; t = add(first, 6)
    while days_between(t, T) > H:
        W = min(14, days_between(first, t) + 1); s = sum(get(add(t, -i)) for i in range(W)); pred = s / W * H
        a = sum(get(add(t, i)) for i in range(1, H + 1)); err += abs(pred - a); bias += pred - a; act += a; n += 1; t = add(t, 1)
    if n < 7 or act <= 0: return None
    return {'n': n, 'wape': r2(err / act), 'bias': r2(bias / act), 'horizon': H}
def confidence(window, active, wape):
    if window < 5 or active < 3: return 'low'
    if wape is not None and wape > 0.5: return 'low'
    if window >= 10 and active >= 7 and (wape is None or wape <= 0.3): return 'high'
    return 'medium'
def nbme_trend(rows, exam, T):
    pts = sorted([(r['date'], r['score']) for r in rows if r['score'] > 0 and valid(r['date'])], key=lambda p: p[0])
    if len(pts) < 2: return None
    t0 = D(pts[0][0]); n = len(pts); xs = [(D(d) - t0).days for d, s in pts]; ys = [s for d, s in pts]
    sx = sum(xs); sy = sum(ys); sxy = sum(x * y for x, y in zip(xs, ys)); sxx = sum(x * x for x in xs); den = n * sxx - sx * sx
    if den == 0: return None
    slope = (n * sxy - sx * sy) / den; inter = (sy - slope * sx) / n; span = days_between(pts[0][0], pts[-1][0])
    o = {'perWeek': r1(slope * 7), 'points': n, 'spanDays': span, 'low': (n < 3 or span < 14)}
    if n >= 4:
        ss = sum((y - (inter + slope * x)) ** 2 for x, y in zip(xs, ys)); o['sigma'] = r1(math.sqrt(ss / (n - 2)))
    if exam and valid(exam):
        xe = (D(exam) - t0).days; o['projected'] = max(0, min(300, jr(inter + slope * xe)))
        if 'sigma' in o: o['rangeLo'] = max(0, jr(o['projected'] - o['sigma'])); o['rangeHi'] = min(300, jr(o['projected'] + o['sigma']))
    return o
def nbme_conf(tr): return None if not tr else ('high' if (tr['points'] >= 4 and tr['spanDays'] >= 28) else ('medium' if tr['points'] >= 3 else 'low'))
def readiness(c):
    if c['days'] is None: return None
    cl = lambda x: max(0, min(1, x)); t = c['target'] or 240; acc = c['uwPct'] or 0
    faNow = cl(c['faDone'] / c['faTotal']) if c['faTotal'] else 0; faEx = cl((c['faDone'] + c['pace_fa'] * c['days']) / c['faTotal']) if c['faTotal'] else 0
    cvNow = cl(c['uwQ'] / c['uwTotal']) if c['uwTotal'] else 0; cvEx = cl((c['uwQ'] + c['pace_uw'] * c['days']) / c['uwTotal']) if c['uwTotal'] else 0
    sc = c['nbProj'] or c['nbLast'] or 0; nbNow = cl(c['nbLast'] / t) if c['nbLast'] else 0; nbEx = cl(sc / t) if sc else 0
    hasnb = bool(c['nbLast'])
    rd = lambda fa, cv, nb: (0.4 * fa + 0.4 * cv * acc + 0.2 * nb) if hasnb else (0.5 * fa + 0.5 * cv * acc); R = lambda x: jr(x * 1000) / 1000
    return {'noNbme': not hasnb, 'now': R(rd(faNow, cvNow, nbNow)), 'atExam': R(rd(faEx, cvEx, nbEx)), 'fa': {'now': R(faNow), 'exam': R(faEx)}, 'uw': {'now': R(cvNow), 'exam': R(cvEx), 'acc': R(acc)}, 'nb': {'now': R(nbNow), 'exam': R(nbEx)}}
def active_in(items, frm, to): return len({d for d, v in items if frm <= d <= to and v > 0})

def forecast(c):
    T = c['T']; days = c['days']; logs = [(x['date'], x['pages']) for x in c['logs']]; uw = [(x['date'], x['q']) for x in c['uw']]
    faTotal = sum(r['total'] for r in c['fa']); faDone = sum(r['done'] for r in c['fa'] if r['total']);          # системы без заданных страниц в общий остаток не входят
    faLeft = max(0, faTotal - faDone)
    uwQ = sum(q for d, q in uw); uwC = sum(min(x['correct'], x['q']) for x in c['uw']); uwLeft = max(0, c['uwTotal'] - uwQ)
    pwFa = pace_win(logs, T, 14); pwUw = pace_win(uw, T, 14); paceFa = pwFa['sum'] / pwFa['W']; paceUw = pwUw['sum'] / pwUw['W']
    F = {'pagesPerDay': r1(paceFa), 'qPerDay': r1(paceUw), 'windowFa': pwFa['W'], 'windowUw': pwUw['W'], 'faLeft': faLeft, 'uwLeft': uwLeft,
         'faNeed': math.ceil(faLeft / max(1, days)) if (days is not None and faLeft > 0) else None, 'uwNeed': math.ceil(uwLeft / max(1, days)) if (days is not None and uwLeft > 0) else None,
         'faProj': proj(faLeft, paceFa, T), 'uwProj': proj(uwLeft, paceUw, T), 'nbme': nbme_trend(c['nbme'], c['exam'], T)}
    p7 = lambda items: rng_sum(items, T, 7, 1); pp = lambda items: rng_sum(items, T, 14, 8)
    F['trend'] = {'pages': pct_change(p7(logs), pp(logs)) if hist_days(logs, T) >= 14 else None, 'q': pct_change(p7(uw), pp(uw)) if hist_days(uw, T) >= 14 else None}
    F['slack'] = {'fa': slack(days, faLeft, paceFa), 'uw': slack(days, uwLeft, paceUw)}
    doneStart = {}
    for d, s_, pg in [(x['date'], x['system'], x['pages']) for x in c['logs']]:
        if d != T: doneStart[s_] = doneStart.get(s_, 0) + pg
    faLeftStart = sum(max(0, r['total'] - min(doneStart.get(r['system'], 0), r['total'])) for r in c['fa'] if r['total'])
    qToday = rng_sum(uw, T, 0, 0); uwLeftStart = max(0, c['uwTotal'] - (uwQ - qToday))
    F['today'] = {'pages': {'done': rng_sum(logs, T, 0, 0), 'goal': math.ceil(faLeftStart / max(1, days)) if (days is not None and faLeftStart > 0) else None},
                  'q': {'done': qToday, 'goal': math.ceil(uwLeftStart / max(1, days)) if (days is not None and uwLeftStart > 0) else None}}
    nbDone = sorted([r for r in c['nbme'] if r['score'] > 0], key=lambda r: r['date'])
    F['exam'] = readiness({'days': days, 'faTotal': faTotal, 'faDone': faDone, 'pace_fa': paceFa, 'uwTotal': c['uwTotal'], 'uwQ': uwQ, 'uwPct': (uwC / uwQ if uwQ else 0), 'pace_uw': paceUw, 'target': c['target'],
                          'nbLast': nbDone[-1]['score'] if nbDone else 0, 'nbProj': (F['nbme'] or {}).get('projected')})
    pw7f = pace_win(logs, T, 7); pw7u = pace_win(uw, T, 7)
    F['check'] = {'fa': backtest(logs, T, 7), 'uw': backtest(uw, T, 7)}
    F['active'] = {'fa': active_in(logs, pwFa['from'], pwFa['to']), 'uw': active_in(uw, pwUw['from'], pwUw['to'])}
    F['raw'] = {'fa': paceFa, 'uw': paceUw}; F['sum'] = {'fa': pwFa['sum'], 'uw': pwUw['sum']}; F['pace7'] = {'fa': r1(pw7f['sum'] / pw7f['W']), 'uw': r1(pw7u['sum'] / pw7u['W'])}
    wp = lambda k: (F['check'][k] or {}).get('wape')
    F['conf'] = {'fa': confidence(pwFa['W'], F['active']['fa'], wp('fa')), 'uw': confidence(pwUw['W'], F['active']['uw'], wp('uw')), 'nbme': nbme_conf(F['nbme'])}
    def prange_old(left, a, b):
        hi, lo = max(a, b), min(a, b); return {'fast': proj(left, hi, T) if hi > 0 else None, 'slow': proj(left, lo, T) if lo > 0 else None}
    def prange(left, items, a, b):                                   # 10-й / 90-й перцентили недельных темпов за 28 дней (окно не раньше первого дня занятий)
        if not left > 0: return None
        dm = {}
        for d, v in items: dm[d] = dm.get(d, 0) + v
        pos = sorted(d for d, v in dm.items() if v > 0); vals = []
        if pos:
            for k in range(1, 29):
                d = add(T, -k)
                if add(d, -6) < pos[0]: break
                vals.append(sum(dm.get(add(d, -i), 0) for i in range(7)) / 7)
        if len(vals) >= 14:
            vals.sort(); n = len(vals); lo = vals[int(math.floor(0.1 * (n - 1)))]; hi = vals[int(math.ceil(0.9 * (n - 1)))]
            return {'fast': proj(left, hi, T) if hi > 0 else None, 'slow': proj(left, lo, T) if lo > 0 else None, 'method': 'pct', 'n': n}
        r = prange_old(left, a, b); r['method'] = 'two'; r['n'] = len(vals); return r
    F['range'] = {'fa': prange(faLeft, logs, pw7f['sum'] / pw7f['W'], paceFa), 'uw': prange(uwLeft, uw, pw7u['sum'] / pw7u['W'], paceUw)}
    # бюджет времени на день: нормы × минуты на единицу + Anki (повторения в среднем за 7 дней + новые) × секунд на карточку; цели Anki и видео берём из ответа сервера (проверяются отдельно)
    S, A = c['settings'], c['ankiA']; goals = {'pages': (F['today']['pages'] or {}).get('goal'), 'q': (F['today']['q'] or {}).get('goal'), 'nw': c['F']['today']['nw']['goal'], 'vid': c['F']['today']['vid']['goal']}
    if days is None: F['budget'] = None
    else:
        items = []
        if goals['pages']: items.append({'k': 'pages', 'n': goals['pages'], 'min': jr(goals['pages'] * S['minPage'])})
        if goals['q']: items.append({'k': 'q', 'n': goals['q'], 'min': jr(goals['q'] * S['minQ'])})
        if A['secPer'] > 0 and (A['avg7'] > 0 or (goals['nw'] or 0) > 0):
            cards = A['avg7'] + (goals['nw'] or 0); items.append({'k': 'anki', 'n': jr(cards), 'min': jr(cards * A['secPer'] / 60)})
        if goals['vid']: items.append({'k': 'vid', 'n': goals['vid'], 'min': goals['vid']})
        if not items: F['budget'] = None
        else:
            tot = sum(x['min'] for x in items); av = jr(S['hours'] * 60)
            F['budget'] = {'items': items, 'total': tot, 'avail': av, 'deficit': max(0, tot - av), 'ratio': jr(tot / av * 100) / 100, 'params': {'minPage': S['minPage'], 'minQ': S['minQ'], 'hours': S['hours']}}
    return F

def diff(a, b, path='', out=None):
    out = [] if out is None else out
    if isinstance(a, dict) and isinstance(b, dict):
        for k in set(a) | set(b):
            if k not in a: out.append((path + '.' + k, '<нет>', b[k]))
            elif k not in b: out.append((path + '.' + k, a[k], '<нет>'))
            else: diff(a[k], b[k], path + '.' + k, out)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        if abs(a - b) > 1e-9: out.append((path, a, b))
    elif a != b: out.append((path, a, b))
    return out
if __name__ == '__main__':
    cases = json.load(open('/tmp/diff_fc.json', encoding='utf-8')); bad = 0; kinds = {}; keys = ['pagesPerDay', 'qPerDay', 'windowFa', 'windowUw', 'faLeft', 'uwLeft', 'faNeed', 'uwNeed', 'faProj', 'uwProj', 'nbme', 'trend', 'slack', 'today', 'exam', 'check', 'active', 'raw', 'sum', 'pace7', 'conf', 'range', 'budget']
    for c in cases:
        E = forecast(c); A = {k: c['F'].get(k) for k in keys}; A['trend'] = {k: A['trend'][k] for k in ('pages', 'q')}; A['slack'] = {k: A['slack'][k] for k in ('fa', 'uw')}
        A['today'] = {k: A['today'][k] for k in ('pages', 'q')}
        d = diff(E, A)
        if d:
            bad += 1
            for p, e, a in d: kinds[p.split('.')[1] if '.' in p else p] = kinds.get(p.split('.')[1] if '.' in p else p, 0) + 1
            if bad <= 6: print('сценарий', c['sc'], 'дней до экзамена', c['days'], '| расхождений', len(d), '; первые:', d[:3])
    print('сценариев:', len(cases), '| с расхождениями:', bad, '| виды:', dict(sorted(kinds.items(), key=lambda x: -x[1])[:10])); sys.exit(1 if bad else 0)
