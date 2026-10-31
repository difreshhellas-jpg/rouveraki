# Ρουβεράκι — παράδοση έργου (1/11/2026)

Για όποιον αναλαμβάνει το site και το Vercel (αναβάθμιση σε Vercel Pro).

## Με μια ματιά

| | |
|---|---|
| Live | https://rouveraki.vercel.app |
| Κώδικας | GitHub `difreshhellas-jpg/rouveraki` (private), **branch `demo-mode`** |
| Vercel project | `rouveraki` (Hobby, λογαριασμός `difreshhellas-jpg`) |
| Stack | Next.js 15, TypeScript, Tailwind, Zustand |
| Τρόπος λειτουργίας | **Demo mode** (`NEXT_PUBLIC_DEMO_MODE=true`): χωρίς βάση δεδομένων |
| Οθόνη καταστήματος | `/demo-kitchen` (παραγγελίες, κουμπί Εκτύπωση 80 mm) |
| Διαχείριση μενού | `/demo-kitchen/menu` (κωδικός: `ADMIN_PASSWORD`) |

## Πώς δουλεύει τώρα

- **Μενού**: ένα αρχείο JSON στο Vercel Blob store `rouveraki-menu` (fra1, public, `menu/menu.json`). Ο ιδιοκτήτης το αλλάζει από το `/demo-kitchen/menu`: φωτογραφία, όνομα, περιγραφή, τιμή, κατηγορία, «Εξαντλήθηκε», προσθήκη/διαγραφή. Κώδικας: `src/lib/menu-store.ts`, `src/app/api/live-menu/`.
  - Αν το Blob δεν έχει αποθηκευμένο μενού, σερβίρεται το `src/data/menu.json` (fallback).
  - Μια αλλαγή φαίνεται στους πελάτες σε ~5–20 δευτερόλεπτα (καθυστέρηση του Blob μετά από overwrite). Η οθόνη διαχείρισης κρατάει τη δική της τελευταία αποθήκευση για να μη γυρίσει πίσω.
- **Πληρωμή**: μόνο στην πόρτα — μετρητά ή κάρτα στο POS του διανομέα (στο κατάστημα για παραλαβή). Καμία online πληρωμή, καμία Viva/IRIS.
- **Παραγγελίες**: ⚠️ σε demo mode αποθηκεύονται **μόνο στον browser του πελάτη** (localStorage, `src/lib/demo/store.ts`). Το κατάστημα **δεν τις βλέπει** από άλλη συσκευή. Αυτό είναι το #1 πράγμα πριν από πραγματική χρήση (δες παρακάτω).
- Χωρίς έλεγχο 18+, χωρίς ζώνες διανομής (χωρίς ελάχιστη/χρέωση), ταμείο σε μία σελίδα.

## Deploy (σημαντικό)

Το production **δεν** βγαίνει από Git. Βγαίνει με το CLI από το branch `demo-mode`:

```bash
git archive demo-mode | tar -x -C /tmp/rv && cp .vercel/project.json /tmp/rv/.vercel/
cd /tmp/rv && npx vercel deploy --prod --yes \
  --build-env NEXT_PUBLIC_DEMO_MODE=true --env NEXT_PUBLIC_DEMO_MODE=true
```

⚠️ Το Git integration κάνει auto-deploy το **`main`**, που είναι η παλιά έκδοση με βάση δεδομένων (Supabase, έχει λήξει). **Ένα push στο `main` σπάει το `/menu`** (500). Πρώτη δουλειά στο Pro: δες «Μετά την αναβάθμιση» βήμα 2.

## Environment variables (Vercel → Settings → Environment Variables)

| Όνομα | Τι κάνει |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | πρόσβαση στο Blob store (μπήκε αυτόματα όταν δημιουργήθηκε το store) |
| `ADMIN_PASSWORD` | κωδικός για το `/demo-kitchen/menu` (μόνο Production). Για αλλαγή: νέα τιμή + νέο deploy |
| `NEXT_PUBLIC_DEMO_MODE` | περνιέται στο deploy command (δεν είναι αποθηκευμένο στο project) |
| `DATABASE_URL`, `SUPABASE_*`, `POSTGRES_*`, `VIVA_*`, `PAYMENT_MODE`, `SMS_PROVIDER` | παλιά, για το non-demo backend. Δεν χρησιμοποιούνται σε demo mode |

## Μετά την αναβάθμιση σε Pro

1. **Μεταφορά project** στο Pro team (Project → Settings → Transfer). Το Blob store και τα env vars ακολουθούν το project — έλεγξε μετά ότι το `BLOB_READ_WRITE_TOKEN` υπάρχει και ότι το `/api/live-menu` απαντά 200.
2. **Σταμάτα το λάθος auto-deploy**: είτε Settings → Git → Production Branch = `demo-mode` **και** πρόσθεσε `NEXT_PUBLIC_DEMO_MODE=true` στα Production env vars, είτε merge το `demo-mode` στο `main` με το ίδιο env var. Μετά τα pushes κάνουν σωστό deploy και το CLI βήμα δεν χρειάζεται.
3. **Κοινές παραγγελίες** (για πραγματική χρήση): οι παραγγελίες πρέπει να πάνε σε κοινό store για να τις δει το κατάστημα. Ο φθηνότερος δρόμος: Upstash Redis από το Vercel Marketplace, routes `POST /api/orders` + `GET /api/admin/orders` που διαβάζουν/γράφουν εκεί, με το ίδιο σχήμα που έχει τώρα το `src/lib/demo/store.ts` (ο client περνάει ήδη από το `src/lib/api.ts`, άρα αλλάζει μόνο αυτό το αρχείο). Και κωδικός και στο `/demo-kitchen` (τώρα είναι ανοιχτό).
4. Το Pro δίνει περισσότερα Blob operations/bandwidth — σε Hobby κάθε φόρτωση `/menu` κάνει ένα Blob read, να το παρακολουθείτε στο Usage.
5. Αν μπει ποτέ online πληρωμή ή βάση δεδομένων: όλος ο κώδικας (Prisma, Viva, SMS) υπάρχει ακόμα στο repo, αλλά η βάση Supabase είναι σε US East και έχει λήξει — θέλει νέα σε EU.

## Τοπικά

```bash
npm install
npx vercel env pull .env.local     # φέρνει BLOB token κ.λπ.
NEXT_PUBLIC_DEMO_MODE=true npx next dev
```
⚠️ Με το `.env.local` το local γράφει στο **ίδιο** Blob με το live — μια αποθήκευση από το local admin αλλάζει το live μενού.

Έλεγχοι: `npx tsc --noEmit -p .` · `npx eslint src` · `npx tsx scripts/verify-rules.ts` · `NEXT_PUBLIC_DEMO_MODE=true npx next build`

## Εκκρεμότητες από τον ιδιοκτήτη

- Τιμές σε Μερίδες/Πίτες/Κρασιά να ελεγχθούν (στις φωτογραφίες του έντυπου οι τιμές ήταν μετατοπισμένες κατά μία γραμμή).
- Καφέδες/ροφήματα/χυμοί/αναψυκτικά: ακόμα placeholder — χρειάζεται φωτογραφία της σελίδας του καταλόγου.
- «Μπύρα κουτάκι» δεν έχει τιμή, δεν μπήκε.
- Μερικές φωτογραφίες είναι προσεγγιστικές (ούζο/τσίπουρο, μάρκες μπύρας, μπιφτέκια) — ο ιδιοκτήτης μπορεί να ανεβάσει δικές του από το admin.

Ιστορικό αλλαγών 31/10: `docs/CHECKLIST-2026-10-31.md`.
