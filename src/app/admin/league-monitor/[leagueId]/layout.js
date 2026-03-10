'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

export default function AdminLeagueMonitorLayout({ children }) {
    const pathname = usePathname();
    const params = useParams();
    const leagueId = params.leagueId;

    const navItems = [
        { name: 'Matchups', path: `/admin/league-monitor/${leagueId}/matchups` },
        { name: 'Rosters', path: `/admin/league-monitor/${leagueId}/rosters` },
        { name: 'Transactions', path: `/admin/league-monitor/${leagueId}/transactions` }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Admin League Detail Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-4 flex items-center gap-4 border-b border-gray-100">
                        <Link
                            href="/admin/league-monitor"
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Admin League Inspector</h1>
                            <p className="text-xs text-gray-500 font-mono">League ID: {leagueId}</p>
                        </div>
                        <div className="ml-auto px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded flex items-center gap-1 border border-red-200">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ADMIN OVERRIDE ACTIVE
                        </div>
                    </div>

                    <nav className="flex space-x-1 py-1 -mb-px overflow-x-auto">
                        {navItems.map((item) => {
                            const isActive = pathname === item.path;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.path}
                                    className={`
                                        whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors
                                        ${isActive
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                    `}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Page Content */}
            <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </div>
        </div>
    );
}
