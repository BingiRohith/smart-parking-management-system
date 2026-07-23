import { useState } from 'react';

/**
 * useModalCrud — shared create/edit-modal + confirm-delete state machine,
 * used by the admin Floors and Staff pages (which otherwise duplicated
 * this exact shape independently). Callers own the actual API calls and
 * any resource-specific form validation; this hook only owns the
 * open/close/target/saving/deleting state around them.
 */
export const useModalCrud = (emptyForm) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (target, formForTarget) => {
    setEditTarget(target);
    setForm(formForTarget);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError('');
  };

  return {
    modalOpen,
    editTarget,
    form,
    setForm,
    formError,
    setFormError,
    saving,
    setSaving,
    openCreate,
    openEdit,
    closeModal,
    handleFormChange,
    deleteTarget,
    setDeleteTarget,
    deleting,
    setDeleting,
  };
};
