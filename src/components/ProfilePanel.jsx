const PERMISSION_LABELS = {
  canStartVisa: 'بدء ملفات الفيزا',
  canStartTourism: 'بدء ملفات السياحة',
  canRestoreClient: 'استرجاع الملفات',
  canCreateClient: 'إنشاء عميل جديد',
  canEditStructure: 'تعديل الهيكل',
  canEditItemProgress: 'تحديث التقدم والملاحظات',
  canManageTemplates: 'إدارة القوالب',
  canManageEmployees: 'إدارة الموظفين',
};

export default function ProfilePanel({ profile, session, roleLabel, permissions, onBack, onLogout }) {
  const activePermissions = Object.entries(permissions || {})
    .filter(([, allowed]) => allowed)
    .map(([key]) => PERMISSION_LABELS[key])
    .filter(Boolean);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10" dir="rtl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">الملف الشخصي</h2>
          <p className="text-sm text-slate-500 mt-1">معلومات الحساب والصلاحيات الحالية المرتبطة به.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          العودة للرئيسية
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
            <div className="text-sm text-slate-200">الحساب الحالي</div>
            <div className="mt-2 text-3xl font-bold">{profile?.full_name || session?.user?.email || 'مستخدم'}</div>
            <div className="mt-2 text-sm text-slate-200">{session?.user?.email || 'لا يوجد بريد مسجل'}</div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">الدور</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{roleLabel}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">الحالة</div>
              <div className="mt-2 text-lg font-bold text-emerald-700">مفعل</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900">ماذا يستطيع هذا الحساب؟</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {activePermissions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-500">لا توجد صلاحيات مفعلة</span>
              ) : (
                activePermissions.map((label) => (
                  <span key={label} className="rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                    {label}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-500">اسم المستخدم</div>
            <div className="mt-1 text-base font-bold text-slate-900">{profile?.full_name || 'غير متوفر'}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500">البريد الإلكتروني</div>
            <div className="mt-1 text-base font-bold text-slate-900 break-all">{session?.user?.email || 'غير متوفر'}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500">الاسم الداخلي للدور</div>
            <div className="mt-1 text-base font-bold text-slate-900">{profile?.role || 'notes_only'}</div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 leading-6">
            إذا احتجت تغيير الدور أو إيقاف الحساب، استخدم إدارة الموظفين من القائمة المنسدلة أعلى الصفحة.
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-slate-800"
          >
            تسجيل الخروج
          </button>
        </aside>
      </div>
    </main>
  );
}
