# Crack

Gemeinsame Koch- und Einkaufs-App für zwei Personen. Sie läuft als Web-App (PWA) auf iPhone und Android, alle Daten
synchronisieren sich in Echtzeit zwischen beiden Handys.

**Aktueller Stand: Phase 1.** Einkaufsliste (auch offline), Notizen, Rezepte von Hand anlegen, Kategorien, Tags und
Sterne-Bewertung sind fertig.

- **Phase 2:** Rezept-Import per Link und Screenshot, Anpassungen bei Bewertungen, Glücksrad
- **Phase 3:** Entdecken-Tab mit Geschmacksprofil, KI-Vorschlägen und Reste-Modus
- **Phase 4:** Zutaten aus einem Rezept auf die Einkaufsliste übernehmen

## Technik

| Bereich | Lösung |
| --- | --- |
| Oberfläche | React, TypeScript, Vite, Tailwind CSS |
| App auf dem Handy | PWA mit Service Worker (vite-plugin-pwa) |
| Hosting | GitHub Pages, automatisch per GitHub Actions |
| Daten, Login, Live-Sync, Bilder | Supabase (Postgres, Auth, Realtime, Storage) |

Die Datenbankstruktur liegt in `supabase/migrations/`.

## Einrichtung Schritt für Schritt

Die Befehle sind für Windows (PowerShell) und werden im Projektordner ausgeführt. Ersetze `DEIN-NAME` durch deinen
GitHub-Benutzernamen und `DEINE-PROJEKT-ID` durch die Supabase-Projekt-ID.

### 1. Werkzeuge installieren

Node.js und Git müssen vorhanden sein. Dazu kommt die GitHub CLI:

```bash
winget install --id GitHub.cli -e
```

Danach das Terminal einmal schließen und neu öffnen. Die Supabase CLI braucht keine Installation, sie läuft über
`npx supabase`.

### 2. GitHub-Repository anlegen

```bash
gh auth login
```

```bash
gh repo create crack --public --source=. --remote=origin
```

```bash
git add . && git commit -m "Phase 1" && git push -u origin main
```

Aktiviere anschließend im Repository unter **Settings → Advanced Security** die Optionen **Secret scanning** und
**Push protection**. GitHub blockt dann versehentlich hochgeladene Schlüssel.

### 3. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) anmelden und **New project** wählen. Name: `crack`, Region: Frankfurt
   (`eu-central-1`). Das Datenbank-Passwort sicher im Passwort-Manager speichern.
2. Die Projekt-ID steht unter **Project Settings → General**.
3. Projekt verknüpfen und die Datenbank anlegen. Das richtet auch alle Zugriffsregeln (RLS) und den privaten
   Bilder-Speicher ein:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref DEINE-PROJEKT-ID
```

```bash
npx supabase db push
```

### 4. GitHub Pages aktivieren und Zugangsdaten setzen

1. Im Repository unter **Settings → Pages** bei **Source** die Option **GitHub Actions** wählen.
2. Im Supabase-Dashboard unter **Project Settings → API** die **Project URL** und den **anon key** kopieren. Wird dort
   statt des anon key ein **Publishable key** angezeigt (beginnt mit `sb_publishable_`), nimm diesen.
3. Beide Werte als GitHub-Secrets speichern. Der Befehl fragt den Wert jeweils ab, er landet also nicht in der
   Befehlshistorie:

```bash
gh secret set VITE_SUPABASE_URL
```

```bash
gh secret set VITE_SUPABASE_ANON_KEY
```

4. Veröffentlichung starten:

```bash
gh workflow run "Deploy auf GitHub Pages"
```

Die App liegt danach unter `https://DEIN-NAME.github.io/crack/`.

Beide Werte sind für das Frontend gedacht und im Browser sichtbar. Geschützt werden die Daten durch den Login und die
Zugriffsregeln in der Datenbank.

### 5. Adresse in Supabase eintragen

Im Supabase-Dashboard unter **Authentication → URL Configuration**:

