# Независимый эталон: опыт по дням, уровень, звание, прогноз уровней, достижения «видео», цель по видео.
import json, math, sys
from datetime import date, timedelta
D = lambda s: date.fromisoformat(s); add = lambda s, n: (D(s) + timedelta(n)).isoformat(); jr = lambda x: math.floor(x + 0.5)
W = {'page': 2, 'q': 1, 'correct': 1, 'anki10': 1, 'newCard': 0.5, 'habit': 15, 'task': 10, 'focus5': 1, 'nbme': 100, 'error': 5, 'card': 5, 'videoMin': 0.3, 'video': 3}
def lvstart(n): return 0 if n <= 1 else jr(150 * (n - 1) ** 1.5)
def levelof(xp):
    n = 1
    while n < 99 and xp >= lvstart(n + 1): n += 1
    return n
def rank(l): return 'professor' if l >= 30 else 'chief' if l >= 25 else 'attending' if l >= 20 else 'fellow' if l >= 15 else 'senior' if l >= 11 else 'resident' if l >= 8 else 'intern' if l >= 5 else 'student' if l >= 3 else 'rookie'
def compute(c):
    d = c['D']; days = {}; src = {k: 0 for k in ['pages', 'uw', 'anki', 'habits', 'tasks', 'focus', 'nbme', 'errors', 'cards', 'video']}
    def add_(dt, k, v):
        if not dt or not v > 0: return
        days[dt] = days.get(dt, 0) + v; src[k] += v
    for l in d['logs']: add_(l['date'], 'pages', l['pages'] * W['page'])
    for r in d['uw']: add_(r['date'], 'uw', r['q'] * W['q'] + min(r['correct'], r['q']) * W['correct'])
    for a in d['anki']: add_(a['d'], 'anki', (a['n'] // 10) * W['anki10'] + a['nw'] * W['newCard'])
    for h in d['planner']['hlog']: add_(h['date'], 'habits', W['habit'])
    for x in d['planner']['items']:
        if x['done']: add_(x['done'], 'tasks', W['task'])
    for f in d['planner']['focus']: add_(f['date'], 'focus', (f['minutes'] // 5) * W['focus5'])
    for n in d['nbme']:
        if n['score'] > 0 and n['date']: add_(n['date'], 'nbme', W['nbme'])
    for e in d['planner']['errors']: add_(e['date'], 'errors', W['error'])
    for k in d['cards']: add_(k['at'], 'cards', W['card'])
    vday = {}
    for v in d['videos']:
        if v['w']: vday[v['w']] = vday.get(v['w'], 0) + v['sec'] / 60 * W['videoMin'] + W['video']
    for dt, x in vday.items(): add_(dt, 'video', min(x, 60))              # потолок 60 XP в день
    byday = {k: jr(v) for k, v in days.items()}; xp = sum(byday.values()); lv = levelof(xp); T = d['today']
    o = {'xp': xp, 'level': lv, 'rank': rank(lv), 'today': byday.get(T, 0), 'week': sum(byday.get(add(T, -i), 0) for i in range(7)), 'byDay': byday}
    o['bySource'] = {k: v for k, v in src.items()}
    ds = sorted(k for k, v in byday.items() if k <= T and v > 0); per = 0
    if ds:
        span = (D(T) - D(ds[0])).days; Wc = max(1, min(14, span)); Wi = max(1, min(14, span + 1))
        sm = lambda a, b: sum(byday.get(add(a, i), 0) for i in range((D(b) - D(a)).days + 1))
        per = max(sm(add(T, -Wc), add(T, -1)) / Wc, sm(add(T, -(Wi - 1)), T) / Wi)
    up = [{'level': n, 'xp': lvstart(n), 'left': lvstart(n) - xp, 'days': (math.ceil((lvstart(n) - xp) / per) if per > 0 else None)} for n in range(lv + 1, min(lv + 3, 99) + 1)]
    ex = None
    if d['days'] is not None and d['days'] >= 0:
        xe = xp + per * d['days']; l2 = levelof(jr(xe)); ex = {'days': d['days'], 'xp': jr(xe), 'level': l2, 'rank': rank(l2)}
    o['lf'] = {'perDay': per, 'upcoming': up, 'exam': ex, 'xp': xp, 'level': lv}
    watched = [v for v in d['videos'] if v['w']]; o['vid'] = {'videos': len(watched), 'min': jr(sum(v['sec'] for v in watched) / 60)}
    return o
bad = 0; cases = json.load(open('/tmp/diff_xp.json', encoding='utf-8')); kinds = {}
for c in cases:
    e = compute(c); r = c['res']; errs = []
    for k in ['xp', 'level', 'rank', 'today', 'week']:
        if e[k] != r['st'][k]: errs.append((k, e[k], r['st'][k]))
    if e['byDay'] != {k: v for k, v in r['st']['byDay'].items()}: errs.append(('byDay',))
    for k, v in e['bySource'].items():
        if abs(v - r['st']['bySource'][k]) > 1e-6: errs.append(('src.' + k, v, r['st']['bySource'][k]))
    lf = r['lf']
    if abs(lf['perDay'] - e['lf']['perDay']) > 1e-9: errs.append(('perDay', e['lf']['perDay'], lf['perDay']))
    if [(u['level'], u['xp'], u['left'], u['days']) for u in lf['upcoming']] != [(u['level'], u['xp'], u['left'], u['days']) for u in e['lf']['upcoming']]: errs.append(('upcoming',))
    if (lf['exam'] or None) != (e['lf']['exam'] or None): errs.append(('exam', e['lf']['exam'], lf['exam']))
    a = {x[0]: x for x in r['ach']}
    if a['vid_1'][1] != e['vid']['videos'] or a['vid_10'][1] != e['vid']['videos'] or a['vid_h10'][1] != e['vid']['min'] or a['vid_1'][3] != (e['vid']['videos'] >= 1) or a['vid_10'][3] != (e['vid']['videos'] >= 10) or a['vid_h10'][3] != (e['vid']['min'] >= 600): errs.append(('ach', a['vid_1'], a['vid_10'], a['vid_h10'], e['vid']))
    if r['exNow'] is not None and abs(r['rd']['ready'] - r['exNow']) > 0.0006: errs.append(('ready клиент≠сервер', r['rd']['ready'], r['exNow']))
    if r['exNo'] is not None and r['exNo'] != r['rd']['noNbme']: errs.append(('noNbme клиент≠сервер', r['rd']['noNbme'], r['exNo']))
    g = {x[0]: x for x in r['goals']}; vg = c['D']['vidGoal']
    if vg['goal']:
        if 'vid' not in g or g['vid'][1] != vg['done'] or g['vid'][2] != vg['goal'] or g['vid'][3] != (vg['done'] >= vg['goal']): errs.append(('goal.vid', g.get('vid'), vg))
    elif 'vid' in g: errs.append(('goal.vid лишняя', g['vid']))
    if errs:
        bad += 1
        for x in errs: kinds[x[0]] = kinds.get(x[0], 0) + 1
        if bad <= 4: print('сценарий', c['sc'], errs[:3])
print('сценариев: %d | с расхождениями: %d | виды: %s' % (len(cases), bad, kinds)); sys.exit(1 if bad else 0)
