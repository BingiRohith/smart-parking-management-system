import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './AdminFloors.css';

const EMPTY_FORM = { name: '', level: '', rows: '', slotsPerRow: '', displayOrder: '' };

const AdminFloors = () => {
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Confirm delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFloors = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/floors/admin/all');
      setFloors(data.floors);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load floors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFloors(); }, [fetchFloors]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (floor) => {
    setEditTarget(floor);
    setForm({
      name: floor.name,
      level: String(floor.level),
      rows: '',
      slotsPerRow: '',
      displayOrder: String(floor.displayOrder),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.name.trim()) { setFormError('Floor name is required.'); return; }
    if (form.level === '') { setFormError('Level is required.'); return; }

    if (!editTarget) {
      // Creating — rows and slotsPerRow are required
      if (!form.rows || !form.slotsPerRow) {
        setFormError('Rows and slots per row are required when creating a floor.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/floors/${editTarget._id}`, {
          name: form.name.trim(),
          level: Number(form.level),
          displayOrder: Number(form.displayOrder) || 0,
        });
      } else {
        await api.post('/floors', {
          name: form.name.trim(),
          level: Number(form.level),
          rows: Number(form.rows),
          slotsPerRow: Number(form.slotsPerRow),
          displayOrder: Number(form.displayOrder) || 0,
        });
      }
      setModalOpen(false);
      fetchFloors();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/floors/${deleteTarget._id}`);
      setDeleteTarget(null);
      fetchFloors();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading floors...</p></div>;
  if (error) return <div className="error-state"><p>⚠️ {error}</p><button onClick={fetchFloors} className="btn btn--primary">Retry</button></div>;

  return (
    <div className="admin-floors fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Parking Floors</h1>
          <p className="admin-page-sub">Manage floors and their slot layouts</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>+ Add Floor</button>
      </div>

      <div className="admin-floors__list card">
        {floors.length === 0 ? (
          <div className="error-state" style={{ padding: 'var(--space-8)' }}>
            <p>No floors yet. Add your first floor.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Floor Name</th>
                <th>Level</th>
                <th>Total Slots</th>
                <th>Available</th>
                <th>Occupied</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {floors.map((floor) => (
                <tr key={floor._id}>
                  <td className="admin-table__bold">{floor.name}</td>
                  <td>
                    <span className="admin-table__mono">{floor.level}</span>
                  </td>
                  <td>{floor.totalSlots}</td>
                  <td>
                    <span className="admin-table__available">{floor.availableCount}</span>
                  </td>
                  <td>
                    <span className="admin-table__occupied">{floor.occupiedCount}</span>
                  </td>
                  <td>{floor.displayOrder}</td>
                  <td>
                    <span className={`badge ${floor.isActive ? 'badge--available' : 'badge--occupied'}`}>
                      {floor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button className="btn btn--secondary btn--sm" onClick={() => openEdit(floor)}>
                        Edit
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => setDeleteTarget(floor)}
                        disabled={!floor.isActive}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit — ${editTarget.name}` : 'Add New Floor'}
      >
        {formError && (
          <div className="login-form__error" role="alert">{formError}</div>
        )}

        <div className="form-group">
          <label className="form-label">Floor Name *</label>
          <input name="name" className="form-input" value={form.name} onChange={handleFormChange} placeholder="e.g. Ground Floor" />
        </div>

        <div className="admin-form-row">
          <div className="form-group">
            <label className="form-label">Level Number *</label>
            <input name="level" type="number" className="form-input" value={form.level} onChange={handleFormChange} placeholder="0, -1, -2, 1 …" />
          </div>
          <div className="form-group">
            <label className="form-label">Display Order</label>
            <input name="displayOrder" type="number" className="form-input" value={form.displayOrder} onChange={handleFormChange} placeholder="1, 2, 3 …" />
          </div>
        </div>

        {!editTarget && (
          <>
            <p className="admin-form-note">
              Slots are auto-generated from rows × slots per row. These cannot be changed later.
            </p>
            <div className="admin-form-row">
              <div className="form-group">
                <label className="form-label">Rows (A, B, C …) *</label>
                <input name="rows" type="number" min="1" max="26" className="form-input" value={form.rows} onChange={handleFormChange} placeholder="e.g. 5" />
              </div>
              <div className="form-group">
                <label className="form-label">Slots per Row *</label>
                <input name="slotsPerRow" type="number" min="1" className="form-input" value={form.slotsPerRow} onChange={handleFormChange} placeholder="e.g. 6" />
              </div>
            </div>
            {form.rows && form.slotsPerRow && (
              <p className="admin-form-preview">
                This will create <strong>{Number(form.rows) * Number(form.slotsPerRow)} slots</strong>
                {' '}({form.rows} rows × {form.slotsPerRow} slots each)
              </p>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn--secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : editTarget ? 'Save Changes' : 'Create Floor'}
          </button>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Floor"
        message={`Deactivate "${deleteTarget?.name}"? It will be hidden from drivers but data is preserved.`}
        confirmLabel="Deactivate"
        loading={deleting}
      />
    </div>
  );
};

export default AdminFloors;
