'use client';

import { useState, useEffect } from 'react';

export default function WBCTicketsPage() {
    const [tradEadData, setTradEadData] = useState(null);
    const [ticketJamData, setTicketJamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isCached, setIsCached] = useState(false);
    const [cacheAge, setCacheAge] = useState(null);

    const fetchTicketData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/wbc/tickets');
            if (!response.ok) {
                throw new Error('Failed to fetch ticket data');
            }

            const data = await response.json();
            setTradEadData(data.tradEad);
            setTicketJamData(data.ticketJam);
            setLastUpdated(new Date());
            setIsCached(data.cached || false);
            setCacheAge(data.cacheAge || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketData();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        WBC 2026 Ticket Availability
                    </h1>
                    <p className="text-gray-300">
                        Real-time ticket status from TradEad and TicketJam
                    </p>
                    {lastUpdated && (
                        <p className="text-sm text-gray-400 mt-2">
                            Last updated: {lastUpdated.toLocaleString('zh-TW')}
                            {isCached && cacheAge && (
                                <span className="ml-2 text-yellow-400">
                                    (Cached - {cacheAge} old)
                                </span>
                            )}
                        </p>
                    )}
                </div>

                {/* Refresh Button */}
                <div className="flex justify-center mb-6">
                    <button
                        onClick={fetchTicketData}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading...
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Data
                            </>
                        )}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
                        <p className="font-semibold">Error:</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* TradEad Section */}
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">TradEad (Tixplus)</h2>
                            <a
                                href="https://tradead.tixplus.jp/wbc2026/buy/bidding/listings/1517?order=1"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:text-blue-200 text-sm flex items-center gap-1"
                            >
                                Visit Site
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-pulse text-gray-300">Loading TradEad data...</div>
                            </div>
                        ) : tradEadData ? (
                            <div className="space-y-4">
                                {tradEadData.pageTitle && (
                                    <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
                                        <p className="text-blue-200 text-sm font-semibold">頁面標題</p>
                                        <p className="text-white">{tradEadData.pageTitle}</p>
                                    </div>
                                )}

                                {tradEadData.listings && tradEadData.listings.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-gray-300 text-sm font-semibold">票券資訊</p>
                                        {tradEadData.listings.map((listing, index) => (
                                            <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                <p className="text-white text-sm">{listing}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {tradEadData.bodyPreview && (
                                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                        <p className="text-gray-300 text-xs font-semibold mb-2">頁面內容預覽</p>
                                        <p className="text-gray-400 text-xs whitespace-pre-wrap">{tradEadData.bodyPreview}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-8">No data available</p>
                        )}
                    </div>

                    {/* TicketJam Section */}
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">TicketJam</h2>
                            <a
                                href="https://ticketjam.jp/tickets/wbc/event_groups/279318"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:text-blue-200 text-sm flex items-center gap-1"
                            >
                                Visit Site
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-pulse text-gray-300">Loading TicketJam data...</div>
                            </div>
                        ) : ticketJamData ? (
                            <div className="space-y-4">
                                {ticketJamData.pageTitle && (
                                    <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
                                        <p className="text-blue-200 text-sm font-semibold">頁面標題</p>
                                        <p className="text-white">{ticketJamData.pageTitle}</p>
                                    </div>
                                )}

                                {ticketJamData.events && ticketJamData.events.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-gray-300 text-sm font-semibold">活動資訊</p>
                                        {ticketJamData.events.map((event, index) => (
                                            <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                <p className="text-white text-sm">{event}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {ticketJamData.bodyPreview && (
                                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                        <p className="text-gray-300 text-xs font-semibold mb-2">頁面內容預覽</p>
                                        <p className="text-gray-400 text-xs whitespace-pre-wrap">{ticketJamData.bodyPreview}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-8">No data available</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
