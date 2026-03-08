# trading

This repository contains small market-data and charting projects.

The repository root is not a single runnable app. Each subdirectory is an independent project.
If you are starting here for the first time, `ticker_comparison` is the easiest place to begin.

## Start Here

- Repository overview: this file
- Project-specific setup and usage: [`ticker_comparison/README.md`](ticker_comparison/README.md)

## Repository Layout

| Directory | Description | Recommended For |
| --- | --- | --- |
| `ticker_comparison` | A web app for comparing two US tickers. The default pair is `QQQ / TQQQ`. | First-time users |
| `fear_greed` | Fear & Greed data and visualization work. | Users working on separate analysis tasks |

## Quick Start For Non-Developers

The simplest way to get value from this repository is to run `ticker_comparison`.

1. Prepare this repository folder.
   - You can `git clone` it or extract it from a zip file.
2. Open the repository folder in Codex.
3. Send Codex this exact prompt:

```text
Please run the ticker_comparison project in this repository.
Install any required dependencies, start the local development server, and tell me the local URL.
If anything fails, fix it and try again.
```

4. Codex will usually do the following for you:
   - move into `ticker_comparison`
   - run `npm install`
   - run `npm run dev`
   - report the local URL
5. Open the URL in your browser.
   - Usually `http://localhost:3000`
   - If port `3000` is already in use, it may switch to `3001`, `3002`, and so on

## If You Want To Run It Manually

There is no shared root-level `package.json` for this repository.
You must enter the specific project directory first.

### macOS / Linux

```bash
cd /path/to/trading/ticker_comparison
npm install
npm run dev
```

### Windows PowerShell

```powershell
cd C:\path\to\trading\ticker_comparison
npm install
npm run dev
```

When the server starts, the terminal prints the local URL.

## Recommended Prerequisites

- `Node.js` LTS
- `npm` (installed with Node.js)
- Internet access
- Optional: `Python 3`
  - Only needed when regenerating the default local data file for `ticker_comparison`

## Common Confusion At The Repository Root

- Do not run `npm install` at the repository root expecting everything to work.
- Move into the target project directory first.
- The best first project to run is `ticker_comparison`.
- For full setup, usage, data refresh, and troubleshooting details, read [`ticker_comparison/README.md`](ticker_comparison/README.md).
