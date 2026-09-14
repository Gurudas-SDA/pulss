// Grafiki uz <canvas> — STUB (implementācija 4. solī).
//
// drawLineChart(canvas, { series: [{ points: [{x, y}], color }], xMin, xMax, yMin, yMax, zones })
export function drawLineChart(canvas, options = {}) {
  // TODO: devicePixelRatio mērogošana, asis, līnijas, pulsa zonu joslas.
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  void options;
}
