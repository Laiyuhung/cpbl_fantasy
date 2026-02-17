'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Profile State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Messages
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchUser = async () => {
            const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
            const uid = cookie?.split('=')[1];

            if (!uid) {
                router.push('/login');
                return;
            }

            try {
                const response = await fetch(`/api/user/profile?user_id=${uid}`, {
                    method: 'GET'
                });
                const data = await response.json();

                if (data.success) {
                    setUser(data.user);
                    setName(data.user.name);
                    setEmail(data.user.email_address);
                } else {
                    setMessage({ type: 'error', text: 'Failed to load user data.' });
                }
            } catch (error) {
                console.error('Error loading profile:', error);
                setMessage({ type: 'error', text: 'Unexpected error loading profile.' });
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    const handleProfileUpdate = async (updatePayload) => {
        setSaving(true);
        setMessage({ type: '', text: '' });

        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const uid = cookie?.split('=')[1];

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, ...updatePayload })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message || 'Updated successfully!' });
                // Dispatch event to update Navbar
                window.dispatchEvent(new Event('auth-changed'));
            } else {
                setMessage({ type: 'error', text: data.error || 'Update failed.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            setSaving(false);
            return;
        }

        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const uid = cookie?.split('=')[1];

        try {
            const res = await fetch('/api/user/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, currentPassword, newPassword })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                // Force logout after a short delay
                setTimeout(async () => {
                    await fetch('/api/logout', { method: 'POST' });
                    localStorage.removeItem('user_id');
                    window.dispatchEvent(new Event('auth-changed'));
                    router.push('/login');
                }, 2000);
            } else {
                setMessage({ type: 'error', text: data.error || 'Password update failed.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300">
                        Profile Settings
                    </h2>
                    <p className="mt-2 text-center text-sm text-purple-200">
                        Manage your account information
                    </p>
                </div>

                {message.text && (
                    <div className={`rounded-md p-4 animate-fade-in ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {message.type === 'success' ? (
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium">{message.text}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Name Update Form */}
                <div className="bg-slate-800/60 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-purple-500/20">
                    <h3 className="text-lg leading-6 font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Update Name
                    </h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleProfileUpdate({ name });
                    }} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                                Display Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
                        >
                            {saving ? 'Saving...' : 'Update Name'}
                        </button>
                    </form>
                </div>

                {/* Email Update Form */}
                <div className="bg-slate-800/60 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-purple-500/20">
                    <h3 className="text-lg leading-6 font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Update Email
                    </h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleProfileUpdate({ email });
                    }} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                                Email Address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white sm:text-sm transition-all"
                            />
                            <p className="mt-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                ℹ️ Changing email requires verification. A limit of 5 verification emails per day applies.
                            </p>
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                        >
                            {saving ? 'Saving...' : 'Update Email'}
                        </button>
                    </form>
                </div>

                {/* Password Change Form */}
                <div className="bg-slate-800/60 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-purple-500/20">
                    <h3 className="text-lg leading-6 font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Change Password
                    </h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label htmlFor="current-password" className="block text-sm font-medium text-slate-300">
                                Current Password
                            </label>
                            <input
                                id="current-password"
                                name="current-password"
                                type="password"
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-white sm:text-sm transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="new-password" className="block text-sm font-medium text-slate-300">
                                New Password
                            </label>
                            <input
                                id="new-password"
                                name="new-password"
                                type="password"
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-white sm:text-sm transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
                                Confirm New Password
                            </label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                required
                                minLength={6}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-white sm:text-sm transition-all"
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-all"
                            >
                                {saving ? 'Updating...' : 'Change Password'}
                            </button>
                            <p className="mt-2 text-xs text-center text-slate-500">
                                Changing your password will log you out of all sessions.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
