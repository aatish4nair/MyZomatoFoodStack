# Connecting your Google Sheet (local setup)

This guide connects the app to your spreadsheet **"My Zomato Food Pile"** (tab **"Formatted Data"**)
on your own computer. It takes about 15 minutes. The Gmail → Apps Script → sheet import you
already have is **not changed**; the app only reads the sheet.

> **Keep secrets out of chats, screenshots, issues and Git.** You will download a key file. Never
> paste its contents anywhere, including into an AI assistant.

## How it works (in one paragraph)

The backend logs in to Google as a **service account**: a robot Google identity that has no
access to anything until you share something with it. You share the sheet with it as **Viewer**
(read-only). The backend asks only for the `spreadsheets.readonly` permission, reads the
"Formatted Data" tab, and serves the result to the page at `http://localhost:5173`. The key file
stays on your computer, outside the project folder. The browser never sees it.

## 1. Create (or choose) a Google Cloud project

1. Open <https://console.cloud.google.com/> and sign in with the Google account that owns the sheet.
2. At the top, open the project picker → **New project**. Name it, for example,
   `my-zomato-food-stack`, then click **Create**. Select it once it's ready.

Using the Sheets API this way is free for personal use; no billing account is needed.

## 2. Enable the Google Sheets API

1. Go to **APIs & Services → Library**.
2. Search for **Google Sheets API**, open it, and click **Enable**.

## 3. Create a service account

1. Go to **IAM & Admin → Service Accounts → Create service account**.
2. Name: `food-stack-reader`. Click **Create and continue**.
3. Skip "Grant this service account access to project" (it needs **no** project roles) → **Done**.
4. Copy the service account's **email**. It looks like
   `food-stack-reader@<project-id>.iam.gserviceaccount.com`.

## 4. Share the sheet with the service account (Viewer only)

1. Open **My Zomato Food Pile** in Google Sheets → **Share**.
2. Paste the service-account email, choose **Viewer**, untick "Notify people", and click **Share**.

Don't use "Anyone with the link"; the app doesn't need it, and it would expose your orders.

## 5. Create and store the key file securely

1. Back in **Service Accounts**, click `food-stack-reader` → **Keys** tab → **Add key → Create new
   key → JSON → Create**. A `.json` file downloads.
2. Move it **outside** the project folder, into a private folder, and restrict it to your user:

   ```bash
   mkdir -p ~/.config/my-zomato-food-stack
   mv ~/Downloads/<downloaded-key-file>.json ~/.config/my-zomato-food-stack/service-account.json
   chmod 600 ~/.config/my-zomato-food-stack/service-account.json
   ```

3. Note the **absolute** path, e.g. `/Users/<you>/.config/my-zomato-food-stack/service-account.json`.

> If your organisation blocks key creation ("Service account key creation is disabled"), you'll
> need a personal Google Cloud project or an admin's help.

## 6. Find the spreadsheet ID

In the sheet's address bar:
`https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit#gid=0`. The ID is the long part
between `/d/` and `/edit`.

## 7. Configure the backend

```bash
cp backend/.env.example backend/.env     # only if backend/.env doesn't exist yet
```

Open `backend/.env` in a text editor and set:

```dotenv
GOOGLE_SHEET_ID=<the ID from step 6>
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/Users/<you>/.config/my-zomato-food-stack/service-account.json
```

Leave `GOOGLE_SHEET_RANGE="'Formatted Data'!A:J"` as it is, unless the tab is named differently.
`backend/.env` is ignored by Git. Run `git status` to confirm it never appears.

## 8. Check the connection (no personal data is printed)

```bash
npm run sheet:check
```

You should see `✓ Connected`, the header names, and **masked** formats (e.g. `99/99/9999`), counts
and status values. It never prints names, restaurants, amounts or IDs.

**Please share this output** (it's safe to share) so the parsing rules can be confirmed. Pay
particular attention to:

- `orders spread over several rows … different Total Paid values` (see DATA-MAPPING.md, "Total Paid");
- the **Order Status** list and how each value is treated.

## 9. Start the app

Use two terminals:

```bash
npm run dev:backend      # terminal 1, http://127.0.0.1:3000
npm run dev:frontend     # terminal 2, open http://localhost:5173
```

## 10. Verify that real data is shown

- The search placeholder cycles through **your** food names (brackets removed).
- The month pill lists your months; searching a food you ordered shows your restaurant and date.
- Optional: open <http://localhost:5173/api/insights> to see the four metrics as JSON.

Spreadsheet changes appear within about a minute (`SHEET_CACHE_TTL_SECONDS`, default 60); there's no
need to restart.

To work on the design without real data: `npm run dev:demo` (synthetic orders, frontend only).

## Troubleshooting

The page shows "Your orders couldn't be loaded right now". The backend terminal, `npm run sheet:check`,
and <http://localhost:5173/api/orders> all give a **code**:

| Code                                           | Meaning                                  | Fix                                                                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_CONFIGURED`                               | `GOOGLE_SHEET_ID` is empty               | Do step 7, then restart `npm run dev:backend`.                                                                                                                                                            |
| `UPSTREAM_AUTH`                                | Google refused the credentials or access | Is the sheet shared with the service-account email (step 4)? Is the Sheets API enabled (step 2)? Is the key file path correct and readable? Was the key deleted in Cloud Console? Create a new key if so. |
| `UPSTREAM_NOT_FOUND`                           | Wrong spreadsheet ID or tab name         | Re-copy the ID (step 6); check the tab is exactly `Formatted Data` or adjust `GOOGLE_SHEET_RANGE`.                                                                                                        |
| `UPSTREAM_QUOTA`                               | Too many requests to Google              | Wait a minute. The app caches reads; don't lower `SHEET_CACHE_TTL_SECONDS` below 30.                                                                                                                      |
| `UPSTREAM_TIMEOUT`                             | Google didn't answer within 10 s         | Check your internet connection; try again.                                                                                                                                                                |
| `MALFORMED_SHEET`                              | Header row or layout not as expected     | Row 1 of the tab must hold the column names (Order ID, Order Date, Restaurant, Item Name, Total Paid, Order Status, …). Run `npm run sheet:check`.                                                        |
| `Invalid environment configuration` at startup | A `.env` value is wrong                  | The message names the variable (never its value). Fix it in `backend/.env`.                                                                                                                               |
| Network error / 502 in the browser             | The backend isn't running                | Start `npm run dev:backend`.                                                                                                                                                                              |

**If a key file was ever exposed** (committed, pasted or shared): delete that key in Cloud Console
(**Service Accounts → Keys**) immediately and create a new one. See `SECURITY.md`.
