import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from './supabaseClient'; // أضفنا هذا السطر
import logo from './assets/logo.png';
import VisaSteps from './components/VisaSteps';
import EmployeeAccessManager from './components/EmployeeAccessManager';
import TemplateManager from './components/TemplateManager';
import TemplateScopeSelector from './components/TemplateScopeSelector';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import ProfilePanel from './components/ProfilePanel';
import TourismCountriesPanel from './components/TourismCountriesPanel';
import TourismVisaRequestForm from './components/TourismVisaRequestForm';
import TourismVisaSteps from './components/TourismVisaSteps';
import TourismTemplateManager from './components/TourismTemplateManager';

const ROLE_LABELS = {
  admin: 'مدير النظام',
  visa_editor: 'محرر ملفات الفيزا',
  tourism_editor: 'محرر ملفات السياحة',
  notes_only: 'ملاحظات فقط',
};

const ROLE_PERMISSIONS = {
  admin: {
    canStartVisa: true,
    canStartTourism: true,
    canRestoreClient: true,
    canCreateClient: true,
    canEditStructure: true,
    canEditItemProgress: true,
    canManageTemplates: true,
    canManageEmployees: true,
  },
  visa_editor: {
    canStartVisa: true,
    canStartTourism: false,
    canRestoreClient: true,
    canCreateClient: true,
    canEditStructure: true,
    canEditItemProgress: true,
    canManageTemplates: false,
    canManageEmployees: false,
  },
  tourism_editor: {
    canStartVisa: false,
    canStartTourism: true,
    canRestoreClient: true,
    canCreateClient: true,
    canEditStructure: true,
    canEditItemProgress: true,
    canManageTemplates: false,
    canManageEmployees: false,
  },
  notes_only: {
    canStartVisa: true,
    canStartTourism: false,
    canRestoreClient: true,
    canCreateClient: false,
    canEditStructure: false,
    canEditItemProgress: true,
    canManageTemplates: false,
    canManageEmployees: false,
  },
};

const DEFAULT_DESTINATIONS = ['المجر', 'إسبانيا', 'إيطاليا'];

const normalizeDestination = (value) => (typeof value === 'string' ? value.trim() : '');

