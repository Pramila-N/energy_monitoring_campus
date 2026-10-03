import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from './Modal.jsx';
import { Phone, Mail, User, BellRing } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';

export function ContactFacultyModal({ open, onClose, room, alert, onSubmit }) {
  const toast = useToast();
  const faculty = room?.facultyId;
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { note: alert?.type || '', channel: 'call' }
  });
  const channel = watch('channel');

  useEffect(() => {
    if (open) reset({ note: alert?.type || '', channel: 'call' });
  }, [open, alert, reset]);

  const submit = async (values) => {
    if (!alert) {
      toast.error('No active alert to attach the notification to.');
      return;
    }
    await onSubmit(values.note, values.channel);
  };

  return (
    <Modal open={open} onClose={onClose} title="Notify faculty member" width="max-w-md">
      {faculty ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {faculty.name?.[0]?.toUpperCase() || 'F'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{faculty.name}</p>
              <p className="truncate text-xs text-slate-500">{faculty.department || ''}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Phone size={12} /> {faculty.phoneNumber || '—'}</span>
            <span className="inline-flex items-center gap-1.5"><Mail size={12} /> {faculty.email || '—'}</span>
          </div>
        </div>
      ) : (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
          No faculty is currently assigned to {room?.roomNumber}. The notification will be logged without a recipient.
        </p>
      )}

      {alert ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <BellRing size={15} className="mt-0.5 shrink-0 text-danger" />
            {alert.message}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500">No unresolved alert for this room — nothing to send right now.</p>
      )}

      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div>
          <label className="label">Alert type / note</label>
          <select className="input" {...register('note')}>
            <option value="EXCESS_ENERGY">Excess energy consumption</option>
            <option value="EMPTY_ROOM_APPLIANCES">Appliances running while empty</option>
            <option value="HIGH_CONSUMPTION">High absolute consumption</option>
            <option value="Other">General concern</option>
          </select>
        </div>
        <div>
          <label className="label">Preferred channel (simulated)</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'call', label: 'Phone call', icon: Phone },
              { v: 'email', label: 'Email', icon: Mail }
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => reset({ note: alert?.type || '', channel: opt.v })}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  channel === opt.v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <opt.icon size={15} /> {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">
            <Phone size={14} /> Send notification
          </button>
        </div>
      </form>
    </Modal>
  );
}