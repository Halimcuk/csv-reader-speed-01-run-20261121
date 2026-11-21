# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Halimcuk/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Halimcuk/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, built for make.fun's "Read broken CSV files faster, 21 November 2026" bounty ($100 in USDC).

Referral: `jcrs26fr`.

## What it does

`solve.js` returns exactly csv-reader 1.0.0's answer — `{columns, rows, errors}` — for every input `{text, header}`, including its broken-row policy (BOM dropped, blank lines skipped, stray CRs dropped with `stray_cr`, quoted fields with `""` escapes and LF-normalised line breaks, `quote_junk` after a closing quote, `unterminated_quote` re-read as unquoted, `short_row`/`long_row` padding and cutting). It just reads much faster: the reference walks one character at a time, this one reads in bulk — a clean record line is split at once, an unquoted field is one slice between the next comma and the record's next line break (found once per record), and a quoted field is slices between the next quotes, normalising line breaks only when a segment actually holds one.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=<out dir> node main.ts
```

`main.ts` (Node 22, standard library only) reads every case from `cases.json`, answers each with `run()` from `solve.js`, and writes `answers.json`. `solve.js` is a dependency-free ES module with no imports.

## Verify it

Against the kit's practice set and the reference (from the kit directory):

```sh
node cli/makefun.mjs grade-local --kit . --bot <this directory> --driver process
```

## License

MIT — see [LICENSE](LICENSE).
