import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Αλλεργιογόνα" };

/** The 14 allergens that must be declared under EU Regulation 1169/2011. */
const ALLERGENS = [
  "Δημητριακά που περιέχουν γλουτένη",
  "Καρκινοειδή",
  "Αυγά",
  "Ψάρια",
  "Αραχίδες",
  "Σόγια",
  "Γάλα (και λακτόζη)",
  "Καρποί με κέλυφος",
  "Σέλινο",
  "Μουστάρδα",
  "Σπόροι σησαμιού",
  "Διοξείδιο του θείου και θειώδη (>10 mg/kg)",
  "Λούπινο",
  "Μαλάκια",
];

export default function AllergensPage() {
  return (
    <>
      <h1>Αλλεργιογόνα</h1>
      <p>
        Σύμφωνα με τον Κανονισμό (ΕΕ) 1169/2011, οφείλουμε να σε ενημερώνουμε για
        την παρουσία των παρακάτω αλλεργιογόνων στα προϊόντα μας.
      </p>

      <h2>Τα 14 δηλούμενα αλλεργιογόνα</h2>
      <ul>
        {ALLERGENS.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>

      <h2>Πριν παραγγείλεις</h2>
      <p>
        Η κουζίνα μας παρασκευάζει ταυτόχρονα προϊόντα που περιέχουν γλουτένη,
        γάλα, αυγά, σησάμι και ξηρούς καρπούς. Δεν μπορούμε να εγγυηθούμε την
        απουσία διασταυρούμενης επιμόλυνσης.
      </p>
      <p>
        Αν εσύ ή κάποιος στην παρέα σου έχει αλλεργία ή δυσανεξία,{" "}
        <strong>τηλεφώνησέ μας πριν την παραγγελία</strong> στο{" "}
        <a href={`tel:${BRAND.phone.tel}`}>{BRAND.phone.display}</a>. Μην
        βασίζεσαι αποκλειστικά στο πεδίο σημειώσεων της παραγγελίας για ζήτημα
        υγείας.
      </p>

      <p>
        {/* TODO:OWNER - the real per-item allergen matrix has to come from the
            kitchen. When it exists, it belongs in the menu_items table (one
            column of allergen codes per item) and rendered on each item sheet,
            not only on this page. */}
        <em>
          Αναλυτικός πίνακας αλλεργιογόνων ανά προϊόν: υπό κατάρτιση σε συνεργασία
          με την κουζίνα.
        </em>
      </p>
    </>
  );
}
