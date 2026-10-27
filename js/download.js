// Lejupielāde caur pagaidu <a download> (JSON/CSV eksporti, automātiskā rezerves kopija).
// Android Chrome failu saglabā mapē Download (Lejupielādes) — tā paliek arī tad, ja Chrome
// iztīra vietnes datus.
export function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
