'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function LeagueChat({ leagueId, managerId, isCompact = false, className = '', pollInterval = 5000, enablePolling = true }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isOpen, setIsOpen] = useState(!isCompact);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const pollIntervalRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    const fetchMessages = useCallback(async () => {
        if (!leagueId) return;

        try {
            const res = await fetch(`/api/league-chat?league_id=${leagueId}&limit=100`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages || []);
            }
        } catch (err) {
            console.error('Failed to fetch chat messages:', err);
        } finally {
            setLoading(false);
        }
    }, [leagueId]);

    // Polling logic - only poll when enablePolling is true
    useEffect(() => {
        if (!enablePolling) {
            // Clear any existing timeout when polling is disabled
            if (pollIntervalRef.current) {
                clearTimeout(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // Schedule next poll after each fetch
        const scheduleNextPoll = async () => {
            await fetchMessages();
            if (enablePolling) {
                pollIntervalRef.current = setTimeout(scheduleNextPoll, pollInterval);
            }
        };

        // Start polling cycle (after initial fetch from below useEffect)
        pollIntervalRef.current = setTimeout(scheduleNextPoll, pollInterval);

        return () => {
            if (pollIntervalRef.current) {
                clearTimeout(pollIntervalRef.current);
            }
        };
    }, [enablePolling, pollInterval, fetchMessages]);

    // Initial fetch only
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, scrollToBottom]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending || !managerId) return;

        setSending(true);
        try {
            const res = await fetch('/api/league-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    league_id: leagueId,
                    manager_id: managerId,
                    message: newMessage.trim()
                })
            });

            const data = await res.json();
            if (data.success) {
                setNewMessage('');
                // Add message immediately for responsiveness
                setMessages(prev => [...prev, data.message]);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getSenderName = (msg) => {
        return msg.nickname || 'Unknown';
    };

    const getMessageTypeStyle = (type) => {
        switch (type) {
            case 'system':
                return 'bg-slate-700/50 text-slate-400 italic text-center text-xs';
            case 'draft_pick':
                return 'bg-purple-900/30 border-l-2 border-purple-500 text-purple-300 text-xs';
            default:
                return '';
        }
    };

    if (isCompact) {
        return (
            <div className={`bg-slate-800/40 rounded-xl border border-slate-700 backdrop-blur-sm shadow-xl flex flex-col overflow-hidden ${className}`}>
                {/* Header */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Chat</span>
                        {messages.length > 0 && (
                            <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {messages.length}
                            </span>
                        )}
                    </div>
                    <span className="text-slate-500 text-sm">{isOpen ? '▼' : '◀'}</span>
                </button>

                {/* Chat Body */}
                {isOpen && (
                    <div className="flex flex-col flex-1 min-h-[150px] max-h-[250px]">
                        <div
                            ref={chatContainerRef}
                            className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar"
                        >
                            {loading ? (
                                <div className="text-slate-500 text-sm text-center py-4">Loading...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-slate-500 text-sm text-center py-4">No messages yet</div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex w-full mb-1 ${msg.manager_id === managerId ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`rounded-md px-2 py-1 w-fit max-w-[66%] break-words ${getMessageTypeStyle(msg.message_type)} ${msg.message_type === 'chat'
                                                ? msg.manager_id === managerId
                                                    ? 'bg-purple-600/30'
                                                    : 'bg-slate-700/50'
                                                : 'mx-auto w-full max-w-full'
                                                }`}
                                        >
                                            {msg.message_type === 'chat' && (
                                                <div className={`flex items-center gap-2 mb-0.5 ${msg.manager_id === managerId ? 'justify-end' : 'justify-start'}`}>
                                                    <span className={`text-[10px] sm:text-xs font-bold ${msg.manager_id === managerId ? 'text-purple-300' : 'text-cyan-300'}`}>
                                                        {getSenderName(msg)}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 whitespace-nowrap">{formatTime(msg.created_at)}</span>
                                                </div>
                                            )}
                                            <p className={`text-xs text-slate-200 leading-snug whitespace-pre-wrap break-words ${msg.message_type === 'chat' && msg.manager_id === managerId ? 'text-right' : 'text-left'}`}>
                                                {msg.message}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSend} className="p-2 border-t border-slate-700/50 flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                maxLength={500}
                                className="flex-1 bg-slate-900/60 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || sending}
                                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-bold text-xs transition-colors"
                            >
                                {sending ? '...' : '↑'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    // Full-size version for overview page
    return (
        <div className={`bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">League Chat</h3>
            </div>

            {/* Messages */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar min-h-[250px] max-h-[350px]"
            >
                {loading ? (
                    <div className="text-slate-500 text-sm text-center py-8">Loading messages...</div>
                ) : messages.length === 0 ? (
                    <div className="text-slate-500 text-sm text-center py-8">
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.manager_id === managerId ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`rounded-lg px-3 py-1.5 w-fit max-w-[66%] break-words ${getMessageTypeStyle(msg.message_type)} ${msg.message_type === 'chat'
                                    ? msg.manager_id === managerId
                                        ? 'bg-purple-600/20 border border-purple-500/30'
                                        : 'bg-slate-700/30 border border-slate-600/30'
                                    : 'mx-auto w-full max-w-full'
                                    }`}
                            >
                                {msg.message_type === 'chat' && (
                                    <div className={`flex items-center gap-2 mb-0.5 ${msg.manager_id === managerId ? 'justify-end' : 'justify-start'}`}>
                                        <span className={`text-xs font-bold ${msg.manager_id === managerId ? 'text-purple-300' : 'text-cyan-300'}`}>
                                            {getSenderName(msg)}
                                        </span>
                                        <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatTime(msg.created_at)}</span>
                                    </div>
                                )}
                                <p className={`text-sm text-slate-200 leading-snug whitespace-pre-wrap break-words ${msg.message_type === 'chat' && msg.manager_id === managerId ? 'text-right' : 'text-left'}`}>
                                    {msg.message}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="flex-1 bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-bold text-sm transition-colors flex items-center gap-2"
                >
                    {sending ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                        <>
                            Send
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
