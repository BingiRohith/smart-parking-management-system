import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './AdminStaff.css';

const EMPTY_FORM = { name: '', username: '', password: '', assignedFloor: '' };

const AdminStaff = () => {
  const [staff, setStaff] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [staffRes, floorsRes] = await Promise.all([
        api.get('/staff'),
        api.get('/floors'),
      ]);
      setStaff(staffRes.data.staff);
      setFloors(floorsRes.data.floors);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (member) => {
    setEditTarget(member);
    setForm({
      name: member.name,
      username: member.username,
      password: '',
      assignedFloor: member.assignedFloor?._id || '',
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
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.username.trim()) { setFormError('Username is required.'); return; }
    if (!editTarget && !form.password) { setFormError('Password is required.'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        assignedFloor: form.assignedFloor || null,
      };
      if (!editTarget || form.password) payload.password = form.password;

      if (editTarget) {
        await api.put(`/staff/${editTarget._id}`, payload);
      } else {
        await api.post('/staff', payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await api.delete(`/staff/${deactivateTarget._id}`);
      setDeactivateTarget(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading staff...</p></div>;
  if (error) return <div className="error-state"><p>⚠️ {error}</p><button onClick={fetchData} className="btn btn--primary">Retry</button></div>;

  return (
    <div className="admin-staff fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Security Staff</h1>
          <p className="admin-page-sub">Manage staff accounts and floor assignments</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>+ Add Staff</button>
      </div>

      <div className="admin-staff__list card">
        {staff.length === 0 ? (
          <div className="error-state" style={{ padding: 'var(--space-8)' }}>
            <p>No security staff yet. Add your first staff member.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Assigned Floor</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member._id}>
                  <td className="admin-table__bold">{member.name}</td>
                  <td>
                    <span className="admin-table__mono">{member.username}</span>
                  </td>
                  <td>
                    {member.assignedFloor ? (
                      <span className="badge badge--available">{member.assignedFloor.name}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>— unassigned —</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${member.isActive ? 'badge--available' : 'badge--occupied'}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                    {new Date(member.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button className="btn btn--secondary btn--sm" onClick={() => openEdit(member)}>
                        Edit
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => setDeactivateTarget(member)}
                        disabled={!member.isActive}
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
        title={editTarget ? `Edit — ${editTarget.name}` : 'Add Security Staff'}
      >
        {formError && <div className="login-form__error" role="alert">{formError}</div>}

        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input name="name" className="form-input" value={form.name} onChange={handleFormChange} placeholder="e.g. Ravi Kumar" />
        </div>

        <div className="admin-form-row">
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input name="username" className="form-input" value={form.username} onChange={handleFormChange} placeholder="e.g. security_g" />
          </div>
          <div className="form-group">
            <label className="form-label">{editTarget ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input name="password" type="password" className="form-input" value={form.password} onChange={handleFormChange} placeholder={editTarget ? 'Leave blank to keep current' : 'Min. 6 characters'} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Assigned Floor</label>
          <select name="assignedFloor" className="form-input" value={form.assignedFloor} onChange={handleFormChange}>
            <option value="">— No floor assigned —</option>
            {floors.map((f) => (
              <option key={f._id} value={f._id}>{f.name} (Level {f.level})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn--secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : editTarget ? 'Save Changes' : 'Create Staff'}
          </button>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Staff"
        message={`Deactivate "${deactivateTarget?.name}" (@${deactivateTarget?.username})? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        loading={deactivating}
      />
    </div>
  );
};

export default AdminStaff;
