import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const CIVIL_STATUS_OPTIONS = [
  { value: 'retired', label: 'متقاعد' },
  { value: 'student', label: 'متمدرس' },
  { value: 'merchant', label: 'تاجر' },
  { value: 'public_employee', label: 'موظف عمومي' },
  { value: 'unemployed', label: 'بطال' },
];

const isSponsorRequired = (civilStatus) => civilStatus === 'student' || civilStatus === 'unemployed';
const NO_SPONSOR_TEMPLATE_KEY = '__none__';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyItem = () => ({
  id: createId(),
  name: 'مستند جديد',
  note: '',
  link: '',
  isChecked: false,
});

const createEmptyStep = () => ({
  id: createId(),
  title: 'خطوة جديدة',
  status: 'pending',
  items: [createEmptyItem()],
});

const createEmptyStage = () => ({
  id: createId(),
  title: 'مرحلة جديدة',
  steps: [createEmptyStep()],
});

const normalizeStages = (input) => {
  if (!Array.isArray(input)) return [];

  return input.map((stage) => ({
    id: stage?.id || createId(),
    title: stage?.title || 'مرحلة جديدة',
    steps: Array.isArray(stage?.steps)
      ? stage.steps.map((step) => ({
          id: step?.id || createId(),
          title: step?.title || 'خطوة جديدة',
          status: step?.status || 'pending',
          items: Array.isArray(step?.items)
            ? step.items.map((item) => ({
                id: item?.id || createId(),
                name: item?.name || 'مستند جديد',
                note: item?.note || '',
                link: item?.link || '',
                isChecked: Boolean(item?.isChecked),
              }))
            : [createEmptyItem()],
        }))
      : [createEmptyStep()],
  }));
};

