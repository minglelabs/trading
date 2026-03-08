# ticker_comparison

A web app for comparing two US ticker symbols.
It opens with `QQQ / TQQQ` by default, and you can search for any other supported pair from the UI.

This README is written for someone who may not know the codebase and may not even be comfortable running local apps yet.
If you use Codex, it should be enough to get the app running locally on either macOS or Windows.

## What This App Does

- Shows a default comparison for `QQQ` and `TQQQ`
- Lets you search for any two ticker symbols and compare them
- Lets you drag the top chart to change the anchor date
- Compares trailing and forward returns for `1M`, `3M`, `6M`, `1Y`, and `5Y`
- Supports `log scale` and `linear scale` in the navigator view

## What You Need Before Running It

Required:

- `Node.js` LTS
- `npm`
- Internet access

Optional:

- `Python 3`
- `pandas`

`Python 3` and `pandas` are not required just to run the app.
They are only needed if you want to regenerate the default local data file at [`public/chart-data.json`](public/chart-data.json).

## Easiest Option: Ask Codex To Run It

On either macOS or Windows, open this repository in Codex and send this prompt:

```text
Please run the ticker_comparison project in this repository.
Install any required dependencies, start the local development server, and tell me the local URL.
If anything fails, fix it and try again.
```

Codex will usually:

1. move into the `ticker_comparison` directory
2. run `npm install`
3. run `npm run dev`
4. tell you which local URL to open

After that, open the reported URL in your browser.

- Usually `http://localhost:3000`
- If port `3000` is already in use, Next.js may switch to `3001`, `3002`, and so on

To stop the server, press `Ctrl + C` in the terminal where it is running.

## Manual Setup

### 1. Move Into The Project Directory

macOS / Linux:

```bash
cd /path/to/trading/ticker_comparison
```

Windows PowerShell:

```powershell
cd C:\path\to\trading\ticker_comparison
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start The Development Server

```bash
npm run dev
```

The terminal will print a local URL.
Most often it will be one of these:

- `http://localhost:3000`
- `http://localhost:3001`

### 4. Use The App In Your Browser

1. Open the printed URL in your browser.
2. The first page will show the default `QQQ / TQQQ` comparison.
3. Use the header search UI to enter two ticker symbols.
4. Other ticker pairs are loaded on demand while the server is running.

## Common Commands

### Start The Development Server

```bash
npm run dev
```

### Verify A Production Build

```bash
npm run build
```

Use this to confirm the app builds successfully before deployment or handoff.

### Start The Production Server

```bash
npm run build
npm run start
```

### Regenerate The Default Data File

```bash
npm run refresh:data
```

This command downloads long-range daily data from `Stooq` and rebuilds [`public/chart-data.json`](public/chart-data.json).

Notes:

- The default local data file only contains `QQQ / TQQQ`.
- Other ticker pairs are fetched live while the app is running.
- `npm run refresh:data` assumes the `python` command points to Python 3.

## If You Need To Refresh Data

If `npm run refresh:data` works in your environment, use that.

If you get a `python` or `pandas` error, use one of the platform-specific commands below.

### macOS / Linux

```bash
python3 -m pip install pandas
python3 refresh_data.py
```

### Windows PowerShell

```powershell
py -3 -m pip install pandas
py -3 refresh_data.py
```

## How The App Loads Data

- The first page renders immediately from the local default file for `QQQ / TQQQ`.
- When you request another pair, `/api/history` fetches that pair live.
- Search suggestions come from `/api/symbol-search`.
- Suggestions are meaningful once you enter at least two characters.
- Entering the same ticker twice returns an error because there is nothing to compare.
- Invalid ticker formats also return an error.

## URL Format For Opening A Specific Pair

You can also open the app with query parameters.

Example:

```text
http://localhost:3000/?primary=MSFT&comparison=AAPL
```

If your server started on `3001`, change the port in the URL accordingly.

## External Network Dependencies

This project does not require a `.env` file.
It does require outbound access to these services while the server is running:

- `stooq.com`
- `api.nasdaq.com`

This matters for:

- fetching history for non-default ticker pairs
- loading ticker search suggestions
- regenerating the local default data file

## Troubleshooting

### `npm install` fails

- Confirm that `Node.js` is installed.
- Close the terminal completely, reopen it, and try again.
- If you still want Codex to handle it, use this prompt:

```text
Please fix the npm install issue in ticker_comparison and try again.
```

### `npm run dev` cannot use port `3000`

That is normal.
If another process already uses `3000`, Next.js will usually switch to another port such as `3001`.
Open the exact URL printed in the terminal.

### You see a `.next/dev/lock` error

This usually means another `next dev` instance is already running for the same project.

1. Check whether another terminal already has `npm run dev` running.
2. If that server is still valid, keep using it instead of starting a second one.
3. If no server is actually running, delete the `.next` directory and start again.

### The page loads but ticker search or history does not work

This is usually an outbound network-access problem.
Make sure access to `stooq.com` and `api.nasdaq.com` is not blocked.

### `npm run refresh:data` fails with a `pandas` error

Install `pandas` using the command for your platform.

macOS / Linux:

```bash
python3 -m pip install pandas
```

Windows PowerShell:

```powershell
py -3 -m pip install pandas
```

## Useful Codex Prompts

- `Run ticker_comparison and tell me the current local URL.`
- `Check whether ticker_comparison builds successfully.`
- `Refresh the default chart-data.json file for ticker_comparison.`
- `Show me a local URL that opens ticker_comparison with MSFT and AAPL.`

## Verified Basic Workflow

The following commands were verified in this repository:

```bash
npm install
npm run build
```
