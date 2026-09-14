// Visi lietotnes UI teksti (latviski). Vienīgā vieta, kur dzīvo lietotāja teksti.

// Noklusējuma aktivitātes — iesēj DB pirmajā atvēršanā (db.js openDb) un pēc "Dzēst visus datus".
export const DEFAULT_ACTIVITIES = ['Airēšana', 'Elpošana', 'Pietupieni', 'Joga'];

export const t = {
  appName: 'Pulss',

  nav: {
    home: 'Sākums',
    analytics: 'Analītika',
    activities: 'Aktivitātes',
    settings: 'Iestatījumi',
  },

  home: {
    title: 'Sākums',
    intro: 'Pievieno Polar H10 jostu un sāc ierakstu.',
    connect: 'Pievienot jostu',
    disconnect: 'Atvienot',
    status: 'Statuss',
    notConnected: 'Nav savienots',
    connecting: 'Savienojas…',
    connected: 'Savienots',
    battery: 'Baterija',
    batteryUnknown: '—',
    activity: 'Aktivitāte',
    noActivities: 'Nav nevienas aktivitātes — pievieno sadaļā',
    start: 'Sākt',
  },

  record: {
    title: 'Ieraksts',
    placeholder: 'Šeit rādīsies pašreizējais pulss un ieraksta ilgums.',
    stop: 'Beigt',
    bpmUnit: 'sitieni/min',
  },

  activities: {
    title: 'Aktivitātes',
    intro: 'Aktivitāšu saraksts, ko izvēlēties pirms ieraksta.',
    empty: 'Nav nevienas aktivitātes.',
    newPlaceholder: 'Jauna aktivitāte',
    add: 'Pievienot',
    up: 'Pārvietot augstāk',
    down: 'Pārvietot zemāk',
    rename: 'Pārdēvēt',
    renamePrompt: 'Jaunais nosaukums:',
    remove: 'Dzēst',
    removeConfirm: 'Dzēst aktivitāti "{name}"?',
    duplicate: 'Šāda aktivitāte jau ir.',
    hasSessions: 'Aktivitātei ir ieraksti — vispirms dzēs tos',
    added: 'Pievienots: {name}',
    removed: 'Dzēsts: {name}',
  },

  analytics: {
    title: 'Analītika',
    placeholder: 'Šeit būs pulsa tendences un zonu statistika.',
  },

  session: {
    title: 'Sesija',
    placeholder: 'Šeit būs viena ieraksta detaļas un grafiks.',
    notFound: 'Sesija nav atrasta.',
  },

  settings: {
    title: 'Iestatījumi',
    placeholder: 'Lietotnes iestatījumi.',
    data: 'Dati',
    exportJson: 'Eksportēt JSON',
    exportCsv: 'Eksportēt CSV',
    importJson: 'Importēt JSON',
    importPicked: 'Fails: {name}',
    importMerge: 'Apvienot',
    importReplace: 'Aizstāt visu',
    importReplaceConfirm: 'Visi esošie dati tiks dzēsti un aizstāti ar importa failu. Turpināt?',
    cancel: 'Atcelt',
    imported: 'Importēts: {activities} aktivitātes, {sessions} sesijas, {samples} paraugi',
    importFailed: 'Imports neizdevās: {msg}',
    exported: 'Eksportēts: {name}',
    nothingToExport: 'Nav sesiju, ko eksportēt.',
    clearAll: 'Dzēst visus datus',
    clearAllConfirm: 'Dzēst VISUS ierakstus, aktivitātes un iestatījumus? Šo nevar atsaukt.',
    cleared: 'Visi dati dzēsti.',
    storage: 'Aizņemts',
    storageMb: '{mb} MB',
    belt: 'Josta',
    mock: 'Mock režīms (imitēta josta)',
    about: 'Par',
    version: 'Versija',
    csvHeader: 'datums;sākums;beigas;ilgums_s;aktivitāte;vid_bpm;maks_bpm;min_bpm;paraugi',
    csvUnknownActivity: '(dzēsta aktivitāte)',
  },

  update: {
    newVersion: 'Jauna versija — pārlādē',
  },

  errors: {
    noBluetooth: 'Šis pārlūks neatbalsta Web Bluetooth. Lieto Chrome uz Android.',
    notFound: 'Lapa nav atrasta.',
    noIndexedDb: 'Šis pārlūks neatbalsta IndexedDB — datus nevar saglabāt.',
    dbOpen: 'Neizdevās atvērt datubāzi.',
    dbBlocked: 'Datubāzi bloķē cita atvērta cilne — aizver to un pārlādē.',
    dbFailed: 'Datubāzes kļūda',
    activityNotFound: 'Aktivitāte nav atrasta.',
    importSchema: 'Nepareizs faila formāts: gaidīts Pulss eksports (schema 1).',
    importShape: 'Nepareizs faila saturs: trūkst activities/sessions/samples masīvu vai ierakstu lauku.',
    importMode: 'Nezināms importa režīms.',
    importParse: 'Failu nevar nolasīt kā JSON.',
  },
};

// "{name}" aizvietošana tekstos.
export function fill(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
