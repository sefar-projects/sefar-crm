import { useState } from 'react';
import { supabase } from '../supabaseClient';

const getStatusColor = (status) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'completed':
      return '✓ مكتملة';
    case 'in_progress':
      return '⚙️ قيد العمل';
    case 'cancelled':
      return '✗ ملغاة';
    default:
      return '○ قيد الانتظار';
  }
};

const getStepStatus = (step) => {
  if (!step.items || step.items.length === 0) return 'pending';
  const completedCount = step.items.filter((item) => item.isChecked).length;
  if (completedCount === step.items.length) return 'completed';
  if (completedCount > 0) return 'in_progress';
  return 'pending';
};

const getStageStatus = (stage) => {
  if (!stage.steps || stage.steps.length === 0) return 'pending';
  const completedCount = stage.steps.filter((step) => getStepStatus(step) === 'completed').length;
  const inProgressCount = stage.steps.filter((step) => getStepStatus(step) === 'in_progress').length;
  if (completedCount === stage.steps.length) return 'completed';
  if (completedCount > 0 || inProgressCount > 0) return 'in_progress';
  return 'pending';
};

const getOverallStatus = (stages) => {
  if (!stages || stages.length === 0) return 'pending';
  const completedCount = stages.filter((stage) => getStageStatus(stage) === 'completed').length;
  const inProgressCount = stages.filter((stage) => getStageStatus(stage) === 'in_progress').length;
  if (completedCount === stages.length) return 'completed';
  if (completedCount > 0 || inProgressCount > 0) return 'in_progress';
  return 'pending';
};

const CIVIL_STATUS_LABELS = {
  retired: 'متقاعد',
  student: 'متمدرس',
  merchant: 'تاجر',
  public_employee: 'موظف عمومي',
  unemployed: 'بطال',
};

const NO_SPONSOR_TEMPLATE_KEY = 'none';

