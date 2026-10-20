export type NocCause = { id: string; name: string };
export type NocMotive = { id: string; name: string; causes: NocCause[] };
export type NocType = { id: string; name: string; motives: NocMotive[] };
export type NocPerson = { id: string; name: string };
export type NocActivation = { kind: 'internal' | 'external'; team: string; at: string; recordedBy: NocPerson };
export type NocComment = { id: string; body: string; createdAt: string; createdBy: NocPerson };

export type NocIncident = {
  id: string;
  description: string;
  typeId: string;
  motiveId: string;
  causeId: string;
  openedAt: string;
  openedBy: NocPerson;
  closedAt: string | null;
  closedBy: NocPerson | null;
  resolution: string;
  activation: NocActivation | null;
  comments: NocComment[];
};

export type NocStore = { version: 1; types: NocType[]; incidents: NocIncident[] };

export const NOC_STORAGE_KEY = 'rede-nex:noc:v1';

export const initialNocStore: NocStore = {
  version: 1,
  types: [{
    id: 'tv-plus',
    name: 'TV PLUS',
    motives: [{ id: 'encoder', name: 'Encoder', causes: [{ id: 'desligou', name: 'Desligou' }] }],
  }],
  incidents: [],
};

export function readNocStore(): NocStore {
  try {
    const saved = localStorage.getItem(NOC_STORAGE_KEY);
    if (!saved) return initialNocStore;
    const parsed: unknown = JSON.parse(saved);
    if (
      parsed && typeof parsed === 'object' &&
      'version' in parsed && parsed.version === 1 &&
      'types' in parsed && Array.isArray(parsed.types) &&
      'incidents' in parsed && Array.isArray(parsed.incidents)
    ) {
      const store = parsed as NocStore;
      return {
        ...store,
        incidents: store.incidents.map(item => {
          const activation = item.activation;
          return {
            ...item,
            activation: activation && (activation.kind === 'internal' || activation.kind === 'external') && typeof activation.team === 'string' && typeof activation.at === 'string' && typeof activation.recordedBy?.name === 'string' ? activation : null,
            comments: Array.isArray(item.comments) ? item.comments.filter(comment => comment && typeof comment.body === 'string' && typeof comment.createdAt === 'string' && typeof comment.createdBy?.name === 'string') : [],
          };
        }),
      };
    }
  } catch { /* A damaged local copy should not prevent the module from opening. */ }
  return initialNocStore;
}

export function saveNocStore(store: NocStore): void {
  localStorage.setItem(NOC_STORAGE_KEY, JSON.stringify(store));
}

export function newNocId(): string {
  return crypto.randomUUID();
}
