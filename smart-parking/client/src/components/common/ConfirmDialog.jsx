import Modal from './Modal';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', loading = false }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn--secondary" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button className="btn btn--danger" onClick={onConfirm} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
