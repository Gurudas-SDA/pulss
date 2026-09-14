// Visi lietotnes UI teksti (latviski). Vienīgā vieta, kur dzīvo lietotāja teksti.
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
    placeholder: 'Šeit būs saglabāto ierakstu saraksts.',
    empty: 'Vēl nav neviena ieraksta.',
    types: {
      walk: 'Pastaiga',
      run: 'Skriešana',
      bike: 'Velosipēds',
      strength: 'Spēka treniņš',
      other: 'Cits',
    },
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
    version: 'Versija',
    mock: 'Mock režīms (imitēta josta)',
  },

  update: {
    newVersion: 'Jauna versija — pārlādē',
  },

  errors: {
    noBluetooth: 'Šis pārlūks neatbalsta Web Bluetooth. Lieto Chrome uz Android.',
    notFound: 'Lapa nav atrasta.',
  },
};
