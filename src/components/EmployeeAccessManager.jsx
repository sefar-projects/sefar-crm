import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import EmployeeInvitePanel from './EmployeeInvitePanel';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'مدير النظام' },
  { value: 'visa_editor', label: 'محرر ملفات الفيزا' },
  { value: 'notes_only', label: 'ملاحظات فقط' },
];

export default function EmployeeAccessManager({ onBack, currentUserId }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('list');

  const refreshEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load employees:', error);
      alert('تعذر تحميل قائمة الموظفين.');
      setEmployees([]);
      return;
    }

    setEmployees(data || []);
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error('Failed to load employees:', error);
        alert('تعذر تحميل قائمة الموظفين.');
        setEmployees([]);
        setLoading(false);
        return;
      }

      setEmployees(data || []);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setSavingUserId(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update role:', error);
      alert('فشل تحديث الدور.');
      setSavingUserId(null);
      return;
    }

    setEmployees((prev) => prev.map((employee) => (
      employee.user_id === userId ? { ...employee, role: newRole } : employee
    )));
    setSavingUserId(null);
  };

  const handleActiveChange = async (userId, nextActive) => {
    if (userId === currentUserId && !nextActive) {
      alert('لا يمكنك إيقاف حسابك الحالي.');
      return;
    }

    setSavingUserId(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: nextActive })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update active state:', error);
      alert('فشل تحديث حالة الحساب.');
      setSavingUserId(null);
      return;
    }

    setEmployees((prev) => prev.map((employee) => (
      employee.user_id === userId ? { ...employee, is_active: nextActive } : employee
    )));
    setSavingUserId(null);
  };

  return (
    <main className="max-w-6xl mx-auto mt-10 px-4 pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة الموظفين والصلاحيات</h2>
          <p className="text-slate-500 text-sm mt-1">تعديل الأدوار وإيقاف/تفعيل الحسابات من جدول profiles.</p>
        </div>
        <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
          ← العودة للرئيسية
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${activeTab === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          قائمة الموظفين
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invite')}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${activeTab === 'invite' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          دعوة / إنشاء موظف
        </button>
      </div>

      {activeTab === 'invite' ? (
        <EmployeeInvitePanel
          onSuccess={async () => {
            await refreshEmployees();
            setActiveTab('list');
          }}
        />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
          إنشاء حسابات موظفين جديدة يتم من Supabase Auth (Dashboard أو دعوة)، ثم يظهر الحساب هنا لتحديد الدور.
        </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">جاري تحميل الموظفين...</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-slate-500">لا يوجد موظفون حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-sm font-bold text-slate-700">الموظف</th>
                    <th className="p-4 text-sm font-bold text-slate-700">معرف المستخدم</th>
                    <th className="p-4 text-sm font-bold text-slate-700">الدور</th>
                    <th className="p-4 text-sm font-bold text-slate-700">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const isSaving = savingUserId === employee.user_id;

                    return (
                      <tr key={employee.user_id} className="border-b border-slate-100">
                        <td className="p-4">
                          <div className="font-semibold text-slate-800">{employee.full_name || 'بدون اسم'}</div>
                        </td>
                        <td className="p-4 text-xs text-slate-500">{employee.user_id}</td>
                        <td className="p-4">
                          <select
                            value={employee.role}
                            disabled={isSaving}
                            onChange={(event) => handleRoleChange(employee.user_id, event.target.value)}
                            className="p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={employee.is_active}
                              disabled={isSaving || (employee.user_id === currentUserId && employee.is_active)}
                              onChange={(event) => handleActiveChange(employee.user_id, event.target.checked)}
                              className="w-4 h-4"
                            />
                            {employee.is_active ? 'نشط' : 'موقوف'}
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
      )}
    </main>
  );
}
