import { IS_TEST_DEPLOY } from "@/lib/site-mode";
import { DEMO_MODE } from "@/lib/demo/config";

/**
 * Sits above the sticky header in normal flow, so it is the first thing on
 * every page load and scrolls away without offsetting anything below it.
 *
 * Both languages at once rather than following the toggle: this is a server
 * component with no access to the visitor's choice, and a warning that only
 * shows in the language you did not pick is not a warning.
 */
export default function QaBanner() {
  if (!IS_TEST_DEPLOY) return null;
  if (DEMO_MODE) {
    return (
      <div
        role="note"
        className="bg-accent px-4 py-2 text-center text-sm font-semibold leading-snug text-onaccent"
      >
        DEMO: παρουσίαση χωρίς πραγματικές παραγγελίες ή χρεώσεις.
        <span className="mx-2 opacity-60" aria-hidden="true">·</span>
        <span lang="en">Demo only: no real orders, nothing is charged.</span>
      </div>
    );
  }
  return (
    <div
      role="note"
      className="bg-accent px-4 py-2 text-center text-sm font-semibold leading-snug text-onaccent"
    >
      Δοκιμαστική έκδοση: οι παραγγελίες δεν εκτελούνται και δεν γίνεται χρέωση.
      <span className="mx-2 opacity-60" aria-hidden="true">·</span>
      <span lang="en">Test version: orders are not fulfilled and nothing is charged.</span>
    </div>
  );
}
