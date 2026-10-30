import { taskDescriptionParts } from '../../shared/taskMedia.mjs';
import { TaskFileCard } from './TaskFileCard';
import { LinkText } from './LinkText';

/** Render only plain text and validated image references; never arbitrary pasted HTML. */
export function TaskDescription({ value }: { value: string }) {
  return <div className="task-description-rich">{taskDescriptionParts(value).map((part, index) => part.kind === 'text'
    ? (part.text.trim() ? <p key={index}><LinkText text={part.text.trim()} /></p> : null)
    : <TaskFileCard key={index} file={{ id: `description-image-${index}`, name: part.name, file_url: part.url, file_type: 'image/png' }} />)}</div>;
}
