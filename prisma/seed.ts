/**
 * Menu seed.
 *
 * Food, beer and wine/spirits are transcribed from Rouveraki's printed menu
 * (photographed 2026-10-28). TODO:OWNER: the café sections (Καφέδες,
 * Ροφήματα, Χυμοί, Αναψυκτικά) were not in those photos and are still
 * placeholders, and every price should be checked against the till once.
 *
 * Run with:  npm run seed
 */
// Run outside Next.js, so nothing has loaded .env.local for us.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { PrismaClient, Prisma } from "@prisma/client";
import { AGE_GATED_CATEGORIES } from "../src/lib/brand";
import { photoForItem } from "../src/lib/images";

const prisma = new PrismaClient();

type SeedItem = {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  price: number;
  category: string;
  prepTimeMinutes: number;
};

const items: SeedItem[] = [
  /* ---- Πίτες τυλιχτές ---------------------------------------------------- */
  { category: "pites", prepTimeMinutes: 8,  price: 4.0, name: "Πίτα τυλιχτή απλή", nameEn: "Wrapped pita", description: "Γέμιση της επιλογής σας (γράψτε τη στις σημειώσεις): γύρος χοιρινός, γύρος κοτόπουλο, καλαμάκι χοιρινό, καλαμάκι κοτόπουλο, κεμπάπ, λουκάνικο Φρανκφούρτης, chicken stripes", descriptionEn: "Filling of your choice (write it in the notes): pork gyros, chicken gyros, pork skewer, chicken skewer, kebab, frankfurter, chicken stripes" },
  { category: "pites", prepTimeMinutes: 8,  price: 4.5, name: "Πίτα Κυπριακή / Μεξικάνικη Τορτίγια", nameEn: "Cypriot pita / Mexican tortilla", description: "Γέμιση της επιλογής σας (γράψτε τη στις σημειώσεις): γύρος χοιρινός, γύρος κοτόπουλο, καλαμάκι χοιρινό, καλαμάκι κοτόπουλο, κεμπάπ, λουκάνικο Φρανκφούρτης, chicken stripes", descriptionEn: "Filling of your choice (write it in the notes): pork gyros, chicken gyros, pork skewer, chicken skewer, kebab, frankfurter, chicken stripes" },
  { category: "pites", prepTimeMinutes: 8,  price: 4.0, name: "Πίτα με μπιφτέκι λαχανικών (νηστίσιμη)", nameEn: "Veggie patty pita (vegan)", description: "Νηστίσιμη πίτα με μπιφτέκι λαχανικών", descriptionEn: "Lenten pita with a vegetable patty" },
  { category: "pites", prepTimeMinutes: 12, price: 9.0, name: "Σκεπαστή με γύρο σε τετράγωνη πίτα", nameEn: "Skepasti with gyros", description: "2 πίτες τετράγωνες ψημένες σε σάντουιτς με γύρο χοιρινό, σκεπαστό με λιωμένο τυρί, ντομάτα, πατάτες, σως", descriptionEn: "Two square pitas toasted sandwich-style with pork gyros, melted cheese, tomato, fries, sauce" },
  { category: "pites", prepTimeMinutes: 6,  price: 3.0, name: "Πίτα παιδική χωρίς κρέας", nameEn: "Kids pita, no meat", description: "Παιδική πίτα χωρίς κρέας", descriptionEn: "Kids pita without meat" },
  { category: "pites", prepTimeMinutes: 1,  price: 0.5, name: "Έξτρα υλικά (πίτα)", nameEn: "Extra topping (pita)", description: "Ανά έξτρα υλικό, γράψτε ποιο στις σημειώσεις", descriptionEn: "Per extra topping, name it in the notes" },

  /* ---- Σουβλάκι καλαμάκι (στα κάρβουνα) ----------------------------------- */
  { category: "kalamakia", prepTimeMinutes: 8, price: 2.2, name: "Καλαμάκι χοιρινό", nameEn: "Pork kalamaki", description: "100 γρ. με ψωμάκι", descriptionEn: "100 g, with bread" },
  { category: "kalamakia", prepTimeMinutes: 8, price: 2.2, name: "Καλαμάκι κοτόπουλο", nameEn: "Chicken kalamaki", description: "100 γρ. με ψωμάκι", descriptionEn: "100 g, with bread" },
  { category: "kalamakia", prepTimeMinutes: 8, price: 2.2, name: "Καλαμάκι κεμπάπ πολίτικο", nameEn: "Politiko kebab skewer", description: "Με ψωμάκι", descriptionEn: "With bread" },
  { category: "kalamakia", prepTimeMinutes: 8, price: 2.4, name: "Κεμπάπ Φιλαδέλφεια MEGAGYROS", nameEn: "Philadelphia kebab MEGAGYROS", description: "Με ψωμάκι", descriptionEn: "With bread" },

  /* ---- Μερίδες (στα κάρβουνα) --------------------------------------------- */
  { category: "merides", prepTimeMinutes: 25, price: 10.0, name: "Κοτόπουλο στα κάρβουνα (μισό)", nameEn: "Charcoal chicken (half)", description: "Μισό κοτόπουλο στα κάρβουνα", descriptionEn: "Half a charcoal-grilled chicken" },
  { category: "merides", prepTimeMinutes: 30, price: 20.0, name: "Κοτόπουλο στα κάρβουνα (ολόκληρο)", nameEn: "Charcoal chicken (whole)", description: "Ολόκληρο κοτόπουλο στα κάρβουνα", descriptionEn: "A whole charcoal-grilled chicken" },
  { category: "merides", prepTimeMinutes: 20, price: 11.0, name: "Κοντοσούβλι αγριογούρουνο", nameEn: "Wild boar kontosouvli", description: "Στη λάμα, 300 gr, με λαχανικά", descriptionEn: "Grilled on the blade, 300 g, with vegetables" },
  { category: "merides", prepTimeMinutes: 20, price: 12.0, name: "Παϊδάκια προβατίνας (μισό κιλό)", nameEn: "Mutton chops (half kilo)", description: "Παϊδάκια προβατίνας στα κάρβουνα, μισό κιλό", descriptionEn: "Charcoal-grilled mutton chops, half a kilo" },
  { category: "merides", prepTimeMinutes: 25, price: 24.0, name: "Παϊδάκια προβατίνας (κιλό)", nameEn: "Mutton chops (kilo)", description: "Παϊδάκια προβατίνας στα κάρβουνα, ένα κιλό", descriptionEn: "Charcoal-grilled mutton chops, one kilo" },
  { category: "merides", prepTimeMinutes: 20, price: 11.0, name: "Πανσέτα χοιρινή (μισό κιλό)", nameEn: "Pork belly (half kilo)", description: "Πανσέτα χοιρινή στα κάρβουνα, μισό κιλό", descriptionEn: "Charcoal-grilled pork belly, half a kilo" },
  { category: "merides", prepTimeMinutes: 25, price: 22.0, name: "Πανσέτα χοιρινή (κιλό)", nameEn: "Pork belly (kilo)", description: "Πανσέτα χοιρινή στα κάρβουνα, ένα κιλό", descriptionEn: "Charcoal-grilled pork belly, one kilo" },
  { category: "merides", prepTimeMinutes: 12, price: 9.5,  name: "Γύρος χοιρινός", nameEn: "Pork gyros platter", description: "Μερίδα γύρος χοιρινός", descriptionEn: "Pork gyros platter" },
  { category: "merides", prepTimeMinutes: 12, price: 9.5,  name: "Γύρος κοτόπουλο", nameEn: "Chicken gyros platter", description: "Μερίδα γύρος κοτόπουλο", descriptionEn: "Chicken gyros platter" },
  { category: "merides", prepTimeMinutes: 15, price: 8.0,  name: "Λουκάνικο χωριάτικο", nameEn: "Village sausage", description: "Χειροποίητο", descriptionEn: "Handmade" },
  { category: "merides", prepTimeMinutes: 16, price: 10.0, name: "Μπιφτέκι μοσχαρίσιο", nameEn: "Beef bifteki", description: "Χειροποίητο, 350 γρ.", descriptionEn: "Handmade, 350 g" },
  { category: "merides", prepTimeMinutes: 16, price: 12.0, name: "Μπιφτέκι αγριογούρουνο", nameEn: "Wild boar bifteki", description: "300 γρ. ζουμερό φιλέτο κιμά με δυόσμο και καρυκεύματα", descriptionEn: "300 g juicy minced fillet with mint and spices" },
  { category: "merides", prepTimeMinutes: 15, price: 10.5, name: "Μπιφτέκι κοτόπουλο", nameEn: "Chicken bifteki", description: "Μπιφτέκι κοτόπουλο στα κάρβουνα", descriptionEn: "Charcoal-grilled chicken patty" },
  { category: "merides", prepTimeMinutes: 20, price: 13.0, name: "Μπριζόλα χοιρινή σταβλίσια", nameEn: "Pork chop", description: "550 γρ.", descriptionEn: "550 g" },
  { category: "merides", prepTimeMinutes: 18, price: 14.0, name: "Τριπλή απόλαυση", nameEn: "Triple delight", description: "Χοιρινά μπριζολάκια x3 χωρίς κόκκαλο με σως BBQ", descriptionEn: "Three boneless pork chops with BBQ sauce" },
  { category: "merides", prepTimeMinutes: 20, price: 16.0, name: "Μοσχαρίσια μπριζόλα", nameEn: "Beef steak", description: "Μοσχαρίσια μπριζόλα στα κάρβουνα", descriptionEn: "Charcoal-grilled beef steak" },
  { category: "merides", prepTimeMinutes: 15, price: 10.0, name: "Φιλέτο κοτόπουλο", nameEn: "Chicken fillet", description: "Με σως μουστάρδας", descriptionEn: "With mustard sauce" },
  { category: "merides", prepTimeMinutes: 12, price: 7.0,  name: "Μπιφτέκι λαχανικών", nameEn: "Veggie patties", description: "2 τεμάχια (ντομάτα, μαρούλι, πατάτες)", descriptionEn: "2 pieces (tomato, lettuce, fries)" },
  { category: "merides", prepTimeMinutes: 14, price: 9.0,  name: "Μερίδα χοιρινό", nameEn: "Pork skewer platter", description: "Καλαμάκι 3 τμχ.", descriptionEn: "3 skewers" },
  { category: "merides", prepTimeMinutes: 14, price: 9.5,  name: "Μερίδα κοτόπουλο", nameEn: "Chicken skewer platter", description: "Καλαμάκι 3 τμχ.", descriptionEn: "3 skewers" },
  { category: "merides", prepTimeMinutes: 12, price: 9.5,  name: "Μερίδα chicken stripes (nuggets)", nameEn: "Chicken stripes platter", description: "Chicken stripes (nuggets)", descriptionEn: "Chicken stripes (nuggets)" },
  { category: "merides", prepTimeMinutes: 14, price: 9.5,  name: "Μερίδα κεμπάπ πολίτικο", nameEn: "Politiko kebab platter", description: "Καλαμάκι 3 τμχ.", descriptionEn: "3 skewers" },
  { category: "merides", prepTimeMinutes: 14, price: 9.5,  name: "Μερίδα κεμπάπ Φιλαδέλφεια", nameEn: "Philadelphia kebab platter", description: "Καλαμάκι 3 τμχ.", descriptionEn: "3 skewers" },

  /* ---- Ποικιλίες ---------------------------------------------------------- */
  { category: "poikilies", prepTimeMinutes: 25, price: 19.0, name: "Ποικιλία special κρεατικών (2 ατόμων)", nameEn: "Special meat platter (for 2)", description: "Λουκάνικο χωριάτικο, πανσέτα, μπιφτέκι μοσχαρίσιο, φιλέτο κοτόπουλο. Συνοδεύονται από πατάτες και σως BBQ", descriptionEn: "Village sausage, pork belly, beef bifteki, chicken fillet. Served with fries and BBQ sauce" },
  { category: "poikilies", prepTimeMinutes: 30, price: 36.0, name: "Ποικιλία special κρεατικών (4 ατόμων)", nameEn: "Special meat platter (for 4)", description: "Λουκάνικο χωριάτικο, πανσέτα, μπιφτέκι μοσχαρίσιο, φιλέτο κοτόπουλο. Συνοδεύονται από πατάτες και σως BBQ", descriptionEn: "Village sausage, pork belly, beef bifteki, chicken fillet. Served with fries and BBQ sauce" },

  /* ---- Club & Burger ------------------------------------------------------ */
  { category: "burger", prepTimeMinutes: 12, price: 8.0, name: "Club σάντουιτς Ρουβεράκι", nameEn: "Rouveraki club sandwich", description: "Ψητό φιλέτο κοτόπουλο με τραγανό μπέικον, τυρί, μαρούλι, ντομάτα, μαγιονέζα, τηγανητές πατάτες", descriptionEn: "Grilled chicken fillet, crispy bacon, cheese, lettuce, tomato, mayonnaise, fries" },
  { category: "burger", prepTimeMinutes: 12, price: 7.5, name: "Club σάντουιτς Γαλοπούλα", nameEn: "Turkey club sandwich", description: "Μαρούλι, ντομάτα, τυρί, φιλέτο γαλοπούλας, μαγιονέζα και τηγανητές πατάτες", descriptionEn: "Lettuce, tomato, cheese, turkey fillet, mayonnaise and fries" },
  { category: "burger", prepTimeMinutes: 14, price: 7.0, name: "Classic Burger", nameEn: "Classic Burger", description: "Αφράτο ψωμάκι με σουσάμι, μπιφτέκι μοσχαρίσιο, ντομάτα, μαρούλι, καραμελωμένα κρεμμύδια, μαγιονέζα, κέτσαπ και τηγανητές πατάτες. Γίνεται και με μπιφτέκι κοτόπουλο +0,50 €", descriptionEn: "Sesame bun, beef patty, tomato, lettuce, caramelised onions, mayonnaise, ketchup and fries. Also with a chicken patty +€0.50" },
  { category: "burger", prepTimeMinutes: 14, price: 7.5, name: "Cheese Burger", nameEn: "Cheese Burger", description: "Αφράτο ψωμάκι με σουσάμι, μπιφτέκι μοσχαρίσιο, μπέικον, τυρί, ντομάτα, μαρούλι, καραμελωμένα κρεμμύδια, μαγιονέζα, κέτσαπ και τηγανητές πατάτες. Γίνεται και με μπιφτέκι κοτόπουλο +0,50 €", descriptionEn: "Sesame bun, beef patty, bacon, cheese, tomato, lettuce, caramelised onions, mayonnaise, ketchup and fries. Also with a chicken patty +€0.50" },
  { category: "burger", prepTimeMinutes: 14, price: 7.5, name: "Classic Burger με μπιφτέκι κοτόπουλο", nameEn: "Classic Burger, chicken patty", description: "Το Classic Burger με μπιφτέκι κοτόπουλο", descriptionEn: "The Classic Burger with a chicken patty" },
  { category: "burger", prepTimeMinutes: 14, price: 8.0, name: "Cheese Burger με μπιφτέκι κοτόπουλο", nameEn: "Cheese Burger, chicken patty", description: "Το Cheese Burger με μπιφτέκι κοτόπουλο", descriptionEn: "The Cheese Burger with a chicken patty" },
  { category: "burger", prepTimeMinutes: 12, price: 9.0, name: "Πίτα Club", nameEn: "Pita club", description: "Τετράγωνη πίτα με ψητό φιλέτο κοτόπουλο, τραγανό μπέικον, τυρί, ντομάτα, μαρούλι, μαγιονέζα και τηγανητές πατάτες", descriptionEn: "Square pita with grilled chicken fillet, crispy bacon, cheese, tomato, lettuce, mayonnaise and fries" },

  /* ---- Σάντουιτς (ψήνεται) ------------------------------------------------ */
  { category: "santouits", prepTimeMinutes: 10, price: 6.0, name: "Σάντουιτς με chicken stripes (nuggets)", nameEn: "Chicken stripes sandwich", description: "Ψημένο σάντουιτς με chicken stripes", descriptionEn: "Toasted sandwich with chicken stripes" },
  { category: "santouits", prepTimeMinutes: 10, price: 6.0, name: "Σάντουιτς με γύρο χοιρινό ή κοτόπουλο", nameEn: "Gyros sandwich (pork or chicken)", description: "Γράψτε χοιρινό ή κοτόπουλο στις σημειώσεις", descriptionEn: "Note pork or chicken" },
  { category: "santouits", prepTimeMinutes: 10, price: 6.0, name: "Σάντουιτς με σουβλάκι", nameEn: "Souvlaki sandwich", description: "Καλαμάκι χοιρινό χειροποίητο, ή καλαμάκι κοτόπουλο ή κεμπάπ πολίτικο, ντομάτα, πατάτες τηγανητές", descriptionEn: "Handmade pork skewer, chicken skewer or politiko kebab, tomato, fries" },
  { category: "santouits", prepTimeMinutes: 10, price: 6.0, name: "Σάντουιτς με λουκάνικο", nameEn: "Sausage sandwich", description: "Ψημένο σάντουιτς με λουκάνικο", descriptionEn: "Toasted sandwich with sausage" },
  { category: "santouits", prepTimeMinutes: 1,  price: 0.5, name: "Έξτρα υλικά (σάντουιτς)", nameEn: "Extra topping (sandwich)", description: "Ανά έξτρα υλικό, γράψτε ποιο στις σημειώσεις", descriptionEn: "Per extra topping, name it in the notes" },

  /* ---- Ορεκτικά ----------------------------------------------------------- */
  { category: "orektika", prepTimeMinutes: 10, price: 4.0, name: "Πατάτες τηγανητές", nameEn: "French fries", description: "Τηγανητές πατάτες", descriptionEn: "French fries" },
  { category: "orektika", prepTimeMinutes: 12, price: 5.0, name: "Πατάτες τηγανητές με τυρί και σως", nameEn: "Fries with cheese and sauce", description: "Πατάτες με τυρί και σως", descriptionEn: "Fries topped with cheese and sauce" },
  { category: "orektika", prepTimeMinutes: 10, price: 6.5, name: "Spring rolls λαχανικών", nameEn: "Vegetable spring rolls", description: "Με σως γιαουρτιού", descriptionEn: "With yoghurt sauce" },
  { category: "orektika", prepTimeMinutes: 12, price: 6.5, name: "Χωριάτικη μανιταρόπιτα", nameEn: "Village mushroom pie", description: "Χωριάτικη πίτα με μανιτάρια", descriptionEn: "Rustic mushroom pie" },
  { category: "orektika", prepTimeMinutes: 12, price: 7.0, name: "Κεφτεδάκια μοσχαρίσια", nameEn: "Beef meatballs", description: "Μοσχαρίσια κεφτεδάκια", descriptionEn: "Beef meatballs" },
  { category: "orektika", prepTimeMinutes: 10, price: 7.0, name: "Ταλαγάνι ψητό", nameEn: "Grilled talagani", description: "Ψητό ταλαγάνι", descriptionEn: "Grilled talagani cheese" },
  { category: "orektika", prepTimeMinutes: 10, price: 6.5, name: "Σαγανάκι κεφαλοτύρι", nameEn: "Kefalotyri saganaki", description: "Τηγανητό κεφαλοτύρι", descriptionEn: "Pan-fried kefalotyri" },
  { category: "orektika", prepTimeMinutes: 4,  price: 4.5, name: "Φέτα με λάδι και ρίγανη", nameEn: "Feta with oil and oregano", description: "Φέτα, ελαιόλαδο, ρίγανη", descriptionEn: "Feta, olive oil, oregano" },
  { category: "orektika", prepTimeMinutes: 12, price: 6.5, name: "Φέτα σε φύλλο κρούστας", nameEn: "Feta in filo", description: "Με σουσάμι & μέλι", descriptionEn: "With sesame & honey" },
  { category: "orektika", prepTimeMinutes: 15, price: 7.0, name: "Μπουγιουρντί", nameEn: "Bougiourdi", description: "Φέτα, κεφαλοτύρι, ντομάτα, ψημένα σε πήλινο", descriptionEn: "Feta, kefalotyri, tomato, baked in clay" },
  { category: "orektika", prepTimeMinutes: 4,  price: 4.5, name: "Τζατζίκι χειροποίητο", nameEn: "Homemade tzatziki", description: "Χειροποίητο τζατζίκι", descriptionEn: "Homemade tzatziki" },
  { category: "orektika", prepTimeMinutes: 4,  price: 4.5, name: "Τυροκαυτερή σπιτική", nameEn: "Homemade tirokafteri", description: "Σπιτική πικάντικη τυροσαλάτα", descriptionEn: "Homemade spicy cheese spread" },
  { category: "orektika", prepTimeMinutes: 3,  price: 0.6, name: "Πιτάκια ατομικά", nameEn: "Single pitas", description: "Ανά τεμάχιο", descriptionEn: "Per piece" },

  /* ---- Σαλάτες ------------------------------------------------------------ */
  { category: "salates", prepTimeMinutes: 8,  price: 9.0, name: "Όνειρο", nameEn: "Oneiro salad", description: "Ρόκα, σπανάκι, πράσινη λόλα, λιαστή ντομάτα, καρύδια, παρμεζάνα και σως βαλσάμικου με μέλι", descriptionEn: "Rocket, spinach, green lollo, sun-dried tomato, walnuts, parmesan, balsamic-honey dressing" },
  { category: "salates", prepTimeMinutes: 8,  price: 9.0, name: "Σαλάτα Σεφ", nameEn: "Chef salad", description: "Μαρούλι, ντομάτα, αγγούρι, ζαμπόν, τυρί, αυγό, σως σεφ", descriptionEn: "Lettuce, tomato, cucumber, ham, cheese, egg, chef dressing" },
  { category: "salates", prepTimeMinutes: 10, price: 9.5, name: "Καίσαρα", nameEn: "Caesar salad", description: "Γαλλική σαλάτα, φιλέτο κοτόπουλο, μπέικον, κρουτόν, τυρί, σως αντζούγιας", descriptionEn: "Lettuce, chicken fillet, bacon, croutons, cheese, anchovy dressing" },
  { category: "salates", prepTimeMinutes: 7,  price: 7.0, name: "Κρητικός ντάκος", nameEn: "Cretan dakos", description: "Κριθαρένιο παξιμάδι, ψιλοκομμένη ντομάτα, ανθότυρο, πράσινη πιπεριά, κάπαρη, κρεμμύδι, ελιές, ρίγανη, ελαιόλαδο", descriptionEn: "Barley rusk, chopped tomato, anthotyro, green pepper, capers, onion, olives, oregano, olive oil" },
  { category: "salates", prepTimeMinutes: 7,  price: 9.0, name: "Χωριάτικη σαλάτα", nameEn: "Greek salad", description: "Ντομάτα, αγγούρι, πράσινη πιπεριά, κάπαρη, κρεμμύδι, ελιές, φέτα, ρίγανη, ελαιόλαδο", descriptionEn: "Tomato, cucumber, green pepper, capers, onion, olives, feta, oregano, olive oil" },
  { category: "salates", prepTimeMinutes: 5,  price: 6.5, name: "Αγγουροντομάτα ή Μαρούλι", nameEn: "Tomato-cucumber or lettuce salad", description: "Γράψτε ποια στις σημειώσεις", descriptionEn: "Note which" },

  /* ---- Ζυμαρικά (σπαγγέτι ή πένες) ---------------------------------------- */
  { category: "zymarika", prepTimeMinutes: 15, price: 8.5, name: "Μακαρόνια με μοσχαρίσιο κιμά", nameEn: "Pasta with beef mince", description: "Σπαγγέτι ή πένες (γράψτε στις σημειώσεις)", descriptionEn: "Spaghetti or penne (note which)" },
  { category: "zymarika", prepTimeMinutes: 15, price: 7.0, name: "Μακαρονάδα αλά Νάπολη", nameEn: "Pasta Napoli", description: "Με κόκκινη σάλτσα. Σπαγγέτι ή πένες (γράψτε στις σημειώσεις)", descriptionEn: "With red sauce. Spaghetti or penne (note which)" },
  { category: "zymarika", prepTimeMinutes: 15, price: 8.5, name: "Καρμπονάρα", nameEn: "Carbonara", description: "Σπαγγέτι ή πένες (γράψτε στις σημειώσεις)", descriptionEn: "Spaghetti or penne (note which)" },
  { category: "zymarika", prepTimeMinutes: 15, price: 8.0, name: "Μακαρονάδα Μεσογειακή", nameEn: "Mediterranean pasta", description: "Φέτα, πάστα ελιάς, φρέσκια ντομάτα, μαυροπίπερο, ρίγανη, ελαιόλαδο. Σπαγγέτι ή πένες", descriptionEn: "Feta, olive paste, fresh tomato, black pepper, oregano, olive oil. Spaghetti or penne" },
  { category: "zymarika", prepTimeMinutes: 15, price: 8.0, name: "Μακαρόνια με πέστο βασιλικού", nameEn: "Pasta with basil pesto", description: "Σπαγγέτι ή πένες (γράψτε στις σημειώσεις)", descriptionEn: "Spaghetti or penne (note which)" },

  /* ---- Ψάρι --------------------------------------------------------------- */
  { category: "psari", prepTimeMinutes: 14, price: 9.5,  name: "Καλαμαράκι τηγανητό", nameEn: "Fried calamari", description: "Τηγανητό καλαμαράκι", descriptionEn: "Fried calamari" },
  { category: "psari", prepTimeMinutes: 18, price: 18.0, name: "Φιλέτο σολομού", nameEn: "Salmon fillet", description: "Φιλέτο σολομού", descriptionEn: "Salmon fillet" },
  { category: "psari", prepTimeMinutes: 16, price: 10.0, name: "Μπακαλιάρος με πατάτες τηγανητές", nameEn: "Cod with fries", description: "Μπακαλιάρος με πατάτες τηγανητές", descriptionEn: "Cod with fries" },

  /* ---- Μπύρες (age-gated, see AGE_GATED_CATEGORIES) ----------------------- */
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Έζα 500 ml", nameEn: "Eza 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Amstel 500 ml", nameEn: "Amstel 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Amstel Radler 500 ml", nameEn: "Amstel Radler 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Νήσος 500 ml", nameEn: "Nissos 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Νύμφη 500 ml", nameEn: "Nymfi 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Alfa 500 ml", nameEn: "Alfa 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Fix 500 ml", nameEn: "Fix 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.5, name: "Mammos 500 ml", nameEn: "Mammos 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.5, name: "Heineken 500 ml", nameEn: "Heineken 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.5, name: "Kaiser 500 ml", nameEn: "Kaiser 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 4.0, name: "Fischer 500 ml", nameEn: "Fischer 500 ml", description: "Μπύρα 500 ml", descriptionEn: "Beer, 500 ml" },
  { category: "mpyres", prepTimeMinutes: 1, price: 3.0, name: "Fix άνευ αλκοόλ", nameEn: "Fix alcohol-free", description: "Μπύρα χωρίς αλκοόλ", descriptionEn: "Alcohol-free beer" },

  /* ---- Κρασιά - Ποτά (age-gated, see AGE_GATED_CATEGORIES) ---------------- */
  { category: "pota"   , prepTimeMinutes: 5,  price: 6.0, name: "Ούζο ή Τσίπουρο ατομικό με μεζέ", nameEn: "Ouzo or tsipouro with meze", description: "Ατομικό ούζο ή τσίπουρο με μεζέ (γράψτε ποιο στις σημειώσεις)", descriptionEn: "Single ouzo or tsipouro with meze (note which)" },
  { category: "pota", prepTimeMinutes: 1, price: 4.0, name: "Λευκό κρασί (Κασκούτας) 0,5 lt", nameEn: "White wine (Kaskoutas) 0.5 l", description: "Λευκό κρασί, μισό λίτρο", descriptionEn: "White wine, half litre" },
  { category: "pota", prepTimeMinutes: 1, price: 4.0, name: "Ροζέ ξηρό κρασί (Λαφαζάνης) 0,5 lt", nameEn: "Dry rosé wine (Lafazanis) 0.5 l", description: "Ροζέ ξηρό κρασί, μισό λίτρο", descriptionEn: "Dry rosé wine, half litre" },
  { category: "pota", prepTimeMinutes: 1, price: 4.0, name: "Κόκκινο κρασί (Κασκούτας) 0,5 lt", nameEn: "Red wine (Kaskoutas) 0.5 l", description: "Κόκκινο κρασί, μισό λίτρο", descriptionEn: "Red wine, half litre" },
  { category: "pota", prepTimeMinutes: 1, price: 5.0, name: "Κόκκινο ημίγλυκο κρασί (Λαφαζάνης) 0,5 lt", nameEn: "Medium-sweet red wine (Lafazanis) 0.5 l", description: "Κόκκινο ημίγλυκο κρασί, μισό λίτρο", descriptionEn: "Medium-sweet red wine, half litre" },
  { category: "pota", prepTimeMinutes: 1, price: 3.0, name: "Ούζο ατομικό mini", nameEn: "Ouzo mini", description: "Ατομικό ούζο", descriptionEn: "Single-serve ouzo" },
  { category: "pota", prepTimeMinutes: 1, price: 3.0, name: "Τσίπουρο ατομικό Τσιλιλή", nameEn: "Tsililis tsipouro, single", description: "Ατομικό τσίπουρο", descriptionEn: "Single-serve tsipouro" },
  { category: "pota", prepTimeMinutes: 1, price: 3.0, name: "Τσίπουρο ατομικό Αποστολάκη", nameEn: "Apostolakis tsipouro, single", description: "Ατομικό τσίπουρο", descriptionEn: "Single-serve tsipouro" },
  { category: "pota", prepTimeMinutes: 1, price: 8.0, name: "Ούζο - Τσίπουρο (Κασκούτας) 250 ml", nameEn: "Ouzo / tsipouro (Kaskoutas) 250 ml", description: "Γράψτε ούζο ή τσίπουρο στις σημειώσεις", descriptionEn: "Note ouzo or tsipouro" },

  /* ---- Καφέδες --------------------------------------------------------- */
  { category: "kafedes", prepTimeMinutes: 4, price: 1.8, name: "Ελληνικός καφές", nameEn: "Greek coffee", description: "Μονός, στο μπρίκι", descriptionEn: "Single, brewed in a briki" },
  { category: "kafedes", prepTimeMinutes: 4, price: 2.2, name: "Espresso", nameEn: "Espresso", description: "Μονός ή διπλός", descriptionEn: "Single or double" },
  { category: "kafedes", prepTimeMinutes: 4, price: 2.8, name: "Freddo espresso", nameEn: "Freddo espresso", description: "Παγωμένος espresso, χτυπητός", descriptionEn: "Iced, shaken espresso" },
  { category: "kafedes", prepTimeMinutes: 4, price: 3.2, name: "Freddo cappuccino", nameEn: "Freddo cappuccino", description: "Με αφρόγαλα", descriptionEn: "With cold milk foam" },
  { category: "kafedes", prepTimeMinutes: 4, price: 3.0, name: "Cappuccino", nameEn: "Cappuccino", description: "Ζεστός, με αφρόγαλα", descriptionEn: "Hot, with milk foam" },
  { category: "kafedes", prepTimeMinutes: 4, price: 3.2, name: "Latte", nameEn: "Latte", description: "Espresso με ζεστό γάλα", descriptionEn: "Espresso with steamed milk" },
  { category: "kafedes", prepTimeMinutes: 4, price: 2.6, name: "Φραπέ", nameEn: "Frappe", description: "Κλασικός ελληνικός φραπές", descriptionEn: "The classic Greek frappe" },
  { category: "kafedes", prepTimeMinutes: 4, price: 2.4, name: "Φίλτρου", nameEn: "Filter coffee", description: "Καφές φίλτρου, ζεστός ή κρύος", descriptionEn: "Filter coffee, hot or iced" },

  /* ---- Ροφήματα -------------------------------------------------------- */
  { category: "rofimata", prepTimeMinutes: 4, price: 2.5, name: "Τσάι", nameEn: "Tea", description: "Μαύρο, πράσινο ή βοτάνων", descriptionEn: "Black, green or herbal" },
  { category: "rofimata", prepTimeMinutes: 5, price: 3.5, name: "Ζεστή σοκολάτα", nameEn: "Hot chocolate", description: "Πυκνή, με κακάο", descriptionEn: "Thick, with cocoa" },
  { category: "rofimata", prepTimeMinutes: 4, price: 3.0, name: "Σαλέπι", nameEn: "Salep", description: "Ζεστό, με κανέλα", descriptionEn: "Hot, with cinnamon" },
  { category: "rofimata", prepTimeMinutes: 4, price: 3.4, name: "Βαλεριάνα / Χαμομήλι", nameEn: "Herbal infusion", description: "Ρόφημα βοτάνων", descriptionEn: "Herbal infusion" },

  /* ---- Χυμοί ----------------------------------------------------------- */
  { category: "chymoi", prepTimeMinutes: 5, price: 3.5, name: "Φρέσκος χυμός πορτοκάλι", nameEn: "Fresh orange juice", description: "Στιγμής, από φρέσκα πορτοκάλια", descriptionEn: "Squeezed to order" },
  { category: "chymoi", prepTimeMinutes: 5, price: 4.5, name: "Smoothie φρούτων", nameEn: "Fruit smoothie", description: "Μπανάνα, φράουλα, γιαούρτι", descriptionEn: "Banana, strawberry, yoghurt" },
  { category: "chymoi", prepTimeMinutes: 3, price: 2.2, name: "Χυμός συσκευασίας", nameEn: "Bottled juice", description: "Πορτοκάλι, ροδάκινο ή ανάμεικτος", descriptionEn: "Orange, peach or mixed" },
  { category: "chymoi", prepTimeMinutes: 5, price: 4.2, name: "Λεμονάδα σπιτική", nameEn: "House lemonade", description: "Φρέσκο λεμόνι, δυόσμος, πάγος", descriptionEn: "Fresh lemon, mint, ice" },

  /* ---- Αναψυκτικά ------------------------------------------------------ */
  { category: "anapsyktika", prepTimeMinutes: 2, price: 2.0, name: "Coca-Cola", nameEn: "Coca-Cola", description: "330ml, κανονική ή zero", descriptionEn: "330ml, regular or zero" },
  { category: "anapsyktika", prepTimeMinutes: 2, price: 2.0, name: "Πορτοκαλάδα", nameEn: "Orangeade", description: "330ml, ανθρακούχα", descriptionEn: "330ml, sparkling" },
  { category: "anapsyktika", prepTimeMinutes: 2, price: 2.0, name: "Λεμονάδα", nameEn: "Lemonade", description: "330ml, ανθρακούχα", descriptionEn: "330ml, sparkling" },
  { category: "anapsyktika", prepTimeMinutes: 2, price: 2.2, name: "Σόδα / Τόνικ", nameEn: "Soda / Tonic", description: "250ml", descriptionEn: "250ml" },
  { category: "anapsyktika", prepTimeMinutes: 2, price: 0.6, name: "Νερό 500ml", nameEn: "Water 500ml", description: "Εμφιαλωμένο", descriptionEn: "Bottled" },
  { category: "anapsyktika", prepTimeMinutes: 2, price: 1.2, name: "Νερό 1.5L", nameEn: "Water 1.5L", description: "Εμφιαλωμένο", descriptionEn: "Bottled" },

];

