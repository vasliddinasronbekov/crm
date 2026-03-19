'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DateCalendarProps {
  onDateSelect?: (date: Date) => void;
  onDateRangeSelect?: (startDate: Date, endDate: Date) => void;
  mode?: 'single' | 'range';
}

export default function DateCalendar({ onDateSelect, onDateRangeSelect, mode: initialMode = 'single' }: DateCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [lastClickedDate, setLastClickedDate] = useState<Date | null>(null);
  const [clickTimeout, setClickTimeout] = useState<any | null>(null);
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>(initialMode);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(today, date);
  };

  const isInRange = (date: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    return date >= rangeStart && date <= rangeEnd;
  };

  const isRangeStart = (date: Date) => {
    return rangeStart && isSameDay(rangeStart, date);
  };

  const isRangeEnd = (date: Date) => {
    return rangeEnd && isSameDay(rangeEnd, date);
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (selectionMode === 'range') {
      // Range selection mode
      if (!rangeStart || (rangeStart && rangeEnd)) {
        // Start new range
        setRangeStart(clickedDate);
        setRangeEnd(null);
        setSelectedDate(clickedDate);
      } else {
        // Complete the range
        const start = rangeStart < clickedDate ? rangeStart : clickedDate;
        const end = rangeStart < clickedDate ? clickedDate : rangeStart;
        setRangeStart(start);
        setRangeEnd(end);
        setSelectedDate(end);

        if (onDateRangeSelect) {
          onDateRangeSelect(start, end);
        }
      }
    } else {
      // Single date selection mode (existing logic)
      // Check if this is a double-click (within 500ms)
      if (
        lastClickedDate &&
        isSameDay(lastClickedDate, clickedDate) &&
        clickTimeout
      ) {
        // Double click detected - redirect to data view for this date
        clearTimeout(clickTimeout);
        setClickTimeout(null);
        handleDoubleClick(clickedDate);
      } else {
        // First click - set selected date and wait for potential second click
        setSelectedDate(clickedDate);
        setLastClickedDate(clickedDate);

        // Clear any existing timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }

        // Set new timeout to reset double-click detection
        const timeout = setTimeout(() => {
          setClickTimeout(null);
          setLastClickedDate(null);
        }, 500);

        setClickTimeout(timeout);

        // Call callback for single click
        if (onDateSelect) {
          onDateSelect(clickedDate);
        }
      }
    }
  };

  const handleDoubleClick = (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Close the calendar
    setIsOpen(false);

    // Navigate to a data view page with the date as a parameter
    // You can change this to navigate to any page you want
    router.push(`/dashboard/data-view?date=${formattedDate}`);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'quarter') => {
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date(today);
        start.setDate(today.getDate() - 30);
        break;
      case 'quarter':
        start = new Date(today);
        start.setDate(today.getDate() - 90);
        break;
      default:
        start = today;
    }

    setRangeStart(start);
    setRangeEnd(end);
    setCurrentMonth(start);

    if (onDateRangeSelect && start && end) {
      onDateRangeSelect(start, end);
    }
  };

  const renderCalendarDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="p-2"></div>
      );
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isSelected = isSameDay(selectedDate, date);
      const isTodayDate = isToday(date);
      const inRange = isInRange(date);
      const rangeStartDate = isRangeStart(date);
      const rangeEndDate = isRangeEnd(date);

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(day)}
          className={`
            p-2 rounded-xl transition-all duration-200 relative
            ${selectionMode === 'range' && (rangeStartDate || rangeEndDate)
              ? 'bg-gradient-to-br from-primary to-cyan-500 text-white font-bold shadow-lg scale-105'
              : selectionMode === 'range' && inRange
              ? 'bg-primary/20 text-primary font-semibold'
              : isSelected && selectionMode === 'single'
              ? 'bg-gradient-to-br from-primary to-cyan-500 text-white font-bold shadow-lg scale-105'
              : isTodayDate
              ? 'bg-primary/10 text-primary font-semibold border-2 border-primary/30'
              : 'hover:bg-primary/5 hover:scale-105'
            }
          `}
        >
          {day}
          {((selectionMode === 'single' && isSelected) || (selectionMode === 'range' && (rangeStartDate || rangeEndDate))) && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-cyan-400 rounded-full animate-pulse"></div>
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="relative" ref={calendarRef}>
      {/* Date Display Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-chip group flex items-center gap-2 px-4 py-2 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
      >
        <Calendar className="h-4 w-4 text-text-secondary group-hover:text-primary transition-colors" />
        <span className="text-sm text-text-secondary group-hover:text-foreground transition-colors">
          {selectedDate ? formatDateShort(selectedDate) : formatDateShort(new Date())}
        </span>
      </button>

      {/* Calendar Popup */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-[85] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="glass-panel-strong border border-border/70 rounded-2xl shadow-2xl p-6 w-80">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                  {selectionMode === 'single' ? 'Select Date' : 'Select Date Range'}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {selectionMode === 'single' ? 'Double-click to view data' : 'Click start and end dates'}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-2 mb-4 p-2 bg-background rounded-xl">
              <button
                onClick={() => {
                  setSelectionMode('single');
                  setRangeStart(null);
                  setRangeEnd(null);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectionMode === 'single'
                    ? 'bg-gradient-to-r from-primary to-cyan-500 text-white'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                Single Date
              </button>
              <button
                onClick={() => {
                  setSelectionMode('range');
                  setSelectedDate(null);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectionMode === 'range'
                    ? 'bg-gradient-to-r from-primary to-cyan-500 text-white'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                Date Range
              </button>
            </div>

            {/* Quick Presets (only show in range mode) */}
            {selectionMode === 'range' && (
              <div className="mb-4">
                <p className="text-xs text-text-secondary mb-2 font-medium">Quick Presets:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Last 7 days', value: 'week' as const },
                    { label: 'Last 30 days', value: 'month' as const },
                    { label: 'Last 90 days', value: 'quarter' as const },
                    { label: 'Today', value: 'today' as const },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => applyPreset(preset.value)}
                      className="px-3 py-2 text-xs bg-surface hover:bg-primary/10 rounded-lg transition-all border border-border hover:border-primary/50 text-text-secondary hover:text-primary font-medium"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-primary" />
              </button>

              <div className="text-center">
                <div className="font-bold text-foreground">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              <button
                onClick={nextMonth}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-primary" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-text-secondary p-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {renderCalendarDays()}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors font-medium"
                >
                  Today
                </button>

                {selectionMode === 'range' && rangeStart && rangeEnd && (
                  <button
                    onClick={() => {
                      setRangeStart(null);
                      setRangeEnd(null);
                    }}
                    className="px-4 py-2 text-sm bg-error/10 hover:bg-error/20 text-error rounded-xl transition-colors font-medium"
                  >
                    Clear Range
                  </button>
                )}
              </div>

              {selectionMode === 'single' && selectedDate && (
                <div className="text-xs text-text-secondary">
                  Selected: {formatDate(selectedDate)}
                </div>
              )}

              {selectionMode === 'range' && rangeStart && (
                <div className="text-xs text-text-secondary space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Start:</span>
                    <span className="font-medium text-foreground">{formatDateShort(rangeStart)}</span>
                  </div>
                  {rangeEnd && (
                    <div className="flex items-center justify-between">
                      <span>End:</span>
                      <span className="font-medium text-foreground">{formatDateShort(rangeEnd)}</span>
                    </div>
                  )}
                  {rangeEnd && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="font-semibold">Duration:</span>
                      <span className="font-semibold text-primary">
                        {Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Instruction */}
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <p className="text-xs text-cyan-600 dark:text-cyan-400 text-center">
                {selectionMode === 'single'
                  ? '💡 Double-click any date to view all system data for that day'
                  : '💡 Click two dates to select a range, or use quick presets above'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
