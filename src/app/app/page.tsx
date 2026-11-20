import type { Metadata } from "next";
import InstallLanding from "@/components/InstallLanding";

/**
 * rouveraki.com/app — the link to share for installing the app. Browsers never
 * install a site without one tap from the visitor, so this page puts that one
 * tap (or, on iPhone, the two Safari steps) front and centre.
 */
export const metadata: Metadata = {
  title: "Κατέβασε την εφαρμογή",
  description: "Το Ρουβεράκι σαν εφαρμογή στο κινητό σου: παραγγελία με ένα άγγιγμα.",
};

export default function AppInstallPage() {
  return <InstallLanding />;
}
