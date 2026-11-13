import { createModule, LibreDwg } from '@mlightcad/libredwg-web';
import { cadViewports, inspectDwg } from '../../shared/architectureCad.mjs';

const supported = new Set(['ARC','CIRCLE','DIMENSION','ELLIPSE','INSERT','LINE','LWPOLYLINE','MTEXT','SPLINE','RAY','TABLE','ACAD_TABLE','TEXT','XLINE']);
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  let reader: ReturnType<typeof LibreDwg.createByWasmInstance> | undefined;
  let pointer = 0;
  try {
    const bytes = new Uint8Array(event.data);
    inspectDwg(bytes);
    self.postMessage({ progress: 'Lendo a estrutura DWG…' });
    const wasmUrl = new URL('../../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm', import.meta.url);
    const response = await fetch(wasmUrl);
    if (!response.ok) throw Error('Não foi possível carregar o leitor DWG. Atualize a página e tente novamente.');
    const module = await createModule({ wasmBinary: new Uint8Array(await response.arrayBuffer()), print: () => {}, printErr: () => {} });
    reader = LibreDwg.createByWasmInstance(module);
    reader.FS.writeFile('source.dwg', bytes);
    const result = reader.dwg_read_file('source.dwg');
    pointer = result.data;
    if (!pointer || result.error >= 128) throw Error('O leitor não conseguiu abrir este DWG. O original foi preservado.');
    self.postMessage({ progress: 'Preparando a geometria 2D…' });
    const { database, stats } = reader.convertEx(pointer);
    if (!database.entities.length || database.entities.length > 500000) throw Error('Este desenho não contém uma base 2D utilizável ou excede 500 mil entidades.');
    const svg = reader.dwg_to_svg(database);
    if (svg.length > 64_000_000) throw Error('A base 2D é grande demais para este dispositivo.');
    const omitted = database.entities.filter(entity => !supported.has(entity.type)).length + stats.unknownEntityCount;
    const views = cadViewports(database, svg);
    const summary = { entity_count: database.entities.length, layer_count: database.tables.LAYER.entries.length, omitted_count: omitted, warning_code: result.error };
    reader.dwg_free(pointer); pointer = 0;
    reader.FS.unlink('source.dwg');
    self.postMessage({ svg, views, summary });
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : 'Não foi possível ler o DWG.' });
  } finally { if (pointer && reader) reader.dwg_free(pointer); }
};
