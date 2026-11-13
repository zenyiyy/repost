# TikTok Repost & Like Cleaner

Reposts und Likes auf TikTok **einzeln auswählen** oder **alle auf einmal auswählen** und dann entfernen (ent-reposten / ent-liken).

## Benutzung (Handy)

TikTok im **Browser** öffnen (nicht in der App), eingeloggt, auf **Desktop-Version** stellen
(Chrome: ⋮ → „Desktopwebsite“, Safari: „aA“ → „Desktop-Website anfordern“).

### Bookmarklet einrichten (einmalig)
1. Inhalt von [`bookmarklet.txt`](bookmarklet.txt) kopieren (auf GitHub „Raw“ öffnen → alles markieren → kopieren).
2. Irgendeine Seite als Lesezeichen speichern, Lesezeichen bearbeiten:
   Name: `TTCleaner`, URL: den kopierten Text einfügen (beginnt mit `javascript:`).

### Starten
1. Auf tiktok.com zu **deinem Profil** → Tab **Reposts** oder **Gefällt mir**.
2. Chrome Android: in die Adressleiste `TTCleaner` tippen und das Lesezeichen antippen.
   Safari iOS: Lesezeichen öffnen → `TTCleaner` antippen.
3. Unten erscheint das Panel:
   - **Reposts / Likes** – was entfernt werden soll
   - **Auswählen** – danach Videos antippen (Häkchen = ausgewählt)
   - **Alle auswählen** – scrollt automatisch bis ganz unten und wählt alles aus
   - **Keine** – Auswahl leeren
   - **Entfernen** – entfernt die ausgewählten (mit Pause zwischen jedem Video)
   - **Stopp** – hält an

Erledigte Videos werden grau, fehlgeschlagene gelb umrandet.
Erneut auf das Lesezeichen tippen blendet das Panel aus/ein.

### Alternative: Userscript
`tt-cleaner.js` ist auch ein Userscript (Tampermonkey / Firefox Android, „Userscripts“-App auf iOS).

## Hinweise
- Es werden TikToks interne Web-Endpunkte benutzt (`/tiktok/v1/upvote/delete` für Reposts,
  `/api/commit/item/digg/?type=0` für Likes). TikTok kann die jederzeit ändern.
- Zwischen den Anfragen wartet das Script 1–2,5 s; bei Rate-Limit wartet es automatisch länger.
  Bei sehr vielen Videos lieber in Etappen arbeiten.

## Entwicklung
`node build.js` erzeugt `bookmarklet.txt` aus `tt-cleaner.js`.