const buildDestinationOptions = (...groups) => {
  const deduped = new Set();

  groups.flat().forEach((value) => {
    const normalized = normalizeDestination(value);
    if (normalized) {
      deduped.add(normalized);
    }
  });

  return Array.from(deduped).sort((firstCountry, secondCountry) => firstCountry.localeCompare(secondCountry, 'ar'));
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceScopeSelectorOpen, setWorkspaceScopeSelectorOpen] = useState(false);
  const [workspaceScope, setWorkspaceScope] = useState(null);
  const [currentClient, setCurrentClient] = useState(null);
  const [tourismSelection, setTourismSelection] = useState(null);
  const [currentTourismRequest, setCurrentTourismRequest] = useState(null);
  const [existingClients, setExistingClients] = useState([]);
  const [tourismRequests, setTourismRequests] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState(DEFAULT_DESTINATIONS);
  const { register, handleSubmit, reset, watch } = useForm();
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedDestination = watch('destination');
  const roleKey = profile?.role || 'notes_only';
  const currentPermissions = ROLE_PERMISSIONS[roleKey] || ROLE_PERMISSIONS.notes_only;

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await supabase.auth.signOut();
  };

  const toggleWorkspace = () => {
    if (workspaceOpen || workspaceScopeSelectorOpen) {
      setWorkspaceOpen(false);
      setWorkspaceScopeSelectorOpen(false);
      return;
    }

    setWorkspaceScopeSelectorOpen(true);
    setUserDropdownOpen(false);
  };

  const closeWorkspace = () => {
    setWorkspaceOpen(false);
    setWorkspaceScopeSelectorOpen(false);
  };

  const openWorkspaceScope = (scope) => {
    setWorkspaceScope(scope);
    setWorkspaceOpen(true);
    setWorkspaceScopeSelectorOpen(false);
    setUserDropdownOpen(false);
  };

  const loadUserProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, role, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error);
      setAuthError('تعذر تحميل ملف الموظف.');
      setProfile(null);
      return;
    }

    if (!data) {
      setAuthError('لا يوجد ملف موظف مرتبط بهذا الحساب. تواصل مع المدير.');
      setProfile(null);
      return;
    }

    if (!data.is_active) {
      setAuthError('تم إيقاف هذا الحساب. تواصل مع المدير.');
      setProfile(null);
      await supabase.auth.signOut();
      return;
    }

    setAuthError('');
    setProfile(data);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');
    setLoginSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email.trim(),
      password: loginForm.password,
    });

    if (error) {
      setAuthError(error.message || 'فشل تسجيل الدخول.');
    }

    setLoginSubmitting(false);
  };

  const handleSelectClient = (client) => {
    if (!client) return;

    if (workspaceScope === 'tourism') {
      setCurrentTourismRequest(client);
      setCurrentScreen('tourism_steps');
    } else {
      setCurrentClient(client);
      setCurrentScreen('visa_steps');
    }

    setUserDropdownOpen(false);
    setWorkspaceOpen(false);
  };

  const handleUpdateClientStatus = async (clientId, nextStatus) => {
    const status = nextStatus === 'cancelled' ? 'canceled' : nextStatus;

    const tableName = workspaceScope === 'tourism' ? 'tourism_visa_requests' : 'clients';

    const { error } = await supabase
      .from(tableName)
      .update({ status })
      .eq('id', clientId);

    if (error) {
      console.error('Failed to update client status:', error);
      alert('تعذر تحديث حالة العميل.');
      return;
    }

    if (workspaceScope === 'tourism') {
      setTourismRequests((previousRequests) => previousRequests.map((request) => (
        request.id === clientId ? { ...request, status } : request
      )));

      setCurrentTourismRequest((previousRequest) => (
        previousRequest?.id === clientId ? { ...previousRequest, status } : previousRequest
      ));
    } else {
      setExistingClients((previousClients) => previousClients.map((client) => (
        client.id === clientId ? { ...client, status } : client
      )));

      setCurrentClient((previousClient) => (
        previousClient?.id === clientId ? { ...previousClient, status } : previousClient
      ));
    }
  };

  const loadDestinationOptions = async () => {
    const [clientsResponse, templatesResponse] = await Promise.all([
      supabase.from('clients').select('destination'),
      supabase.from('visa_templates').select('destination'),
    ]);

    if (clientsResponse.error) {
      console.error('Failed to load destinations from clients:', clientsResponse.error);
    }

    if (templatesResponse.error) {
      console.error('Failed to load destinations from templates:', templatesResponse.error);
    }

    const clientDestinations = (clientsResponse.data || []).map((row) => row.destination);
    const templateDestinations = (templatesResponse.data || []).map((row) => row.destination);

    setDestinationOptions(buildDestinationOptions(DEFAULT_DESTINATIONS, clientDestinations, templateDestinations));
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        setAuthError(error.message || 'تعذر التحقق من الجلسة.');
      }

      const nextSession = data?.session || null;
      setSession(nextSession);

      if (nextSession?.user) {
        await loadUserProfile(nextSession.user.id);
      }

      if (isMounted) {
        setAuthLoading(false);
      }
    };

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setCurrentScreen('home');
        setCurrentClient(null);
        setTourismSelection(null);
        setCurrentTourismRequest(null);
        setWorkspaceOpen(false);
        setWorkspaceScopeSelectorOpen(false);
        setProfile(null);
        setAuthLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        setCurrentScreen('home');
        setCurrentClient(null);
        setTourismSelection(null);
        setCurrentTourismRequest(null);
      }

      await loadUserProfile(nextSession.user.id);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleHomeBack = () => {
    setCurrentScreen('home');
    setUserDropdownOpen(false);
    setCurrentClient(null);
    setTourismSelection(null);
    setCurrentTourismRequest(null);
  };

  const handleOpenTourismRequest = (selection) => {
    if (!selection?.country || !selection?.visaType) return;

    setTourismSelection(selection);
    setCurrentTourismRequest(null);
    setCurrentScreen('tourism_request');
    setUserDropdownOpen(false);
  };

  const handleCreateTourismRequest = (request) => {
    setCurrentTourismRequest(request);
    setCurrentScreen('tourism_steps');
  };

  useEffect(() => {
    if (!session || !profile) {
      setExistingClients([]);
      return;
    }

    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, destination, stages_data, status, created_at');

      if (error) {
        console.error('Failed to load clients:', error);
        return;
      }

      setExistingClients(data || []);
    };

    const fetchTourismRequests = async () => {
      const { data, error } = await supabase
        .from('tourism_visa_requests')
        .select('id, client_name, country_name, visa_type_name, civil_status, stages_data, status, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load tourism requests:', error);
        return;
      }

      const mapped = (data || []).map((row) => ({
        ...row,
        first_name: row.client_name || 'عميل سياحي',
        last_name: '',
        destination: row.country_name || 'غير محددة',
      }));

      setTourismRequests(mapped);
    };

    fetchClients();
    fetchTourismRequests();
    loadDestinationOptions();
  }, [session, profile]);

  // هذه الدالة ستعمل عند الضغط على زر "الالمرحلة التالية"
