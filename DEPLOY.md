# Deploying Hotel Mansarover

## First time
1. https://console.firebase.google.com → Add project (Analytics not needed).
2. Build > Firestore Database > Create database (production mode, region asia-south1 / Mumbai).
3. Project settings > Your apps > Web (</>) → register app → copy the config into `.env`
   (copy `.env.example` to `.env` and fill all six values, no quotes).
4. In a terminal in this folder:
   ```
   npm install
   npm run build
   npx firebase-tools login
   npx firebase-tools use --add          # pick your project
   npx firebase-tools deploy --only firestore:rules,hosting
   ```
   The Firestore rules MUST be deployed, otherwise the app cannot read or write anything.
5. Open the Hosting URL on a phone → Install app (Android Chrome menu) / Share > Add to Home Screen (iPhone).
6. First visit asks you to create the Management account. Then add users under Users.

## Updating to a new version
Replace the project files with the new ones (keep your `.env`), then:
```
npm install          # needed when a new library was added
npm run build        # rebuild every time: .env values are baked in
npx firebase-tools deploy --only hosting
```
Staff get the new version the next time they open the app (close and reopen if it looks old).
Existing data is kept. Old summaries keep their old check-in numbers in the database but they are no longer shown.

## Using the app
- Maintenance (Management, first time): Maintenance > Setup > "Load default rooms & checklists" (4 room types, 37 rooms, standard checklist per type).
  Then adjust room types, rooms and each type's checklist as needed.
- Maintenance (Manager/Management): Maintenance > tap a room > tap ✓ or ✗ for each item (✗ needs a remark) > Submit.
  Progress is saved as a draft automatically; tap the room again to continue.
- Maintenance history: Maintenance > History. One row per room, months as columns, each number is the day a checklist was filled
  (red = had issues). Tap a number to open that checklist. Filter by type or room, export CSV.
- Maintenance reports: Maintenance > Reports.
  Open issues = rooms whose newest check still has a cross (shows how many checks in a row it has failed; a later all-OK check clears it).
  By room = pick a room, optional date range: open issues now, items that fail most often, all past checks, CSV.
- Accountant: Summary > pick the day > (optional) Upload night audit (.xlsx) > fill the rest > Save draft / Submit.
- Management: open a submitted day > Verify each finance field (or "Verify all finance fields") > Verify summary.
  Changing a verified amount (after Send back) clears only that field's tick.
- Daily summary Power: enter "45 KW generator hours" and "82 KW generator hours" each day. Older days that only have the single
  combined figure still show in the database but are flagged in fuel reports.
- Generator fuel (first time, Management): Generator > pick the 45 KW or 82 KW tab > Set opening volume (date, litres in that
  generator's tank, optional capacity). Do this once for each generator, using the volume at the start of the day.
- Generator top-up (Accountant): Generator > pick the generator > + Fuel top-up. Pick the day (top-ups are at the start of the day),
  enter litres before and after. Fuel used and L/hr appear from that generator's hours in the daily summary, so keep summaries
  submitted. Management can add a stock reading to correct a level, and edit or delete entries.
- Pending warning: after 10:00 AM IST, if yesterday is missing or still a draft.

## Troubleshooting
- Login page shows a red database message: deploy the Firestore rules (step 4), check `.env`, rebuild.
- Firestore asks for an index: click the link in the browser console error.
- Night audit says it can't read the file: it must be the .xlsx night audit report (not .xls / PDF).

## Security note
Login is checked against the database (no Firebase Auth), so Firestore rules are open and role
checks run in the app only. Keep the URL and project keys within staff. Moving to Firebase Auth later
would give server-side protection.
