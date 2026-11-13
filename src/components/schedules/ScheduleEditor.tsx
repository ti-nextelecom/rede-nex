import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import {
  SCHEDULE_LABELS,
  SCHEDULE_STATUSES,
  scheduleEntryInput,
  type ScheduleEntry,
  type ScheduleInput,
  type ScheduleStatus,
} from '../../../shared/workSchedules.mjs';
import type { SchedulePerson } from '../../lib/workSchedulesApi';

export function ScheduleEditor({
  person,
  day,
  entry,
  busy,
  onClose,
  onSave,
}: {
  person: SchedulePerson;
  day: string;
  entry?: ScheduleEntry;
  busy: boolean;
  onClose: () => void;
  onSave: (entries: ScheduleInput[], operationId: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<ScheduleStatus>(entry?.status || 'work');
  const [start, setStart] = useState(entry?.start_time || '08:00');
  const [end, setEnd] = useState(entry?.end_time || '17:00');
  const [note, setNote] = useState(entry?.note || '');
  const [error, setError] = useState('');
  const request = useRef({ signature: '', id: '' });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    try {
      const input = scheduleEntryInput({
        user_id: person.id,
        day,
        status,
        start_time: status === 'work' ? start : null,
        end_time: status === 'work' ? end : null,
        note,
        expected_revision: entry?.revision || 0,
      });
      const signature = JSON.stringify(input);
      if (request.current.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      await onSave([input], request.current.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar.',
      );
    }
  }
  const editable = person.can_edit;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="schedule-dialog"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogTitle>
          {editable ? 'Organizar dia' : 'Consultar dia'}
        </DialogTitle>
        <DialogDescription>
          {person.name} · {day.split('-').reverse().join('/')}
        </DialogDescription>
        <form onSubmit={submit}>
          <fieldset disabled={busy || !editable}>
            <label>
              Situação
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ScheduleStatus)
                }
              >
                {SCHEDULE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {SCHEDULE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            {status === 'work' && (
              <>
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
                {end < start && (
                  <p className="schedule-hint">
                    Turno noturno, com saída no dia seguinte.
                  </p>
                )}
              </>
            )}
            <label>
              {status === 'agreed_off'
                ? 'Detalhes da folga combinada (opcional)'
                : 'Observação (opcional)'}
              <textarea
                maxLength={500}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  status === 'agreed_off'
                    ? 'Registre o acordo e a compensação, quando houver'
                    : 'Informação sobre este dia'
                }
              />
            </label>
          </fieldset>
          {entry && (
            <p className="schedule-hint">
              Atualizado em {new Date(entry.updated_at).toLocaleString('pt-BR')}
            </p>
          )}
          {error && (
            <p role="alert" className="schedule-error">
              {error}
            </p>
          )}
          <footer>
            <button type="button" disabled={busy} onClick={onClose}>
              {editable ? 'Cancelar' : 'Fechar'}
            </button>
            {editable && (
              <button className="schedule-primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar e notificar supervisores'}
              </button>
            )}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
