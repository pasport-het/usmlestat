import json, bisect, sys
bad = []; cases = json.load(open('/tmp/diff_slot.json'))
for c in cases:
    st, en, iv, n, m = c['st'], c['en'], c['iv'], c['n'], c['m']
    b = list(range(st, en, iv)); slots = len(b)                         # границы слотов перебором
    if m < st: slot, nxt = 0, st
    elif m >= en: slot, nxt = slots - 1, 1440 + st
    else: slot = bisect.bisect_right(b, m) - 1; nxt = b[slot + 1] if slot + 1 < slots else en
    exp = {'slot': slot, 'slots': slots, 'idx': (slot % n) if n else 0, 'cycle': (slot // n) if n else 0, 'next': nxt}
    if exp != c['r']: bad.append((c, exp))
print('сценариев: %d | расхождений: %d' % (len(cases), len(bad)))
for c, e in bad[:3]: print(c, e)
sys.exit(1 if bad else 0)
