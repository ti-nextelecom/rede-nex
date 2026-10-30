import { useDeferredValue, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
export default function PdfPreview({ url, width, zoom }: { url: string; width: number; zoom: number }) {
  const [page, setPage] = useState(1), [count, setCount] = useState(0);
  const file = useMemo(() => ({ url, withCredentials: new URL(url, window.location.href).origin === window.location.origin }), [url]);
  const options = useMemo(() => ({ isEvalSupported: false }), []);
  const renderWidth = useDeferredValue(Math.min(2600, Math.max(240, width - 40) * zoom));
  return <div className="nex-pdf-preview"><div className="nex-pdf-scroll"><Document file={file} options={options} onLoadSuccess={document => setCount(document.numPages)} loading={<p role="status">Carregando PDF…</p>} error={<p role="alert">Não foi possível visualizar o PDF. Use “Abrir original” ou baixe o arquivo.</p>}>
    <Page pageNumber={page} width={renderWidth} devicePixelRatio={Math.min(window.devicePixelRatio || 1, 1.5)} renderAnnotationLayer={false} loading={<p role="status">Preparando página…</p>} />
  </Document></div><nav className="nex-pdf-pages" aria-label="Páginas do PDF"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {count || '…'}</span><button type="button" disabled={!count || page >= count} onClick={() => setPage(value => value + 1)}>Próxima</button></nav></div>;
}