- **Site URL:** `https://DEIN-NAME.github.io/crack/`
- **Redirect URLs:** dieselbe Adresse hinzufügen

### 6. Eure zwei Konten anlegen und Registrierung sperren

1. Im Supabase-Dashboard unter **Authentication → Users → Add user → Create new user** beide Konten anlegen und
   **Auto Confirm User** aktivieren.
2. **Sofort danach** unter **Authentication → Sign In / Providers** die Option **Allow new users to sign up**
   ausschalten. Eure Konten funktionieren weiter, aber niemand sonst kann sich registrieren.
3. In der App mit dem ersten Konto anmelden, Namen eintragen und **Haushalt anlegen** wählen.
4. Unter **Einstellungen** (Zahnrad oben rechts) den Einladungscode kopieren und der zweiten Person schicken.
5. Die zweite Person meldet sich an, wählt **Beitreten** und gibt den Code ein. Der Haushalt ist auf zwei Personen
   begrenzt, der Code ist danach wertlos.

Passwort vergessen? In Phase 1 gibt es dafür keine E-Mail-Funktion. Du kannst das Passwort im Dashboard unter
**Authentication → Users** neu setzen.

### 7. KI-Schlüssel (erst ab Phase 2)

1. In der [Claude Console](https://console.anthropic.com) einen API-Key erstellen. **Auto-Reload aus lassen**, dann
   kann nie mehr als das aufgeladene Guthaben verbraucht werden.
2. Den Key selbst im Terminal eintragen, niemals in einen Chat oder eine Datei kopieren:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=DEIN-KEY
```

Die genauen Schritte zum Deployen der Edge Functions folgen mit Phase 2.

### 8. App auf den Handys installieren

- **iPhone:** Adresse in **Safari** öffnen, dann **Teilen → Zum Home-Bildschirm**.
- **Android:** Adresse in **Chrome** öffnen, dann **⋮ → App installieren**.

### 9. So kommen Updates auf die Handys

Jeder Push auf `main` baut und veröffentlicht die App automatisch, das dauert etwa zwei Minuten. Die Handys prüfen beim
Öffnen und danach stündlich auf eine neue Version. Sie laden sie beim Start oder im Hintergrund von selbst. Ist die App
gerade offen, erscheint oben der Hinweis **Neue Version – neu laden**, damit keine Eingabe verloren geht.

Änderungen an der Datenbank (neue Dateien in `supabase/migrations/`) spielst du zusätzlich mit `npx supabase db push` ein.

## Sicherheit

- Ohne Login ist nur die Anmeldeseite sichtbar.
- Row Level Security ist auf allen Tabellen und im Bilder-Speicher aktiv. Nur Mitglieder des Haushalts haben Zugriff.
- Geheime Schlüssel gehören nie in dieses öffentliche Repository, `.env`-Dateien sind per `.gitignore` ausgeschlossen.

## Lokal entwickeln

```bash
npm install
```

Kopiere `.env.example` nach `.env.local`, trage die Werte ein und starte die App:

```bash
npm run dev
```

Tests laufen mit `npm test`, den fertigen Build erzeugt `npm run build`.

## Gut zu wissen

- **Pausierung:** Supabase pausiert kostenlose Projekte nach etwa einer Woche ohne jede Nutzung. Im Dashboard lässt sich
  das Projekt wieder starten, die Daten bleiben erhalten.
- **Offline:** Die Einkaufsliste lässt sich offline lesen, abhaken und ergänzen. Rezepte und Notizen sind offline nur
  lesbar, soweit sie schon einmal geladen wurden. Neue Notizen brauchen Internet, Notizen werden erst bei Verbindung
  gespeichert.
- **Gleichzeitiges Bearbeiten:** Schreibt ihr zur selben Zeit in dieselbe Notiz, gewinnt die zuletzt gespeicherte
  Fassung. In der Einkaufsliste gibt es dieses Problem nicht, weil jede Änderung einzeln übertragen wird.
