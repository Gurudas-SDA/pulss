# Pulss

Pulss ir maza progresīvā tīmekļa lietotne (PWA) sirdsdarbības ierakstīšanai no **Polar H10** jostas caur Web Bluetooth. Tā strādā bezsaistē, glabā ierakstus lokāli ierīcē un rāda aktivitāšu vēsturi un analītiku.

## Prasības

- **Android + Google Chrome.** Web Bluetooth darbojas tikai Chrome (un Chromium bāzētos pārlūkos, kas to ieslēguši). **Samsung Internet Web Bluetooth neatbalsta.**
- Polar H10 josta ar ieslēgtu Bluetooth.

## Instalēšana

1. Atver lietotnes adresi Chrome: `https://gurudas-sda.github.io/pulss/`
2. Chrome izvēlne (⋮) → **"Pievienot sākuma ekrānam"** (vai "Instalēt lietotni").
3. Palaid "Pulss" no sākuma ekrāna — tā atveras pilnekrāna režīmā un strādā arī bez interneta.

## Lietošana

1. **Sākums → "Pievienot jostu"** — Chrome parāda Bluetooth ierīču sarakstu; izvēlies Polar H10.
2. Izvēlies **aktivitāti** (sarakstu vari papildināt sadaļā "Aktivitātes").
3. **Sākt** — ieraksta ekrānā redzams pulss, vid./maks./min. un pēdējo 5 minūšu līkne. Ekrāns tiek turēts nomodā.
4. **Beigt** — ieraksts tiek saglabāts un atveras tā skats (statistika, pulsa līkne, aktivitātes maiņa, CSV eksports, dzēšana).
5. **Analītika** — pa aktivitātēm: vidējā/maksimālā pulsa tendence pa ierakstiem, kopsavilkums (ierakstu skaits, laiks, izmaiņa starp pirmajiem un pēdējiem 3 ierakstiem) un visu ierakstu saraksts; periods 30/90 dienas vai viss.

Dati glabājas tikai ierīcē (IndexedDB). **Rezerves kopija:** Iestatījumi → Dati → "Eksportēt JSON" (viss: aktivitātes, ieraksti, paraugi); to pašu failu var importēt citā ierīcē vai pēc pārinstalēšanas ("Apvienot" vai "Aizstāt visu").

## Izstrāde

Lokālais serveris (projekta mapē):

```
python -m http.server 8898
```

Atver `http://localhost:8898/`.

- `?mock=1` — imitācijas režīms bez īstas jostas; tas pats ieslēdzams Iestatījumos (glabājas DB `settings.mock`).
- Iestatījumi → Dati: JSON eksports/imports (apvienot vai aizstāt), CSV sesiju kopsavilkums (`;`, UTF-8 BOM — atveras Excel), "Dzēst visus datus".
- **Pirms katras publicēšanas jāpalielina `CACHE_VERSION` failā `sw.js`** — citādi pārlūks paturēs veco kešoto versiju.
- Visi ceļi ir relatīvi (bez sākuma `/`), lai lietotne strādātu GitHub Pages apakšceļā `/pulss/`.

## Struktūra

- `js/app.js` — sāknēšana, hash maršrutētājs, skatu montēšana, SW reģistrācija
- `js/i18n.js` — visi UI teksti latviski
- `js/ble.js` — Polar H10 BLE klients (`HrmClient`) un imitācija (`MockHrm`)
- `js/db.js` — IndexedDB slānis (`pulss` v1: activities, sessions, samples, settings; eksports/imports)
- `js/format.js` — datumu/laika/ilguma formatēšana (lv-LV)
- `js/recorder.js` — ieraksta sesijas loģika
- `js/charts.js` — grafiku zīmēšana uz `<canvas>`
- `js/ui/*.js` — ekrāni (`render(container, params)`, `unmount()`)
- `tools/make_icons.py` — ikonu ģenerators (Pillow)
