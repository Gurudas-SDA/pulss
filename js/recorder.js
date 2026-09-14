// Ieraksta sesijas loģika — STUB (implementācija 3. solī).
//
// Recorder klausās HrmClient/MockHrm 'hr' notikumus, buferē paraugus atmiņā,
// periodiski (un pie stop) raksta IndexedDB caur db.js, uztur statistiku (avg/max/ilgums).
export class Recorder {
  constructor(/* client, { activity } */) {
    this.active = false;
    this.samples = [];
    this.startedAt = null;
  }

  start() {
    // TODO: this.active = true; startedAt = Date.now(); subscribe client.on('hr')
    throw new Error('Recorder.start: TODO');
  }

  async stop() {
    // TODO: unsubscribe, aprēķināt kopsavilkumu, saveSession(), atgriezt session id
    throw new Error('Recorder.stop: TODO');
  }
}
