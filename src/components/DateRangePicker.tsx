import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';

export type DateRangePreset = '365D' | '90D' | '30D' | '7D' | 'TODAY' | 'MONTH' | 'CUSTOM';

export type DateRangeFilter = {
  preset: DateRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
};

interface DateRangePickerProps {
  value: DateRangeFilter;
  onChange: (value: DateRangeFilter) => void;
  showPresetsInline?: boolean;
}

export function isTimestampInRange(ts: number, filter: DateRangeFilter): boolean {
  if (filter.preset === 'CUSTOM' && filter.startDate && filter.endDate) {
    const start = new Date(`${filter.startDate}T00:00:00`).getTime();
    const end = new Date(`${filter.endDate}T23:59:59.999`).getTime();
    return ts >= start && ts <= end;
  }

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  if (filter.preset === 'TODAY') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return ts >= d.getTime();
  }

  if (filter.preset === 'MONTH') {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return ts >= d.getTime();
  }

  const days =
    filter.preset === '365D'
      ? 365
      : filter.preset === '90D'
      ? 90
      : filter.preset === '30D'
      ? 30
      : 7;

  return ts >= now - days * DAY_MS;
}

export function getDateRangeLabel(filter: DateRangeFilter): string {
  if (filter.preset === 'CUSTOM' && filter.startDate && filter.endDate) {
    const s = new Date(`${filter.startDate}T00:00:00`).toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const e = new Date(`${filter.endDate}T00:00:00`).toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `${s} – ${e}`;
  }
  if (filter.preset === 'TODAY') return 'Today';
  if (filter.preset === 'MONTH') return 'This Month';
  if (filter.preset === '90D') return 'Last 90 Days';
  if (filter.preset === '30D') return 'Last 30 Days';
  if (filter.preset === '7D') return 'Last 7 Days';
  return 'Last 1 Year';
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DateRangePicker({
  value,
  onChange,
  showPresetsInline = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const todayStr = toIsoDate(new Date());
  const oneYearAgoStr = toIsoDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

  const [customStart, setCustomStart] = useState<string>(
    value.startDate || oneYearAgoStr
  );
  const [customEnd, setCustomEnd] = useState<string>(
    value.endDate || todayStr
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectPreset = (preset: DateRangePreset) => {
    if (preset === 'CUSTOM') {
      onChange({
        preset: 'CUSTOM',
        startDate: customStart,
        endDate: customEnd,
      });
    } else {
      onChange({ preset });
    }
    setIsOpen(false);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) {
      alert('Start date cannot be after end date.');
      return;
    }
    onChange({
      preset: 'CUSTOM',
      startDate: customStart,
      endDate: customEnd,
    });
    setIsOpen(false);
  };

  const isCustom = value.preset === 'CUSTOM';

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {/* Main Interactive Calendar Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            isOpen || isCustom
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="Click to select custom date range"
        >
          <Calendar size={15} className={isOpen || isCustom ? 'text-white' : 'text-blue-600'} />
          <span className="font-semibold">{isCustom ? getDateRangeLabel(value) : 'Date Range'}</span>
          <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Inline Quick Presets */}
        {showPresetsInline && (
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
            {(
              [
                { id: '365D', label: '1 Year' },
                { id: '90D', label: '90D' },
                { id: '30D', label: '30D' },
                { id: '7D', label: '7D' },
              ] as const
            ).map(p => {
              const active = value.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Calendar size={16} className="text-blue-600" />
              Select Date Range
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Quick Presets
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: '365D', label: 'Last 1 Year' },
                  { id: '90D', label: 'Last 90 Days' },
                  { id: '30D', label: 'Last 30 Days' },
                  { id: '7D', label: 'Last 7 Days' },
                  { id: 'MONTH', label: 'This Month' },
                  { id: 'TODAY', label: 'Today' },
                ] as const
              ).map(preset => {
                const isSelected = value.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[11px] text-center transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range Selection Form */}
          <form onSubmit={handleApplyCustom} className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Custom From / To Dates
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || todayStr}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={todayStr}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Check size={14} />
                <span>Apply Range</span>
              </button>

              {isCustom && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset('365D')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg transition-colors cursor-pointer"
                  title="Reset to 1 Year"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
