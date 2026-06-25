import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const STATUS_META = {
  working: {
    label: 'قيد العمل',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  completed: {
    label: 'مكتمل',
    badge: 'bg-green-100 text-green-800 border-green-200',
  },
  canceled: {
    label: 'ملغى',
    badge: 'bg-red-100 text-red-800 border-red-200',
  },
};

const VIEW_OPTIONS = [
  { value: 'working', label: 'قيد العمل' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'canceled', label: 'ملغى' },
  { value: 'all', label: 'الكل' },
];

const WORKSPACE_SCOPE = {
  study: {
    title: 'لوحة الفيزا الدراسية',
    description: 'متابعة ملفات الدراسة، الحالات، وتصدير التقارير.',
    searchPlaceholder: 'ابحث عن عميل دراسة أو دولة...',
    clientTitle: 'العملاء (الدراسة)',
    currentClientTitle: 'العميل الدراسي الحالي',
    countryStatsTitle: 'إحصاءات الدول (الدراسة)',
  },
  tourism: {
    title: 'لوحة السياحة والأسفار',
    description: 'متابعة ملفات السياحة الحديثة، الحالات، وتصدير التقارير.',
    searchPlaceholder: 'ابحث عن عميل سياحة أو وجهة...',
    clientTitle: 'العملاء (السياحة)',
    currentClientTitle: 'الملف السياحي الحالي',
    countryStatsTitle: 'إحصاءات الدول (السياحة)',
  },
};

const normalizeStatus = (status) => {
  if (status === 'completed') return 'completed';
  if (status === 'canceled' || status === 'cancelled') return 'canceled';
  return 'working';
};

const getStatusMeta = (status) => STATUS_META[normalizeStatus(status)] || STATUS_META.working;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const buildCountryStats = (clients) => {
  const grouped = clients.reduce((accumulator, client) => {
    const destination = client.destination?.trim() || 'غير محددة';
    const currentStatus = normalizeStatus(client.status);

    if (!accumulator[destination]) {
      accumulator[destination] = {
        destination,
        working: 0,
        completed: 0,
        canceled: 0,
        total: 0,
      };
    }

    accumulator[destination][currentStatus] += 1;
    accumulator[destination].total += 1;
    return accumulator;
  }, {});

  return Object.values(grouped).sort((firstCountry, secondCountry) => secondCountry.total - firstCountry.total);
};

const buildOverview = (clients) => {
  return clients.reduce(
    (accumulator, client) => {
      const currentStatus = normalizeStatus(client.status);
      accumulator.total += 1;
      accumulator[currentStatus] += 1;
      return accumulator;
    },
    { total: 0, working: 0, completed: 0, canceled: 0 },
  );
};

const buildPdfMarkup = (clients, countryStats, overview) => {
  const countryRows = countryStats
    .map(
      (country) => `
        <tr>
          <td>${country.destination}</td>
          <td>${country.working}</td>
          <td>${country.completed}</td>
          <td>${country.canceled}</td>
          <td>${country.total}</td>
        </tr>
      `,
    )
    .join('');

  const clientRows = clients
    .map(
      (client) => `
        <tr>
          <td>${`${client.first_name || ''} ${client.last_name || ''}`.trim()}</td>
          <td>${client.destination || 'غير محددة'}</td>
          <td>${getStatusMeta(client.status).label}</td>
          <td>${formatDate(client.created_at)}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <div class="page">
      <div class="header">
        <div>
          <div class="eyebrow">Sefar CRM</div>
          <h1>تقرير العملاء والدول</h1>
          <p>ملخص الحالات وعدد العملاء لكل دولة.</p>
        </div>
        <div class="muted">Generated at: ${new Date().toLocaleString()}</div>
      </div>

      <div class="cards">
        <div class="card"><div class="label">الإجمالي</div><div class="value">${overview.total}</div></div>
        <div class="card"><div class="label">قيد العمل</div><div class="value">${overview.working}</div></div>
        <div class="card"><div class="label">مكتمل</div><div class="value">${overview.completed}</div></div>
        <div class="card"><div class="label">ملغى</div><div class="value">${overview.canceled}</div></div>
      </div>

      <h2>إحصاءات الدول</h2>
      <table>
        <thead>
          <tr>
            <th>الدولة</th>
            <th>قيد العمل</th>
            <th>مكتمل</th>
            <th>ملغى</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${countryRows || '<tr><td colspan="5">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>

      <h2>قائمة العملاء</h2>
      <table>
        <thead>
          <tr>
            <th>العميل</th>
            <th>الدولة</th>
            <th>الحالة</th>
            <th>تاريخ الإنشاء</th>
          </tr>
        </thead>
        <tbody>
          ${clientRows || '<tr><td colspan="4">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
};

const exportToExcel = (clients, countryStats, overview) => {
  const workbook = XLSX.utils.book_new();

  const overviewRows = [
    { metric: 'Total Clients', value: overview.total },
    { metric: 'Working', value: overview.working },
    { metric: 'Completed', value: overview.completed },
    { metric: 'Canceled', value: overview.canceled },
  ];

  const clientRows = clients.map((client) => ({
    Client: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    Country: client.destination || 'غير محددة',
    Status: getStatusMeta(client.status).label,
    Created: formatDate(client.created_at),
  }));

  const countryRows = countryStats.map((country) => ({
    Country: country.destination,
    Working: country.working,
    Completed: country.completed,
    Canceled: country.canceled,
    Total: country.total,
  }));

  const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
  const clientsSheet = XLSX.utils.json_to_sheet(clientRows);
  const countriesSheet = XLSX.utils.json_to_sheet(countryRows);

  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');
  XLSX.utils.book_append_sheet(workbook, clientsSheet, 'Clients');
  XLSX.utils.book_append_sheet(workbook, countriesSheet, 'Countries');

  XLSX.writeFile(workbook, `sefar-crm-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export default function WorkspaceSidebar({
  clients,
  currentClient,
  onSelectClient,
  onUpdateClientStatus,
  canUpdateClientStatus,
  onClose,
  scope = 'study',
  onlyRecent = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState('working');

  const overview = useMemo(() => buildOverview(clients), [clients]);
  const countryStats = useMemo(() => buildCountryStats(clients), [clients]);

  const scopeMeta = WORKSPACE_SCOPE[scope] || WORKSPACE_SCOPE.study;

  const recentClients = useMemo(() => {
    return [...clients].sort((firstClient, secondClient) => {
      const firstTime = new Date(firstClient.created_at || 0).getTime();
      const secondTime = new Date(secondClient.created_at || 0).getTime();
      return secondTime - firstTime;
    }).slice(0, 30);
  }, [clients]);

  const sourceClients = onlyRecent ? recentClients : clients;

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sourceClients.filter((client) => {
      const currentStatus = normalizeStatus(client.status);
      const matchesStatus = viewFilter === 'all' || currentStatus === viewFilter;
      const matchesSearch =
        !normalizedSearch ||
        [client.first_name, client.last_name, client.destination, client.client_name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [sourceClients, searchTerm, viewFilter]);

  const handleExportExcel = () => {
    exportToExcel(clients, countryStats, overview);
  };

  const handleDownloadPdf = async () => {
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
    wrapper.innerHTML = `
      <style>
        .page { padding: 24px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
        .eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        h1 { margin: 0 0 8px; font-size: 28px; font-weight: 800; }
        p { margin: 0; color: #475569; font-size: 13px; line-height: 1.7; }
        .muted { color: #64748b; font-size: 12px; }
        .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
        .card { border: 1px solid #cbd5e1; border-radius: 14px; padding: 14px; background: #f8fafc; }
        .label { font-size: 12px; color: #64748b; margin-bottom: 8px; }
        .value { font-size: 24px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-size: 12px; }
        th { background: #e2e8f0; font-weight: 700; }
        h2 { margin: 26px 0 10px; font-size: 18px; }
      </style>
      ${buildPdfMarkup(clients, countryStats, overview)}
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

      doc.save(`sefar-crm-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      wrapper.remove();
    }
  };

  return (
    <aside className="h-full bg-gradient-to-b from-white via-slate-50 to-white/90 backdrop-blur overflow-y-auto">
      <div className="p-3 lg:p-4 h-full">
        <div className="space-y-6">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.26),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_32%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-slate-300 mb-3">مساحة العمل</div>
                  <h2 className="text-2xl font-black mb-2 leading-tight">{scopeMeta.title}</h2>
                  <p className="text-sm text-slate-300 leading-6">{scopeMeta.description}</p>
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                  >
                    إغلاق
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500 mb-1">الإجمالي</div>
                <div className="text-2xl font-black text-slate-900">{overview.total}</div>
              </div>
              <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm">
                <div className="text-xs text-blue-600 mb-1">قيد العمل</div>
                <div className="text-2xl font-black text-blue-800">{overview.working}</div>
              </div>
              <div className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4 shadow-sm">
                <div className="text-xs text-green-600 mb-1">مكتمل</div>
                <div className="text-2xl font-black text-green-800">{overview.completed}</div>
              </div>
              <div className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-4 shadow-sm">
                <div className="text-xs text-red-600 mb-1">ملغى</div>
                <div className="text-2xl font-black text-red-800">{overview.canceled}</div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{scopeMeta.clientTitle}</h3>
                  <p className="text-xs text-slate-500">فلتر بالحالة أو ابحث بالاسم أو الدولة.</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                >
                  Excel
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewFilter(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      viewFilter === option.value
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={scopeMeta.searchPlaceholder}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {filteredClients.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    لا توجد نتائج مطابقة.
                  </div>
                ) : (
                  filteredClients.map((client) => {
                    const isSelected = currentClient?.id === client.id;
                    const statusMeta = getStatusMeta(client.status);
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => onSelectClient(client)}
                        className={`w-full rounded-2xl border p-3 text-right transition ${
                      isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 truncate">{client.destination || 'غير محددة'}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusMeta.badge}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {currentClient && (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">{scopeMeta.currentClientTitle}</h3>
                    <p className="text-xs text-slate-500">العميل المختار للعمل عليه الآن.</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusMeta(currentClient.status).badge}`}>
                    {getStatusMeta(currentClient.status).label}
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-900">{currentClient.first_name} {currentClient.last_name}</div>
                  <div className="text-slate-500">{currentClient.destination || 'غير محددة'}</div>
                </div>

                {canUpdateClientStatus ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">تحديث الحالة</label>
                    <select
                      value={normalizeStatus(currentClient.status)}
                      onChange={(event) => onUpdateClientStatus(currentClient.id, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {VIEW_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    لا يمكن تغيير الحالة لهذا الدور.
                  </div>
                )}
              </div>
            )}

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{scopeMeta.countryStatsTitle}</h3>
                  <p className="text-xs text-slate-500">قيد العمل، مكتمل، وملغى لكل دولة.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  تنزيل PDF
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {countryStats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    لا توجد بيانات دول بعد.
                  </div>
                ) : (
                  countryStats.map((country) => (
                    <div key={country.destination} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-semibold text-slate-900">{country.destination}</div>
                        <div className="text-xs font-bold text-slate-500">{country.total} إجمالي</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                        <div className="rounded-xl bg-blue-100 px-2 py-1 text-blue-800">ق {country.working}</div>
                        <div className="rounded-xl bg-green-100 px-2 py-1 text-green-800">م {country.completed}</div>
                        <div className="rounded-xl bg-red-100 px-2 py-1 text-red-800">ل {country.canceled}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
      </div>
    </aside>
  );
}
