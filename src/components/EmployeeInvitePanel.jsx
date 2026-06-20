import { useState } from 'react';
import { supabase } from '../supabaseClient';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'مدير النظام' },
  { value: 'visa_editor', label: 'محرر ملفات الفيزا' },
  { value: 'notes_only', label: 'ملاحظات فقط' },
];

export default function EmployeeInvitePanel({ onSuccess }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'notes_only',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setErrorMessage('');

    const { data, error } = await supabase.functions.invoke('invite-employee', {
      body: {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        password: formData.password,
      },
    });

    if (error) {
      console.error('Invite employee failed:', error);
      setErrorMessage(error.message || 'تعذر إرسال الدعوة.');
      setSubmitting(false);
      return;
    }

    if (data?.error) {
      setErrorMessage(data.error);
      setSubmitting(false);
      return;
    }

    setMessage('تم إنشاء الموظف وتعيين كلمة المرور بنجاح.');
    setFormData({ full_name: '', email: '', role: 'notes_only', password: '' });
    setSubmitting(false);

    if (onSuccess) {
      await onSuccess();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900">دعوة أو إنشاء موظف جديد</h3>
        <p className="text-sm text-slate-500 mt-1">
          هذا النموذج يستدعي Edge Function آمنة في Supabase. الوظيفة يجب أن تتحقق من أن المستخدم الحالي Admin قبل إنشاء الدعوة.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">الاسم الكامل</label>
          <input
            type="text"
            required
            value={formData.full_name}
            onChange={(event) => setFormData((previous) => ({ ...previous, full_name: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="مثال: أحمد بن علي"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">البريد الإلكتروني</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(event) => setFormData((previous) => ({ ...previous, email: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="employee@company.com"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">كلمة المرور الأولية</label>
          <input
            type="text"
            required
            minLength={8}
            value={formData.password}
            onChange={(event) => setFormData((previous) => ({ ...previous, password: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="أدخل كلمة مرور أولية لا تقل عن 8 أحرف"
          />
          <p className="mt-2 text-xs text-slate-500">
            هذه هي كلمة المرور التي ستستخدم لأول دخول. Supabase لا يعرضها لاحقاً، لذلك يجب أن تحددها هنا.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">الدور</label>
          <select
            value={formData.role}
            onChange={(event) => setFormData((previous) => ({ ...previous, role: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جاري الإرسال...' : 'إرسال الدعوة'}
          </button>
        </div>

        {errorMessage && (
          <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="md:col-span-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
            {message}
          </div>
        )}
      </form>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 leading-6">
        بعد نجاح الدعوة، سيُنشئ الـ Edge Function حساب Auth ويضيف السجل إلى جدول profiles. يمكنك لاحقاً فتح قائمة الموظفين لتعديل الدور أو تفعيل/إيقاف الحساب.
      </div>
    </div>
  );
}
