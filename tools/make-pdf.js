const fs = require('fs');
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');
// Static font files (SIL Open Font License) so the PDF embeds compact TrueType fonts.
const fontUrl = f => 'file://' + path.join(__dirname, 'fonts', f);
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const block = src.slice(src.indexOf('const SCALE'), src.indexOf('const STRONG'));
const { SCALE, DOMAINS, GUESS, IMPORTANT_PICKS } = new Function(block + '; return { SCALE, DOMAINS, GUESS, IMPORTANT_PICKS };')();
const STEADY = 55, STRONG = 75, GAP = 20;
let n = 0;
const numbered = DOMAINS.map(d => ({ ...d, items: d.items.map(i => ({ ...i, n: ++n })) }));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const score = t => Math.round((t - 4) / 16 * 100);

const questionnaire = who => `
<section class="page">
  <div class="runhead"><span>Both Sides Check-in</span><span>${who} copy</span></div>
  <h2>${who}: your answers</h2>
  <div class="namerow"><span>Name</span><i></i><span>Date</span><i class="short"></i></div>
  <p class="lede">Answer on your own, without looking at your partner's copy. Circle one number for each statement, thinking about the past month. Go with your first reaction. Tick <b>n/a</b> only if an intimacy statement really doesn't fit your relationship.</p>
  <div class="key">${SCALE.map(s => `<span><b>${s.v}</b> ${s.l}</span>`).join('')}</div>
  ${numbered.map(d => `
    <div class="area">
      <h3>${d.name}</h3>
      <table class="q">
        ${d.items.map(i => `<tr><td class="num">${i.n}</td><td class="stmt">${esc(i.t)}</td><td class="circles">${[1,2,3,4,5].map(v => `<span>${v}</span>`).join('')}${i.na ? '<span class="na-box">n/a</span>' : '<span class="na-space"></span>'}</td></tr>`).join('')}
      </table>
    </div>`).join('')}
</section>
<section class="page">
  <div class="runhead"><span>Both Sides Check-in</span><span>${who} copy</span></div>
  <h2>How do you think your partner sees it?</h2>
  <p class="lede">For each area, circle how you think your partner would rate it over the past month. You'll compare these guesses with their own answers.</p>
  <table class="guess">
    <tr><th class="l">Area</th>${GUESS.map(g => `<th>${g.l}</th>`).join('')}</tr>
    ${DOMAINS.map(d => `<tr><td class="l"><b>${d.name}</b><br><span class="fine">${d.blurb}</span></td>${GUESS.map(() => '<td><span class="dot-o"></span></td>').join('')}</tr>`).join('')}
  </table>
  <h2 style="margin-top:16pt">What matters most to you right now?</h2>
  <p class="lede">Tick the ${IMPORTANT_PICKS === 2 ? 'two' : IMPORTANT_PICKS} areas you most want to be good at the moment.</p>
  <div class="picks">${DOMAINS.map(d => `<div><span class="tick"></span><span><b>${d.name}</b><br><span class="fine">${d.blurb}</span></span></div>`).join('')}</div>
</section>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face { font-family:"Figtree"; font-weight:400; src:url("${fontUrl('Figtree-400.ttf')}"); }
@font-face { font-family:"Figtree"; font-weight:600; src:url("${fontUrl('Figtree-600.ttf')}"); }
@font-face { font-family:"Figtree"; font-weight:700; src:url("${fontUrl('Figtree-700.ttf')}"); }
@font-face { font-family:"Newsreader"; font-weight:500; src:url("${fontUrl('Newsreader-500.ttf')}"); }
</style>
<style>
@page { size: A4; margin: 16mm 16mm 18mm; }
:root { --ink:#241C2C; --muted:#5F566A; --line:#CFC7D6; --soft:#F1EEF4; --accent:#74305A; --bad:#A8353A; }
* { box-sizing: border-box; }
body { margin:0; font-family:"Figtree", "Helvetica Neue", Arial, sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.45; }
h1,h2,h3 { font-family:"Newsreader", Georgia, serif; font-weight:500; margin:0; line-height:1.15; }
h1 { font-size:30pt; } h2 { font-size:19pt; margin-bottom:6pt; } h3 { font-size:12.5pt; margin:0 0 2pt; }
p { margin:0 0 7pt; }
.page { break-after: page; }
.page:last-child { break-after: auto; }
.eyebrow, .runhead { font-size:7.5pt; letter-spacing:.1em; text-transform:uppercase; font-weight:600; color:var(--muted); }
.runhead { display:flex; justify-content:space-between; border-bottom:0.6pt solid var(--line); padding-bottom:4pt; margin-bottom:12pt; }
.lede { color:var(--muted); max-width:150mm; }
.box { border:0.8pt solid var(--line); border-radius:6pt; padding:10pt 12pt; margin:10pt 0; break-inside:avoid; }
.box.safe { border-color:var(--bad); }
.box h3 { font-size:12pt; }
ol.steps { margin:4pt 0 0; padding-left:16pt; } ol.steps li { margin-bottom:4pt; }
.areas { display:grid; grid-template-columns:1fr 1fr; gap:4pt 18pt; margin-top:6pt; }
.areas div b { font-weight:600; } .areas div span { color:var(--muted); }
.namerow { display:flex; gap:8pt; align-items:flex-end; margin:4pt 0 10pt; font-weight:600; font-size:9.5pt; }
.namerow i { flex:1; border-bottom:0.8pt solid var(--ink); height:12pt; } .namerow i.short { flex:0 0 32mm; }
.key { display:flex; flex-wrap:wrap; gap:4pt 14pt; font-size:8.5pt; color:var(--muted); margin:6pt 0 10pt; padding:6pt 8pt; background:var(--soft); border-radius:5pt; }
.key b { color:var(--ink); }
.area { break-inside:avoid; margin-bottom:5pt; }
table { border-collapse:collapse; width:100%; }
table.q td { padding:2pt 0; border-top:0.5pt solid var(--line); vertical-align:middle; }
td.num { width:8mm; color:var(--muted); font-variant-numeric:tabular-nums; font-size:9pt; }
td.stmt { padding-right:8pt !important; }
td.circles { width:58mm; white-space:nowrap; text-align:right; }
td.circles span { display:inline-block; width:6.2mm; height:6.2mm; line-height:6.2mm; border:0.7pt solid var(--line); border-radius:50%; text-align:center; font-size:9pt; margin-left:2mm; font-variant-numeric:tabular-nums; }
table.score th, table.score td { border:0.6pt solid var(--line); padding:5pt 5pt; text-align:center; font-size:9pt; font-variant-numeric:tabular-nums; }
table.score th { background:var(--soft); font-weight:600; font-size:8pt; }
table.score td.l { text-align:left; font-weight:600; }
table.score td.blank { height:20pt; }
table.score td.na { background:var(--soft); }
table.conv td, table.conv th { border:0.6pt solid var(--line); padding:3pt 0; text-align:center; font-size:8.5pt; font-variant-numeric:tabular-nums; }
table.conv th { background:var(--soft); font-weight:600; }
.band { display:grid; grid-template-columns:repeat(4,1fr); gap:8pt; margin:8pt 0; }
.band div { border:0.6pt solid var(--line); border-radius:5pt; padding:6pt 8pt; font-size:8.5pt; }
.band b { display:block; font-size:9.5pt; }
.tip { break-inside:avoid; padding:7pt 0; border-top:0.5pt solid var(--line); }
.tip:first-of-type { border-top:0; }
.tip p { margin:2pt 0 0; }
.nw { white-space:nowrap; }
.fine { font-size:8pt; color:var(--muted); }
.talk td { border:0.6pt solid var(--line); height:19pt; }
table.track th, table.track td { border:0.6pt solid var(--line); text-align:center; font-size:8.5pt; padding:0; height:22pt; }
table.track th { background:var(--soft); font-weight:600; font-size:7.5pt; height:16pt; }
table.track th.sub { font-size:7pt; color:var(--muted); }
table.track td.l, table.track th.l { text-align:left; padding:0 6pt; width:40mm; font-weight:600; }
table.track tr.dates td { height:16pt; } table.track tr.dates td.l { font-weight:400; }
table.track tr.total td { border-top:1.2pt solid var(--ink); }
td.circles span.na-box { width:auto; padding:0 1.6mm; border-radius:3pt; font-size:7.5pt; color:var(--muted); }
td.circles span.na-space { display:inline-block; width:8mm; margin-left:2mm; border:0; }
table.guess { margin-top:6pt; }
table.guess th, table.guess td { border:0.6pt solid var(--line); padding:5pt 4pt; text-align:center; font-size:8.5pt; }
table.guess th { background:var(--soft); font-weight:600; font-size:8pt; }
table.guess td.l, table.guess th.l { text-align:left; width:52mm; }
table.guess .dot-o { display:inline-block; width:6mm; height:6mm; border:0.7pt solid var(--line); border-radius:50%; }
.picks { display:grid; grid-template-columns:1fr 1fr; gap:7pt 16pt; margin-top:6pt; }
.picks > div { display:grid; grid-template-columns:7mm 1fr; align-items:start; }
.picks .tick { display:inline-block; width:4mm; height:4mm; border:0.8pt solid var(--ink); border-radius:1pt; margin-top:1pt; }
table.notes td { border-bottom:0.6pt solid var(--line); height:24pt; vertical-align:bottom; }
table.notes td.d { width:24mm; color:var(--muted); font-size:8pt; }
</style></head><body>

<section class="page">
  <span class="eyebrow">Relationship check-in · paper version</span>
  <h1 style="margin:6pt 0 10pt">How is it going, from both sides?</h1>
  <p class="lede">Each of you answers 32 short statements on your own, then guesses how the other sees things. It takes about ten minutes. Then you score it together and see how each of you sees the relationship, where you see it differently, how well you read each other, and what to work on first.</p>

  <div class="box">
    <h3>How to use it</h3>
    <ol class="steps">
      <li><b>Each take your own copy</b> (Partner 1 and Partner 2, three pages each). Answer separately, without discussing or looking at each other's answers.</li>
      <li><b>Score together</b> using the scoring sheet, then compare your guesses on the "How well you read each other" page. About fifteen minutes with a pen.</li>
      <li><b>Pick one area to start with</b>, using the "Start here" page. Talk about the statements you answered most differently, and the blind spots, before trying to fix anything.</li>
      <li><b>Repeat it every month or so</b> with fresh copies, and write your scores on the tracking page to see what's changing.</li>
    </ol>
  </div>

  <div class="box safe">
    <h3>Before you start</h3>
    <p>This check-in assumes you both feel safe to speak openly. If you feel afraid of your partner, or controlled by them (money, phone, who you see, where you go), don't do it together. Talk to someone on your own first. It's free and confidential.</p>
    <p style="margin:0"><b>1800RESPECT</b> (family and domestic violence, 24/7): <b class="nw">1800 737 732</b> &nbsp;·&nbsp; <b>Lifeline</b> (crisis support, 24/7): <b class="nw">13 11 14</b> &nbsp;·&nbsp; In immediate danger: <b>000</b></p>
  </div>

  <h3 style="margin-top:12pt">What it covers</h3>
  <div class="areas">${DOMAINS.map(d => `<div><b>${d.name}</b> <span>· ${d.blurb}</span></div>`).join('')}</div>

  <p class="fine" style="margin-top:16pt">This is a conversation starter, not a clinical assessment or a substitute for counselling. Scores and cut-offs are provisional and not clinically validated. There is also an app version where you each answer on your own phone and the scoring is done for you.</p>
</section>

${questionnaire('Partner 1')}
${questionnaire('Partner 2')}

<section class="page">
  <div class="runhead"><span>Both Sides Check-in</span><span>Scoring sheet</span></div>
  <h2>Score it together</h2>
  <ol class="steps" style="margin-bottom:8pt">
    <li>For each area, add up each partner's four circled numbers. For the statements in the <b>Reverse</b> column, count <b>6 minus</b> the number circled (so 5 counts as 1, 4 as 2, 3 stays 3). These are warning-sign statements, where agreeing is a bad sign. If you ticked <b>n/a</b> for some intimacy statements, add up the ones you answered, divide by how many that was and multiply by 4 (round to the nearest whole number). If all four are n/a, leave intimacy out of your overall score.</li>
    <li>Each total is between 4 and 20. Convert it to a score out of 100 using the table below.</li>
    <li>Write the gap between your two scores, and the status: go through the four rules below in order and use the first one that fits. Circle the names of the areas either of you ticked as mattering most.</li>
  </ol>
  <table class="score">
    <tr><th style="text-align:left">Area</th><th>Statements</th><th>Reverse</th><th>P1 total</th><th>P1 score</th><th>P2 total</th><th>P2 score</th><th>Gap</th><th>Status</th></tr>
    ${numbered.map(d => `<tr><td class="l">${d.name}</td><td>${d.items[0].n}–${d.items[3].n}</td><td>${d.items.filter(i => i.r).map(i => i.n).join(', ')}</td><td class="blank"></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
    <tr><td class="l">Overall (average of the 8 scores)</td><td colspan="3" class="na"></td><td></td><td class="na"></td><td></td><td colspan="2" class="na"></td></tr>
  </table>

  <h3 style="margin-top:12pt">Total to score</h3>
  <table class="conv">
    <tr><th>Total</th>${Array.from({length:17},(_,k)=>`<td>${k+4}</td>`).join('')}</tr>
    <tr><th>Score</th>${Array.from({length:17},(_,k)=>`<td>${score(k+4)}</td>`).join('')}</tr>
  </table>

  <div class="band">
    <div><b>Needs work</b>Either of you scored below ${STEADY} (a total of 12 or less).</div>
    <div><b>Seen differently</b>Both ${STEADY}+, but your scores are ${GAP} or more points apart.</div>
    <div><b>Strength</b>You both scored ${STRONG}+ (a total of 16 or more).</div>
    <div><b>Steady</b>Anything else.</div>
  </div>

  <h3 style="margin-top:10pt">Statements to talk about</h3>
  <p>Go through both copies statement by statement. Note any where your answers are two or more apart (after reversing the warning-sign statements). These are the best conversation starters.</p>
  <table class="talk" style="width:100%">
    <tr>${Array.from({length:6},()=>'<td></td>').join('')}</tr>
  </table>
  <p class="fine" style="margin-top:6pt">Write the statement numbers in the boxes.</p>
