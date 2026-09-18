/**
 * Menu seed.
 *
 * TODO:OWNER — the twelve CATEGORIES are confirmed (spec §0), but Rouveraki does
 * not publish a full item list or prices anywhere public. The items below are a
 * realistic Greek café / grill-house / bar menu used so the site is buildable
 * and demoable end to end. Every name and price must be replaced with the real
 * menu before launch. Nothing else in the codebase hardcodes an item.
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
  /* ---- Πίτες ----------------------------------------------------------- */
  { category: "pites", prepTimeMinutes: 10, price: 3.9, name: "Πίτα γύρο χοιρινό", nameEn: "Pork gyros pita", description: "Χοιρινός γύρος, τζατζίκι, ντομάτα, κρεμμύδι, πατάτες", descriptionEn: "Pork gyros, tzatziki, tomato, onion, fries" },
  { category: "pites", prepTimeMinutes: 10, price: 4.1, name: "Πίτα γύρο κοτόπουλο", nameEn: "Chicken gyros pita", description: "Γύρος κοτόπουλο, σως γιαουρτιού, ντομάτα, κρεμμύδι, πατάτες", descriptionEn: "Chicken gyros, yoghurt sauce, tomato, onion, fries" },
  { category: "pites", prepTimeMinutes: 10, price: 3.9, name: "Πίτα σουβλάκι χοιρινό", nameEn: "Pork souvlaki pita", description: "Καλαμάκι χοιρινό, τζατζίκι, ντομάτα, κρεμμύδι, πατάτες", descriptionEn: "Pork skewer, tzatziki, tomato, onion, fries" },
  { category: "pites", prepTimeMinutes: 10, price: 4.1, name: "Πίτα σουβλάκι κοτόπουλο", nameEn: "Chicken souvlaki pita", description: "Καλαμάκι κοτόπουλο, σως γιαουρτιού, ντομάτα, κρεμμύδι, πατάτες", descriptionEn: "Chicken skewer, yoghurt sauce, tomato, onion, fries" },
  { category: "pites", prepTimeMinutes: 12, price: 4.5, name: "Πίτα μπιφτέκι", nameEn: "Bifteki pita", description: "Μπιφτέκι μοσχαρίσιο, τζατζίκι, ντομάτα, κρεμμύδι, πατάτες", descriptionEn: "Beef patty, tzatziki, tomato, onion, fries" },
  { category: "pites", prepTimeMinutes: 10, price: 4.3, name: "Πίτα λουκάνικο", nameEn: "Sausage pita", description: "Χωριάτικο λουκάνικο, μουστάρδα, ντομάτα, κρεμμύδι, πατάτες", descriptionEn: "Village sausage, mustard, tomato, onion, fries" },
  { category: "pites", prepTimeMinutes: 9,  price: 3.6, name: "Πίτα λαχανικών", nameEn: "Veggie pita", description: "Ψητά λαχανικά, τζατζίκι, ντομάτα, μαρούλι, πατάτες", descriptionEn: "Grilled vegetables, tzatziki, tomato, lettuce, fries" },
  { category: "pites", prepTimeMinutes: 10, price: 4.6, name: "Πίτα special Ρουβεράκι", nameEn: "Rouveraki special pita", description: "Γύρος, μπέικον, τυρί, σως του καταστήματος, πατάτες", descriptionEn: "Gyros, bacon, cheese, house sauce, fries" },

  /* ---- Σουβλάκια ------------------------------------------------------- */
  { category: "souvlakia", prepTimeMinutes: 14, price: 11.5, name: "Μερίδα σουβλάκι χοιρινό", nameEn: "Pork souvlaki platter", description: "Τρία καλαμάκια, πίτα, πατάτες, τζατζίκι, σαλάτα", descriptionEn: "Three skewers, pita, fries, tzatziki, salad" },
  { category: "souvlakia", prepTimeMinutes: 14, price: 12.5, name: "Μερίδα σουβλάκι κοτόπουλο", nameEn: "Chicken souvlaki platter", description: "Τρία καλαμάκια κοτόπουλο, πίτα, πατάτες, σως γιαουρτιού", descriptionEn: "Three chicken skewers, pita, fries, yoghurt sauce" },
  { category: "souvlakia", prepTimeMinutes: 16, price: 14.9, name: "Μικτή μερίδα", nameEn: "Mixed grill platter", description: "Γύρος, καλαμάκι, λουκάνικο, μπιφτέκι, πίτες, πατάτες", descriptionEn: "Gyros, skewer, sausage, bifteki, pitas, fries" },
  { category: "souvlakia", prepTimeMinutes: 16, price: 13.9, name: "Μερίδα μπιφτέκι", nameEn: "Bifteki platter", description: "Δύο μπιφτέκια, πίτα, πατάτες, σαλάτα εποχής", descriptionEn: "Two beef patties, pita, fries, seasonal salad" },
  { category: "souvlakia", prepTimeMinutes: 18, price: 16.5, name: "Μερίδα παϊδάκια", nameEn: "Lamb chops platter", description: "Αρνίσια παϊδάκια, πατάτες, λεμόνι, ρίγανη", descriptionEn: "Lamb chops, fries, lemon, oregano" },
  { category: "souvlakia", prepTimeMinutes: 16, price: 13.5, name: "Μερίδα λουκάνικο", nameEn: "Sausage platter", description: "Χωριάτικο λουκάνικο, πατάτες, μουστάρδα, πίτα", descriptionEn: "Village sausage, fries, mustard, pita" },

  /* ---- Γύρος ----------------------------------------------------------- */
  { category: "gyros", prepTimeMinutes: 12, price: 10.5, name: "Μερίδα γύρος χοιρινός", nameEn: "Pork gyros platter", description: "Γύρος χοιρινός, πίτα, πατάτες, τζατζίκι, ντομάτα, κρεμμύδι", descriptionEn: "Pork gyros, pita, fries, tzatziki, tomato, onion" },
  { category: "gyros", prepTimeMinutes: 12, price: 11.5, name: "Μερίδα γύρος κοτόπουλο", nameEn: "Chicken gyros platter", description: "Γύρος κοτόπουλο, πίτα, πατάτες, σως γιαουρτιού", descriptionEn: "Chicken gyros, pita, fries, yoghurt sauce" },
  { category: "gyros", prepTimeMinutes: 12, price: 8.9,  name: "Γύρος σε μπολ", nameEn: "Gyros bowl", description: "Γύρος με ρύζι, λαχανικά και σως, χωρίς πίτα", descriptionEn: "Gyros over rice with vegetables and sauce, no pita" },
  { category: "gyros", prepTimeMinutes: 13, price: 12.9, name: "Γύρος special", nameEn: "Gyros special", description: "Διπλή μερίδα γύρο, δύο πίτες, πατάτες, τρεις σως", descriptionEn: "Double gyros, two pitas, fries, three sauces" },

  /* ---- Καλαμάκια ------------------------------------------------------- */
  { category: "kalamakia", prepTimeMinutes: 8,  price: 2.6, name: "Καλαμάκι χοιρινό", nameEn: "Pork kalamaki", description: "Ένα καλαμάκι χοιρινό με ψωμί", descriptionEn: "One pork skewer with bread" },
  { category: "kalamakia", prepTimeMinutes: 8,  price: 2.8, name: "Καλαμάκι κοτόπουλο", nameEn: "Chicken kalamaki", description: "Ένα καλαμάκι κοτόπουλο με ψωμί", descriptionEn: "One chicken skewer with bread" },
  { category: "kalamakia", prepTimeMinutes: 9,  price: 3.2, name: "Καλαμάκι λουκάνικο", nameEn: "Sausage kalamaki", description: "Χωριάτικο λουκάνικο στα κάρβουνα", descriptionEn: "Charcoal-grilled village sausage" },
  { category: "kalamakia", prepTimeMinutes: 10, price: 3.4, name: "Κοντοσούβλι", nameEn: "Kontosouvli", description: "Χοιρινό κοντοσούβλι, μερίδα καλαμακιού", descriptionEn: "Pork kontosouvli, single portion" },
  { category: "kalamakia", prepTimeMinutes: 8,  price: 2.9, name: "Καλαμάκι λαχανικών", nameEn: "Vegetable kalamaki", description: "Πιπεριά, κολοκύθι, μανιτάρι, κρεμμύδι", descriptionEn: "Pepper, courgette, mushroom, onion" },

  /* ---- Ζυμαρικά -------------------------------------------------------- */
  { category: "zymarika", prepTimeMinutes: 15, price: 9.5,  name: "Καρμπονάρα", nameEn: "Carbonara", description: "Ταλιατέλες, μπέικον, κρέμα, παρμεζάνα", descriptionEn: "Tagliatelle, bacon, cream, parmesan" },
  { category: "zymarika", prepTimeMinutes: 15, price: 8.9,  name: "Ναπολιτέν", nameEn: "Napolitana", description: "Σπαγγέτι με φρέσκια σάλτσα ντομάτας και βασιλικό", descriptionEn: "Spaghetti with fresh tomato sauce and basil" },
  { category: "zymarika", prepTimeMinutes: 16, price: 10.9, name: "Πένες με κοτόπουλο", nameEn: "Penne with chicken", description: "Πένες, κοτόπουλο, μανιτάρια, κρέμα γάλακτος", descriptionEn: "Penne, chicken, mushrooms, cream" },
  { category: "zymarika", prepTimeMinutes: 18, price: 11.9, name: "Παστίτσιο", nameEn: "Pastitsio", description: "Παραδοσιακό παστίτσιο με μπεσαμέλ", descriptionEn: "Traditional pastitsio with béchamel" },
  { category: "zymarika", prepTimeMinutes: 16, price: 11.5, name: "Γιουβέτσι", nameEn: "Giouvetsi", description: "Μοσχάρι με κριθαράκι στον φούρνο", descriptionEn: "Oven-baked beef with orzo" },

  /* ---- Ορεκτικά -------------------------------------------------------- */
  { category: "orektika", prepTimeMinutes: 8,  price: 3.5, name: "Τζατζίκι", nameEn: "Tzatziki", description: "Στραγγιστό γιαούρτι, αγγούρι, σκόρδο", descriptionEn: "Strained yoghurt, cucumber, garlic" },
  { category: "orektika", prepTimeMinutes: 8,  price: 3.8, name: "Τυροκαυτερή", nameEn: "Tirokafteri", description: "Πικάντικη τυροσαλάτα με φέτα και πιπεριά", descriptionEn: "Spicy feta and pepper spread" },
  { category: "orektika", prepTimeMinutes: 10, price: 4.2, name: "Πατάτες τηγανητές", nameEn: "French fries", description: "Φρέσκιες πατάτες, ρίγανη, αλάτι", descriptionEn: "Fresh-cut fries, oregano, salt" },
  { category: "orektika", prepTimeMinutes: 12, price: 5.5, name: "Πατάτες με τυρί και μπέικον", nameEn: "Loaded fries", description: "Πατάτες, λιωμένο τυρί, μπέικον, σως", descriptionEn: "Fries, melted cheese, bacon, sauce" },
  { category: "orektika", prepTimeMinutes: 12, price: 6.5, name: "Σαγανάκι", nameEn: "Saganaki", description: "Τηγανητό κεφαλοτύρι με λεμόνι", descriptionEn: "Pan-fried kefalotyri with lemon" },
  { category: "orektika", prepTimeMinutes: 12, price: 5.9, name: "Κολοκυθοκεφτέδες", nameEn: "Courgette fritters", description: "Με δυόσμο και σως γιαουρτιού", descriptionEn: "With mint and yoghurt sauce" },
  { category: "orektika", prepTimeMinutes: 10, price: 4.9, name: "Ψωμάκια σκόρδου", nameEn: "Garlic bread", description: "Ψητό ψωμί με σκόρδο και βούτυρο", descriptionEn: "Toasted bread with garlic butter" },
  { category: "orektika", prepTimeMinutes: 14, price: 7.5, name: "Φτερούγες κοτόπουλου", nameEn: "Chicken wings", description: "Έξι τεμάχια, BBQ ή καυτερή σως", descriptionEn: "Six pieces, BBQ or hot sauce" },

  /* ---- Σαλάτες --------------------------------------------------------- */
  { category: "salates", prepTimeMinutes: 8,  price: 7.5, name: "Χωριάτικη", nameEn: "Greek salad", description: "Ντομάτα, αγγούρι, φέτα, ελιές, κρεμμύδι, ρίγανη", descriptionEn: "Tomato, cucumber, feta, olives, onion, oregano" },
  { category: "salates", prepTimeMinutes: 8,  price: 8.5, name: "Σαλάτα του Καίσαρα", nameEn: "Caesar salad", description: "Μαρούλι, κοτόπουλο, κρουτόν, παρμεζάνα", descriptionEn: "Lettuce, chicken, croutons, parmesan" },
  { category: "salates", prepTimeMinutes: 8,  price: 7.9, name: "Πράσινη σαλάτα", nameEn: "Green salad", description: "Ανάμεικτα πράσινα, ξηροί καρποί, βινεγκρέτ", descriptionEn: "Mixed greens, nuts, vinaigrette" },
  { category: "salates", prepTimeMinutes: 8,  price: 8.9, name: "Σαλάτα με γύρο", nameEn: "Gyros salad", description: "Ανάμεικτα λαχανικά με γύρο και σως γιαουρτιού", descriptionEn: "Mixed vegetables with gyros and yoghurt sauce" },

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

  /* ---- Ποτά (age-gated, see AGE_GATED_CATEGORIES) ----------------------- */
  { category: "pota", prepTimeMinutes: 3, price: 3.5, name: "Μπύρα 330ml", nameEn: "Beer 330ml", description: "Ελληνική ή εισαγωγής", descriptionEn: "Greek or imported" },
  { category: "pota", prepTimeMinutes: 3, price: 5.0, name: "Μπύρα 500ml", nameEn: "Beer 500ml", description: "Ελληνική ή εισαγωγής", descriptionEn: "Greek or imported" },
  { category: "pota", prepTimeMinutes: 3, price: 4.5, name: "Κρασί ποτήρι", nameEn: "Wine by the glass", description: "Λευκό, ροζέ ή κόκκινο", descriptionEn: "White, rosé or red" },
  { category: "pota", prepTimeMinutes: 3, price: 16.0, name: "Κρασί φιάλη", nameEn: "Wine bottle", description: "750ml, επιλογή καταστήματος", descriptionEn: "750ml, house selection" },
  { category: "pota", prepTimeMinutes: 3, price: 4.0, name: "Τσίπουρο", nameEn: "Tsipouro", description: "Καραφάκι 100ml, με ή χωρίς γλυκάνισο", descriptionEn: "100ml carafe, with or without anise" },
  { category: "pota", prepTimeMinutes: 3, price: 4.0, name: "Ούζο", nameEn: "Ouzo", description: "Καραφάκι 100ml", descriptionEn: "100ml carafe" },
  { category: "pota", prepTimeMinutes: 4, price: 8.0, name: "Ποτό απλό", nameEn: "Spirit, single", description: "Ουίσκι, βότκα, τζιν ή ρούμι με αναψυκτικό", descriptionEn: "Whisky, vodka, gin or rum with a mixer" },
  { category: "pota", prepTimeMinutes: 5, price: 9.0, name: "Cocktail", nameEn: "Cocktail", description: "Επιλογή από τη λίστα του μπαρ", descriptionEn: "From the bar list" },
  { category: "pota", prepTimeMinutes: 3, price: 6.0, name: "Aperol Spritz", nameEn: "Aperol Spritz", description: "Aperol, prosecco, σόδα, πορτοκάλι", descriptionEn: "Aperol, prosecco, soda, orange" },
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
