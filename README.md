# Both Sides Check-in

A five-minute relationship check-in for couples. Each partner answers 32 statements on their own phone. The check-in then shows how each person sees the relationship across eight areas, where they agree, where they see things differently, and what to work on first. Repeating it every month or so shows what is changing.

This is a conversation starter, not a clinical assessment. The cut-offs (55 and 75 out of 100, a 20-point gap, a 13-point change) are provisional and have not been validated.

## How it works

- **Two phones.** One partner answers and sends the other a link. Their answers are encoded in the link's `#fragment`, which browsers never send to the server. The second partner answers, sees the combined report, and gets a results link to send back.
- **One phone.** Partners answer in turn on the same device.
- **History.** Finished check-ins are saved in the browser's `localStorage`. A history link (also a `#fragment`) restores them on any device.
- **Safety.** Each partner answers two private safety questions. They are never saved, encoded in a link, or shown to the other partner. A warning-sign answer shows support services (1800RESPECT, Lifeline, 000) and the option to wipe everything on the device.

There is no backend and no database. The whole app is `index.html`.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The app: questions, scoring, link encoding, history and charts |
| `both-sides-checkin-paper.pdf` | Printable version with a hand-scoring sheet and a tracking page |
| `tools/make-pdf.js` | Regenerates the PDF from the questions in `index.html` |

## Changing the questions

The statements live in the `DOMAINS` array in `index.html`. Each area has four statements; `r: true` marks a reverse-scored (warning-sign) statement.

Changing the number, order or scale of statements changes the link format. Bump the version character in `encodePerson`/`decodePerson`, or links people have already shared will decode into the wrong answers.

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

The fonts in `tools/fonts/` (Figtree and Newsreader) are licensed under the SIL Open Font License 1.1. The app loads the same fonts from Google Fonts.
