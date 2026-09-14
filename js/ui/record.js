import { t } from '../i18n.js';

export function render(container) {
  container.innerHTML = `
    <h2>${t.record.title}</h2>
    <p>${t.record.placeholder}</p>
    <div class="bpm-big">— <span class="unit">${t.record.bpmUnit}</span></div>
    <button id="btn-stop" class="btn btn-big" type="button">${t.record.stop}</button>
  `;
  container.querySelector('#btn-stop').addEventListener('click', () => {
    // TODO (3. solis): const id = await state.recorder.stop(); location.hash = '#session/' + id
    location.hash = '#home';
  });
}

export function unmount() {
  // TODO (3. solis): atsaistīt 'hr' klausītājus, apturēt ilguma taimeri
}
