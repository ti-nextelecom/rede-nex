export const MAX_DWG_BYTES = 20 * 1024 * 1024;
export const DWG_SIGNATURES = Object.freeze({ AC1009: 'R11/R12', AC1012: 'R13', AC1014: 'R14', AC1015: '2000', AC1018: '2004', AC1021: '2007', AC1024: '2010', AC1027: '2013', AC1032: '2018' });

export function inspectDwg(bytes, size = bytes.byteLength) {
  const signature = String.fromCharCode(...new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, Math.min(6, bytes.byteLength)));
  if (!Number.isInteger(size) || size < 64 || size > MAX_DWG_BYTES) throw Error('Escolha um DWG válido de até 20 MB.');
  if (!DWG_SIGNATURES[signature]) throw Error('O conteúdo não é um DWG compatível. Renomear outro arquivo para .dwg não converte o desenho.');
  return { signature, version: DWG_SIGNATURES[signature] };
}

export function validateCadMetadata(value) {
  if (!value || value.format !== 'DWG' || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200 || /[\\/\u0000-\u001f]/.test(value.name)
    || !/^[a-f0-9]{64}$/.test(value.sha256 || '') || !DWG_SIGNATURES[value.signature]
    || !Number.isInteger(value.size) || value.size < 64 || value.size > MAX_DWG_BYTES
    || !Number.isInteger(value.entity_count) || value.entity_count < 0 || value.entity_count > 2000000
    || !Number.isInteger(value.layer_count) || value.layer_count < 0 || value.layer_count > 100000
    || !Number.isInteger(value.omitted_count) || value.omitted_count < 0 || value.omitted_count > 2000000
    || !Number.isInteger(value.warning_code) || value.warning_code < 0 || value.warning_code > 16383
    || typeof value.calibrated !== 'boolean') throw Error('Identificação da referência DWG inválida.');
  return { format: 'DWG', name: value.name, sha256: value.sha256, signature: value.signature, size: value.size,
    entity_count: value.entity_count, layer_count: value.layer_count, omitted_count: value.omitted_count,
    warning_code: value.warning_code, calibrated: value.calibrated };
}

export function cadViewports(database, svg) {
  const match = svg.match(/viewBox="([\d.eE+\- ]+)"/);
  const full = match?.[1].trim().split(/\s+/).map(Number);
  if (!full || full.length !== 4 || full.some(value => !Number.isFinite(value)) || full[2] <= 0 || full[3] <= 0) throw Error('O DWG não contém uma área 2D visível.');
  const points = [];
  for (const entity of database.entities || []) {
    if (entity.isVisible === false) continue;
    for (const field of ['startPoint', 'endPoint', 'center', 'insertionPoint', 'position']) {
      const point = entity[field];
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
    }
    for (const point of Array.isArray(entity.vertices) ? entity.vertices : []) if (Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
  }
  if (points.length < 100) return [{ name: 'Base DWG', box: full }];
  const axisLimits = axis => {
    const values = points.map(point => point[axis]).sort((a, b) => a - b);
    const lower = values[Math.floor(values.length * .25)], upper = values[Math.floor(values.length * .75)];
    const span = Math.max(upper - lower, 1e-6);
    return [Math.max(lower - span * 6, values[Math.floor(values.length * .005)]), Math.min(upper + span * 6, values[Math.floor(values.length * .995)])];
  };
  const [left, right] = axisLimits('x'), [bottom, top] = axisLimits('y');
  const cluster = points.filter(point => point.x >= left && point.x <= right && point.y >= bottom && point.y <= top);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of cluster) { minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); }
  const width = maxX - minX, height = maxY - minY;
  if (!cluster.length || !Number.isFinite(width + height) || width <= 0 || height <= 0 || (full[2] <= width * 8 && full[3] <= height * 8)) return [{ name: 'Base DWG', box: full }];
  const margin = Math.max(width, height) * .025;
  // Long multi-sheet model spaces need several readable views, with overlap.
  if (height > width * 3) {
    const count = Math.min(3, Math.ceil(height / (width * 2)));
    const step = height / count;
    return [...Array.from({ length: count }, (_, index) => ({ name: `DWG — região ${index + 1}`, box: [minX - margin, -maxY + index * step - margin, width + margin * 2, step + margin * 2] })), { name: 'DWG — visão geral', box: full }];
  }
  return [
    { name: 'DWG — região principal', box: [minX - margin, -maxY - margin, width + margin * 2, height + margin * 2] },
    { name: 'DWG — visão geral', box: full },
  ];
}

export function cadSvgForView(svg, box, maximum = 5000) {
  if (!Array.isArray(box) || box.length !== 4 || box.some(value => !Number.isFinite(value)) || box[2] <= 0 || box[3] <= 0) throw Error('Enquadramento DWG inválido.');
  const ratio = box[2] / box[3];
  const width = Math.max(1, Math.round(ratio >= 1 ? maximum : maximum * ratio));
  const height = Math.max(1, Math.round(ratio >= 1 ? maximum / ratio : maximum));
  return svg.replace(/viewBox="[^"]+"/, () => `viewBox="${box.join(' ')}"`)
    .replace('width="100%" height="100%"', () => `width="${width}" height="${height}"`)
    .replace('stroke-width="0.1%"', () => `stroke-width="${Math.max(box[2], box[3]) / maximum * .65}"`)
    .replace('stroke="#000000"', 'stroke="#e2e8f0"');
}
