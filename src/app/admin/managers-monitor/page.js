'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const defaultSummary = {
  total: 0,
  verified: 0,
  unverified: 0,
  mustChangePassword: 0,
  hasToken: 0,
  tokenActive: 0,
  tokenExpired: 0,
  resendHeavy: 0,
};

export default function ManagersMonitorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(defaultSummary);
  const [searchTerm, setSearchTerm] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [passwordFilter, setPasswordFilter] = useState('all');

  const fetchManagers = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await fetch('/api/admin/managers');
      if (res.status === 401 || res.status === 403) {
        alert('You do not have admin privileges');
        router.push('/home');
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load managers table status');
        return;
      }

      setRows(data.managers || []);
      setSummary(data.summary || defaultSummary);
    } catch (err) {
      console.error('Managers monitor fetch failed:', err);
      setError('An unexpected error occurred');
    } finally {
      if (manual) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const text = [row.name, row.email_address, row.manager_id].join(' ').toLowerCase();
        if (!text.includes(term)) return false;
      }

      if (verifiedFilter === 'verified' && !row.email_verified) return false;
      if (verifiedFilter === 'unverified' && row.email_verified) return false;

      if (tokenFilter === 'active' && !row.verification_token_active) return false;
      if (tokenFilter === 'expired' && !row.verification_token_expired) return false;
      if (tokenFilter === 'none' && row.has_verification_token) return false;

      if (passwordFilter === 'must-change' && !row.must_change_password) return false;
      if (passwordFilter === 'normal' && row.must_change_password) return false;

      return true;
    });
  }, [rows, searchTerm, verifiedFilter, tokenFilter, passwordFilter]);

  const formatTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('zh-TW', { hour12: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-600">Loading managers table status...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <div className="text-red-600 text-lg font-bold mb-2">Error</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Managers Table Monitor</h1>
              <p className="text-sm text-gray-500">Track account verification and token health in public.managers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">{rows.length} rows</div>
            <button
              onClick={() => fetchManagers(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          {[
            ['Total', summary.total, 'text-gray-900'],
            ['Verified', summary.verified, 'text-green-600'],
            ['Unverified', summary.unverified, 'text-amber-600'],
            ['Must Change PW', summary.mustChangePassword, 'text-rose-600'],
            ['Has Token', summary.hasToken, 'text-indigo-600'],
            ['Token Active', summary.tokenActive, 'text-blue-600'],
            ['Token Expired', summary.tokenExpired, 'text-orange-600'],
            ['Resend >= 3', summary.resendHeavy, 'text-purple-600'],
          ].map(([label, val, cls]) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</div>
              <div className={`text-2xl font-black mt-1 ${cls}`}>{val}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or manager ID"
            className="flex-1 min-w-[220px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />

          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          <select
            value={tokenFilter}
            onChange={(e) => setTokenFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Token State</option>
            <option value="active">Token Active</option>
            <option value="expired">Token Expired</option>
            <option value="none">No Token</option>
          </select>

          <select
            value={passwordFilter}
            onChange={(e) => setPasswordFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Password State</option>
            <option value="must-change">Must Change</option>
            <option value="normal">Normal</option>
          </select>

          {(searchTerm || verifiedFilter !== 'all' || tokenFilter !== 'all' || passwordFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setVerifiedFilter('all');
                setTokenFilter('all');
                setPasswordFilter('all');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              Clear
            </button>
          )}

          <div className="text-xs text-gray-400">Showing {filteredRows.length} of {rows.length}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Verified</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Must Change PW</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Token State</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Sent Count</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Last Sent</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Token Expires</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Manager ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                      No rows found for the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.manager_id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-3 py-3 text-gray-900 font-medium max-w-[140px] truncate" title={row.name}>{row.name}</td>
                      <td className="px-3 py-3 text-gray-700 max-w-[220px] truncate" title={row.email_address}>{row.email_masked}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.email_verified ? 'bg-green-100 text-green-800 border-green-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                          {row.email_verified ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.must_change_password ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                          {row.must_change_password ? 'Required' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.verification_token_active ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-300">Active</span>
                        ) : row.verification_token_expired ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border bg-orange-100 text-orange-800 border-orange-300">Expired</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-100 text-gray-700 border-gray-300">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-gray-700">{row.verification_email_sent_count}</td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">{formatTime(row.last_verification_email_sent_at)}</td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">{formatTime(row.verification_token_expires)}</td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">{formatTime(row.created_at)}</td>
                      <td className="px-3 py-3 text-gray-400 font-mono text-xs max-w-[180px] truncate" title={row.manager_id}>{row.manager_id}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