export default function TourismTemplateManager({ onBack }) {
  const [countries, setCountries] = useState([]);
  const [visaTypes, setVisaTypes] = useState([]);
  const [countryId, setCountryId] = useState('');
  const [visaTypeId, setVisaTypeId] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [sponsorCivilStatus, setSponsorCivilStatus] = useState('');
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const sponsorNeeded = isSponsorRequired(civilStatus);
  const canLoadTemplate = countryId && visaTypeId && civilStatus && (!sponsorNeeded || sponsorCivilStatus);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === countryId) || null,
    [countries, countryId],
  );

  const selectedVisaType = useMemo(
    () => visaTypes.find((visaType) => visaType.id === visaTypeId) || null,
    [visaTypes, visaTypeId],
  );

  useEffect(() => {
    let isActive = true;

    const loadCountries = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('tourism_countries')
        .select('id, name')
        .order('name', { ascending: true });

      if (!isActive) return;

      if (error) {
        console.error('Failed to load tourism countries for template manager:', error);
        setErrorMessage('تعذر تحميل البلدان من قسم السياحة.');
        setCountries([]);
        setLoading(false);
        return;
      }

      setCountries(data || []);
      setLoading(false);
    };

    void loadCountries();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadVisaTypes = async () => {
      if (!countryId) {
        setVisaTypes([]);
        setVisaTypeId('');
        return;
      }

      const { data, error } = await supabase
        .from('tourism_visa_types')
        .select('id, country_id, name')
        .eq('country_id', countryId)
        .order('name', { ascending: true });

      if (!isActive) return;

      if (error) {
        console.error('Failed to load tourism visa types for template manager:', error);
        setErrorMessage('تعذر تحميل أنواع الفيزا لهذا البلد.');
        setVisaTypes([]);
        return;
      }

      setVisaTypes(data || []);
      setVisaTypeId('');
      setStages([]);
      setMessage('');
    };

    void loadVisaTypes();

    return () => {
      isActive = false;
    };
  }, [countryId]);

  useEffect(() => {
    let isActive = true;

    const loadTemplate = async () => {
      if (!canLoadTemplate) {
        setStages([]);
        return;
      }

      setErrorMessage('');
      setMessage('');

      const { data, error } = await supabase
        .from('tourism_visa_templates')
        .select('id, stages_data')
        .eq('country_id', countryId)
        .eq('visa_type_id', visaTypeId)
        .eq('civil_status', civilStatus)
        .eq('sponsor_civil_status', sponsorNeeded ? sponsorCivilStatus : NO_SPONSOR_TEMPLATE_KEY)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        console.error('Failed to load tourism template:', error);
        setErrorMessage('تعذر تحميل القالب الحالي.');
        setStages([]);
        return;
      }

      const normalized = normalizeStages(data?.stages_data || []);
      setStages(normalized);
      if (normalized.length === 0) {
        setMessage('لا يوجد قالب محفوظ لهذا الاختيار بعد. يمكنك البدء ببناء قالب جديد.');
      }
    };

    void loadTemplate();

    return () => {
      isActive = false;
    };
  }, [canLoadTemplate, countryId, visaTypeId, civilStatus, sponsorNeeded, sponsorCivilStatus]);

  const addStage = () => setStages((previous) => [...previous, createEmptyStage()]);

  const deleteStage = (stageIndex) => {
    setStages((previous) => previous.filter((_, index) => index !== stageIndex));
  };

  const addStep = (stageIndex) => {
    setStages((previous) => previous.map((stage, index) => (
      index === stageIndex
        ? { ...stage, steps: [...stage.steps, createEmptyStep()] }
        : stage
    )));
  };

  const deleteStep = (stageIndex, stepIndex) => {
    setStages((previous) => previous.map((stage, index) => {
      if (index !== stageIndex) return stage;
      return {
        ...stage,
        steps: stage.steps.filter((_, innerIndex) => innerIndex !== stepIndex),
      };
    }));
  };

  const addItem = (stageIndex, stepIndex) => {
    setStages((previous) => previous.map((stage, index) => {
      if (index !== stageIndex) return stage;
      return {
        ...stage,
        steps: stage.steps.map((step, innerIndex) => (
          innerIndex === stepIndex
            ? { ...step, items: [...step.items, createEmptyItem()] }
            : step
        )),
      };
    }));
  };

  const deleteItem = (stageIndex, stepIndex, itemIndex) => {
    setStages((previous) => previous.map((stage, index) => {
      if (index !== stageIndex) return stage;
      return {
        ...stage,
        steps: stage.steps.map((step, innerIndex) => {
          if (innerIndex !== stepIndex) return step;
          return {
            ...step,
            items: step.items.filter((_, itemInnerIndex) => itemInnerIndex !== itemIndex),
          };
        }),
      };
    }));
  };

  const updateStage = (stageIndex, title) => {
    setStages((previous) => previous.map((stage, index) => (
      index === stageIndex ? { ...stage, title } : stage
    )));
  };

  const updateStep = (stageIndex, stepIndex, title) => {
    setStages((previous) => previous.map((stage, index) => {
      if (index !== stageIndex) return stage;
      return {
        ...stage,
        steps: stage.steps.map((step, innerIndex) => (
          innerIndex === stepIndex ? { ...step, title } : step
        )),
      };
    }));
  };

  const updateItem = (stageIndex, stepIndex, itemIndex, field, value) => {
    setStages((previous) => previous.map((stage, index) => {
      if (index !== stageIndex) return stage;
      return {
        ...stage,
        steps: stage.steps.map((step, innerIndex) => {
          if (innerIndex !== stepIndex) return step;
          return {
            ...step,
            items: step.items.map((item, itemInnerIndex) => (
              itemInnerIndex === itemIndex ? { ...item, [field]: value } : item
            )),
          };
        }),
      };
    }));
  };

  const handleSaveTemplate = async () => {
    if (!canLoadTemplate) {
      setErrorMessage('اختر البلد ونوع الفيزا والحالة المدنية، وأضف حالة الكفيل عند الحاجة.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setMessage('');

    const { error } = await supabase
      .from('tourism_visa_templates')
      .upsert(
        {
          country_id: countryId,
          visa_type_id: visaTypeId,
          civil_status: civilStatus,
          sponsor_civil_status: sponsorNeeded ? sponsorCivilStatus : NO_SPONSOR_TEMPLATE_KEY,
          stages_data: stages,
        },
        {
          onConflict: 'country_id,visa_type_id,civil_status,sponsor_civil_status',
        },
      );

    if (error) {
      console.error('Failed to save tourism template:', error);
      setErrorMessage('تعذر حفظ القالب حالياً.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage('تم حفظ القالب السياحي بنجاح. سيُطبق على العملاء المستقبليين لنفس الاختيار.');
  };

  return (
    <main className="max-w-6xl mx-auto mt-10 px-4 pb-12" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">إعداد قوالب السياحة والأسفار</h2>
          <p className="text-sm text-slate-500 mt-1">اختر البلد + نوع الفيزا + الحالة المدنية (+ حالة الكفيل عند الحاجة) ثم عدّل جدول الوثائق واحفظه كقالب.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          ← العودة لاختيار القوالب
        </button>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-6 py-5">
          <div className="text-xs uppercase tracking-[0.25em] text-emerald-100">Tourism Templates</div>
          <h3 className="text-xl font-black mt-1">محرر القوالب السياحية</h3>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">البلد</label>
              <select
                value={countryId}
                onChange={(event) => setCountryId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">اختر البلد...</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>{country.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">نوع الفيزا</label>
              <select
                value={visaTypeId}
                onChange={(event) => setVisaTypeId(event.target.value)}
                disabled={!countryId}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="">اختر نوع الفيزا...</option>
                {visaTypes.map((visaType) => (
                  <option key={visaType.id} value={visaType.id}>{visaType.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة المدنية</label>
              <select
                value={civilStatus}
                onChange={(event) => {
                  setCivilStatus(event.target.value);
                  setSponsorCivilStatus('');
                  setStages([]);
                  setMessage('');
                  setErrorMessage('');
                }}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">اختر الحالة المدنية...</option>
                {CIVIL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {sponsorNeeded && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة المدنية للكفيل</label>
                <select
                  value={sponsorCivilStatus}
                  onChange={(event) => setSponsorCivilStatus(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">اختر حالة الكفيل...</option>
                  {CIVIL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              جاري تحميل بيانات القوالب...
            </div>
          )}

          {!loading && canLoadTemplate && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              القالب الحالي: <span className="font-bold text-slate-900">{selectedCountry?.name || '-'} - {selectedVisaType?.name || '-'} - {(CIVIL_STATUS_OPTIONS.find((option) => option.value === civilStatus)?.label) || '-'}</span>
              {sponsorNeeded && (
                <span className="font-bold text-slate-900"> - كفيل: {(CIVIL_STATUS_OPTIONS.find((option) => option.value === sponsorCivilStatus)?.label) || '-'}</span>
              )}
            </div>
          )}

          {canLoadTemplate && (
            <div className="space-y-5">
              {stages.map((stage, stageIndex) => (
                <div key={stage.id} className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <input
                      value={stage.title}
                      onChange={(event) => updateStage(stageIndex, event.target.value)}
                      className="flex-1 rounded-xl border border-emerald-300 bg-white px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button type="button" onClick={() => deleteStage(stageIndex)} className="text-xs font-bold text-red-600 hover:text-red-800">
                      حذف المرحلة
                    </button>
                  </div>

                  {stage.steps.map((step, stepIndex) => (
                    <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-3 mb-3">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <input
                          value={step.title}
                          onChange={(event) => updateStep(stageIndex, stepIndex, event.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => deleteStep(stageIndex, stepIndex)} className="text-xs font-bold text-red-600 hover:text-red-800">
                          حذف الخطوة
                        </button>
                      </div>

                      <table className="w-full text-right text-sm">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="p-2">الوثيقة/المهمة</th>
                            <th className="p-2">ملاحظات</th>
                            <th className="p-2">الرابط</th>
                            <th className="p-2">إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {step.items.map((item, itemIndex) => (
                            <tr key={item.id} className="border-b border-slate-100">
                              <td className="p-2">
                                <input
                                  value={item.name}
                                  onChange={(event) => updateItem(stageIndex, stepIndex, itemIndex, 'name', event.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  value={item.note}
                                  onChange={(event) => updateItem(stageIndex, stepIndex, itemIndex, 'note', event.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  value={item.link}
                                  onChange={(event) => updateItem(stageIndex, stepIndex, itemIndex, 'link', event.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="p-2">
                                <button type="button" onClick={() => deleteItem(stageIndex, stepIndex, itemIndex)} className="text-xs font-bold text-red-600 hover:text-red-800">
                                  حذف
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <button
                        type="button"
                        onClick={() => addItem(stageIndex, stepIndex)}
                        className="mt-3 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                      >
                        + إضافة بند
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addStep(stageIndex)}
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                  >
                    + إضافة خطوة
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap gap-3 justify-between">
                <button
                  type="button"
                  onClick={addStage}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  + إضافة مرحلة
                </button>

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ القالب'}
                </button>
              </div>
            </div>
          )}

          {!loading && !canLoadTemplate && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              اختر البلد ونوع الفيزا والحالة المدنية، وعند اختيار بطال/متمدرس حدّد أيضاً الحالة المدنية للكفيل.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{errorMessage}</div>
          )}

          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{message}</div>
          )}
        </div>
      </section>
    </main>
  );
}
