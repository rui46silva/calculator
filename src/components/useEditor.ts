import { useState } from 'react';
import { useStore } from '../data/store';
import type { AppData, Collection } from '../data/types';

/** Draft state for adding/editing one item of a collection through EditDialog. */
export function useEditor<C extends Collection>(collection: C, blank: () => AppData[C][number]) {
  type Item = AppData[C][number];
  const { upsert, remove } = useStore();
  const [draft, setDraft] = useState<Item | null>(null);
  const [isNew, setIsNew] = useState(false);

  return {
    draft,
    isNew,
    open: draft !== null,
    add: () => {
      setIsNew(true);
      setDraft(blank());
    },
    edit: (item: Item) => {
      setIsNew(false);
      setDraft(item);
    },
    set: <K extends keyof Item>(key: K, value: Item[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d)),
    close: () => setDraft(null),
    save: () => {
      if (draft) upsert(collection, draft);
      setDraft(null);
    },
    remove: () => {
      if (draft) remove(collection, (draft as { id: string }).id);
      setDraft(null);
    },
  };
}
