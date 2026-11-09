import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../context/permissions';
import { User, UserRole } from '../types';

type AuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  createdAt: string;
  user?: { name: string; email: string; role: string } | null;
};

export const AdminConsole: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeSection, setActiveSection] = useState<'users' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ESTIMATOR');
  const [department, setDepartment] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [userRows, logs] = await Promise.all([api.getAdminUsers(), api.getAdminAuditLogs()]);
      setUsers(userRows);
      setAuditLogs(logs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load administration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.createAdminUser({ email, name, password, role, department: department || undefined });
      setEmail('');
      setName('');
      setPassword('');
      setDepartment('');
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create user');
    }
  };

  const changeRole = async (target: User, nextRole: UserRole) => {
    if (target.role === nextRole) return;
    setError('');
    try {
      const updated = await api.updateAdminUserRole(target.id, nextRole);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update role');
    }
  };

  if (!hasPermission(user?.role, 'USER_MANAGE')) {
    return (
      <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h1 className="text-base font-bold text-amber-950">Access restricted</h1>
        <p className="mt-2 text-sm text-amber-900">Only administrators can manage users and system audit records.</p>
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-4 sm:space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <h1 className="text-lg font-bold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">Manage user access and review system audit activity.</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === 'users' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Users & Roles
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('audit')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === 'audit' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Audit Log
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading administration data…</p>
      ) : activeSection === 'users' ? (
        <div className="space-y-4">
          <form onSubmit={createUser} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
            <h2 className="sm:col-span-2 lg:col-span-3 text-sm font-bold text-slate-900">Create user</h2>
            <label className="text-xs font-semibold text-slate-600">
              Name
              <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Temporary password (12+ characters)
              <input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoComplete="new-password" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="ESTIMATOR">Estimator</option>
                <option value="SALES_HEAD">Sales Head</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Department
              <input value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">Create account</button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Role</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.email}</p></td>
                      <td className="px-4 py-3 text-slate-600">{item.department || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Role for ${item.email}`}
                          value={item.role}
                          disabled={item.id === user?.id}
                          onChange={(event) => void changeRole(item, event.target.value as UserRole)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100"
                        >
                          <option value="ESTIMATOR">Estimator</option>
                          <option value="SALES_HEAD">Sales Head</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        {item.id === user?.id && <span className="ml-2 text-xs text-slate-400">Current user</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{entry.user?.name || 'System'}<br />{entry.user?.role || ''}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{entry.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{entry.entityType}<br /><span className="font-mono">{entry.entityId}</span></td>
                    <td className="max-w-sm px-4 py-3"><pre className="whitespace-pre-wrap break-words text-[11px] text-slate-600">{entry.details || '—'}</pre></td>
                  </tr>
                ))}
                {auditLogs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No audit records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
