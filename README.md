# Valora

A guided discounted cash flow (DCF) builder for students and new grads learning valuation to break into the world of M&A and valuation.

Valora walks you through a DCF one assumption at a time, compiles the full model so you can see every formula, and then tests it:

- **Guided inputs.** Seven steps from historical results to terminal value, each with a plain-English explanation and where to find the number in a 10-K.
- **Source tags.** Every input shows whether it came from a filing, market data, an assumption, or you.
- **Compiled model.** A ledger-style sheet. Click any projected number to see the formula with the actual values plugged in.
- **Sanity checks.** Green, yellow and red flags on each input, rolled up into a 1 to 5 star model-quality rating.
- **Results.** Value bridge, free cash flow chart, WACC and terminal value sensitivity tables, and a reverse DCF that shows what the market price implies.
- **Share links.** The whole model is encoded in the link, so there's no database and nothing stored on a server.

Apple is preloaded from its fiscal 2026 results (year ended September 26, 2026).

## Run it locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # engine tests, including the Excel cross-check
```

## How the math is verified

`lib/dcf.ts` is the valuation engine. `verification/` builds the same model as an Excel workbook using ordinary cell formulas, recalculates it in LibreOffice, and the test suite checks that the engine matches the spreadsheet on three scenarios (Apple base case, Apple with mid-year discounting and an exit multiple, and a leveraged high-growth company).

To regenerate the workbook:

```bash
npx tsx verification/make-scenarios.ts
python3 verification/build_check_workbook.py
soffice --headless --calc --convert-to xlsx --outdir verification/recalc verification/valora-check.xlsx
python3 verification/extract_results.py
```

## Roadmap

- Pull financials for any ticker from SEC EDGAR
- AI-suggested assumptions with reasoning from 10-K and 10-Q text
- LBO builder

Valora is a learning tool, not investment advice.
