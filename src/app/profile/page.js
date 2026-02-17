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

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const uid = cookie?.split('=')[1];

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, name, email })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
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
        <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                        Profile Settings
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-400">
                        Manage your account information
                    </p>
                </div>

                {message.text && (
                    <div className={`rounded-md p-4 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
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

                <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
                    <h3 className="text-lg leading-6 font-medium text-white mb-4">Basic Information</h3>
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                                Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-slate-800 text-white sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-slate-800 text-white sm:text-sm"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Note: Changing your email will require verification. Please check your inbox and spam folder.
                            </p>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Update Profile'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
                    <h3 className="text-lg leading-6 font-medium text-white mb-4">Change Password</h3>
                    <form onSubmit={handlePasswordChange} className="space-y-6">
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
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-slate-800 text-white sm:text-sm"
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
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-slate-800 text-white sm:text-sm"
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
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-slate-800 text-white sm:text-sm"
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
