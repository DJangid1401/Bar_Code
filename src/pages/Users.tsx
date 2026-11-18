import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  Users as UsersIcon,
  UserPlus,
  Trash2,
  KeyRound,
  Sparkles,
  Copy,
  Eye,
  EyeOff,
  Shield,
  Check,
  RefreshCw,
} from 'lucide-react';

function generateLoginId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base || 'staff'}${suffix}`;
}

function generatePassword(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const words = ['Inv', 'Stk', 'Key', 'App', 'Pro', 'Box'];
  const pick = words[Math.floor(Math.random() * words.length)];
  return `${pick}@${num}`;
}

export default function Users() {
  const { users, currentUser, isUsersLoading, isSyncing, fetchUsers, createUser, deleteUser } =
    useStore();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'Staff'>('Staff');
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAutoGenerate = () => {
    setUsername(generateLoginId(name));
    setPassword(generatePassword());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      alert('Please fill in Full Name, Login ID, and Password.');
      return;
    }

    const res = await createUser({
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      role,
    });

    alert(res.message);
    if (res.success) {
      setName('');
      setUsername('');
      setPassword('');
      setRole('Staff');
    }
  };

  const handleDelete = async (id: string, userName: string) => {
    if (isSyncing) return;
    if (confirm(`Are you sure you want to delete user "${userName}"?`)) {
      const res = await deleteUser(id);
      alert(res.message);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleCopyCredentials = (user: {
    id: string;
    name: string;
    username: string;
    password?: string;
  }) => {
    const text = `Swati Entreprise Login\nName: ${user.name}\nLogin ID: ${user.username}\nPassword: ${user.password || ''}`;
    navigator.clipboard?.writeText(text);
    setCopiedId(user.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-sm">
        <Shield size={40} className="mx-auto text-slate-400" />
        <h2 className="text-xl font-bold text-slate-800">Admin Access Required</h2>
        <p className="text-sm text-slate-500">
          Only Admin accounts can generate or manage Login IDs and Passwords.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2.5">
            <UsersIcon className="text-blue-600" size={30} />
            Users &amp; Login Credentials
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Generate Login ID &amp; Password for staff. Every Stock IN / OUT records the signed-in user&apos;s name and timestamp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchUsers()}
          disabled={isUsersLoading}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw size={16} className={isUsersLoading ? 'animate-spin' : ''} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Create / Generate User Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="text-blue-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Generate New Login ID &amp; Password</h2>
          </div>
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Sparkles size={15} />
            <span>Auto-Generate ID &amp; Password</span>
          </button>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Login ID *
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. rahul01"
              className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Password *
            </label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="e.g. Inv@4829"
              className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value === 'Admin' ? 'Admin' : 'Staff')}
              className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm bg-white font-semibold focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSyncing}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <KeyRound size={16} />
              <span>{isSyncing ? 'Creating...' : 'Create Login Account'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-base">Active Login Accounts</h3>
          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
            {users.length} Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Login ID</th>
                <th className="p-4">Password</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map(u => {
                const isRevealed = revealedIds.includes(u.id);
                const isCopied = copiedId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{u.name}</td>
                    <td className="p-4 font-mono text-slate-700">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold">
                        {u.username}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          {isRevealed ? u.password || '••••••' : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleReveal(u.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                          title={isRevealed ? 'Hide password' : 'Show password'}
                        >
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          u.role === 'Admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(u)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Copy Login ID & Password"
                        >
                          {isCopied ? (
                            <>
                              <Check size={14} className="text-green-600" />
                              <span className="text-green-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id, u.name)}
                          disabled={isSyncing || u.id === currentUser?.id}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title={
                            u.id === currentUser?.id
                              ? 'Cannot delete currently signed-in account'
                              : 'Delete user'
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              {isUsersLoading
                ? 'Loading user accounts...'
                : 'No users found. Ensure the updated Apps Script is deployed to manage users.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
