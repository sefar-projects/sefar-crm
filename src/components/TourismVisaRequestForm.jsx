import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const DEFAULT_PAYMENT_PLACE = '';

const CIVIL_STATUS_OPTIONS = [
  { value: 'retired', label: 'متقاعد' },
  { value: 'student', label: 'متمدرس' },
  { value: 'merchant', label: 'تاجر' },
  { value: 'public_employee', label: 'موظف عمومي' },
  { value: 'unemployed', label: 'بطال' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'married', label: 'متزوج' },
  { value: 'single', label: 'غير متزوج' },
];

const FAMILY_RELATIONSHIP_OPTIONS = [
  { value: 'son_daughter', label: 'ابن / ابنة' },
  { value: 'father_mother', label: 'أب / أم' },
  { value: 'spouse', label: 'زوج / زوجة' },
];

const CIVIL_STATUS_LABELS = Object.fromEntries(CIVIL_STATUS_OPTIONS.map((option) => [option.value, option.label]));
const MARITAL_STATUS_LABELS = Object.fromEntries(MARITAL_STATUS_OPTIONS.map((option) => [option.value, option.label]));
const FAMILY_RELATIONSHIP_LABELS = Object.fromEntries(FAMILY_RELATIONSHIP_OPTIONS.map((option) => [option.value, option.label]));

const normalizeValue = (value) => (typeof value === 'string' ? value.trim() : '');

const sortPaymentPlaces = (places) => {
  return [...places].sort((firstPlace, secondPlace) => firstPlace.name.localeCompare(secondPlace.name, 'ar'));
};

const getEmptyPerson = () => ({
  passport_link: '',
  father_name: '',
  mother_name: '',
  marital_status: '',
  civil_status: '',
  phone: '',
  email: '',
  residence_address: '',
  notes: '',
  family_relationship: '',
});

const clonePrimaryPerson = (person) => ({
  ...person,
  family_relationship: '',
});

const normalizePerson = (person) => ({
  passport_link: normalizeValue(person.passport_link),
  father_name: normalizeValue(person.father_name),
  mother_name: normalizeValue(person.mother_name),
  marital_status: normalizeValue(person.marital_status),
  civil_status: normalizeValue(person.civil_status),
  phone: normalizeValue(person.phone),
  email: normalizeValue(person.email),
  residence_address: normalizeValue(person.residence_address),
  notes: normalizeValue(person.notes),
  family_relationship: normalizeValue(person.family_relationship),
});

const isSponsorRequired = (civilStatus) => civilStatus === 'student' || civilStatus === 'unemployed';

