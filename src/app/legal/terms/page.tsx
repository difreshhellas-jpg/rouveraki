import type { Metadata } from "next";
import { BRAND, DELIVERY_ZONES } from "@/lib/brand";
import { formatEuro } from "@/lib/money";

export const metadata: Metadata = { title: "Όροι Χρήσης" };

export default function TermsPage() {
  return (
    <>
      <h1>Όροι Χρήσης</h1>
      <p>
        Οι παρόντες όροι διέπουν τη χρήση του ιστότοπου και την υποβολή
        παραγγελιών προς το κατάστημα {BRAND.nameEl}, {BRAND.address.street},{" "}
        {BRAND.address.city} {BRAND.address.postalCode}.
      </p>

      <h2>1. Παραγγελίες</h2>
      <ul>
        <li>
          Η υποβολή παραγγελίας αποτελεί πρόταση σύναψης σύμβασης. Η σύμβαση
          καταρτίζεται μόνο όταν το κατάστημα αποδεχθεί ρητά την παραγγελία.
        </li>
        <li>
          Το κατάστημα διατηρεί το δικαίωμα να απορρίψει παραγγελία (π.χ.
          εξάντληση προϊόντος, υπερβολικός φόρτος, διεύθυνση εκτός ζώνης). Σε
          κάθε τέτοια περίπτωση το ποσό επιστρέφεται πλήρως και αυτόματα.
        </li>
        <li>
          Μπορείς να ακυρώσεις την παραγγελία σου μόνο πριν αυτή γίνει αποδεκτή
          από το κατάστημα, μέσα από τη σελίδα παρακολούθησης.
        </li>
      </ul>

      <h2>2. Ώρες λειτουργίας και διανομής</h2>
      <p>
        Το κατάστημα λειτουργεί καθημερινά {BRAND.hours.opens}-
        {BRAND.hours.closes}. Η διανομή εκτελείται καθημερινά{" "}
        {BRAND.deliveryHours.opens}-{BRAND.deliveryHours.closes}. Εκτός
        των ωρών διανομής είναι διαθέσιμη μόνο η παραλαβή από το κατάστημα.
      </p>

      <h2>3. Ζώνες, ελάχιστη παραγγελία και κόστος διανομής</h2>
      {/* TODO:OWNER - these figures are placeholders; confirm before launch. */}
      <ul>
        {DELIVERY_ZONES.map((z) => (
          <li key={z.id}>
            <strong>{z.el}</strong> - ελάχιστη παραγγελία{" "}
            {formatEuro(z.minimumOrder)}, κόστος διανομής{" "}
            {z.deliveryFee === 0 ? "δωρεάν" : formatEuro(z.deliveryFee)},
            ενδεικτικός χρόνος ~{z.etaMinutes}′.
          </li>
        ))}
      </ul>
      <p>
        Οι χρόνοι παράδοσης είναι εκτιμήσεις και επηρεάζονται από τον φόρτο, τον
        καιρό και την κυκλοφορία.
      </p>

      <h2>4. Τιμές και απόδειξη</h2>
      <p>
        Όλες οι τιμές αναγράφονται σε ευρώ και περιλαμβάνουν ΦΠΑ. Για κάθε
        συναλλαγή εκδίδεται νόμιμο φορολογικό παραστατικό.
      </p>

      <h2>5. Αλκοολούχα ποτά - ηλικιακός περιορισμός</h2>
      <p>
        Η πώληση αλκοολούχων ποτών επιτρέπεται αποκλειστικά σε άτομα άνω των 18
        ετών. Κατά την ολοκλήρωση παραγγελίας που περιέχει αλκοόλ απαιτείται
        ρητή δήλωση ενηλικότητας. Το κατάστημα διατηρεί το δικαίωμα να ζητήσει
        επίδειξη ταυτότητας κατά την παράδοση ή την παραλαβή και να αρνηθεί την
        παράδοση των αλκοολούχων ειδών εφόσον δεν αποδεικνύεται η ηλικία.
      </p>
      <p>
        {/* TODO:LAWYER/ACCOUNTANT - spec §6: confirm whether a checkbox alone
            is accepted for alcohol delivery, or whether a driver-side ID check
            is expected in practice. Also confirm whether the municipality of
            Xylokastro restricts alcohol sale hours; if it does, set
            ALCOHOL_HOURS_RESTRICTED in src/lib/hours.ts and update this text. */}
        <em>
          Σημείωση προς επιβεβαίωση: ο ακριβής τρόπος ελέγχου ηλικίας και τυχόν
          τοπικοί περιορισμοί ωραρίου πώλησης αλκοόλ επιβεβαιώνονται πριν τη
          δημοσίευση.
        </em>
      </p>

      <h2>6. Ευθύνη</h2>
      <p>
        Καταβάλλουμε κάθε προσπάθεια ώστε οι πληροφορίες του ιστότοπου
        (διαθεσιμότητα, τιμές, περιγραφές, αλλεργιογόνα) να είναι ακριβείς και
        επίκαιρες. Για κρίσιμα ζητήματα υγείας, όπως αλλεργίες, επικοινώνησε
        τηλεφωνικά πριν παραγγείλεις.
      </p>

      <h2>7. Επικοινωνία</h2>
      <p>
        {BRAND.nameEl}, {BRAND.address.street}, {BRAND.address.city}{" "}
        {BRAND.address.postalCode}. Τηλέφωνο{" "}
        <a href={`tel:${BRAND.phone.tel}`}>{BRAND.phone.display}</a>.
      </p>
    </>
  );
}
