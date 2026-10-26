// Pilot-study analysis: reads the results links participants sent in and reports how well
// the check-in measures what it claims to.
//
//   node analyse-pilot.js links.txt > report.md
//
// links.txt can be anything containing the links (an email export, a notes file): every
// "#r-…" results link and "#h-…" history link in it is picked up. Duplicates (both partners
// sending the same link) are counted once.
//
// The app's own decoding and scoring code is loaded from ../index.html, so the numbers here
// always match what couples saw.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const el = () => ({ addEventListener() {}, set innerHTML(v) {}, querySelector() { return null; }, querySelectorAll() { return []; } });
  const ctx = {
    console, TextEncoder, TextDecoder, BigInt,
    location: { hash: '', origin: 'https://pilot.local', pathname: '/', search: '' },
    history: { replaceState() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: el, createRange() {} }, window: { scrollTo() {}, addEventListener() {} }, navigator: {},
    addEventListener() {}
  };
  vm.createContext(ctx);
  vm.runInContext(js + ';globalThis.__app = { parseShared, decodePerson, analyse, domainScore, adj, DOMAINS, CSI, GUESS, CHANGE };', ctx);
  return ctx.__app;
}

/* ---------- Statistics ---------- */
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = xs => { const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1); };
function pearson(xs, ys) {
  if (xs.length < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, k) => { sxy += (x - mx) * (ys[k] - my); sxx += (x - mx) ** 2; syy += (ys[k] - my) ** 2; });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
// Cronbach's alpha: how consistently an area's statements move together.
function cronbach(rows) {
  if (rows.length < 3) return null;
  const k = rows[0].length;
  const itemVar = Array.from({ length: k }, (_, j) => variance(rows.map(r => r[j]))).reduce((s, v) => s + v, 0);
  const totalVar = variance(rows.map(r => r.reduce((s, v) => s + v, 0)));
  return totalVar ? (k / (k - 1)) * (1 - itemVar / totalVar) : null;
}
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '–' : x.toFixed(d));
const norm = s => (s || '').trim().toLowerCase();

