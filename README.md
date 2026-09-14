# Pulss

Pulss ir maza progresīvā tīmekļa lietotne (PWA) sirdsdarbības ierakstīšanai no **Polar H10** jostas caur Web Bluetooth. Tā strādā bezsaistē, glabā ierakstus lokāli ierīcē un rāda aktivitāšu vēsturi un analītiku.

## Prasības

- **Android + Google Chrome.** Web Bluetooth darbojas tikai Chrome (un Chromium bāzētos pārlūkos, kas to ieslēguši). **Samsung Internet Web Bluetooth neatbalsta.**
- Polar H10 josta ar ieslēgtu Bluetooth.

## Instalēšana

1. Atver lietotnes adresi Chrome: `https://gurudas-sda.github.io/pulss/`
2. Chrome izvēlne (⋮) → **"Pievienot sākuma ekrānam"** (vai "Instalēt lietotni").
3. Palaid "Pulss" no sākuma ekrāna — tā atveras pilnekrāna režīmā un strādā arī bez interneta.

## Izstrāde

Lokālais serveris (projekta mapē):

```
python -m http.server 8899
```

Atver `http://localhost:8899/`.

- `?mock=1` — imitācijas režīms bez īstas jostas (tiks ieviests 3. solī).
- **Pirms katras publicēšanas jāpalielina `CACHE_VERSION` failā `sw.js`** — citādi pārlūks paturēs veco kešoto versiju.
- Visi ceļi ir relatīvi (bez sākuma `/`), lai lietotne strādātu GitHub Pages apakšceļā `/pulss/`.

## Struktūra

- `js/app.js` — sāknēšana, hash maršrutētājs, skatu montēšana, SW reģistrācija
- `js/i18n.js` — visi UI teksti latviski
- `js/ble.js` — Polar H10 BLE klients (`HrmClient`) un imitācija (`MockHrm`)
- `js/db.js` — IndexedDB slānis
- `js/recorder.js` — ieraksta sesijas loģika
- `js/charts.js` — grafiku zīmēšana uz `<canvas>`
- `js/ui/*.js` — ekrāni (`render(container, params)`, `unmount()`)
- `tools/make_icons.py` — ikonu ģenerators (Pillow)
