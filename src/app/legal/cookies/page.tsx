import type { Metadata } from "next";

export const metadata: Metadata = { title: "Πολιτική Cookies" };

export default function CookiesPage() {
  return (
    <>
      <h1>Πολιτική Cookies</h1>
      <p>
        Ο ιστότοπος χρησιμοποιεί μόνο τα απολύτως απαραίτητα αποθηκευμένα
        στοιχεία για να λειτουργήσει. Δεν χρησιμοποιούμε cookies διαφήμισης ή
        παρακολούθησης και δεν μοιραζόμαστε δεδομένα με δίκτυα διαφήμισης.
      </p>

      <h2>Τι αποθηκεύεται στη συσκευή σου</h2>
      <ul>
        <li>
          <strong>rouveraki.cart.v1</strong> (local storage) - το περιεχόμενο του
          καλαθιού σου, ώστε να μη χαθεί αν ανανεώσεις τη σελίδα. Παραμένει στη
          συσκευή σου και δεν αποστέλλεται πουθενά μέχρι να υποβάλεις παραγγελία.
        </li>
        <li>
          <strong>rouveraki.locale</strong> (local storage) - η επιλογή γλώσσας.
        </li>
        <li>
          <strong>rouveraki.theme</strong> (local storage) - η επιλογή ανοιχτού ή
          σκούρου θέματος.
        </li>
        <li>
          <strong>Cookies σύνδεσης προσωπικού</strong> - μόνο στη διαχειριστική
          περιοχή, για τη διατήρηση της σύνδεσης του προσωπικού.
        </li>
      </ul>

      <h2>Τρίτα μέρη</h2>
      <ul>
        <li>
          <strong>Χάρτης Google</strong> - η ενσωματωμένη προβολή χάρτη φορτώνεται
          από τη Google και ενδέχεται να θέτει δικά της cookies όταν εμφανίζεται.
        </li>
        <li>
          <strong>Viva.com</strong> - η σελίδα πληρωμής βρίσκεται σε ιστότοπο της
          Viva.com και διέπεται από τη δική της πολιτική.
        </li>
      </ul>

      <p>
        Μπορείς να διαγράψεις όλα τα παραπάνω από τις ρυθμίσεις του φυλλομετρητή
        σου. Η διαγραφή τους αδειάζει το καλάθι και επαναφέρει τις επιλογές
        γλώσσας και θέματος στις προεπιλογές.
      </p>

      <p>
        {/* TODO:LAWYER - if any analytics or marketing pixel is ever added, a
            consent banner becomes mandatory before it loads. As built, no such
            script exists and none is loaded. */}
        <em>
          Αν στο μέλλον προστεθεί εργαλείο στατιστικών ή διαφήμισης, θα απαιτηθεί
          banner συγκατάθεσης πριν τη φόρτωσή του.
        </em>
      </p>
    </>
  );
}
