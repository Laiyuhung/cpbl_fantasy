'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Separate loading states
    const [nameSaving, setNameSaving] = useState(false);
    const [emailSaving, setEmailSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    // Profile State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);

    // Resend State
    const [isResending, setIsResending] = useState(false);

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Messages
    const [message, setMessage] = useState({ type: '', text: '' });

    // Auto-dismiss all messages
    useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

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
                    setEmailVerified(data.user.email_verified);
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

    const handleProfileUpdate = async (type, payload) => {
        if (type === 'name') setNameSaving(true);
        if (type === 'email') setEmailSaving(true);

        setMessage({ type: '', text: '' });

        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const uid = cookie?.split('=')[1];

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, ...payload })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message || 'Updated successfully!' });
                window.dispatchEvent(new Event('auth-changed'));

                // Reload profile data to get latest status (e.g. if email changed, verified might be false now)
                // Simple refetch or manual update:
                if (type === 'email' && payload.email !== user.email_address) {
                    setEmailVerified(false);
                }
            } else {
                setMessage({ type: 'error', text: data.error || 'Update failed.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            if (type === 'name') setNameSaving(false);
            if (type === 'email') setEmailSaving(false);
        }
    };

    const handleResendVerification = async () => {
        setIsResending(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch('/api/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: 'Verification email sent! Please check your inbox.' });
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to send email.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error sending verification email.' });
        } finally {
            setIsResending(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordSaving(true);
        setMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            setPasswordSaving(false);
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
            setPasswordSaving(false);
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
            {/* Centered Alert Modal */}
            {/* Centered Alert Modal within z-[9999] container */}
            {message.text && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 pointer-events-none">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-300"
                        onClick={() => setMessage({ type: '', text: '' })}
                    />

                    {/* Modal Content */}
                    <div className={`relative pointer-events-auto transform transition-all duration-300 scale-100 px-8 py-6 rounded-2xl shadow-2xl border flex flex-col items-center gap-4 max-w-sm w-full ${message.type === 'success'
                        ? 'bg-slate-900/95 border-green-500/50 text-green-400'
                        : 'bg-slate-900/95 border-red-500/50 text-red-400'
                        }`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${message.type === 'success' ? 'border-green-500/30 bg-green-500/20' : 'border-red-500/30 bg-red-500/20'
                            }`}>
                            {message.type === 'success' ? (
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                        </div>
                        <div className="text-center w-full">
                            <h3 className="text-xl font-bold text-white mb-2">
                                {message.type === 'success' ? 'Success!' : 'Error'}
                            </h3>
                            <p className="text-lg font-medium opacity-90 break-words">{message.text}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-md mx-auto space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300">
                        Profile Settings
                    </h2>
                    <p className="mt-2 text-center text-sm text-purple-200">
                        Manage your account information
                    </p>
                </div>

                {/* Name Update Form */}
                <div className="bg-slate-800/60 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-purple-500/20">
                    <h3 className="text-lg leading-6 font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Update Name
                    </h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleProfileUpdate('name', { name });
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
                            disabled={nameSaving}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
                        >
                            {nameSaving ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </span>
                            ) : 'Update Name'}
                        </button>
                    </form>
                </div>

                {/* Email Update Form */}
                <div className="bg-slate-800/60 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg leading-6 font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Update Email
                        </h3>
                        {emailVerified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Verified
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Unverified
                            </span>
                        )}
                    </div>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleProfileUpdate('email', { email });
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
                            disabled={emailSaving}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                        >
                            {emailSaving ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </span>
                            ) : 'Update Email'}
                        </button>
                    </form>

                    {!emailVerified && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={isResending}
                                className="w-full flex justify-center py-2 px-4 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-blue-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                            >
                                {isResending ? 'Sending...' : 'Resend Verification Email'}
                            </button>
                        </div>
                    )}
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
                                disabled={passwordSaving}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-all"
                            >
                                {passwordSaving ? 'Updating...' : 'Change Password'}
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
