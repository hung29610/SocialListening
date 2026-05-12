'use client';

import { useState, useEffect } from 'react';

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
        Quét thủ công - không cần lịch tự động
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Daily: Select hours */}
      {frequency === 'daily' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn giờ quét (có thể chọn nhiều)
          </label>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
              <button
                key={hour}
                type="button"
                onClick={() => toggleSelection(selectedHours, hour, setSelectedHours)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  selectedHours.includes(hour)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                }`}
              >
                {hour.toString().padStart(2, '0')}:00
              </button>
            ))}
          </div>
          {selectedHours.length === 0 && (
            <p className="text-xs text-red-600 mt-1">Vui lòng chọn ít nhất 1 giờ</p>
          )}
        </div>
      )}

      {/* Weekly: Select days of week + time */}
      {frequency === 'weekly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn thứ trong tuần (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-7 gap-2">
              {[
                { value: 0, label: 'T2' },
                { value: 1, label: 'T3' },
                { value: 2, label: 'T4' },
                { value: 3, label: 'T5' },
                { value: 4, label: 'T6' },
                { value: 5, label: 'T7' },
                { value: 6, label: 'CN' }
              ].map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfWeek, day.value, setSelectedDaysOfWeek)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    selectedDaysOfWeek.includes(day.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {selectedDaysOfWeek.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Vui lòng chọn ít nhất 1 ngày</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Giờ quét
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {/* Monthly: Select days of month + time */}
      {frequency === 'monthly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn ngày trong tháng (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfMonth, day, setSelectedDaysOfMonth)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedDaysOfMonth.includes(day)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDaysOfMonth.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Vui lòng chọn ít nhất 1 ngày</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Giờ quét
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {/* Yearly: Select months + days + time */}
      {frequency === 'yearly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn tháng (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleSelection(selectedMonths, month, setSelectedMonths)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedMonths.includes(month)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  T{month}
                </button>
              ))}
            </div>
            {selectedMonths.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Vui lòng chọn ít nhất 1 tháng</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn ngày trong tháng (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfMonth, day, setSelectedDaysOfMonth)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedDaysOfMonth.includes(day)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDaysOfMonth.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Vui lòng chọn ít nhất 1 ngày</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Giờ quét
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}
    </div>
  );
}
