import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const DEFAULT_TEMPLATE = {
  destination: '',
  education_level: '',
  stages_data: [],
};

const STEP_STATUSES = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'in_progress', label: 'قيد العمل' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'cancelled', label: 'ملغاة' },
];

const normalizeUrl = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyItem = () => ({
  id: createId(),
  name: 'مهمة جديدة',
  link: '',
  note: '',
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
  const rawStages = typeof input === 'string' ? JSON.parse(input || '[]') : input;

  if (!Array.isArray(rawStages)) {
    return [];
  }

  return rawStages.map((stage) => ({
    id: stage?.id || createId(),
    title: stage?.title || 'مرحلة جديدة',
    steps: Array.isArray(stage?.steps)
      ? stage.steps.map((step) => ({
          id: step?.id || createId(),
          title: step?.title || 'خطوة جديدة',
          status: STEP_STATUSES.some((option) => option.value === step?.status) ? step.status : 'pending',
          items: Array.isArray(step?.items)
            ? step.items.map((item) => ({
                id: item?.id || createId(),
                name: item?.name || 'مهمة جديدة',
                link: item?.link || '',
                note: item?.note || '',
                isChecked: Boolean(item?.isChecked),
              }))
            : [createEmptyItem()],
        }))
      : [createEmptyStep()],
  }));
};

const getStageStats = (stage) => {
  const steps = stage.steps || [];
  const items = steps.flatMap((step) => step.items || []);
  const checkedItems = items.filter((item) => item.isChecked).length;

  return {
    steps: steps.length,
    items: items.length,
    checkedItems,
  };
};

export default function TemplateManager({ onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_TEMPLATE);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visa_templates')
      .select('id, destination, education_level, stages_data, created_at')
      .order('destination', { ascending: true });

    if (error) {
      console.error('Failed to load templates:', error);
      setErrorMessage('تعذر تحميل القوالب.');
      setTemplates([]);
      setLoading(false);
      return;
    }

    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('visa_templates')
        .select('id, destination, education_level, stages_data, created_at')
        .order('destination', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Failed to load templates:', error);
        setErrorMessage('تعذر تحميل القوالب.');
        setTemplates([]);
        setLoading(false);
        return;
      }

      setTemplates(data || []);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectTemplate = (template) => {
    setSelectedTemplateId(template.id);
    setFormData({
      destination: template.destination || '',
      education_level: template.education_level || '',
      stages_data: normalizeStages(template.stages_data),
    });
    setMessage('');
    setErrorMessage('');
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(null);
    setFormData(DEFAULT_TEMPLATE);
    setMessage('');
    setErrorMessage('');
  };

  const updateStage = (stageIndex, field, value) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => (
        index === stageIndex ? { ...stage, [field]: value } : stage
      )),
    }));
  };

  const updateStep = (stageIndex, stepIndex, field, value) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
        if (index !== stageIndex) return stage;
        return {
          ...stage,
          steps: stage.steps.map((step, innerIndex) => (
            innerIndex === stepIndex ? { ...step, [field]: value } : step
          )),
        };
      }),
    }));
  };

  const updateItem = (stageIndex, stepIndex, itemIndex, field, value) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
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
      }),
    }));
  };

  const addStage = () => {
    setFormData((previous) => ({
      ...previous,
      stages_data: [...previous.stages_data, createEmptyStage()],
    }));
  };

  const deleteStage = (stageIndex) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.filter((_, index) => index !== stageIndex),
    }));
  };

  const addStep = (stageIndex) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
        if (index !== stageIndex) return stage;
        return { ...stage, steps: [...stage.steps, createEmptyStep()] };
      }),
    }));
  };

  const deleteStep = (stageIndex, stepIndex) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
        if (index !== stageIndex) return stage;
        return {
          ...stage,
          steps: stage.steps.filter((_, innerIndex) => innerIndex !== stepIndex),
        };
      }),
    }));
  };

  const addItem = (stageIndex, stepIndex) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
        if (index !== stageIndex) return stage;
        return {
          ...stage,
          steps: stage.steps.map((step, innerIndex) => {
            if (innerIndex !== stepIndex) return step;
            return { ...step, items: [...step.items, createEmptyItem()] };
          }),
        };
      }),
    }));
  };

  const deleteItem = (stageIndex, stepIndex, itemIndex) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
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
      }),
    }));
  };

  const toggleItemChecked = (stageIndex, stepIndex, itemIndex) => {
    setFormData((previous) => ({
      ...previous,
      stages_data: previous.stages_data.map((stage, index) => {
        if (index !== stageIndex) return stage;
        return {
          ...stage,
          steps: stage.steps.map((step, innerIndex) => {
            if (innerIndex !== stepIndex) return step;
            return {
              ...step,
              items: step.items.map((item, itemInnerIndex) => (
                itemInnerIndex === itemIndex ? { ...item, isChecked: !item.isChecked } : item
              )),
            };
          }),
        };
      }),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const payload = {
        destination: formData.destination.trim(),
        education_level: formData.education_level.trim() || null,
        stages_data: formData.stages_data,
      };

      if (!payload.destination) {
        throw new Error('الوجهة مطلوبة.');
      }

      const query = selectedTemplateId
        ? supabase.from('visa_templates').update(payload).eq('id', selectedTemplateId)
        : supabase.from('visa_templates').insert([payload]);

      const { error } = await query.select();

      if (error) {
        throw error;
      }

      setMessage(selectedTemplateId ? 'تم تحديث القالب بنجاح.' : 'تم إنشاء القالب بنجاح.');
      await loadTemplates();
      handleNewTemplate();
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrorMessage(error.message || 'فشل حفظ القالب.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;

    const confirmed = window.confirm('هل تريد حذف هذا القالب؟');
    if (!confirmed) return;

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('visa_templates')
      .delete()
      .eq('id', selectedTemplateId);

    if (error) {
      console.error('Failed to delete template:', error);
      setErrorMessage('فشل حذف القالب.');
      setSaving(false);
      return;
    }

    setMessage('تم حذف القالب بنجاح.');
    handleNewTemplate();
    await loadTemplates();
    setSaving(false);
  };

  return (
    <main className="max-w-7xl mx-auto mt-10 px-4 pb-12" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إعداد القوالب</h2>
          <p className="text-slate-500 text-sm mt-1">أنشئ القالب من خلال واجهة بصرية: مرحلة، ثم خطوة، ثم بنودها، بدون أي JSON.</p>
        </div>
        <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
          ← العودة للرئيسية
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900">القوالب الحالية</h3>
            <button
              type="button"
              onClick={handleNewTemplate}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              + جديد
            </button>
          </div>

          {loading ? (
            <div className="py-6 text-center text-slate-500">جاري تحميل القوالب...</div>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              لا توجد قوالب بعد.
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {templates.map((template) => {
                const selected = selectedTemplateId === template.id;
                const stageCount = Array.isArray(template.stages_data) ? template.stages_data.length : 0;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full rounded-2xl border p-3 text-right transition ${
                      selected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{template.destination}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{template.education_level || 'بدون مستوى محدد'}</span>
                      <span>{stageCount} مراحل</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الوجهة</label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(event) => setFormData((previous) => ({ ...previous, destination: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: المجر"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">المستوى الدراسي</label>
                <input
                  type="text"
                  value={formData.education_level}
                  onChange={(event) => setFormData((previous) => ({ ...previous, education_level: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: bachelor"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">بناء القالب</h3>
                  <p className="text-sm text-slate-500 mt-1">أضف مراحل، ثم خطوات، ثم البنود داخل كل خطوة.</p>
                </div>
                <button
                  type="button"
                  onClick={addStage}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition"
                >
                  + إضافة مرحلة
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">المراحل</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{formData.stages_data.length}</div>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">الخطوات</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formData.stages_data.reduce((count, stage) => count + (stage.steps?.length || 0), 0)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">البنود</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formData.stages_data.reduce(
                      (count, stage) => count + stage.steps.reduce((stepCount, step) => stepCount + (step.items?.length || 0), 0),
                      0,
                    )}
                  </div>
                </div>
              </div>
            </div>

            {formData.stages_data.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                لا توجد مراحل حتى الآن. أضف أول مرحلة للبدء.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.stages_data.map((stage, stageIndex) => {
                  const stats = getStageStats(stage);
                  return (
                    <section key={stage.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 text-white">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-sm font-semibold text-slate-300">مرحلة {stageIndex + 1}</div>
                          <input
                            value={stage.title}
                            onChange={(event) => updateStage(stageIndex, 'title', event.target.value)}
                            className="min-w-[220px] rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-lg font-bold text-white placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-white/60"
                            placeholder="عنوان المرحلة"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-200">
                          <span className="rounded-full bg-white/10 px-3 py-1">{stats.steps} خطوات</span>
                          <span className="rounded-full bg-white/10 px-3 py-1">{stats.items} بند</span>
                          <button
                            type="button"
                            onClick={() => deleteStage(stageIndex)}
                            className="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white hover:bg-red-600 transition"
                          >
                            حذف المرحلة
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 p-5 bg-slate-50">
                        {stage.steps.map((step, stepIndex) => (
                          <article key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">خطوة {stepIndex + 1}</span>
                                <input
                                  value={step.title}
                                  onChange={(event) => updateStep(stageIndex, stepIndex, 'title', event.target.value)}
                                  className="min-w-[220px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="عنوان الخطوة"
                                />
                                <select
                                  value={step.status}
                                  onChange={(event) => updateStep(stageIndex, stepIndex, 'status', event.target.value)}
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {STEP_STATUSES.map((status) => (
                                    <option key={status.value} value={status.value}>
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteStep(stageIndex, stepIndex)}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 transition"
                              >
                                حذف الخطوة
                              </button>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="min-w-full text-right text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500">
                                    <th className="p-3 font-semibold">المهمة / الوثيقة</th>
                                    <th className="p-3 font-semibold">ملاحظات</th>
                                    <th className="p-3 font-semibold">الرابط</th>
                                    <th className="p-3 font-semibold text-center">تمت</th>
                                    <th className="p-3 font-semibold text-center">إجراء</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {step.items.map((item, itemIndex) => (
                                    <tr key={item.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                                      <td className="p-3">
                                        <input
                                          value={item.name}
                                          onChange={(event) => updateItem(stageIndex, stepIndex, itemIndex, 'name', event.target.value)}
                                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholder="اسم المهمة"
                                        />
                                      </td>
                                      <td className="p-3">
                                        <input
                                          value={item.note}
                                          onChange={(event) => updateItem(stageIndex, stepIndex, itemIndex, 'note', event.target.value)}
                                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholder="أضف ملاحظة"
                                        />
                                      </td>
                                      <td className="p-3">
                                        <div className="space-y-2">
                                          <input
                                            value={item.link}
                                            onChange={(event) => updateItem(stageIndex, stepIndex, itemIndex, 'link', event.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://..."
                                          />
                                          {item.link?.trim() && (
                                            <a
                                              href={normalizeUrl(item.link)}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-900"
                                            >
                                              فتح الرابط
                                            </a>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(item.isChecked)}
                                          onChange={() => toggleItemChecked(stageIndex, stepIndex, itemIndex)}
                                          className="h-5 w-5 accent-blue-600"
                                        />
                                      </td>
                                      <td className="p-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => deleteItem(stageIndex, stepIndex, itemIndex)}
                                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
                                        >
                                          حذف
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-4 flex justify-start">
                              <button
                                type="button"
                                onClick={() => addItem(stageIndex, stepIndex)}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
                              >
                                + إضافة بند
                              </button>
                            </div>
                          </article>
                        ))}

                        <button
                          type="button"
                          onClick={() => addStep(stageIndex)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                        >
                          + إضافة خطوة
                        </button>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {selectedTemplateId ? 'حفظ التغييرات' : 'إنشاء القالب'}
              </button>
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 transition disabled:opacity-60"
                >
                  حذف القالب
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