async function main() {
  console.log(`Seeding ${items.length} menu items...`);

  // Per-category sort order follows the order items appear in this file.
  const counters = new Map<string, number>();

  for (const item of items) {
    const sortOrder = (counters.get(item.category) ?? 0) + 1;
    counters.set(item.category, sortOrder);

    // Age gating is derived from the category, never hand-set per item, so a new
    // spirit added to Ποτά can never be forgotten.
    const requiresAgeVerification = AGE_GATED_CATEGORIES.includes(item.category);

    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name, category: item.category },
    });

    const data = {
      name: item.name,
      nameEn: item.nameEn,
      description: item.description,
      descriptionEn: item.descriptionEn,
      price: new Prisma.Decimal(item.price.toFixed(2)),
      category: item.category,
      available: true,
      prepTimeMinutes: item.prepTimeMinutes,
      requiresAgeVerification,
      sortOrder,
      // Category/keyword default. Overridden per item from /admin/menu once
      // real Rouveraki photography exists.
      image: photoForItem(item.name, item.category),
    };

    if (existing) {
      await prisma.menuItem.update({ where: { id: existing.id }, data });
    } else {
      await prisma.menuItem.create({ data });
    }
  }

  // Anything not in this list (the old placeholder menu) is hidden, not
  // deleted, so past orders keep their rows. Re-enable one from /admin/menu.
  const keep = new Set(items.map((i) => `${i.category}|${i.name}`));
  const stale = (await prisma.menuItem.findMany({ where: { available: true }, select: { id: true, name: true, category: true } }))
    .filter((m) => !keep.has(`${m.category}|${m.name}`))
    .map((m) => m.id);
  if (stale.length) {
    await prisma.menuItem.updateMany({ where: { id: { in: stale } }, data: { available: false } });
    console.log(`Hid ${stale.length} items that are no longer on the menu.`);
  }

  const total = await prisma.menuItem.count();
  const gated = await prisma.menuItem.count({
    where: { requiresAgeVerification: true },
  });
  console.log(`Done. ${total} items in the database, ${gated} age-gated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
