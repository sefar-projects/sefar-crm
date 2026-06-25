export default function TemplateScopeSelector({ onBack, onSelectStudy, onSelectTourism }) {
  return (
    <main className="max-w-4xl mx-auto mt-10 px-4 pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-slate-900">إعداد القوالب</h2>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          ← العودة للرئيسية
        </button>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-6 py-5">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-300">Template Scope</div>
          <h3 className="text-xl font-black mt-1">اختر نوع القوالب</h3>
          <p className="text-sm text-slate-300 mt-2">حدد المسار أولاً حتى تبقى قوالب الفيزا الدراسية منفصلة عن قوالب السياحة والأسفار.</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            type="button"
            onClick={onSelectStudy}
            className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 text-right hover:shadow-lg hover:border-rose-300 transition"
          >
            <div className="text-xs font-bold text-rose-700 tracking-[0.18em] mb-2">STUDY VISA</div>
            <div className="text-xl font-black text-slate-900 mb-2">قوالب الفيزا الدراسية</div>
            <p className="text-sm text-slate-600 leading-7">إدارة قوالب المراحل والخطوات الخاصة بمسار الدراسة كما هو موجود حالياً.</p>
          </button>

          <button
            type="button"
            onClick={onSelectTourism}
            className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-right hover:shadow-lg hover:border-emerald-300 transition"
          >
            <div className="text-xs font-bold text-emerald-700 tracking-[0.18em] mb-2">TOURISM</div>
            <div className="text-xl font-black text-slate-900 mb-2">قوالب السياحة والأسفار</div>
            <p className="text-sm text-slate-600 leading-7">إدارة القوالب حسب البلد، نوع الفيزا، والحالة المدنية للعملاء السياحيين.</p>
          </button>
        </div>
      </section>
    </main>
  );
}