const onSubmit = async (data) => {
    if (!currentPermissions.canCreateClient) {
      alert('ليس لديك صلاحية إنشاء ملفات جديدة.');
      return;
    }

    try {
      const finalDestination = normalizeDestination(data.destination === 'other' ? data.customDestination : data.destination);

      if (!finalDestination) {
        alert('الرجاء اختيار وجهة صالحة.');
        return;
      }

      // 1. البحث الذكي عن قالب جاهز لهذه الدولة في Supabase
      const { data: templateData, error: templateError } = await supabase
        .from('visa_templates')
        .select('stages_data')
        .eq('destination', finalDestination)
        .maybeSingle(); // maybeSingle لا تظهر خطأ إذا لم تجد شيئاً
      if (templateError) throw templateError;

      // إذا وجد قالباً يسحبه، وإلا يترك مساحة العمل فارغة لتبنيها أنت
      const initialStages = templateData ? templateData.stages_data : [];

      // 2. إنشاء العميل مع القالب المسحوب (أو الفارغ)
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert([
          {
            first_name: data.firstName,
            last_name: data.lastName,
            dob: data.dob,
            passport_number: data.passport,
            national_id: data.nationalId,
            destination: finalDestination,
            education: data.education,
            status: data.status || 'working_on',
            stages_data: initialStages,
            created_by: session?.user?.id || null,
            assigned_to: session?.user?.id || null,
          }
        ])
        .select();

      if (insertError) throw insertError;

      const createdClient = newClient[0];
      setCurrentClient(createdClient);
      setExistingClients((prev) => [...prev, createdClient]);
      setDestinationOptions((previous) => buildDestinationOptions(previous, [finalDestination]));
      reset();
      setCurrentScreen('visa_steps');
      
    } catch (error) {
      console.error("Error:", error);
      alert("حدث خطأ أثناء حفظ البيانات.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg px-6 py-8 text-center w-full max-w-md">
            <div className="text-slate-800 font-bold mb-2">جاري التحميل...</div>
            <p className="text-slate-500 text-sm">يتم تجهيز جلسة الموظف.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
        <main className="min-h-screen flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-4xl bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-5">
              <div className="lg:col-span-2 bg-slate-900 text-white p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs mb-6">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  بوابة الموظفين
                </div>
                <h1 className="text-3xl font-extrabold leading-tight mb-4">تسجيل الدخول إلى النظام</h1>
                <p className="text-slate-300 text-sm leading-7">
                  يتم تحديد الصلاحيات تلقائياً بناءً على دور الموظف المخزن في جدول profiles داخل Supabase.
                </p>
              </div>

              <div className="lg:col-span-3 p-6 lg:p-10">
                <h2 className="text-xl font-bold text-slate-800 mb-6">دخول الموظف</h2>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">البريد الإلكتروني</label>
                    <input
                      type="email"
                      required
                      value={loginForm.email}
                      onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="employee@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">كلمة المرور</label>
                    <input
                      type="password"
                      required
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="********"
                    />
                  </div>

                  {authError && (
                    <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full bg-[#c4ff4d] hover:bg-[#b0e645] text-slate-900 font-extrabold text-lg py-3 px-6 rounded-xl transition-all shadow-sm disabled:opacity-60"
                  >
                    {loginSubmitting ? 'جاري الدخول...' : 'تسجيل الدخول'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center w-full max-w-lg">
            <h2 className="text-2xl font-bold text-slate-800 mb-3">تعذر فتح حساب الموظف</h2>
            <p className="text-slate-500 mb-4">{authError || 'ملف الموظف غير متوفر أو غير مفعل.'}</p>
            <button onClick={handleLogout} className="px-5 py-2 rounded-lg font-bold bg-slate-800 text-white hover:bg-slate-900">
              تسجيل الخروج
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (


    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
        <div className="min-h-screen">
          {workspaceOpen && (
            <div className="fixed inset-0 z-40">
              <button
                type="button"
                aria-label="إغلاق مساحة العمل"
                onClick={closeWorkspace}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              />
              <aside className="absolute inset-y-0 left-0 w-full max-w-[420px] bg-white shadow-2xl border-r border-slate-200 overflow-y-auto">
                <WorkspaceSidebar
                  clients={workspaceScope === 'tourism' ? tourismRequests : existingClients}
                  currentClient={workspaceScope === 'tourism' ? currentTourismRequest : currentClient}
                  onSelectClient={handleSelectClient}
                  onUpdateClientStatus={handleUpdateClientStatus}
                  canUpdateClientStatus={currentPermissions.canEditStructure}
                  scope={workspaceScope === 'tourism' ? 'tourism' : 'study'}
                  onlyRecent={workspaceScope === 'tourism'}
                  onClose={closeWorkspace}
                />
              </aside>
            </div>
          )}

          {workspaceScopeSelectorOpen && (
            <div className="fixed inset-0 z-40">
              <button
                type="button"
                aria-label="إغلاق اختيار مساحة العمل"
                onClick={() => setWorkspaceScopeSelectorOpen(false)}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              />

              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl p-6" dir="rtl">
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">Workspace Scope</div>
                    <h3 className="text-2xl font-black text-slate-900">اختر نوع مساحة العمل</h3>
                    <p className="text-sm text-slate-500 mt-1">حدد المسار الذي تريد متابعته الآن.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => openWorkspaceScope('study')}
                      className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-right hover:border-rose-300 hover:shadow-sm transition"
                    >
                      <div className="text-xs font-bold text-rose-700 tracking-[0.18em] mb-2">STUDY VISA</div>
                      <div className="font-black text-slate-900">الفيزا الدراسية</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => openWorkspaceScope('tourism')}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right hover:border-emerald-300 hover:shadow-sm transition"
                    >
                      <div className="text-xs font-bold text-emerald-700 tracking-[0.18em] mb-2">TOURISM</div>
                      <div className="font-black text-slate-900">قسم السياحة والأسفار</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="min-w-0">
            {/* 1. شريط التنقل العلوي (Navbar) */}
            <nav className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              {/* جهة اليمين: الشعار واسم الوكالة */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/5 p-1 shadow-md ring-1 ring-slate-200">
                  <img src={logo} alt="Sefar Travel Services logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-slate-900">Sefar Travel Services</h1>
                  <p className="text-xs text-slate-500">نظام إدارة علاقات العملاء CRM</p>
                </div>
              </div>

              {/* جهة اليسار: قائمة المستخدم المنسدلة */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleWorkspace}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 8h8M8 12h8M8 16h4" />
                  </svg>
                  مساحة العمل
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition-all text-sm font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {profile.full_name || session.user.email} ({ROLE_LABELS[roleKey] || roleKey})
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* القائمة المنسدلة عند الضغط */}
                  {userDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentScreen('profile');
                        setUserDropdownOpen(false);
                      }}
                      className="block w-full text-right px-4 py-2 text-sm hover:bg-slate-50 transition"
                    >
                      الملف الشخصي
                    </button>
                    {currentPermissions.canManageTemplates && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentScreen('template_scope');
                          setUserDropdownOpen(false);
                        }}
                        className="block w-full text-right px-4 py-2 text-sm hover:bg-slate-50 transition font-semibold text-blue-600"
                      >
                        إعداد القوالب ⚙️
                      </button>
                    )}
                    {currentPermissions.canManageEmployees && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentScreen('employees');
                          setUserDropdownOpen(false);
                        }}
                        className="block w-full text-right px-4 py-2 text-sm hover:bg-slate-50 transition font-semibold text-emerald-700"
                      >
                        إدارة الموظفين
                      </button>
                    )}
                    <hr className="my-1 border-slate-100" />
                    <button type="button" onClick={handleLogout} className="block w-full text-right px-4 py-2 text-sm hover:bg-slate-50 transition">
                      تسجيل الخروج
                    </button>
                    </div>
                  )}
                </div>
              </div>
            </nav>

            {currentScreen === 'employees' && currentPermissions.canManageEmployees && (
              <EmployeeAccessManager onBack={handleHomeBack} currentUserId={session.user.id} />
            )}

            {currentScreen === 'template_scope' && currentPermissions.canManageTemplates && (
              <TemplateScopeSelector
                onBack={handleHomeBack}
                onSelectStudy={() => setCurrentScreen('templates')}
                onSelectTourism={() => setCurrentScreen('tourism_templates')}
              />
            )}

            {currentScreen === 'templates' && currentPermissions.canManageTemplates && (
              <TemplateManager onBack={handleHomeBack} />
            )}

            {currentScreen === 'tourism_templates' && currentPermissions.canManageTemplates && (
              <TourismTemplateManager onBack={() => setCurrentScreen('template_scope')} />
            )}

            {currentScreen === 'profile' && (
              <ProfilePanel
                profile={profile}
                session={session}
                roleLabel={ROLE_LABELS[roleKey] || roleKey}
                permissions={currentPermissions}
                onBack={handleHomeBack}
                onLogout={handleLogout}
              />
            )}

            {currentScreen === 'tourism' && currentPermissions.canStartTourism && (
              <TourismCountriesPanel onBack={handleHomeBack} onSelectVisaType={handleOpenTourismRequest} />
            )}

            {currentScreen === 'tourism_request' && currentPermissions.canStartTourism && tourismSelection && (
              <TourismVisaRequestForm
                country={tourismSelection.country}
                visaType={tourismSelection.visaType}
                onCreateRequest={handleCreateTourismRequest}
                onBack={() => setCurrentScreen('tourism')}
              />
            )}

            {currentScreen === 'tourism_steps' && currentPermissions.canStartTourism && currentTourismRequest && (
              <TourismVisaSteps
                key={currentTourismRequest.id}
                request={currentTourismRequest}
                onBack={() => setCurrentScreen('tourism_request')}
                canEditStructure={currentPermissions.canEditStructure}
                canEditItemProgress={currentPermissions.canEditItemProgress}
                canManageTemplates={currentPermissions.canManageTemplates}
              />
            )}

            {/* 2. مساحة العمل الرئيسية */}
            {currentScreen === 'home' && (
              <main className="max-w-4xl mx-auto mt-20 px-4 text-center">
          {/* عنوان ترحيبي */}
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">مرحباً بك مجدداً في لوحة التحكم</h2>
          <p className="text-slate-500 mb-12 max-w-md mx-auto text-sm">
            الرجاء اختيار المسار العملي الذي ترغب في تنظيمه ومتابعته الآن لتوجيه النظام بشكل صحيح.
          </p>

          {/* أزرار توجيه المسار (بناءً على تصميم 1.png) */}
          <div className="space-y-6 max-w-2xl mx-auto">
            {!currentPermissions.canCreateClient && (
              <div className="bg-white rounded-3xl border border-amber-200 p-5 text-right">
                <div className="font-bold text-amber-700 mb-1">إضافة عميل جديد</div>
                <p className="text-sm text-slate-500">هذا الدور مخصص للمتابعة فقط (ملاحظات، روابط، وcheckbox).</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* زر مسار الفيزا (باللون الأحمر الاحترافي) */}
              <button 
                onClick={() => currentPermissions.canStartVisa && currentPermissions.canCreateClient && setCurrentScreen('visa_start')}
                disabled={!currentPermissions.canStartVisa || !currentPermissions.canCreateClient}
                className={`group relative overflow-hidden rounded-[2rem] border-2 p-8 text-center shadow-sm transition-all duration-300 flex flex-col items-center transform hover:-translate-y-1 ${currentPermissions.canStartVisa ? 'cursor-pointer border-rose-100 bg-gradient-to-br from-white via-rose-50/60 to-rose-100 hover:border-rose-400 hover:shadow-2xl' : 'cursor-not-allowed border-slate-200 bg-white opacity-60'}`}
              >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-red-500 to-orange-400"></div>
              <div className={`w-20 h-20 rounded-[1.4rem] flex items-center justify-center mb-6 transition-all duration-300 shadow-lg ${currentPermissions.canStartVisa ? 'bg-rose-500 text-white group-hover:scale-105' : 'bg-slate-100 text-slate-400'}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="mb-3 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-rose-700 border border-rose-100">ابدأ الآن</div>
              <h3 className={`font-black text-2xl mb-3 transition-colors ${currentPermissions.canStartVisa ? 'text-slate-900 group-hover:text-rose-700' : 'text-slate-400'}`}>فيزا دراسية</h3>
              <p className="text-slate-500 text-sm leading-7 max-w-sm">
                إدارة طلبات الفيزا الدراسية، تجهيز المستندات، ومتابعة قوالب خطوات الدول والقبولات الجامعية من واجهة أوضح وأجمل.
              </p>
              {(!currentPermissions.canStartVisa || !currentPermissions.canCreateClient) ? (
                <span className="mt-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">غير متاح لهذا الموظف</span>
              ) : (
                <span className="mt-4 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-100">اضغط للدخول إلى المسار</span>
              )}
            </button>

            {/* زر مسار السياحة (باللون الأخضر الاحترافي) */}
            <button 
              onClick={() => currentPermissions.canStartTourism && setCurrentScreen('tourism')}
              disabled={!currentPermissions.canStartTourism}
              className={`group relative overflow-hidden rounded-[2rem] border-2 p-8 text-center shadow-sm transition-all duration-300 flex flex-col items-center transform hover:-translate-y-1 ${currentPermissions.canStartTourism ? 'cursor-pointer border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-teal-100 hover:border-emerald-400 hover:shadow-2xl' : 'cursor-not-allowed border-slate-200 bg-white opacity-60'}`}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400"></div>
              <div className={`w-20 h-20 rounded-[1.4rem] flex items-center justify-center mb-6 transition-all duration-300 shadow-lg ${currentPermissions.canStartTourism ? 'bg-emerald-500 text-white group-hover:scale-105' : 'bg-slate-100 text-slate-400'}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2m4-1c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" />
                </svg>
              </div>
              <div className="mb-3 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-emerald-700 border border-emerald-100">مسار ثاني</div>
              <h3 className={`font-black text-2xl mb-3 transition-colors ${currentPermissions.canStartTourism ? 'text-slate-900 group-hover:text-emerald-700' : 'text-slate-400'}`}>قسم السياحة والأسفار</h3>
              <p className="text-slate-500 text-sm leading-7 max-w-sm">
                تنظيم الرحلات السياحية، حجوزات الفنادق، الطيران، وتجهيز برامج العطلات والرحلات الخارجية بواجهة أكثر وضوحًا.
              </p>
              {!currentPermissions.canStartTourism ? (
                <span className="mt-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">غير متاح لهذا الموظف</span>
              ) : (
                <span className="mt-4 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">اضغط للتجربة</span>
              )}
            </button>

            </div>
          </div>
        </main>
            )}

            {/* شاشة 2: نموذج إضافة معلومات العميل */}
            {currentScreen === 'visa_start' && (
              <div className="max-w-4xl mx-auto mt-10 px-4 pb-12 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">إضافة معلومات العميل</h2>
                  <button 
                    onClick={handleHomeBack}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
                  >
                    ← العودة للرئيسية
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-1 divide-y divide-slate-200">
              {/* الحقول النصية */}
              {[
                { label: 'الاسم', id: 'firstName', type: 'text', placeholder: 'مثال: أحمد' },
                { label: 'اللقب', id: 'lastName', type: 'text', placeholder: 'مثال: بن علي' },
                { label: 'تاريخ الميلاد', id: 'dob', type: 'date', placeholder: '' },
                { label: 'رقم الهاتف', id: 'phone', type: 'text', placeholder: 'رقم الهاتف' },
                { label: 'الايمايل', id: 'email', type: 'email', placeholder: 'الايمايل' },
              ].map((field) => (
                <div key={field.id} className="flex flex-col sm:flex-row">
                  <div className="bg-slate-100 sm:w-1/4 p-4 font-bold text-slate-700 flex items-center border-l border-slate-200">
                    {field.label}
                  </div>
                  <div className="sm:w-3/4 p-3">
                    <input 
                      {...register(field.id)} 
                      type={field.type}
                      placeholder={field.placeholder}
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                </div>
              ))}

              {/* الوجهة (قائمة منسدلة) */}
              <div className="flex flex-col sm:flex-row">
                <div className="bg-slate-100 sm:w-1/4 p-4 font-bold text-slate-700 flex items-center border-l border-slate-200">الوجهة والبلد</div>
                <div className="sm:w-3/4 p-3 flex flex-col gap-2">
                  <select {...register('destination')} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white" required>
                    <option value="">اختر الوجهة...</option>
                    {destinationOptions.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                    <option value="other" className="font-bold text-blue-600">+ إضافة بلد جديد غير موجود بالقائمة...</option>
                  </select>

                  {selectedDestination === 'other' && (
                    <input 
                      type="text" 
                      {...register('customDestination')} 
                      placeholder="اكتب اسم البلد الجديد هنا (مثال: كندا، رومانيا...)"
                      className="w-full p-2.5 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition animate-fadeIn"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row">
                <div className="bg-slate-100 sm:w-1/4 p-4 font-bold text-slate-700 flex items-center border-l border-slate-200">المستوى الدراسي</div>
                <div className="sm:w-3/4 p-3">
                  <select {...register('education')} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white" required>
                    <option value="">اختر المستوى...</option>
                    <option value="highschool">ثانوي</option>
                    <option value="bachelor">بكالوريوس / ليسانس</option>
                    <option value="master">ماجستير</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row">
                <div className="bg-slate-100 sm:w-1/4 p-4 font-bold text-slate-700 flex items-center border-l border-slate-200">الحالة</div>
                <div className="sm:w-3/4 p-3">
                  <select {...register('status')} defaultValue="working_on" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white">
                    <option value="working_on">قيد العمل</option>
                    <option value="completed">مكتمل</option>
                    <option value="canceled">ملغى</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 flex justify-end border-t border-slate-200">
              <button 
                type="submit"
                className="bg-[#c4ff4d] hover:bg-[#b0e645] text-slate-900 font-extrabold text-lg py-3 px-10 rounded-xl transition-all shadow-sm transform hover:-translate-y-0.5"
              >
                المرحلة التالية أو إنهاء
              </button>
            </div>
          </form>
              </div>
            )}

            {currentScreen === 'visa_steps' && currentClient && (
              <VisaSteps
                key={currentClient.id}
                client={currentClient}
                onBack={handleHomeBack}
                canEditStructure={currentPermissions.canEditStructure}
                canEditItemProgress={currentPermissions.canEditItemProgress}
                canManageTemplates={currentPermissions.canManageTemplates}
              />
            )}
          </div>
        </div>
      </div>
  );
}

export default App;