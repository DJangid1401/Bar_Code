import { useState, useMemo, useEffect } from 'react';
import {
  useStore,
  INDIAN_GST_REGEX,
  INDIAN_PAN_REGEX,
  INDIAN_PHONE_REGEX,
} from '../store';
import { Customer } from '../types/customer';
import {
  Contact2,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  X,
  Check,
  Building2,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
} from 'lucide-react';

export default function Customers() {
  const { customers, saveCustomer, deleteCustomer, currentUser } = useStore();
  const isAdmin = currentUser?.role === 'Admin';

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  // Auto-purge any test customer record if present
  useEffect(() => {
    const testRecord = customers.find(
      c =>
        c.id === 'cust-1795069880052' ||
        c.name.trim().toLowerCase() === 'test' ||
        c.gst.trim().toLowerCase() === 'agfsdtgsfsg'
    );
    if (testRecord) {
      deleteCustomer(testRecord.id);
    }
  }, [customers, deleteCustomer]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formGst, setFormGst] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPan, setFormPan] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time sanitized values & strict Indian GST/PAN/Phone validations
  const cleanName = formName.trim();
  const cleanGst = formGst.trim().toUpperCase().replace(/\s+/g, '');
  const cleanPhone = formPhone.trim().replace(/\D/g, '');
  const cleanPan = formPan.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const isNameValid = cleanName.length > 0;
  const isGstValid = INDIAN_GST_REGEX.test(cleanGst);
  const isPhoneValid = !cleanPhone || INDIAN_PHONE_REGEX.test(cleanPhone);
  const isPanValid = !cleanPan || INDIAN_PAN_REGEX.test(cleanPan);
  const isFormValid = isNameValid && isGstValid && isPhoneValid && isPanValid;

  // Filtered customer list (purges any invalid / all-numeric GST entries)
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const validCustomers = customers.filter(c => {
      if (!c || !c.gst) return false;
      const gst = c.gst.trim().toUpperCase().replace(/\s+/g, '');
      if (!INDIAN_GST_REGEX.test(gst)) return false;
      const name = c.name.trim().toLowerCase();
      if (!name || name === 'test' || c.id === 'cust-1795069880052') return false;
      return true;
    });
    if (!q) return validCustomers;
    return validCustomers.filter(c => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.gst.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.pan && c.pan.toLowerCase().includes(q))
      );
    });
  }, [customers, search]);

  const stats = useMemo(() => {
    const total = filteredCustomers.length;
    const withGst = filteredCustomers.filter(c => Boolean(c.gst?.trim())).length;
    const withPhone = filteredCustomers.filter(c => Boolean(c.phone?.trim())).length;
    return { total, withGst, withPhone };
  }, [filteredCustomers]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormGst('');
    setFormPhone('');
    setFormAddress('');
    setFormPan('');
    setFormError('');
    setShowAddModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormGst(c.gst);
    setFormPhone(c.phone || '');
    setFormAddress(c.address || '');
    setFormPan(c.pan || '');
    setFormError('');
    setShowAddModal(true);
  };

  const handleGstChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    setFormGst(upper);
    // Auto-extract PAN from GST (characters 3-12) if PAN is empty or was previously auto-filled
    if (upper.length >= 12 && (!formPan || formPan.length === 10)) {
      setFormPan(upper.slice(2, 12));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    const cleanGst = formGst.trim().toUpperCase().replace(/\s+/g, '');
    const cleanPhone = formPhone.trim().replace(/\D/g, '');
    const cleanPan = formPan.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Mandatory Name check
    if (!cleanName) {
      setFormError('Customer Name is mandatory.');
      return;
    }

    // Mandatory Indian GST check (2 State Digits + 10-char PAN + 1 Entity char + Z + 1 Check code)
    if (!cleanGst) {
      setFormError('GST Number is mandatory.');
      return;
    }
    if (!INDIAN_GST_REGEX.test(cleanGst)) {
      setFormError(
        'GST Number must follow standard Indian GSTIN structure: 2 digits State Code + 10-char PAN (5 letters + 4 digits + 1 letter) + 1 Entity char + Z + 1 Check code (e.g. 27AABCS1429B1Z8).'
      );
      return;
    }

    // Optional Phone check (fixed structure: exactly 10 digits)
    if (cleanPhone && !INDIAN_PHONE_REGEX.test(cleanPhone)) {
      setFormError('Phone / Mobile Number must be exactly 10 digits (e.g. 9820012345).');
      return;
    }

    // Optional PAN check (fixed structure: 5 letters + 4 digits + 1 letter)
    if (cleanPan && !INDIAN_PAN_REGEX.test(cleanPan)) {
      setFormError(
        'PAN Number must follow standard Indian PAN structure: 5 letters + 4 digits + 1 letter (e.g. AABCS1429B).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveCustomer({
        id: editingCustomer ? editingCustomer.id : undefined,
        name: cleanName,
        gst: cleanGst,
        phone: cleanPhone || undefined,
        address: formAddress.trim() || undefined,
        pan: cleanPan || undefined,
      });

      if (res.success) {
        setShowAddModal(false);
      } else {
        setFormError(res.message);
      }
    } catch {
      setFormError('An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;
    await deleteCustomer(deletingCustomer.id);
    setDeletingCustomer(null);
  };

  const handleExportCsv = () => {
    const headers = ['Customer Name', 'GST Number', 'Phone', 'Address', 'PAN', 'Registered On'];
    const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = filteredCustomers.map(c => [
      c.name,
      c.gst,
      c.phone || '',
      c.address || '',
      c.pan || '',
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
    ]);

    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Swati_Entreprise_Customer_DB.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2.5">
              <Contact2 className="text-blue-600" size={30} />
              Customer DB
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Customer directory with GST numbers and contact details (Name &amp; GST mandatory).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredCustomers.length === 0}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add New Customer</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Registered Customers
              </p>
              <p className="text-xl font-extrabold text-slate-900">{stats.total}</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Verified GST Records
              </p>
              <p className="text-xl font-extrabold text-emerald-800">{stats.withGst}</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Phone size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Phone Contacts
              </p>
              <p className="text-xl font-extrabold text-indigo-800">{stats.withPhone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Contact2 className="text-blue-600" size={20} />
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                Customer List ({filteredCustomers.length} Records)
              </h2>
              <p className="text-xs text-slate-500">
                Search by Customer Name, GST, Phone, PAN, or Address
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Name, GST, Phone, PAN..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-3.5">Customer Name *</th>
                <th className="p-3.5">GST Number *</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">PAN</th>
                <th className="p-3.5">Address</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block">{customer.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">ID: {customer.id}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md text-xs inline-block">
                      {customer.gst}
                    </span>
                  </td>
                  <td className="p-3.5 text-xs text-slate-600">
                    {customer.phone ? (
                      <span className="flex items-center gap-1.5 font-medium">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        {customer.phone}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3.5 text-xs font-mono text-slate-600">
                    {customer.pan ? (
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700">
                        {customer.pan}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3.5 text-xs text-slate-600 max-w-xs">
                    {customer.address ? (
                      <span className="flex items-start gap-1.5 line-clamp-2" title={customer.address}>
                        <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>{customer.address}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(customer)}
                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Edit Customer"
                      >
                        <Edit2 size={15} />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeletingCustomer(customer)}
                          className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Delete Customer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              No customers found. Click &quot;Add New Customer&quot; above to register one.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Contact2 className="text-blue-600" size={20} />
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Customer Name (Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">* (Mandatory)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Shree Ganesh Traders"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>

              {/* GST Number (Mandatory) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    GST Number <span className="text-red-500">* (Mandatory)</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      isGstValid ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {formGst.length}/15 chars
                  </span>
                </div>
                <input
                  type="text"
                  value={formGst}
                  onChange={e => handleGstChange(e.target.value)}
                  placeholder="e.g. 27AABCS1429B1Z8"
                  maxLength={15}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold uppercase focus:outline-none transition-colors ${
                    isGstValid
                      ? 'border-emerald-400 bg-emerald-50/20 text-emerald-900 focus:border-emerald-600'
                      : formGst.length > 0
                      ? 'border-amber-300 focus:border-amber-500'
                      : 'border-slate-200 focus:border-blue-500'
                  }`}
                  required
                />

                {isGstValid ? (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                    <Check size={13} />
                    Valid 15-character Indian GSTIN
                  </p>
                ) : cleanGst.length > 0 ? (
                  <p className="text-[11px] text-slate-500 mt-1">
                    15-character Indian GSTIN (e.g. 27AABCS1429B1Z8) — {cleanGst.length}/15 chars
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Standard 15-character Indian GSTIN (e.g. 27AABCS1429B1Z8)
                  </p>
                )}
              </div>

              {/* Phone Number (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    Phone / Mobile Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {formPhone && (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        cleanPhone.length === 10 ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {formPhone.length}/10 digits
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="e.g. 9820012345 (10 digits)"
                  maxLength={10}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                    cleanPhone.length === 10
                      ? 'border-emerald-400 bg-emerald-50/20 text-emerald-900 focus:border-emerald-600'
                      : 'border-slate-200 focus:border-blue-500'
                  }`}
                />
                {cleanPhone.length === 10 ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Check size={13} className="text-emerald-600" />
                    <span>Valid 10-digit mobile number</span>
                  </div>
                ) : cleanPhone.length > 0 ? (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Please enter full 10 digits ({cleanPhone.length}/10)
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">10-digit mobile number only</p>
                )}
              </div>

              {/* PAN Number (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    PAN Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {formPan && (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        isPanValid ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {formPan.length}/10 chars
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={formPan}
                  onChange={e =>
                    setFormPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
                  }
                  placeholder="e.g. AABCS1429B"
                  maxLength={10}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none transition-colors ${
                    cleanPan.length > 0 && isPanValid
                      ? 'border-emerald-400 bg-emerald-50/20 text-emerald-900 focus:border-emerald-600'
                      : cleanPan.length > 0
                      ? 'border-amber-300 focus:border-amber-500'
                      : 'border-slate-200 focus:border-blue-500'
                  }`}
                />
                {cleanPan.length > 0 && isPanValid ? (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                    <Check size={13} />
                    Valid 10-character PAN
                  </p>
                ) : cleanPan.length > 0 ? (
                  <p className="text-[11px] text-slate-500 mt-1">
                    10-character PAN (e.g. AABCS1429B) — {cleanPan.length}/10 chars
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    10-character alphanumeric PAN (Auto-extracted from GST)
                  </p>
                )}
              </div>

              {/* Address (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Billing / Delivery Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="e.g. Shop 14, Zaveri Bazaar, Mumbai"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-[11px]">
                  {!isFormValid ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                      <AlertCircle size={13} className="text-amber-600 shrink-0" />
                      {!isNameValid
                        ? 'Enter Customer Name to enable saving'
                        : !isGstValid
                        ? 'Valid 15-char Indian GSTIN required to save'
                        : !isPhoneValid
                        ? 'Phone number must be 10 digits'
                        : 'PAN must follow 5-letters + 4-digits + 1-letter'}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                      <Check size={13} className="text-emerald-600 shrink-0" />
                      Ready to save customer
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    title={
                      !isFormValid
                        ? 'Fill required Name and valid GSTIN structure to save'
                        : ''
                    }
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                      isFormValid && !isSubmitting
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <Check size={14} />
                    <span>{editingCustomer ? 'Update Customer' : 'Save Customer'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-slate-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Customer</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <strong>{deletingCustomer.name}</strong> (GST: {deletingCustomer.gst}) from Customer DB?
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 shadow-md cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
