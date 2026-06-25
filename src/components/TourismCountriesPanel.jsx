import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const DEFAULT_COUNTRY = 'تركيا';
const DEFAULT_VISA_TYPE = 'فيزا سياحية';

const normalizeCountry = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeVisaType = (value) => (typeof value === 'string' ? value.trim() : '');

const sortCountries = (countries) => {
  return [...countries].sort((firstCountry, secondCountry) => firstCountry.name.localeCompare(secondCountry.name, 'ar'));
};

const sortVisaTypes = (types) => {
  return [...types].sort((firstType, secondType) => firstType.name.localeCompare(secondType.name, 'ar'));
};

export default function TourismCountriesPanel({ onBack, onSelectVisaType }) {
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [visaTypes, setVisaTypes] = useState([]);
  const [newCountry, setNewCountry] = useState('');
  const [newVisaType, setNewVisaType] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typesLoading, setTypesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadVisaTypesForCountry = async (country) => {
    if (!country?.id) {
      setSelectedCountry(null);
      setVisaTypes([]);
      return;
    }

    setTypesLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('tourism_visa_types')
      .select('id, country_id, name')
      .eq('country_id', country.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load tourism visa types:', error);
      if (error.code === '42P01') {
        setErrorMessage('جدول tourism_visa_types غير موجود في Supabase. أنشئه أولاً من SQL.');
      } else {
        setErrorMessage('تعذر تحميل أنواع الفيزا لهذا البلد.');
      }
      setSelectedCountry(country);
      setVisaTypes([]);
      setTypesLoading(false);
      return;
    }

    let rows = Array.isArray(data) ? data : [];

    if (rows.length === 0) {
      const { error: seedTypeError } = await supabase
        .from('tourism_visa_types')
        .insert([{ country_id: country.id, name: DEFAULT_VISA_TYPE }]);

      if (!seedTypeError) {
        const { data: seededTypes, error: seededTypesError } = await supabase
          .from('tourism_visa_types')
          .select('id, country_id, name')
          .eq('country_id', country.id)
          .order('name', { ascending: true });

        if (!seededTypesError) {
          rows = seededTypes || [];
        }
      }
    }

    setSelectedCountry(country);
    setVisaTypes(sortVisaTypes(rows));
    setTypesLoading(false);
  };

  useEffect(() => {
    const loadCountries = async () => {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('tourism_countries')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Failed to load tourism countries:', error);
        if (error.code === '42P01') {
          setErrorMessage('جدول tourism_countries غير موجود في Supabase. أنشئه أولاً من SQL.');
        } else {
          setErrorMessage('تعذر تحميل قائمة البلدان من Supabase.');
        }
        setCountries([]);
        setLoading(false);
        return;
      }

      const rows = Array.isArray(data) ? data : [];

      if (rows.length === 0) {
        const { error: seedError } = await supabase
          .from('tourism_countries')
          .insert([{ name: DEFAULT_COUNTRY }]);

        if (seedError) {
          console.error('Failed to seed default tourism country:', seedError);
        } else {
          const { data: seededRows, error: refetchError } = await supabase
            .from('tourism_countries')
            .select('id, name')
            .order('name', { ascending: true });

          if (!refetchError) {
            const sortedSeededRows = sortCountries(seededRows || []);
            setCountries(sortedSeededRows);
            await loadVisaTypesForCountry(sortedSeededRows[0] || null);
            setLoading(false);
            return;
          }
        }
      }

      const sortedRows = sortCountries(rows);
      setCountries(sortedRows);
      await loadVisaTypesForCountry(sortedRows[0] || null);
      setLoading(false);
    };

    void loadCountries();
  }, []);

  const handleAddCountry = async (event) => {
    event.preventDefault();
    const normalized = normalizeCountry(newCountry);
    setMessage('');
    setErrorMessage('');

    if (!normalized) {
      setMessage('الرجاء إدخال اسم بلد صحيح.');
      return;
    }

    if (countries.some((country) => country.name.toLowerCase() === normalized.toLowerCase())) {
      setMessage('هذا البلد موجود بالفعل في القائمة.');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from('tourism_countries')
      .insert([{ name: normalized }])
      .select('id, name')
      .single();

    if (error) {
      console.error('Failed to add tourism country:', error);
      if (error.code === '23505') {
        setMessage('هذا البلد موجود بالفعل في القائمة.');
      } else {
        setErrorMessage('تعذر إضافة البلد حالياً.');
      }
      setSaving(false);
      return;
    }

    const nextCountries = sortCountries([...countries, data]);
    setCountries(nextCountries);
    setNewCountry('');
    setSaving(false);
    setMessage('تمت إضافة البلد بنجاح.');
    await loadVisaTypesForCountry(data);
  };

  const handleRemoveCountry = async (country) => {
    setMessage('');
    setErrorMessage('');

    if (country.name === DEFAULT_COUNTRY) {
      setMessage('لا يمكن حذف البلد الافتراضي تركيا.');
      return;
    }

    const { error } = await supabase
      .from('tourism_countries')
      .delete()
      .eq('id', country.id);

    if (error) {
      console.error('Failed to delete tourism country:', error);
      setErrorMessage('تعذر حذف البلد حالياً.');
      return;
    }

    const nextCountries = countries.filter((row) => row.id !== country.id);
    setCountries(nextCountries);
    if (selectedCountry?.id === country.id) {
      await loadVisaTypesForCountry(nextCountries[0] || null);
    }
    setMessage('تم حذف البلد من القائمة.');
  };

  const handleAddVisaType = async (event) => {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!selectedCountry?.id) {
      setMessage('اختر بلدًا أولاً ثم أضف نوع الفيزا.');
      return;
    }

    const normalized = normalizeVisaType(newVisaType);
    if (!normalized) {
      setMessage('الرجاء إدخال نوع فيزا صحيح.');
      return;
    }

    if (visaTypes.some((type) => type.name.toLowerCase() === normalized.toLowerCase())) {
      setMessage('هذا النوع موجود بالفعل لهذا البلد.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('tourism_visa_types')
      .insert([{ country_id: selectedCountry.id, name: normalized }])
      .select('id, country_id, name')
      .single();

    if (error) {
      console.error('Failed to add tourism visa type:', error);
      if (error.code === '23505') {
        setMessage('هذا النوع موجود بالفعل لهذا البلد.');
      } else {
        setErrorMessage('تعذر إضافة نوع الفيزا حالياً.');
      }
      setSaving(false);
      return;
    }

    setVisaTypes((previous) => sortVisaTypes([...previous, data]));
    setNewVisaType('');
    setSaving(false);
    setMessage('تمت إضافة نوع الفيزا بنجاح.');
  };

  const handleRemoveVisaType = async (visaType) => {
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('tourism_visa_types')
      .delete()
      .eq('id', visaType.id);

    if (error) {
      console.error('Failed to delete tourism visa type:', error);
      setErrorMessage('تعذر حذف نوع الفيزا حالياً.');
      return;
    }

    setVisaTypes((previous) => previous.filter((row) => row.id !== visaType.id));
    setMessage('تم حذف نوع الفيزا من البلد.');
  };

  return (
    <main className="max-w-5xl mx-auto mt-10 px-4 pb-12" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">قسم السياحة والأسفار</h2>
          <p className="text-sm text-slate-500 mt-1">هذه شاشة بداية خاصة بالسياحة، ويمكنك إدارة قائمة البلدان هنا.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          ← العودة للرئيسية
        </button>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-5">
          <div className="text-xs uppercase tracking-[0.25em] text-emerald-100">Tourism</div>
          <h3 className="text-xl font-black mt-1">قائمة البلدان</h3>
          <p className="text-sm text-emerald-50 mt-2">اختر بلدًا ثم ستظهر أنواع الفيزا الخاصة به، ويمكنك إضافة أنواع جديدة لكل بلد.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-lg font-black text-slate-900">البلدان</h4>

              <form onSubmit={handleAddCountry} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <input
                  type="text"
                  value={newCountry}
                  onChange={(event) => setNewCountry(event.target.value)}
                  placeholder="أدخل اسم بلد جديد..."
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition"
                >
                  {saving ? 'جاري الإضافة...' : '+ إضافة بلد'}
                </button>
              </form>

              <div className="grid grid-cols-1 gap-3">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                    جاري تحميل البلدان...
                  </div>
                ) : countries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                    لا توجد بلدان بعد.
                  </div>
                ) : countries.map((country) => (
                  <div
                    key={country.id}
                    className={`rounded-2xl border p-4 flex items-center justify-between gap-3 transition ${
                      selectedCountry?.id === country.id
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadVisaTypesForCountry(country)}
                      className="text-right flex-1 font-bold text-slate-900"
                    >
                      {country.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(country)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        country.name === DEFAULT_COUNTRY
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                      disabled={country.name === DEFAULT_COUNTRY || loading || saving}
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-black text-slate-900">
                أنواع الفيزا {selectedCountry ? `- ${selectedCountry.name}` : ''}
              </h4>

              {!selectedCountry ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                  اختر بلدًا من القائمة لتظهر أنواع الفيزا الخاصة به.
                </div>
              ) : (
                <>
                  <form onSubmit={handleAddVisaType} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                    <input
                      type="text"
                      value={newVisaType}
                      onChange={(event) => setNewVisaType(event.target.value)}
                      placeholder={`أدخل نوع فيزا جديد لـ ${selectedCountry.name}...`}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={saving || typesLoading}
                      className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition"
                    >
                      {saving ? 'جاري الإضافة...' : '+ إضافة نوع'}
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-3">
                    {typesLoading ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                        جاري تحميل أنواع الفيزا...
                      </div>
                    ) : visaTypes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                        لا توجد أنواع فيزا لهذا البلد بعد.
                      </div>
                    ) : visaTypes.map((visaType) => (
                      <div key={visaType.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onSelectVisaType?.({ country: selectedCountry, visaType })}
                          className="text-right flex-1 font-bold text-slate-900 hover:text-blue-700 transition"
                        >
                          {visaType.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVisaType(visaType)}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold transition bg-red-50 text-red-700 hover:bg-red-100"
                          disabled={typesLoading || saving}
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