function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node analyse-pilot.js links.txt'); process.exit(1); }
  const app = loadApp();
  const text = fs.readFileSync(file, 'utf8');
  const found = text.match(/#[rh]-[0-9a-v._~-]+/gi) || [];

  // Check-ins: { day, A, B } as person codes, de-duplicated.
  const seen = new Map();
  let unreadable = 0;
  for (const link of found) {
    const r = app.parseShared(link);
    if (!r) { unreadable++; continue; }
    const entries = r.type === 'h' ? r.entries : [{ day: r.day, A: r.A.code, B: r.B.code }];
    for (const e of entries) {
      const key = [e.A, e.B].sort().join('|') + '@' + e.day;
      if (!seen.has(key)) seen.set(key, e);
    }
  }
  const checkins = [...seen.values()].map(e => {
    const A = app.decodePerson(e.A), B = app.decodePerson(e.B);
    return { day: e.day, A, B, couple: [norm(A.name), norm(B.name)].sort().join('|'), R: app.analyse({ a: A, b: B }) };
  });

  // One record per person per check-in.
  const people = checkins.flatMap(c => [['a', c.A], ['b', c.B]].map(([w, P]) => ({
    couple: c.couple, name: norm(P.name), day: c.day, P,
    domains: Object.fromEntries(c.R.rows.map(r => [r.d.id, r[w]])),
    overall: c.R.overall[w],
    csi: P.csi ? P.csi.reduce((s, v) => s + v, 0) : null,
    meanOff: c.R.reading[w] ? c.R.reading[w].meanOff : null
  })));
  // Reliability and validity use each person's first check-in only, so repeat visits don't count twice.
  const firsts = [...people].sort((x, y) => x.day - y.day)
    .filter((p, k, all) => all.findIndex(q => q.couple === p.couple && q.name === p.name) === k);

  const out = [];
  out.push('# Pilot analysis', '');
  out.push(`- Links read: ${found.length}${unreadable ? ` (${unreadable} could not be read)` : ''}`);
  out.push(`- Check-ins: ${checkins.length}, from ${new Set(checkins.map(c => c.couple)).size} couples`);
  out.push(`- People (first check-in each): ${firsts.length}; with the satisfaction yardstick (CSI-4): ${firsts.filter(p => p.csi !== null).length}`);
  out.push('');
  if (firsts.length < 30) out.push(`> Fewer than 30 people. Treat every number below as a rough early signal, not a result.`, '');

  // 1. Internal consistency
  out.push('## 1. Do each area\'s statements hang together?', '');
  out.push('Cronbach\'s alpha per area. Roughly: 0.7+ good, 0.6–0.7 acceptable for 4 statements, below 0.6 means the statements are measuring different things and need rewording.', '');
  out.push('| Area | People | Alpha |', '| --- | ---: | ---: |');
  for (const d of app.DOMAINS) {
    const rows = firsts.map(p => d.items.map(i => app.adj(i, p.P.answers[i.id]))).filter(r => r.every(v => v !== null));
    out.push(`| ${d.name} | ${rows.length} | ${fmt(cronbach(rows))} |`);
  }
  out.push('');

  // 2. Validity against the yardstick
  const withCsi = firsts.filter(p => p.csi !== null);
  out.push('## 2. Do scores line up with an established measure?', '');
  if (withCsi.length < 3) out.push('Not enough pilot answers with the CSI-4 yet.', '');
  else {
    out.push(`Correlation with the CSI-4 total (0–21). Expect the overall score to correlate strongly (0.6+). Areas will vary; a near-zero area is measuring something other than satisfaction, which may be fine (e.g. teamwork) or a sign of a weak area.`, '');
    out.push('| Score | People | r with CSI-4 |', '| --- | ---: | ---: |');
    out.push(`| **Overall** | ${withCsi.length} | ${fmt(pearson(withCsi.map(p => p.overall), withCsi.map(p => p.csi)))} |`);
    for (const d of app.DOMAINS) {
      const ok = withCsi.filter(p => p.domains[d.id] !== null);
      out.push(`| ${d.name} | ${ok.length} | ${fmt(pearson(ok.map(p => p.domains[d.id]), ok.map(p => p.csi)))} |`);
    }
    const distressed = withCsi.filter(p => p.csi < 13.5);
    out.push('', `${distressed.length} of ${withCsi.length} people (${Math.round(100 * distressed.length / withCsi.length)}%) scored below 13.5 on the CSI-4, the published cut-off for relationship distress.`);
    if (distressed.length && distressed.length < withCsi.length) {
      out.push(`Their average overall score here: ${Math.round(mean(distressed.map(p => p.overall)))}; everyone else: ${Math.round(mean(withCsi.filter(p => p.csi >= 13.5).map(p => p.overall)))}. A clear gap supports the 55 "needs work" cut-off; check where the line would fall best.`);
    }
    out.push('');
  }

  // 3. Test-retest
  out.push('## 3. How much do scores move by chance?', '');
  const pairs = [];
  const byPerson = new Map();
  people.forEach(p => { const k = p.couple + '#' + p.name; if (!byPerson.has(k)) byPerson.set(k, []); byPerson.get(k).push(p); });
  for (const list of byPerson.values()) {
    list.sort((x, y) => x.day - y.day);
    for (let k = 1; k < list.length; k++) {
      const gap = list[k].day - list[k - 1].day;
      if (gap >= 5 && gap <= 14) pairs.push([list[k - 1], list[k]]);
    }
  }
  if (pairs.length < 3) out.push(`Only ${pairs.length} repeat check-ins 5–14 days apart. Ask couples to repeat the check-in about a week later without discussing it.`, '');
  else {
    const areaDiffs = pairs.flatMap(([x, y]) => app.DOMAINS.map(d => (x.domains[d.id] === null || y.domains[d.id] === null ? null : Math.abs(y.domains[d.id] - x.domains[d.id])))).filter(v => v !== null);
    const p90 = quantile(areaDiffs, 0.9);
    out.push(`${pairs.length} people repeated the check-in 5–14 days apart.`, '');
    out.push(`- Overall score, first vs second time: r = ${fmt(pearson(pairs.map(p => p[0].overall), pairs.map(p => p[1].overall)))} (0.7+ is good)`);
    out.push(`- Typical change in an area with nothing real happening: ${fmt(mean(areaDiffs), 1)} points on average; 90% of changes were ${p90} points or less.`);
    out.push(`- The app currently treats ${app.CHANGE}+ points as a real change. ${p90 > app.CHANGE ? `**That is below the chance level here: consider raising it to about ${p90}.**` : 'That is at or above the chance level here, so it holds up.'}`);
    out.push('');
  }

  // 4. Reading each other
  const reads = firsts.filter(p => p.meanOff !== null);
  out.push('## 4. How well do partners read each other?', '');
  if (!reads.length) out.push('No guesses yet (older check-ins don\'t include them).', '');
  else out.push(`Average guess was ${Math.round(mean(reads.map(p => p.meanOff)))} points off the partner's own area score (${reads.length} people). If almost everyone is within 25 points, the blind-spot threshold may be too generous to be interesting.`, '');

  console.log(out.join('\n'));
}

main();
