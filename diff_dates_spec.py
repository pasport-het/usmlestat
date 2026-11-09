import json, calendar, sys
from datetime import date, timedelta
d = json.load(open('/tmp/diff_dates.json', encoding='utf-8')); bad = []; D = lambda s: date.fromisoformat(s); cal = calendar.Calendar(0)
for ym, g in d['grids']:
    y, m = map(int, ym.split('-')); exp = [[[x.isoformat(), x.month == m] for x in w] for w in cal.monthdatescalendar(y, m)]; got = [[[c['date'], c['inMonth']] for c in w] for w in g]
    if exp != got: bad.append(('monthGrid', ym))
for s, n, r in d['add']:
    if (D(s) + timedelta(n)).isoformat() != r: bad.append(('addDays', s, n, r))
for a, b, r in d['between']:
    if (D(b) - D(a)).days != r: bad.append(('daysBetween', a, b, r))
for s, r in d['wd']:
    if D(s).isoweekday() != r: bad.append(('weekday', s, r))
for s, r in d['mon']:
    if (D(s) - timedelta(D(s).isoweekday() - 1)).isoformat() != r: bad.append(('monday', s, r))
for ym, k, r in d['shift']:
    y, m = map(int, ym.split('-')); t = y * 12 + (m - 1) + k
    if '%04d-%02d' % (t // 12, t % 12 + 1) != r: bad.append(('shiftMonth', ym, k, r))
print('сеток %d, сложений %d, разностей %d, дней недели %d, понедельников %d, сдвигов %d | расхождений: %d' % (len(d['grids']), len(d['add']), len(d['between']), len(d['wd']), len(d['mon']), len(d['shift']), len(bad)))
for b in bad[:5]: print('  ', b)
sys.exit(1 if bad else 0)
