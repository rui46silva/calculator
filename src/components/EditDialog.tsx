import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

/** Modal form used to add or edit an item. Full-screen sheet on mobile. */
export function EditDialog({
  title,
  open,
  onClose,
  onSave,
  onDelete,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{title}</h2>
        <div className="form-grid">{children}</div>
        <div className="dialog-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete}>
              Apagar
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  );
}