export default function TourismVisaRequestForm({
  country,
  visaType,
  onBack,
  onCreateRequest,
}) {
  const [paymentPlaces, setPaymentPlaces] = useState([]);
  const [loadingPaymentPlaces, setLoadingPaymentPlaces] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [customPaymentPlace, setCustomPaymentPlace] = useState('');

  const [clientName, setClientName] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [primaryPerson, setPrimaryPerson] = useState(getEmptyPerson());
  const [companions, setCompanions] = useState([]);
  const [paymentPlace, setPaymentPlace] = useState(DEFAULT_PAYMENT_PLACE);
  const [sponsorData, setSponsorData] = useState({
    civil_status: '',
    job_title: '',
  });

  const shouldShowSponsor = useMemo(
    () => isSponsorRequired(primaryPerson.civil_status),
    [primaryPerson.civil_status],
  );

  const downloadRequestPdf = async (payload) => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('dir', 'rtl');
    wrapper.style.width = '794px';
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.transform = 'translateX(-120vw)';
    wrapper.style.background = '#ffffff';
    wrapper.style.color = '#0f172a';
    wrapper.style.fontFamily = 'Arial, Helvetica, sans-serif';
    wrapper.style.padding = '0';
    wrapper.style.zIndex = '-1';

    const companionsMarkup = (payload.companions_data || [])
      .map((person, index) => {
        return `
          <div class="companion">
            <div class="companion-title">عميل إضافي ${index + 2} - ${FAMILY_RELATIONSHIP_LABELS[person.family_relationship] || person.family_relationship || '-'}</div>
            <div class="grid">
              <div class="card"><div class="label">رابط الجواز</div><div class="value">${person.passport_link || '-'}</div></div>
              <div class="card"><div class="label">الحالة الاجتماعية</div><div class="value">${MARITAL_STATUS_LABELS[person.marital_status] || person.marital_status || '-'}</div></div>
              <div class="card"><div class="label">الحالة المدنية</div><div class="value">${CIVIL_STATUS_LABELS[person.civil_status] || person.civil_status || '-'}</div></div>
              <div class="card"><div class="label">الهاتف</div><div class="value">${person.phone || '-'}</div></div>
              <div class="card"><div class="label">الإيمايل</div><div class="value">${person.email || '-'}</div></div>
              <div class="card"><div class="label">العنوان</div><div class="value">${person.residence_address || '-'}</div></div>
            </div>
          </div>
        `;
      })
      .join('');

    const sponsorMarkup = payload.sponsor_job_title || payload.sponsor_civil_status
      ? `
        <div class="notes">
          <div class="label">بيانات الكفيل</div>
          <div class="value">الحالة المدنية: ${CIVIL_STATUS_LABELS[payload.sponsor_civil_status] || payload.sponsor_civil_status || '-'}</div>
          <div class="value">الصفة/المنصب: ${payload.sponsor_job_title || '-'}</div>
        </div>
      `
      : '';

    wrapper.innerHTML = `
      <style>
        .page { padding: 26px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
        .eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        h1 { margin: 0 0 8px; font-size: 27px; font-weight: 800; }
        p { margin: 0; color: #475569; font-size: 13px; line-height: 1.7; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 16px; }
        .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; background: #f8fafc; }
        .label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
        .value { font-size: 13px; font-weight: 700; word-break: break-word; }
        .notes { margin-top: 14px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; background: #f8fafc; }
        .companion { margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
        .companion-title { font-weight: 800; margin-bottom: 6px; }
      </style>
      <div class="page">
        <div class="header">
          <div>
            <div class="eyebrow">Sefar CRM</div>
            <h1>نموذج العميل السياحي</h1>
            <p>الاسم: ${payload.client_name || '-'}</p>
            <p>${country?.name || '-'} - ${visaType?.name || '-'}</p>
          </div>
          <div style="font-size:12px;color:#64748b;">${new Date().toLocaleString()}</div>
        </div>

        <div class="grid">
          <div class="card"><div class="label">عدد الأشخاص</div><div class="value">${payload.people_count || 1}</div></div>
          <div class="card"><div class="label">مكان الدفع</div><div class="value">${payload.payment_place_name || '-'}</div></div>
          <div class="card"><div class="label">رابط جواز السفر</div><div class="value">${payload.passport_link || '-'}</div></div>
          <div class="card"><div class="label">اسم ولقب الأب</div><div class="value">${payload.father_name || '-'}</div></div>
          <div class="card"><div class="label">اسم ولقب الأم</div><div class="value">${payload.mother_name || '-'}</div></div>
          <div class="card"><div class="label">الحالة الاجتماعية</div><div class="value">${MARITAL_STATUS_LABELS[payload.marital_status] || payload.marital_status || '-'}</div></div>
          <div class="card"><div class="label">الحالة المدنية</div><div class="value">${CIVIL_STATUS_LABELS[payload.civil_status] || payload.civil_status || '-'}</div></div>
          <div class="card"><div class="label">رقم الهاتف</div><div class="value">${payload.phone || '-'}</div></div>
          <div class="card"><div class="label">الإيمايل</div><div class="value">${payload.email || '-'}</div></div>
          <div class="card" style="grid-column: span 2;"><div class="label">عنوان الإقامة</div><div class="value">${payload.residence_address || '-'}</div></div>
        </div>

        <div class="notes">
          <div class="label">ملاحظات</div>
          <div class="value">${payload.notes || '-'}</div>
        </div>

        ${sponsorMarkup}
        ${companionsMarkup}
      </div>
    `;

    document.body.appendChild(wrapper);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: wrapper.scrollWidth,
        windowHeight: wrapper.scrollHeight,
      });

      const imageData = canvas.toDataURL('image/png');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;

      let remainingHeight = imageHeight;
      let imageOffset = 0;

      doc.addImage(imageData, 'PNG', 0, imageOffset, pageWidth, imageHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        imageOffset = remainingHeight - imageHeight;
        doc.addPage();
        doc.addImage(imageData, 'PNG', 0, imageOffset, pageWidth, imageHeight);
        remainingHeight -= pageHeight;
      }

      doc.save(`tourism-client-${payload.id || Date.now()}.pdf`);
    } finally {
      wrapper.remove();
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadPaymentPlaces = async () => {
      setErrorMessage('');

      const { data, error } = await supabase
        .from('tourism_payment_places')
        .select('id, name')
        .order('name', { ascending: true });

      if (!isActive) {
        return;
      }

      if (error) {
        console.error('Failed to load payment places:', error);
        if (error.code === '42P01') {
          setErrorMessage('جدول tourism_payment_places غير موجود في Supabase. أنشئه أولاً من SQL.');
        } else {
          setErrorMessage('تعذر تحميل أماكن الدفع من Supabase.');
        }
        setPaymentPlaces([]);
        setLoadingPaymentPlaces(false);
        return;
      }

      setPaymentPlaces(sortPaymentPlaces(data || []));
      setLoadingPaymentPlaces(false);
    };

    void loadPaymentPlaces();

    return () => {
      isActive = false;
    };
  }, []);

  const handlePeopleCountChange = (value) => {
    const numericCount = Math.max(1, Number(value || 1));
    const additionalCount = Math.max(0, numericCount - 1);

    setPeopleCount(numericCount);
    setCompanions((previous) => {
      const next = [...previous];

      while (next.length < additionalCount) {
        next.push(clonePrimaryPerson(primaryPerson));
      }

      if (next.length > additionalCount) {
        next.length = additionalCount;
      }

      return next;
    });
  };

  const handlePrimaryChange = (field, value) => {
    setPrimaryPerson((previous) => ({ ...previous, [field]: value }));
  };

  const handleCompanionChange = (index, field, value) => {
    setCompanions((previous) => previous.map((person, personIndex) => (
      personIndex === index ? { ...person, [field]: value } : person
    )));
  };

  const ensurePaymentPlace = async (rawPaymentPlace) => {
    const normalized = normalizeValue(rawPaymentPlace);
    if (!normalized) {
      return null;
    }

    const existing = paymentPlaces.find((place) => place.name.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from('tourism_payment_places')
      .insert([{ name: normalized }])
      .select('id, name')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: refetched } = await supabase
          .from('tourism_payment_places')
          .select('id, name')
          .order('name', { ascending: true });
        const matched = (refetched || []).find((place) => place.name.toLowerCase() === normalized.toLowerCase());
        return matched || null;
      }

      throw error;
    }

    setPaymentPlaces((previous) => sortPaymentPlaces([...previous, data]));
    return data;
  };

  const loadTourismTemplate = async (civilStatus) => {
    const { data, error } = await supabase
      .from('tourism_visa_templates')
      .select('stages_data')
      .eq('country_id', country.id)
      .eq('visa_type_id', visaType.id)
      .eq('civil_status', civilStatus)
      .maybeSingle();

    if (error) {
      console.error('Failed to load tourism template:', error);
      return [];
    }

    return Array.isArray(data?.stages_data) ? data.stages_data : [];
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    const normalizedPrimary = normalizePerson(primaryPerson);
    const normalizedClientName = normalizeValue(clientName);
    const normalizedCompanions = companions.map(normalizePerson);
    const normalizedSponsorCivilStatus = normalizeValue(sponsorData.civil_status);
    const normalizedSponsorJobTitle = normalizeValue(sponsorData.job_title);

    const paymentPlaceValue =
      paymentPlace === 'other'
        ? normalizeValue(customPaymentPlace)
        : normalizeValue(paymentPlace);

    if (!normalizedClientName) {
      setErrorMessage('الرجاء إدخال اسم العميل.');
      return;
    }

    const requiredPrimaryFields = [
      normalizedPrimary.passport_link,
      normalizedPrimary.father_name,
      normalizedPrimary.mother_name,
      normalizedPrimary.marital_status,
      normalizedPrimary.civil_status,
      normalizedPrimary.phone,
      normalizedPrimary.email,
      normalizedPrimary.residence_address,
      paymentPlaceValue,
    ];

    if (requiredPrimaryFields.some((field) => !field)) {
      setErrorMessage('الرجاء تعبئة كل الحقول المطلوبة لبيانات العميل الرئيسي.');
      return;
    }

    if (normalizedCompanions.some((person) => !person.family_relationship)) {
      setErrorMessage('الرجاء تحديد العلاقة العائلية لكل عميل إضافي.');
      return;
    }

    if (isSponsorRequired(normalizedPrimary.civil_status) && (!normalizedSponsorCivilStatus || !normalizedSponsorJobTitle)) {
      setErrorMessage('الرجاء تعبئة بيانات الكفيل لأن الحالة المدنية هي بطال أو متمدرس.');
      return;
    }

    setSaving(true);

    try {
      const paymentPlaceRow = await ensurePaymentPlace(paymentPlaceValue);
      if (!paymentPlaceRow) {
        setErrorMessage('تعذر حفظ مكان الدفع.');
        setSaving(false);
        return;
      }

      const initialStages = await loadTourismTemplate(normalizedPrimary.civil_status);

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user || null;

      const { data: requestRows, error } = await supabase.from('tourism_visa_requests').insert([
        {
          country_id: country.id,
          country_name: country.name,
          visa_type_id: visaType.id,
          visa_type_name: visaType.name,
          client_name: normalizedClientName,
          people_count: Math.max(1, Number(peopleCount || 1)),
          companions_data: normalizedCompanions,
          civil_status: normalizedPrimary.civil_status,
          sponsor_civil_status: normalizedSponsorCivilStatus || null,
          sponsor_job_title: normalizedSponsorJobTitle || null,
          passport_link: normalizedPrimary.passport_link,
          father_name: normalizedPrimary.father_name,
          mother_name: normalizedPrimary.mother_name,
          marital_status: normalizedPrimary.marital_status,
          phone: normalizedPrimary.phone,
          email: normalizedPrimary.email,
          residence_address: normalizedPrimary.residence_address,
          notes: normalizedPrimary.notes || null,
          payment_place_id: paymentPlaceRow.id,
          payment_place_name: paymentPlaceRow.name,
          stages_data: initialStages,
          status: 'working_on',
          created_by: currentUser?.id || null,
        },
      ]).select();

      if (error) {
        throw error;
      }

      const createdRequest = requestRows?.[0] || null;

      if (createdRequest) {
        await downloadRequestPdf(createdRequest);
      }

      setMessage('تم حفظ بيانات العميل بنجاح.');
      setClientName('');
      setPeopleCount(1);
      setPrimaryPerson(getEmptyPerson());
      setCompanions([]);
      setPaymentPlace(DEFAULT_PAYMENT_PLACE);
      setCustomPaymentPlace('');
      setSponsorData({ civil_status: '', job_title: '' });

      if (createdRequest && onCreateRequest) {
        onCreateRequest(createdRequest);
      }
    } catch (error) {
      console.error('Failed to save tourism visa request:', error);
      if (error.code === '42P01') {
        setErrorMessage('الجدول غير مكتمل في Supabase (tourism_visa_requests). أضف الأعمدة الجديدة أولاً.');
      } else {
        setErrorMessage('تعذر حفظ بيانات العميل حالياً.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto mt-10 px-4 pb-12" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">نموذج العميل السياحي</h2>
          <p className="text-sm text-slate-500 mt-1">
            {country?.name ? `${country.name} - ` : ''}
            {visaType?.name || ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          ← العودة لأنواع الفيزا
        </button>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-6 py-5">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-300">Tourism Request</div>
          <h3 className="text-xl font-black mt-1">إدخال بيانات العميل</h3>
          <p className="text-sm text-slate-300 mt-2">بعد الحفظ سيتم تنزيل PDF تلقائياً، وسيظهر اسم العميل في مساحة العمل السياحية للبحث السريع.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">اسم العميل</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="الاسم الكامل للعميل"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">عدد الأشخاص</label>
              <input
                type="number"
                min={1}
                required
                value={peopleCount}
                onChange={(event) => handlePeopleCountChange(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-black text-slate-900 mb-4">بيانات العميل الرئيسي</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">جواز السفر</label>
                <input
                  type="url"
                  required
                  value={primaryPerson.passport_link}
                  onChange={(event) => handlePrimaryChange('passport_link', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="رابط Google Drive لجواز السفر"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة الاجتماعية</label>
                <select
                  required
                  value={primaryPerson.marital_status}
                  onChange={(event) => handlePrimaryChange('marital_status', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر الحالة...</option>
                  {MARITAL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة المدنية</label>
                <select
                  required
                  value={primaryPerson.civil_status}
                  onChange={(event) => handlePrimaryChange('civil_status', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر الحالة المدنية...</option>
                  {CIVIL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">اسم ولقب الأب</label>
                <input
                  type="text"
                  required
                  value={primaryPerson.father_name}
                  onChange={(event) => handlePrimaryChange('father_name', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="اسم ولقب الأب"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">اسم ولقب الأم</label>
                <input
                  type="text"
                  required
                  value={primaryPerson.mother_name}
                  onChange={(event) => handlePrimaryChange('mother_name', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="اسم ولقب الأم"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">رقم الهاتف</label>
                <input
                  type="text"
                  required
                  value={primaryPerson.phone}
                  onChange={(event) => handlePrimaryChange('phone', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="رقم الهاتف"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الإيمايل</label>
                <input
                  type="email"
                  required
                  value={primaryPerson.email}
                  onChange={(event) => handlePrimaryChange('email', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@email.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">مكان دفع ملف الفيزا</label>
                <select
                  required
                  value={paymentPlace}
                  onChange={(event) => setPaymentPlace(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر مكان الدفع...</option>
                  {paymentPlaces.map((place) => (
                    <option key={place.id} value={place.name}>{place.name}</option>
                  ))}
                  <option value="other">+ إضافة مكان دفع جديد...</option>
                </select>
              </div>

              {paymentPlace === 'other' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">مكان دفع جديد</label>
                  <input
                    type="text"
                    required
                    value={customPaymentPlace}
                    onChange={(event) => setCustomPaymentPlace(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="أدخل مكان الدفع الجديد"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان الإقامة</label>
                <input
                  type="text"
                  required
                  value={primaryPerson.residence_address}
                  onChange={(event) => handlePrimaryChange('residence_address', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="عنوان الإقامة"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">ملاحظات</label>
                <textarea
                  value={primaryPerson.notes}
                  onChange={(event) => handlePrimaryChange('notes', event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أي ملاحظات إضافية..."
                />
              </div>
            </div>
          </div>

          {shouldShowSponsor && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-black text-slate-900 mb-4">بيانات الكفيل</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة المدنية للكفيل</label>
                  <select
                    required
                    value={sponsorData.civil_status}
                    onChange={(event) => setSponsorData((previous) => ({ ...previous, civil_status: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">اختر الحالة...</option>
                    {CIVIL_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">صفة/منصب الكفيل</label>
                  <input
                    type="text"
                    required
                    value={sponsorData.job_title}
                    onChange={(event) => setSponsorData((previous) => ({ ...previous, job_title: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="مثال: موظف عمومي، تاجر..."
                  />
                </div>
              </div>
            </div>
          )}

          {companions.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-slate-900">بيانات العملاء الإضافيين</h4>
              {companions.map((person, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-bold text-slate-900 mb-3">العميل الإضافي رقم {index + 2}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">العلاقة العائلية</label>
                      <select
                        required
                        value={person.family_relationship}
                        onChange={(event) => handleCompanionChange(index, 'family_relationship', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">اختر العلاقة...</option>
                        {FAMILY_RELATIONSHIP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">جواز السفر</label>
                      <input
                        type="url"
                        value={person.passport_link}
                        onChange={(event) => handleCompanionChange(index, 'passport_link', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="رابط Google Drive"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة الاجتماعية</label>
                      <select
                        value={person.marital_status}
                        onChange={(event) => handleCompanionChange(index, 'marital_status', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">اختر الحالة...</option>
                        {MARITAL_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">الحالة المدنية</label>
                      <select
                        value={person.civil_status}
                        onChange={(event) => handleCompanionChange(index, 'civil_status', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">اختر الحالة...</option>
                        {CIVIL_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">الهاتف</label>
                      <input
                        type="text"
                        value={person.phone}
                        onChange={(event) => handleCompanionChange(index, 'phone', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">الإيمايل</label>
                      <input
                        type="email"
                        value={person.email}
                        onChange={(event) => handleCompanionChange(index, 'email', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان الإقامة</label>
                      <input
                        type="text"
                        value={person.residence_address}
                        onChange={(event) => handleCompanionChange(index, 'residence_address', event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{errorMessage}</div>
          )}

          {message && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>
          )}

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              العودة
            </button>
            <button
              type="submit"
              disabled={saving || loadingPaymentPlaces}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ بيانات العميل'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
