# Hotel Mansarover app

React + Vite + Tailwind PWA on Firebase (Firestore + Hosting). See DEPLOY.md for setup and updates.

## Features
- Username + 4-digit PIN login; roles: Management, Manager, Accountant
- User management (Management)
- Daily summary (Accountant fills; Management verifies, including each finance field)
  - Rooms, Food (incl. in-house guests), Finance (cash, UPI, card, bank transfers, Bill to Company, expenses), Power
  - Draft / Submitted / Verified, "Unverified" badges, 10 AM IST pending warning
  - Night audit (.xlsx) upload that auto-fills rooms occupied, check-outs and receipts
  - Monthly table with totals, month selector, CSV export
- Tasks (anyone can assign to anyone), shown on Home
- Maintenance: room types, rooms and a separate checklist per room type (Management setup at /maintenance/setup);
  rooms grid for everyone; Manager and Management fill checklists (tick/cross, remark required on cross, draft autosave).
  History table (rooms x months, with fill dates, filters, CSV) and reports (open issues, by-room report) for everyone.
- Generator fuel (Management + Accountant): the 45 KW and 82 KW generators each have their own tank and their own tab.
  Management sets each tank's opening volume; Accountant records top-ups (volume before and after, at the start of the day).
  Fuel used = previous level after top-up minus next level before top-up; that generator's running hours come from the daily
  summaries. Shows exact L/hr per period, average, High flags, estimated stock and CSV export per generator.

## Dev
```
cp .env.example .env   # fill values
npm install
npm run dev
```
