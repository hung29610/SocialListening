'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ScheduleSelectorProps {
  frequency: 'manual' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  value: {
    hours?: number[];
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    months?: number[];
    time?: string;
  };
  onChange: (value: any) => void;
}

export default function ScheduleSelector({ frequency, value, onChange }: ScheduleSelectorProps) {
  const { t } = useLanguage();
  const [selectedHours, setSelectedHours] = useState<number[]>(value.hours || []);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>(value.daysOfWeek || []);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>(value.daysOfMonth || []);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(value.months || []);
  const [time, setTime] = useState(value.time || '09:00');

  useEffect(() => {
    // Update parent when selections change
    onChange({
      hours: selectedHours,
      daysOfWeek: selectedDaysOfWeek,
      daysOfMonth: selectedDaysOfMonth,
      months: selectedMonths,
      time
    });
  }, [selectedHours, selectedDaysOfWeek, selectedDaysOfMonth, selectedMonths, time]);

  const toggleSelection = (array: number[], value: number, setter: (arr: number[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(v => v !== value));
    } else {
      setter([...array, value].sort((a, b) => a - b));
    }
  };

  if (frequency === 'manual') {
    return (
      <div className="text-sm text-gray-500">
        {t('scanPage.scheduleSelector.manual')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Daily: Select hours */}
      {frequency === 'daily' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            {t('scanPage.scheduleSelector.pickHours')}
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
              <button
                key={hour}
                type="button"
                onClick={() => toggleSelection(selectedHours, hour, setSelectedHours)}
                className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                  selectedHours.includes(hour)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:border-indigo-500/50 hover:bg-white dark:bg-[#1E293B]/80'
                }`}
              >
                {hour.toString().padStart(2, '0')}:00
              </button>
            ))}
          </div>
          {selectedHours.length === 0 && (
            <p className="text-xs text-rose-400 mt-2">{t('scanPage.scheduleSelector.needHour')}</p>
          )}
        </div>
      )}

      {/* Weekly: Select days of week + time */}
      {frequency === 'weekly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.pickWeekdays')}
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {[
                { value: 0, label: t('scanPage.scheduleSelector.weekday.mon') },
                { value: 1, label: t('scanPage.scheduleSelector.weekday.tue') },
                { value: 2, label: t('scanPage.scheduleSelector.weekday.wed') },
                { value: 3, label: t('scanPage.scheduleSelector.weekday.thu') },
                { value: 4, label: t('scanPage.scheduleSelector.weekday.fri') },
                { value: 5, label: t('scanPage.scheduleSelector.weekday.sat') },
                { value: 6, label: t('scanPage.scheduleSelector.weekday.sun') }
              ].map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfWeek, day.value, setSelectedDaysOfWeek)}
                  className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                    selectedDaysOfWeek.includes(day.value)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:border-indigo-500/50 hover:bg-white dark:bg-[#1E293B]/80'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {selectedDaysOfWeek.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">{t('scanPage.scheduleSelector.needDay')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.scanTime')}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
        </>
      )}

      {/* Monthly: Select days of month + time */}
      {frequency === 'monthly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.pickMonthDays')}
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfMonth, day, setSelectedDaysOfMonth)}
                  className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                    selectedDaysOfMonth.includes(day)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:border-indigo-500/50 hover:bg-white dark:bg-[#1E293B]/80'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDaysOfMonth.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">{t('scanPage.scheduleSelector.needDay')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.scanTime')}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
        </>
      )}

      {/* Yearly: Select months + days + time */}
      {frequency === 'yearly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.pickMonths')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleSelection(selectedMonths, month, setSelectedMonths)}
                  className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                    selectedMonths.includes(month)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:border-indigo-500/50 hover:bg-white dark:bg-[#1E293B]/80'
                  }`}
                >
                  {t('scanPage.scheduleSelector.monthPrefix')}{month}
                </button>
              ))}
            </div>
            {selectedMonths.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">{t('scanPage.scheduleSelector.needMonth')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.pickMonthDays')}
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfMonth, day, setSelectedDaysOfMonth)}
                  className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                    selectedDaysOfMonth.includes(day)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:border-indigo-500/50 hover:bg-white dark:bg-[#1E293B]/80'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDaysOfMonth.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">{t('scanPage.scheduleSelector.needDay')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('scanPage.scheduleSelector.scanTime')}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
        </>
      )}
    </div>
  );
}
