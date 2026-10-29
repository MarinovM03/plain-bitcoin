# Sources

Every number the site shows names its source and as-of time on screen. This file lists each source in one place.

## Data

Bundled snapshots, refreshed by hand with the scripts in `scripts/` (see the README). Nothing is fetched at runtime and no source needs an API key.

| File                       | What                                                           | Source                                                                                                                                                         | Licence                                   |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `src/data/cpi/uk.json`     | UK CPI index, all items, 2015=100 (ONS series D7BT), monthly   | Office for National Statistics, [D7BT](https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23), public CSV                               | Open Government Licence v3.0              |
| `src/data/cpi/us.json`     | US CPI-U, all items, not seasonally adjusted (BLS CUUR0000SA0) | US Bureau of Labor Statistics via FRED, [CPIAUCNS](https://fred.stlouisfed.org/series/CPIAUCNS), public fredgraph CSV                                          | Public domain (US government work)        |
| `src/data/prices/usd.json` | BTC month-end close in US dollars: PriceUSD on the last day    | [Coin Metrics Community Data](https://docs.coinmetrics.io/api/v4/), keyless community API, daily reference price from 18 July 2010                             | CC BY-NC 4.0, attribution to Coin Metrics |
| `src/data/prices/gbp.json` | BTC month-end close in pounds: the USD close ÷ USD per GBP     | Coin Metrics as above, divided by the last rate published that month in [DEXUSUK](https://fred.stlouisfed.org/series/DEXUSUK) (Federal Reserve H.10, via FRED) | CC BY-NC 4.0 (price), public domain (FX)  |

Notes:

- Every file carries `series`, `source`, `url`, `licence`, `asOf` (the day it was downloaded) and `months` (`YYYY-MM` to value). CPI is kept from January 2010; prices start in July 2010.
- A month the source did not publish is a gap, never filled in. The US file has no October 2025: BLS published no October 2025 CPI. The tool says so when that month is picked.
- FRED's UK CPI series (`GBRCPIALLMINMEI`, from the OECD) stops at March 2025, so UK CPI comes straight from the ONS.
- No keyless source has a long, liquid BTC/GBP history: Bitstamp's GBP pair starts in May 2020 and Coinbase's in April 2015 with trades of 0.01 BTC. Pounds are therefore derived from the multi-exchange US dollar reference price and the official month-end exchange rate. The tool says this on screen.
- Coin Metrics community data is licensed for non-commercial use. If the site ever earns money, this source must be replaced or licensed.

Planned:

| Use                                 | Source                                                                  | Arrives   |
| ----------------------------------- | ----------------------------------------------------------------------- | --------- |
| Block height for the supply counter | mempool.space REST API, Esplora fallback, offline estimate if both fail | Session 3 |

## Fonts

| File                                   | Font                                                      | Licence                                         |
| -------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `public/fonts/fraunces-600.woff2`      | Fraunces SemiBold, Latin subset (via Fontsource 5.3.0)    | SIL OFL 1.1, `public/fonts/Fraunces-OFL.txt`    |
| `public/fonts/ibm-plex-mono-500.woff2` | IBM Plex Mono Medium, Latin subset (via Fontsource 5.3.0) | SIL OFL 1.1, `public/fonts/IBMPlexMono-OFL.txt` |
