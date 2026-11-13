import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import {
  generateFiveTwo,
  SCHEDULE_LABELS,
  WEEKDAYS,
  type ScheduleInput,
} from '../../../shared/workSchedules.mjs';
import { getSchedules, type SchedulePerson } from '../../lib/workSchedulesApi';

export function ScheduleGenerator({
  people,
  from,
  to,
  busy,
  onClose,
  onSave,
}: {
  people: SchedulePerson[];
  from: string;
  to: string;
  busy: boolean;
  onClose: () => void;
  onSave: (entries: ScheduleInput[], operationId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [first, setFirst] = useState(from);
  const [last, setLast] = useState(to);
  const [workdays, setWorkdays] = useState([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');
  const [replace, setReplace] = useState(false);
  const [review, setReview] = useState<{
    entries: ScheduleInput[];
    replaced: number;
    agreed: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef('');
  const lock = useRef(false);
  const available = people.filter((person) =>
    person.name
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );
  async function preview(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || busy) return;
    lock.current = true;
    setLoading(true);
    setError('');
    try {
      // Validate locally before requesting a potentially large calendar range.
      generateFiveTwo({
        userIds: selected,
        from: first,
        to: last,
        workdays,
        start_time: start,
        end_time: end,
      });
      const latest = await getSchedules(first, last);
      const allowed = new Set(
        latest.people
          .filter((person) => person.can_edit)
          .map((person) => person.id),
      );
      if (selected.some((id) => !allowed.has(id)))
        throw Error(
          'A hierarquia mudou. Reabra o planejamento para atualizar os colaboradores.',
        );
      const entries = generateFiveTwo({
        userIds: selected,
        from: first,
        to: last,
        workdays,
        start_time: start,
        end_time: end,
        existing: latest.entries,
        replace,
      });
      if (!entries.length)
        throw Error(
          'Os dias selecionados já possuem escala. Se precisar alterá-los, habilite a substituição.',
        );
      const keys = new Set(
        entries.map((entry) => entry.user_id + ':' + entry.day),
      );
      const overwritten = latest.entries.filter(
        (entry) =>
          entry.status !== 'unplanned' &&
          keys.has(entry.user_id + ':' + entry.day),
      );
      setReview({
        entries,
        replaced: overwritten.length,
        agreed: overwritten.filter((entry) => entry.status === 'agreed_off')
          .length,
      });
      operation.current = crypto.randomUUID();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível revisar a escala.',
      );
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }
  async function save() {
    if (!review || busy) return;
    setError('');
    try {
      await onSave(review.entries, operation.current);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar.',
      );
    }
  }
  const locked = busy || loading;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <DialogContent
        className="schedule-dialog schedule-generator"
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (locked) event.preventDefault();
        }}
      >
        <DialogTitle>Planejar escala 5×2</DialogTitle>
        <DialogDescription>
          Cinco dias de trabalho e dois de folga por semana. Ajuste os acordos
          individuais na grade após gerar.
        </DialogDescription>
        {review ? (
          <div className="schedule-review">
            <p>
              <strong>{selected.length} colaborador(es)</strong> ·{' '}
              {first.split('-').reverse().join('/')} a{' '}
              {last.split('-').reverse().join('/')}
            </p>
            <ul>
              {(['work', 'off'] as const).map((status) => (
                <li key={status}>
                  {SCHEDULE_LABELS[status]}{' '}
                  <strong>
                    {
                      review.entries.filter((entry) => entry.status === status)
                        .length
                    }{' '}
                    dia(s)
                  </strong>
                </li>
              ))}
            </ul>
            <p>
              Trabalho em {workdays.map((day) => WEEKDAYS[day]).join(', ')} ·{' '}
              {start}–{end}
              {end < start ? ' (saída no dia seguinte)' : ''}.
            </p>
            <p>
              {review.replaced
                ? `${review.replaced} dia(s) já planejado(s) serão substituídos, incluindo ${review.agreed} folga(s) combinada(s).`
                : `${review.entries.length} dia(s) sem escala receberão o planejamento.`}
            </p>
            <p className="schedule-hint">
              Os demais supervisores receberão um aviso com o período e a
              quantidade de alterações.
            </p>
            {error && (
              <p role="alert" className="schedule-error">
                {error}
              </p>
            )}
            <footer>
              <button
                disabled={busy}
                onClick={() => {
                  setReview(null);
                  setError('');
                }}
              >
                Voltar e ajustar
              </button>
              <button
                disabled={busy}
                className="schedule-primary"
                onClick={() => void save()}
              >
                {busy ? 'Salvando…' : 'Confirmar e notificar'}
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={preview}>
            <fieldset disabled={locked}>
              <div className="schedule-form-pair">
                <label>
                  De
                  <input
                    type="date"
                    required
                    value={first}
                    onChange={(event) => setFirst(event.target.value)}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    required
                    value={last}
                    min={first}
                    onChange={(event) => setLast(event.target.value)}
                  />
                </label>
              </div>
              <fieldset className="schedule-weekdays">
                <legend>Dias de trabalho · {workdays.length}/5</legend>
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={workdays.includes(day)}
                      onChange={() =>
                        setWorkdays((current) =>
                          current.includes(day)
                            ? current.filter((value) => value !== day)
                            : [...current, day],
                        )
                      }
                    />
                    {WEEKDAYS[day]}
                  </label>
                ))}
              </fieldset>
              <div className="schedule-form-pair">
                <label>
                  Entrada
                  <input
                    type="time"
                    required
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </label>
                <label>
                  Saída
                  <input
                    type="time"
                    required
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </label>
              </div>
              <label>
                Colaboradores da sua hierarquia · {selected.length}{' '}
                selecionado(s)
                <input
                  type="search"
                  placeholder="Buscar colaborador"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="schedule-select-actions">
                <button
                  type="button"
                  onClick={() =>
                    setSelected((current) => [
                      ...new Set([
                        ...current,
                        ...available.map((person) => person.id),
                      ]),
                    ])
                  }
                >
                  Selecionar resultados
                </button>
                <button type="button" onClick={() => setSelected([])}>
                  Limpar seleção
                </button>
              </div>
              <div className="schedule-people-options">
                {available.map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(person.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(person.id)
                            ? current.filter((id) => id !== person.id)
                            : [...current, person.id],
                        )
                      }
                    />
                    <span>
                      {person.name}
                      <small>{person.department_name || 'Sem setor'}</small>
                    </span>
                  </label>
                ))}
                {!available.length && <p>Nenhum colaborador encontrado.</p>}
              </div>
              <label className="schedule-checkbox">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(event) => setReplace(event.target.checked)}
                />
                <span>
                  Substituir dias já planejados, incluindo folgas combinadas
                </span>
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="schedule-error">
                {error}
              </p>
            )}
            <footer>
              <button type="button" disabled={locked} onClick={onClose}>
                Cancelar
              </button>
              <button
                disabled={locked || !selected.length}
                className="schedule-primary"
              >
                {loading ? 'Revisando…' : 'Revisar planejamento'}
              </button>
            </footer>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
