# Both Sides Check-in

A five-minute relationship check-in for couples. Each partner answers 32 statements on their own phone, guesses how the other would rate each of the eight areas, and picks the two areas that matter most to them right now. The check-in then shows how each person sees the relationship, where they agree, where they see things differently, how well they read each other (blind spots), and what to work on first. Repeating it every month or so shows what is changing.

This is a conversation starter, not a clinical assessment. The cut-offs (55 and 75 out of 100, a 20-point gap, a 13-point change) are provisional and have not been validated.

## How it works

- **Two phones.** One partner answers and sends the other a link. Their answers are encoded in the link's `#fragment`, which browsers never send to the server. The second partner answers, sees the combined report, and gets a results link to send back.
- **One phone.** Partners answer in turn on the same device.
- **History.** Finished check-ins are saved in the browser's `localStorage`. A history link (also a `#fragment`) restores them on any device.
- **Doesn't apply.** The intimacy statements have a "Doesn't apply to us" option. Those answers are left out of the area score; an area with no applicable answers is left out of the overall score.
- **Safety.** Each partner answers two private safety questions. They are never saved, encoded in a link, or shown to the other partner. A warning-sign answer shows support services (1800RESPECT, Lifeline, 000) and the option to wipe everything on the device.

There is no backend and no database. The whole app is `index.html`.

## Pilot study

The pilot checks whether the check-in measures something real before it is promoted.

1. Send participants `https://both-sides-checkin.vercel.app/#pilot`. Pilot mode adds four questions from the Couples Satisfaction Index (CSI-4; Funk & Rogge, 2007), an established measure used here as a yardstick. Their partner's link carries pilot mode over automatically. **Check the CSI licence and wording against the published version before using it outside research.**
2. At the end, each couple sees "Send your results to the research team" with their results link. It never contains the private safety answers. Ask them to send it only if both partners agree.
3. Ask couples to repeat the check-in about a week later without discussing it, and send that link too. The pair shows how much scores move by chance.
4. Paste all the links you receive into a text file (anything containing them works) and run:

   ```bash
   node tools/analyse-pilot.js links.txt > report.md
   ```

   The report covers whether each area's statements hang together (Cronbach's alpha), how scores correlate with the CSI-4, how much scores move between the two runs (and whether the 13-point "real change" threshold holds), and how well partners guess each other. Aim for at least 30 couples before trusting any of it.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The app: questions, scoring, link encoding, history and charts |
| `both-sides-checkin-paper.pdf` | Printable version with a hand-scoring sheet and a tracking page |
| `tools/make-pdf.js` | Regenerates the PDF from the questions in `index.html` |
| `tools/analyse-pilot.js` | Reports reliability and validity from pilot results links |

## Changing the questions

The statements live in the `DOMAINS` array in `index.html`. Each area has four statements; `r: true` marks a reverse-scored (warning-sign) statement.

Changing the number, order or scale of statements, areas or guesses changes the link format. Add a new version character in `encodePerson`/`decodeHead` and keep decoding the old ones, or links people have already shared will decode into the wrong answers. The current format is version 2; version 1 links (before guesses and "doesn't apply") still open.

After editing the questions, regenerate the PDF:

```bash
cd tools
npm install
npm run pdf
```

## Running locally

Any static file server works:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Licences

The CSI-4 questions shown in pilot mode are from Funk, J. L., & Rogge, R. D. (2007), *Journal of Family Psychology*, 21(4), 572–583.

The fonts in `tools/fonts/` (Figtree and Newsreader) are licensed under the SIL Open Font License 1.1. The app loads the same fonts from Google Fonts.
