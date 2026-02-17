'use client';
import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function AmericanDatePicker({ value, onChange, minDate, disabled, className }) {
    const [show, setShow] = useState(false);
    const [viewDate, setViewDate] = useState(new Date()); // Calendar view month
    const containerRef = useRef(null);

    // Parse input value
    const dateValue = value ? new Date(value) : null;
    const isValidDate = dateValue && !isNaN(dateValue.getTime());

    // Initialize view date from value or minDate or today
    useEffect(() => {
        if (show) {
            if (isValidDate) {
                setViewDate(new Date(dateValue));
            } else if (minDate) {
                setViewDate(new Date(minDate));
            } else {
                setViewDate(new Date());
            }
        }
    }, [show]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShow(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleDateClick = (day) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

        // Preserve time from current value or default to 12:00 PM
        if (isValidDate) {
            newDate.setHours(dateValue.getHours(), dateValue.getMinutes());
        } else {
            newDate.setHours(12, 0);
        }

        // Check minDate
        if (minDate && newDate < new Date(minDate)) {
            // If selected date is before minDate (considering time), maybe just set date part and adjust time?
            // Simplified: Just allow setting date, time might be invalid, validation handles it externally?
            // Or auto-adjust time to minDate time if same day?
        }

        emitChange(newDate);
    };

    const handleTimeChange = (type, val) => {
        const current = isValidDate ? new Date(dateValue) : new Date();
        // If no value yet, use today or minDate
        if (!isValidDate && minDate) {
            current.setTime(new Date(minDate).getTime());
        }

        if (type === 'hour') {
            let h = parseInt(val);
            const isPM = current.getHours() >= 12;
            // Handle 12-hour format logic if needed or just use 0-23 inputs?
            // Let's use simple dropdowns for HH (1-12) + AM/PM
        }

        // Actually, let's just construct new date
        let newDate = new Date(current);

        // Get current AM/PM status
        let hours = newDate.getHours();
        let isPm = hours >= 12;
        if (type === 'ampm') {
            if (val === 'PM' && !isPm) hours += 12;
            else if (val === 'AM' && isPm) hours -= 12;
        } else if (type === 'hour') {
            let h = parseInt(val);
            if (h === 12) h = 0; // treat 12 as 0 temp
            if (isPm) h += 12;
            hours = h;
        } else if (type === 'minute') {
            newDate.setMinutes(parseInt(val));
        }

        newDate.setHours(hours);
        emitChange(newDate);
    };

    const emitChange = (date) => {
        // Format to YYYY-MM-DDTHH:mm
        const pad = (n) => n.toString().padStart(2, '0');
        const isoString = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        onChange(isoString);
    };

    // Rendering
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    // Time values
    const hours = dateValue ? (dateValue.getHours() % 12 || 12) : 12;
    const minutes = dateValue ? dateValue.getMinutes() : 0;
    const ampm = dateValue ? (dateValue.getHours() >= 12 ? 'PM' : 'AM') : 'AM';

    const formatDisplay = (date) => {
        if (!date) return '';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Input Display */}
            <div
                onClick={() => !disabled && setShow(!show)}
                className={`flex items-center justify-between w-full px-3 py-2 bg-slate-800/60 border rounded-md cursor-pointer transition-colors ${disabled ? 'opacity-50 cursor-not-allowed border-purple-500/10' : 'border-purple-500/30 hover:border-purple-500/50'}`}
            >
                <span className={`text-sm ${isValidDate ? 'text-white' : 'text-slate-400'}`}>
                    {isValidDate ? formatDisplay(dateValue) : 'Select Date & Time'}
                </span>
                <CalendarIcon className="w-4 h-4 text-purple-400" />
            </div>

            {/* Popup */}
            {show && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[300px] animate-scaleIn">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}
                            className="p-1 hover:bg-slate-700 rounded text-purple-300 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-white">
                            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </span>
                        <button
                            type="button"
                            onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}
                            className="p-1 hover:bg-slate-700 rounded text-purple-300 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 mb-4 text-center">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                            <div key={d} className="text-xs font-bold text-purple-400/70 py-1">{d}</div>
                        ))}
                        {days.map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} />;

                            const currentDayDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                            const isSelected = isValidDate &&
                                dateValue.getDate() === day &&
                                dateValue.getMonth() === viewDate.getMonth() &&
                                dateValue.getFullYear() === viewDate.getFullYear();

                            const isToday = new Date().toDateString() === currentDayDate.toDateString();
                            const isDisabled = minDate && new Date(currentDayDate.setHours(23, 59, 59, 999)) < new Date(minDate);

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                    text-sm p-1 rounded-full transition-all
                    ${isSelected ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-500/50' : ''}
                    ${!isSelected && !isDisabled ? 'hover:bg-purple-500/20 text-slate-300 hover:text-white' : ''}
                    ${isDisabled ? 'text-slate-700 cursor-not-allowed' : ''}
                    ${isToday && !isSelected ? 'border border-purple-500/50' : ''}
                  `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Time Picker */}
                    <div className="border-t border-purple-500/20 pt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <select
                                value={hours}
                                onChange={(e) => handleTimeChange('hour', e.target.value)}
                                className="bg-slate-800 border-none rounded text-white text-sm p-1 cursor-pointer focus:ring-1 focus:ring-purple-500"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                            <span className="text-white">:</span>
                            <select
                                value={minutes}
                                onChange={(e) => handleTimeChange('minute', e.target.value)}
                                className="bg-slate-800 border-none rounded text-white text-sm p-1 cursor-pointer focus:ring-1 focus:ring-purple-500"
                            >
                                {Array.from({ length: 4 }, (_, i) => i * 15).map(m => (
                                    <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                ))}
                                {!Array.from({ length: 4 }, (_, i) => i * 15).includes(minutes) && (
                                    <option value={minutes}>{minutes.toString().padStart(2, '0')}</option>
                                )}
                            </select>
                            <select
                                value={ampm}
                                onChange={(e) => handleTimeChange('ampm', e.target.value)}
                                className="bg-slate-800 border-none rounded text-white text-sm p-1 cursor-pointer focus:ring-1 focus:ring-purple-500"
                            >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShow(false)}
                            className="text-xs font-bold text-purple-300 hover:text-white uppercase"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