</section>

<section class="page">
  <div class="runhead"><span>Both Sides Check-in</span><span>How well you read each other</span></div>
  <h2>How well you read each other</h2>
  <p class="lede">Turn each guess into a number, then compare it with the other person's own score from the scoring sheet. A guess ${25} or more points away is a <b>blind spot</b>: one of the most useful things to talk about. Ask what the other person sees that you didn't.</p>
  <div class="key">${GUESS.map(g => `<span><b>${g.v}</b> ${g.l}</span>`).join('')}</div>
  <table class="score">
    <tr><th style="text-align:left">Area</th><th>P1's guess</th><th>P2's score</th><th>Points off</th><th>P2's guess</th><th>P1's score</th><th>Points off</th></tr>
    ${DOMAINS.map(d => `<tr><td class="l">${d.name}</td><td class="blank"></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
    <tr><td class="l">Average points off</td><td colspan="2" class="na"></td><td></td><td colspan="2" class="na"></td><td></td></tr>
  </table>
  <p style="margin-top:10pt">When a guess was higher than the other person's score, the guesser thought their partner was happier with that area than they are. When it was lower, they thought their partner was less happy than they are.</p>
</section>

<section class="page">
  <div class="runhead"><span>Both Sides Check-in</span><span>What to work on</span></div>
  <h2>Start here</h2>
  <p class="lede">Pick up to three areas marked <b>Needs work</b> or <b>Seen differently</b>, starting with the lowest score, and put ones either of you said matter most ahead of the rest. Try the matching suggestion for a week, then check in again. For a <b>Seen differently</b> area, start by understanding why your views differ before trying to fix anything.</p>
  ${DOMAINS.map(d => `<div class="tip"><h3>${d.name}</h3><p>${d.tip}</p></div>`).join('')}
  <p class="fine" style="margin-top:12pt">If several areas need work, or the same argument keeps coming back, a couples counsellor is a good next step.</p>
</section>

<section class="page">
  <div class="runhead"><span>Both Sides Check-in</span><span>Track over time</span></div>
  <h2>Track your check-ins</h2>
  <p class="lede">Copy each area's scores from the scoring sheet after every check-in, ideally about a month apart. Look for moves of 13 points or more. One answer moving one step shifts an area by about 6 points, so smaller changes are mostly noise.</p>
  <table class="track">
    <tr><th class="l" rowspan="2">Area</th>${Array.from({length:6},(_,k)=>`<th colspan="2">Check-in ${k+1}</th>`).join('')}</tr>
    <tr>${Array.from({length:6},()=>'<th class="sub">P1</th><th class="sub">P2</th>').join('')}</tr>
    <tr class="dates"><td class="l">Date</td>${Array.from({length:6},()=>'<td colspan="2"></td>').join('')}</tr>
    ${DOMAINS.map(d => `<tr><td class="l">${d.name}</td>${Array.from({length:12},()=>'<td></td>').join('')}</tr>`).join('')}
    <tr class="total"><td class="l">Overall</td>${Array.from({length:12},()=>'<td></td>').join('')}</tr>
  </table>
  <h3 style="margin-top:14pt">What we agreed to try</h3>
  <table class="notes">
    ${Array.from({length:6},()=>'<tr><td class="d">Date</td><td></td></tr>').join('')}
  </table>
</section>
</body></html>`;

const tmp = path.join(require('os').tmpdir(), 'both-sides-paper.html');
fs.writeFileSync(tmp, html);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family); });
  console.log('fonts loaded:', [...new Set(fonts)]);
  await page.pdf({ path: path.join(root, 'both-sides-checkin-paper.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:7pt;color:#5F566A;width:100%;text-align:center;font-family:Arial">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
  await browser.close();
})();
