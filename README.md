# Pulss

## Kas tas ir

Pulss ir maza progresīvā tīmekļa lietotne (PWA) sirdsdarbības ierakstīšanai no **Polar H10** jostas caur Web Bluetooth. Tā strādā bezsaistē, glabā ierakstus tikai ierīcē (IndexedDB) un rāda aktivitāšu vēsturi un analītiku — bez konta, bez servera, bez trešo pušu bibliotēkām.

## Prasības

- **Android + Google Chrome.** Web Bluetooth darbojas tikai Chrome (un Chromium bāzētos pārlūkos, kas to ieslēguši). Ja lietotne atvērta pārlūkā bez Web Bluetooth, sākuma ekrānā redzama brīdinājuma kartīte.
- **Polar H10** josta (ieslēgts Bluetooth ierīcē).
- **HTTPS** — Web Bluetooth un service worker strādā tikai drošā savienojumā (vai `localhost` izstrādei).

## Instalēšana

1. Atver Chrome adresi `https://gurudas-sda.github.io/pulss/`.
2. Chrome izvēlne (⋮) → **"Pievienot sākuma ekrānam"** (vai "Instalēt lietotni") — vai nospied **"Instalēt"** instalēšanas kartītē, ko lietotne piedāvā sākuma ekrānā.
3. Palaid "Pulss" no sākuma ekrāna — tā atveras pilnekrānā un strādā arī bez interneta.

## Jostas pievienošana

1. Uzvelc jostu un **samitrini elektrodus** (citādi josta signālu neuztver vai rāda "nav savienots").
2. Sākums → **"Pievienot jostu"** — Chrome parāda Bluetooth ierīču sarakstu.
3. Izvēlies **"Polar H10 …"** un apstiprini. Statuss kļūst "Savienots", parādās pulss un baterijas līmenis.

## Lietošana

1. Izvēlies **aktivitāti** (sarakstu vari papildināt un pārkārtot sadaļā "Aktivitātes").
2. **Sākt** — ieraksta ekrānā redzams pulss, vid./maks./min. un pēdējo 5 minūšu līkne. Ekrāns tiek turēts nomodā.
3. **Beigt** — ieraksts tiek saglabāts un atveras tā skats (statistika, pulsa līkne, aktivitātes maiņa, CSV eksports, dzēšana).
4. **Analītika** — pa aktivitātēm: vidējā/maksimālā pulsa tendence pa ierakstiem (x ass = ierakstu datumi), kopsavilkums (ierakstu skaits, kopā laiks, vid. pulss, augstākais maks., vid. ilgums, izmaiņa starp pirmajiem un pēdējiem 3 ierakstiem) un ierakstu saraksts; periods 30/90 dienas vai viss.

Ja savienojums ar jostu ieraksta laikā zūd, lietotne mēģina to atjaunot pati; ieraksts turpinās. Nepabeigtu ierakstu (piem., pēc pārlūka aizvēršanas) sākuma ekrāns piedāvā pabeigt vai dzēst.

## Baterija

Polar H10 lieto **CR2025** monētbateriju (parasti ~400 h). Lietotne rāda baterijas līmeni sākuma ekrānā un iekrāso to sarkanu, kad līmenis ir **zem 20 %** — tad laiks nomainīt bateriju.

## Datu rezerves kopija

Dati glabājas tikai ierīcē. Iestatījumi → Dati:

- **Eksportēt JSON** — viss (aktivitātes, ieraksti, paraugi). To pašu failu var importēt citā ierīcē vai pēc pārinstalēšanas: **Importēt JSON** → "Apvienot" (pievieno trūkstošo) vai "Aizstāt visu" (dzēš esošo).
- **Eksportēt CSV** — sesiju kopsavilkums (`;` atdalītājs, UTF-8 BOM — atveras Excel).
- Atsevišķas sesijas CSV (sesijas skatā): kolonnas `t_s;bpm;rr_ms`; ja vienā paraugā ir vairākas RR vērtības, tās `rr_ms` kolonnā atdalītas ar `|`.

## Zināmie ierobežojumi

- **Ekrānam jāpaliek ieslēgtam.** Lietotne lieto Wake Lock, lai ekrāns neizslēgtos; ja Wake Lock nav pieejams vai ekrānu izslēdz manuāli, Android var apturēt pārlūku un ieraksts pārtrūkst.
- **Samsung Internet neder** — tas neatbalsta Web Bluetooth. Lieto Chrome.
- **Viena josta** vienlaikus; lietotne meklē tikai Polar H10 (sirdsdarbības servisu).
- iOS Safari Web Bluetooth neatbalsta — lietotne tur atveras, bet jostu pievienot nevar.

## Izstrāde

Lokālais serveris (projekta mapē):

```
python -m http.server 8898
```

Atver `http://localhost:8898/`.

- `?mock=1` — imitācijas režīms bez īstas jostas; tas pats ieslēdzams Iestatījumos (glabājas DB `settings.mock`).
- **Pirms katras publicēšanas jāpalielina `CACHE_VERSION` failā `sw.js`** — citādi pārlūks paturēs veco kešoto versiju. Lietotnes versija: `APP_VERSION` failā `js/app.js`.
- `tools/make_icons.py` — ikonu ģenerators (Pillow) → `icons/`.
- Visi ceļi ir relatīvi (bez sākuma `/`), lai lietotne strādātu GitHub Pages apakšceļā `/pulss/`.

### Struktūra

- `js/app.js` — sāknēšana, hash maršrutētājs, navigācija (SVG ikonas), instalēšanas notikums, SW reģistrācija
- `js/i18n.js` — visi UI teksti latviski
- `js/ble.js` — Polar H10 BLE klients (`HrmClient`) un imitācija (`MockHrm`)
- `js/db.js` — IndexedDB slānis (`pulss` v1: activities, sessions, samples, settings; eksports/imports)
- `js/format.js` — datumu/laika/ilguma formatēšana (lv-LV)
- `js/recorder.js` — ieraksta sesijas loģika (Wake Lock, nepabeigtu ierakstu atjaunošana)
- `js/charts.js` — grafiku zīmēšana uz `<canvas>`
- `js/ui/*.js` — ekrāni (`render(container, params)`, `unmount()`)
- `sw.js` — service worker (čaulas kešs, `CACHE_VERSION`)
