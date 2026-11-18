// Ρουβεράκι · Παραγγελίες: Windows app for the shop screen.
//
// One small .exe, no installer. The first run copies it to
// %LOCALAPPDATA%\RouverakiOrders, adds a Desktop and a Start Menu icon and
// starts it with Windows (so delivery reopens by itself after a restart), then
// opens the shop screen in its own window. Every later run just opens it.
//
// The window is Microsoft Edge (or Chrome) in app mode with its own profile,
// so it has no address bar or tabs, remembers the shop code, prints tickets
// straight to the default printer (--kiosk-printing, no print dialog), plays
// the order sound without a tap first, and keeps checking for orders while
// minimised.
//
// Build (no SDK needed, the compiler ships with Windows), from this folder:
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe -codepage:65001
//     -target:winexe -win32icon:app.ico -r:System.Windows.Forms.dll
//     -out:..\..\public\downloads\Rouveraki-Paragelies.exe RouverakiOrders.cs
// Run with --uninstall to remove the icons and auto-start.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Rouveraki Paragelies")]
[assembly: AssemblyProduct("Rouveraki Paragelies")]
[assembly: AssemblyCompany("Rouveraki")]
[assembly: AssemblyVersion("1.0.0.0")]

static class RouverakiOrders
{
    const string Url = "https://rouveraki.com/demo-kitchen";
    const string Name = "Ρουβεράκι Παραγγελίες";

    static string Home
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RouverakiOrders"); }
    }

    [STAThread]
    static void Main(string[] args)
    {
        try
        {
            if (args.Length > 0 && args[0] == "--uninstall") { Uninstall(); return; }
            string installed = Path.Combine(Home, "Rouveraki-Paragelies.exe");
            string self = Assembly.GetExecutingAssembly().Location;
            bool firstRun = !File.Exists(installed);
            if (!string.Equals(Path.GetFullPath(self), Path.GetFullPath(installed), StringComparison.OrdinalIgnoreCase))
            {
                Directory.CreateDirectory(Home);
                File.Copy(self, installed, true);
                MakeShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Name + ".lnk"), installed);
                MakeShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Name + ".lnk"), installed);
                MakeShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), Name + ".lnk"), installed);
            }
            Open();
            if (firstRun)
                MessageBox.Show(
                    "Η εφαρμογή εγκαταστάθηκε.\n\n" +
                    "• Εικονίδιο «" + Name + "» στην επιφάνεια εργασίας.\n" +
                    "• Ανοίγει μόνη της όταν ανοίγει ο υπολογιστής.\n" +
                    "• Όσο είναι ανοιχτή, η διανομή είναι ανοιχτή στο site.\n\n" +
                    "Βάλε τον κωδικό του καταστήματος μία φορά.",
                    Name, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception e)
        {
            MessageBox.Show("Δεν άνοιξε η εφαρμογή:\n" + e.Message, Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    static string Browser()
    {
        string x86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates = {
            Path.Combine(x86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(x86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };
        foreach (string c in candidates) if (File.Exists(c)) return c;
        throw new Exception("Δεν βρέθηκε Microsoft Edge ή Google Chrome.");
    }

    static void Open()
    {
        string profile = Path.Combine(Home, "profile");
        string flags =
            "--app=\"" + Url + "\" " +
            "--user-data-dir=\"" + profile + "\" " +
            "--kiosk-printing " +
            "--autoplay-policy=no-user-gesture-required " +
            "--disable-background-timer-throttling " +
            "--disable-renderer-backgrounding " +
            "--disable-backgrounding-occluded-windows " +
            "--no-first-run --no-default-browser-check " +
            "--window-size=1280,860";
        Process.Start(new ProcessStartInfo(Browser(), flags) { UseShellExecute = false });
    }

    static void MakeShortcut(string lnk, string target)
    {
        Type t = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(t);
        object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
        Type st = sc.GetType();
        st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
        st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { Path.GetDirectoryName(target) });
        st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { target + ",0" });
        st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { "Οθόνη παραγγελιών Ρουβεράκι" });
        st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
    }

    static void Uninstall()
    {
        Environment.SpecialFolder[] places = {
            Environment.SpecialFolder.DesktopDirectory,
            Environment.SpecialFolder.Programs,
            Environment.SpecialFolder.Startup,
        };
        foreach (Environment.SpecialFolder f in places)
        {
            string p = Path.Combine(Environment.GetFolderPath(f), Name + ".lnk");
            if (File.Exists(p)) File.Delete(p);
        }
        MessageBox.Show("Αφαιρέθηκαν τα εικονίδια και η αυτόματη εκκίνηση.", Name);
    }
}