const normalizeUrl = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function TourismVisaSteps({
  request,
  onBack,
  canEditStructure = false,
  canEditItemProgress = false,
  canManageTemplates = false,
}) {
  const [stages, setStages] = useState(() => Array.isArray(request?.stages_data) ? request.stages_data : []);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const allowStructureEditing = canEditStructure && isEditing;
  const canSave = canEditStructure || canEditItemProgress;

  const saveTemplate = async (newStages) => {
    const { error } = await supabase
      .from('tourism_visa_templates')
      .upsert(
        {
          country_id: request.country_id,
          visa_type_id: request.visa_type_id,
          civil_status: request.civil_status,
          sponsor_civil_status: request.sponsor_civil_status || NO_SPONSOR_TEMPLATE_KEY,
          stages_data: newStages,
        },
        {
          onConflict: 'country_id,visa_type_id,civil_status,sponsor_civil_status',
        },
      );

    if (error) {
      console.error('Failed to save tourism template:', error);
      throw error;
    }
  };

  const saveToDatabase = async (newStages) => {
    setIsSaving(true);
    setStages(newStages);

    try {
      const { error } = await supabase
        .from('tourism_visa_requests')
        .update({ stages_data: newStages })
        .eq('id', request.id);

      if (error) {
        throw error;
      }

      await saveTemplate(newStages);
      alert('تم الحفظ بنجاح!');
    } catch (error) {
      console.error('Error updating tourism request:', error);
      if (error?.code === '42P10') {
        alert('خطأ في حفظ القالب: يجب إضافة UNIQUE على (country_id, visa_type_id, civil_status, sponsor_civil_status).');
      } else {
        alert('خطأ في حفظ البيانات');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    try {
      await saveTemplate(stages);
      alert('تم حفظ الهيكل كقالب للسياحة بنجاح!');
    } catch {
      alert('حدث خطأ أثناء حفظ القالب.');
    }
  };

  const addStage = () => saveToDatabase([...stages, { id: Date.now(), title: 'مرحلة جديدة', steps: [] }]);
  const deleteStage = (stageIndex) => saveToDatabase(stages.filter((_, index) => index !== stageIndex));

  const addStep = (stageIndex) => {
    const newStages = [...stages];
    newStages[stageIndex].steps.push({ id: Date.now(), title: 'خطوة جديدة', status: 'pending', items: [] });
    saveToDatabase(newStages);
  };

  const deleteStep = (stageIndex, stepIndex) => {
    const newStages = [...stages];
    newStages[stageIndex].steps = newStages[stageIndex].steps.filter((_, index) => index !== stepIndex);
    saveToDatabase(newStages);
  };

  const addItem = (stageIndex, stepIndex) => {
    const newStages = [...stages];
    newStages[stageIndex].steps[stepIndex].items.push({ id: Date.now(), name: 'مستند جديد', note: '', link: '', isChecked: false });
    saveToDatabase(newStages);
  };

  const updateText = (stageIndex, stepIndex, itemIndex, field, value) => {
    const newStages = [...stages];
    if (itemIndex === null && stepIndex === null) {
      newStages[stageIndex].title = value;
    } else if (itemIndex === null) {
      newStages[stageIndex].steps[stepIndex].title = value;
    } else {
      newStages[stageIndex].steps[stepIndex].items[itemIndex][field] = value;
    }
    setStages(newStages);
  };

  const updateStepStatus = (stageIndex, stepIndex, newStatus) => {
    const newStages = [...stages];
    newStages[stageIndex].steps[stepIndex].status = newStatus;
    setStages(newStages);
  };

  const deleteItem = (stageIndex, stepIndex, itemIndex) => {
    const newStages = [...stages];
    newStages[stageIndex].steps[stepIndex].items.splice(itemIndex, 1);
    setStages(newStages);
  };

  const toggleCheckbox = (stageIndex, stepIndex, itemIndex) => {
    const newStages = [...stages];
    const item = newStages[stageIndex].steps[stepIndex].items[itemIndex];
    item.isChecked = !item.isChecked;
    setStages(newStages);
  };

  return (
    <div className="max-w-[95%] mx-auto mt-6 px-4 pb-32" dir="rtl">
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 sticky top-4 z-40 gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-700">العميل: {request?.client_name || 'غير محدد'}</div>
          <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-700">البلد: {request?.country_name}</div>
          <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-700">نوع الفيزا: {request?.visa_type_name}</div>
          <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-700">
            الحالة المدنية: {CIVIL_STATUS_LABELS[request?.civil_status] || request?.civil_status}
          </div>
          {(request?.civil_status === 'student' || request?.civil_status === 'unemployed') && (
            <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-700">
              حالة الكفيل: {CIVIL_STATUS_LABELS[request?.sponsor_civil_status] || request?.sponsor_civil_status || '-'}
            </div>
          )}
          <div className={`px-4 py-2 rounded-lg font-bold border-2 ${getStatusColor(getOverallStatus(stages))}`}>
            حالة الملف: {getStatusLabel(getOverallStatus(stages))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageTemplates && isEditing && (
            <button onClick={saveAsTemplate} className="px-4 py-2 rounded-lg font-bold text-sm bg-purple-600 text-white hover:bg-purple-700">
              💾 حفظ كقالب
            </button>
          )}
          {canEditStructure && (
            <button
              onClick={() => setIsEditing((previous) => !previous)}
              className={`px-4 py-2 rounded-lg font-bold ${isEditing ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
            >
              {isEditing ? '🔒 إغلاق التعديل' : '⚙️ تفعيل التعديل'}
            </button>
          )}
          <button onClick={onBack} className="px-4 py-2 text-slate-500 hover:text-slate-800">← العودة</button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="xl:w-3/4 space-y-6">
          {stages.map((stage, stageIndex) => {
            const stageStatus = getStageStatus(stage);

            return (
              <div key={stage.id} className="bg-[#d4ff66] rounded-2xl p-6 border-2 border-[#c2f04b] shadow-md">
                <div className="flex justify-between items-center mb-6 gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {allowStructureEditing ? (
                      <input
                        value={stage.title}
                        onChange={(event) => updateText(stageIndex, null, null, null, event.target.value)}
                        className="text-2xl font-bold bg-transparent border-b-2 border-black outline-none"
                      />
                    ) : (
                      <h2 className="text-2xl font-bold">{stage.title}</h2>
                    )}
                    <div className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getStatusColor(stageStatus)}`}>
                      {getStatusLabel(stageStatus)}
                    </div>
                  </div>
                  {allowStructureEditing && (
                    <button onClick={() => deleteStage(stageIndex)} className="text-red-600 font-bold hover:text-red-800">
                      حذف المرحلة
                    </button>
                  )}
                </div>

                {stage.steps.map((step, stepIndex) => (
                  <div key={step.id} className="bg-white rounded-lg p-5 mb-5 border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-slate-200 gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        {allowStructureEditing ? (
                          <input
                            value={step.title}
                            onChange={(event) => updateText(stageIndex, stepIndex, null, null, event.target.value)}
                            className="font-bold outline-none border-b border-slate-400 bg-slate-50 px-2"
                          />
                        ) : (
                          <h3 className="font-bold text-lg">{step.title}</h3>
                        )}
                        <select
                          value={step.status || 'pending'}
                          onChange={(event) => updateStepStatus(stageIndex, stepIndex, event.target.value)}
                          disabled={!allowStructureEditing}
                          className={`px-3 py-1 rounded-lg font-semibold text-sm border-2 outline-none cursor-pointer ${getStatusColor(step.status || 'pending')}`}
                        >
                          <option value="pending">○ قيد الانتظار</option>
                          <option value="in_progress">⚙️ قيد العمل</option>
                          <option value="completed">✓ مكتملة</option>
                          <option value="cancelled">✗ ملغاة</option>
                        </select>
                      </div>
                      {allowStructureEditing && (
                        <button onClick={() => deleteStep(stageIndex, stepIndex)} className="text-red-500 text-sm font-bold hover:text-red-700">
                          حذف الخطوة
                        </button>
                      )}
                    </div>

                    <table className="w-full text-right mb-4 text-sm">
                      <thead>
                        <tr className="bg-gradient-to-l from-slate-100 to-slate-50 border-b-2 border-slate-300">
                          <th className="p-3 font-bold text-slate-700">الوثيقة/المهمة</th>
                          <th className="p-3 font-bold text-slate-700">ملاحظات</th>
                          <th className="p-3 font-bold text-slate-700">الرابط</th>
                          <th className="p-3 text-center font-bold text-slate-700">الحالة</th>
                          {allowStructureEditing && <th className="p-3 text-center font-bold text-slate-700">إجراء</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {step.items.map((item, itemIndex) => (
                          <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              {allowStructureEditing ? (
                                <input
                                  value={item.name}
                                  onChange={(event) => updateText(stageIndex, stepIndex, itemIndex, 'name', event.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              ) : (
                                <span className={item.isChecked ? 'line-through text-slate-500' : ''}>{item.name}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <input
                                value={item.note}
                                onChange={(event) => updateText(stageIndex, stepIndex, itemIndex, 'note', event.target.value)}
                                placeholder="أضف ملاحظة..."
                                readOnly={!canEditItemProgress}
                                className={`w-full px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!canEditItemProgress ? 'cursor-not-allowed opacity-80' : ''}`}
                              />
                            </td>
                            <td className="p-3">
                              <div className="space-y-2">
                                <input
                                  value={item.link}
                                  onChange={(event) => updateText(stageIndex, stepIndex, itemIndex, 'link', event.target.value)}
                                  placeholder="أضف رابط..."
                                  readOnly={!canEditItemProgress}
                                  className={`w-full px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm ${!canEditItemProgress ? 'cursor-not-allowed opacity-80' : ''}`}
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
                                checked={item.isChecked}
                                onChange={() => toggleCheckbox(stageIndex, stepIndex, itemIndex)}
                                disabled={!canEditItemProgress}
                                className="w-5 h-5 cursor-pointer"
                              />
                            </td>
                            {allowStructureEditing && (
                              <td className="p-3 text-center">
                                <button onClick={() => deleteItem(stageIndex, stepIndex, itemIndex)} className="text-red-500 hover:text-red-700 font-bold text-sm">
                                  حذف
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {allowStructureEditing && (
                      <div className="flex gap-2">
                        <button onClick={() => addItem(stageIndex, stepIndex)} className="text-blue-600 text-sm font-bold hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded">
                          + إضافة بند
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {allowStructureEditing && (
                  <button
                    onClick={() => addStep(stageIndex)}
                    className="w-full border-2 border-dashed border-[#c2f04b] hover:border-[#b0e645] bg-[#e8ff99] hover:bg-[#d9ff66] p-3 mt-4 font-bold text-[#666600] rounded-lg transition-all"
                  >
                    + إضافة خطوة جديدة
                  </button>
                )}
              </div>
            );
          })}

          {allowStructureEditing && (
            <button onClick={addStage} className="w-full bg-slate-800 hover:bg-slate-900 text-white p-4 rounded-xl font-bold transition-all">
              + إضافة مرحلة كبرى
            </button>
          )}
        </div>
      </div>

      {canSave && (
        <button
          onClick={() => saveToDatabase(stages)}
          disabled={isSaving}
          className={`fixed bottom-8 left-8 px-6 py-3 rounded-full font-bold text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-110 ${
            isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 active:scale-95'
          }`}
        >
          {isSaving ? '⏳ جاري الحفظ...' : '💾 حفظ التغييرات'}
        </button>
      )}
    </div>
  );
}