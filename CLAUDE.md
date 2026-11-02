# Crack: Übergabe für die nächste Sitzung

Koch- und Einkaufs-App (PWA) für zwei Personen. Der Besitzer ist kein Profi-Entwickler: Antworten auf Deutsch und
verständlich, alles Mögliche selbst im Terminal erledigen. Dieses Repository ist **öffentlich**.

## Wo alles liegt

- **App:** https://joernsvw.github.io/crack/ (GitHub Pages, jeder Push auf `main` baut und veröffentlicht automatisch)
- **Repository:** https://github.com/joernsvw/crack
- **Supabase-Projekt:** Referenz `evivnwegejuylkpwgcfb`, Region Frankfurt
- **Edge Function:** eine einzige, `import-recipe`, mit mehreren Aktionen: Link-Import, `recipe_id` (Anpassen),
  `action: screenshots`, `action: suggest`, `action: leftovers`
- **Secrets:** `ANTHROPIC_API_KEY` liegt bei Supabase, `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` bei GitHub. Lokal
  ist kein Geheimnis nötig. Den API-Key nie in den Chat oder ins Repository.

## Einrichtung auf einem neuen Rechner

```bash
npm install
```

GitHub CLI installieren und anmelden (`gh auth login`), dann bei Supabase anmelden und verknüpfen:

```bash
npx.cmd supabase login
```

```bash
npx.cmd supabase link --project-ref evivnwegejuylkpwgcfb
```

Nach einem frischen `git clone` außerdem die anonyme Autor-Adresse setzen, damit keine private E-Mail in öffentlichen
Commits landet. Die Adresse steht als Autor im letzten Commit (`git log -1 --format=%ae`):

```bash
git config user.name joernsvw
```

```bash
git config user.email "ADRESSE-AUS-DEM-LETZTEN-COMMIT"
```

```bash
git config core.autocrlf false
```

Unter Windows-PowerShell `npx.cmd` und `npm.cmd` statt `npx` und `npm` nutzen, Skripte sind dort gesperrt. Das Projekt
nicht in einem Google-Drive-Ordner bearbeiten.

## Arbeitsweise, die sich bewährt hat

- **Veröffentlichen nur nach ausdrücklichem OK.** Die Supabase-CLI und die Sicherheitsprüfung verlangen das für jede
  Änderung am Live-Projekt. „Bauen“ allein reichte nicht, also am Ende konkret fragen.
- **Reihenfolge:** erst `npx.cmd supabase db push --linked --yes`, dann
  `npx.cmd supabase functions deploy import-recipe --use-api --yes --project-ref evivnwegejuylkpwgcfb`, dann `git push`.
- **Vor jedem Commit** nach Geheimnissen und persönlichen Namen suchen. Keine echten Vornamen ins Repository.
- **Commit-Texte** in PowerShell ohne doppelte Anführungszeichen, sie zerlegen sonst den Befehl.
- **Nur `.env.local` für lokale Tests** nutzen und danach löschen, sie ist per `.gitignore` ausgeschlossen. Secrets mit
  `gh secret set NAME --body "$wert"` setzen, nicht über die Standardeingabe: PowerShell setzt dort ein unsichtbares Zeichen davor.
- **API-Schlüssel auslesen:** Die Ausgabe von `supabase projects api-keys -o json` enthält auch die geheimen Schlüssel. Nie
  ausgeben, und in PowerShell 5.1 das JSON-Array erst mit `ForEach-Object { $_ }` auflösen.
- **Modell:** `claude-opus-5-5` (änderbar über das Secret `ANTHROPIC_MODEL`). Die Claude-API-Referenz vor Änderungen an den
  KI-Aufrufen neu laden.

## Tests

```bash
npm.cmd test
```

- `scripts/dev/test-rls.mjs` prüft Migrationen und Zugriffsregeln gegen ein Postgres im Speicher. Vorher einmalig
  `npm.cmd i --no-save @electric-sql/pglite`, Aufruf mit dem Migrationsordner als Parameter.
- `scripts/dev/mock-supabase.mjs` ist eine Attrappe von Supabase auf Port 54399 für Browser-Tests. Dazu `.env.local` mit
  `VITE_SUPABASE_URL=http://localhost:54399` und einem beliebigen Schlüssel, Login-Passwort `testpass`.
- Die Attrappe prüft weder echte KI noch Realtime, und sie füllt keine Datenbank-Standardwerte. Echte KI-Tests laufen nur
  mit dem Login der beiden Nutzer: `consume_ai_call` und die Rechte brauchen ein echtes Konto.

## Stand

Fertig und online: Einkaufsliste mit Offline-Warteschlange, Notizen, Rezepte, Link-Import (TikTok, Pinterest samt
Originalrezept, Blogs), Screenshot-Import, Anpassen mit KI, Bewertungen mit Anpassungen, Entdecken (Vorschläge, Reste,
Geschmacksprofil), Zutaten auf die Einkaufsliste, Glücksrad, Umrechnung von Cups und Unzen.

Offen, jeweils noch zu beobachten:
- Am iPhone kam bei einem TikTok-Link einmal „0“ heraus. Vermutete Ursache behoben (leere Seite ging an die KI, keine
  Wiederholungen), aber nicht am iPhone bestätigt. Die Funktion protokolliert seitdem Zahlen je Import.
- Wie gut die KI Cups schätzt, ist mit echten Rezepten noch nicht geprüft.

Bewusste Entscheidungen, die nicht neu aufgerollt werden sollten:
- **Login bleibt** und läuft nur über E-Mail und Passwort. Die Registrierung ist gesperrt, es gibt keine Einladungslinks.
- **Android:** Chrome meldet unter `joernsvw.github.io` „bereits installiert“, obwohl Crack laut `chrome://webapks` fehlt.
  Es betrifft die ganze Adresse. Der Besitzer nutzt eine Verknüpfung und will nichts Weiteres. Option, falls er es doch
  möchte: eigene Adresse über eine kostenlose GitHub-Organisation. Website-Daten dort nie löschen lassen, andere Apps
  (Training) speichern ihre Daten im selben Bereich.
- **Keine Bildbearbeitung per KI:** Claude erzeugt keine Bilder, ein zweiter Dienst wäre kostenpflichtig, das wurde abgelehnt.
- **Rezeptmengen** bleiben im Original, die Umrechnung steht daneben. Erfunden wird nichts, außer jemand wünscht es
  ausdrücklich unter „Mit KI anpassen“.
