import React, { useState, useRef, useEffect } from 'react';
import { Filter, Search, X, Check, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/helpers';

export type FilterType = 'checkbox' | 'numeric' | 'text';

export interface CheckboxFilterValue {
  type: 'checkbox';
  selectedValues: string[];
}

export interface NumericFilterValue {
  type: 'numeric';
  operator: 'all' | 'equals' | 'greater' | 'less' | 'between';
  val1?: number;
  val2?: number;
}

export interface TextFilterValue {
  type: 'text';
  mode: 'contains' | 'starts' | 'equals';
  text: string;
}

export type FilterValue = CheckboxFilterValue | NumericFilterValue | TextFilterValue;

interface OptionWithCount {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  columnId: string;
  columnLabel: string;
  filterType: FilterType;
  options?: OptionWithCount[]; // For checkbox filter type
  value?: FilterValue | null;
  onChange: (val: FilterValue | null) => void;
  className?: string;
}

export default function ExcelColumnFilter({
  columnLabel,
  filterType,
  options = [],
  value,
  onChange,
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Search input for checkbox filter popover
  const [searchQuery, setSearchQuery] = useState('');

  // Checkbox local state
  const [selectedCheckboxValues, setSelectedCheckboxValues] = useState<string[]>(() => {
    if (value && value.type === 'checkbox') return value.selectedValues;
    return options.map(o => o.value);
  });

  // Numeric local state
  const [numOperator, setNumOperator] = useState<NumericFilterValue['operator']>(() => {
    if (value && value.type === 'numeric') return value.operator;
    return 'all';
  });
  const [val1, setVal1] = useState<string>(() => {
    if (value && value.type === 'numeric' && value.val1 !== undefined) return String(value.val1);
    return '';
  });
  const [val2, setVal2] = useState<string>(() => {
    if (value && value.type === 'numeric' && value.val2 !== undefined) return String(value.val2);
    return '';
  });

  // Text local state
  const [textMode, setTextMode] = useState<TextFilterValue['mode']>(() => {
    if (value && value.type === 'text') return value.mode;
    return 'contains';
  });
  const [textVal, setTextVal] = useState<string>(() => {
    if (value && value.type === 'text') return value.text;
    return '';
  });

  // Keep local states updated if incoming prop changes
  useEffect(() => {
    if (value && value.type === 'checkbox') {
      setSelectedCheckboxValues(value.selectedValues);
    } else if (!value && filterType === 'checkbox') {
      setSelectedCheckboxValues(options.map(o => o.value));
    }

    if (value && value.type === 'numeric') {
      setNumOperator(value.operator);
      setVal1(value.val1 !== undefined ? String(value.val1) : '');
      setVal2(value.val2 !== undefined ? String(value.val2) : '');
    } else if (!value && filterType === 'numeric') {
      setNumOperator('all');
      setVal1('');
      setVal2('');
    }

    if (value && value.type === 'text') {
      setTextMode(value.mode);
      setTextVal(value.text);
    } else if (!value && filterType === 'text') {
      setTextMode('contains');
      setTextVal('');
    }
  }, [value, options, filterType]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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

  const isFilterActive = React.useMemo(() => {
    if (!value) return false;
    if (value.type === 'checkbox') {
      return value.selectedValues.length < options.length;
    }
    if (value.type === 'numeric') {
      return value.operator !== 'all' && (value.val1 !== undefined || value.val2 !== undefined);
    }
    if (value.type === 'text') {
      return value.text.trim().length > 0;
    }
    return false;
  }, [value, options]);

  // Checkbox handlers
  const filteredOptions = options.filter(o =>
    o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllSelected = options.length > 0 && selectedCheckboxValues.length === options.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCheckboxValues([]);
    } else {
      setSelectedCheckboxValues(options.map(o => o.value));
    }
  };

  const handleToggleOption = (val: string) => {
    if (selectedCheckboxValues.includes(val)) {
      setSelectedCheckboxValues(selectedCheckboxValues.filter(v => v !== val));
    } else {
      setSelectedCheckboxValues([...selectedCheckboxValues, val]);
    }
  };

  const handleApplyCheckbox = () => {
    if (selectedCheckboxValues.length === options.length) {
      onChange(null); // No filter active if all selected
    } else {
      onChange({ type: 'checkbox', selectedValues: selectedCheckboxValues });
    }
    setIsOpen(false);
  };

  const handleClearCheckbox = () => {
    setSelectedCheckboxValues(options.map(o => o.value));
    onChange(null);
    setIsOpen(false);
  };

  // Numeric handlers
  const handleApplyNumeric = () => {
    if (numOperator === 'all') {
      onChange(null);
    } else {
      const v1 = val1 !== '' ? Number(val1) : undefined;
      const v2 = val2 !== '' ? Number(val2) : undefined;
      onChange({ type: 'numeric', operator: numOperator, val1: v1, val2: v2 });
    }
    setIsOpen(false);
  };

  const handleClearNumeric = () => {
    setNumOperator('all');
    setVal1('');
    setVal2('');
    onChange(null);
    setIsOpen(false);
  };

  // Text handlers
  const handleApplyText = () => {
    if (!textVal.trim()) {
      onChange(null);
    } else {
      onChange({ type: 'text', mode: textMode, text: textVal.trim() });
    }
    setIsOpen(false);
  };

  const handleClearText = () => {
    setTextVal('');
    setTextMode('contains');
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative inline-block text-left", className)} ref={popoverRef} onClick={e => e.stopPropagation()}>
      {/* Icon Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-1 rounded transition-all cursor-pointer inline-flex items-center justify-center border-none ml-1",
          isFilterActive
            ? "bg-[#C58A22] text-[#FFFFFF] shadow-xs"
            : "text-[#9CA3AF] hover:text-[#1F2933] hover:bg-[#E5E7EB]"
        )}
        title={`Filter by ${columnLabel}`}
      >
        <Filter size={11} className={cn(isFilterActive && "stroke-[2.5]")} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-64 rounded-xl bg-white shadow-xl border border-[#E5E7EB] z-50 text-xs animate-fade-in normal-case font-normal text-[#1F2933]"
          style={{ minWidth: '220px' }}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E5E7EB] bg-[#FAFAFA] rounded-t-xl">
            <span className="font-bold text-[#1F2933]">Filter {columnLabel}</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#9CA3AF] hover:text-[#1F2933] bg-transparent border-none cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          </div>

          {/* Popover Content */}
          <div className="p-3 space-y-3">
            {/* CHECKBOX FILTER TYPE */}
            {filterType === 'checkbox' && (
              <>
                {/* Search in filter options */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md text-xs outline-none focus:border-[#C58A22]"
                  />
                </div>

                {/* Select All toggle */}
                <div
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded hover:bg-[#F3F4F6] font-semibold text-[#1F2933]"
                >
                  {isAllSelected ? (
                    <CheckSquare size={14} className="text-[#C58A22]" />
                  ) : (
                    <Square size={14} className="text-[#9CA3AF]" />
                  )}
                  <span>Select All ({options.length})</span>
                </div>

                {/* Options Checkbox List */}
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border-t border-b border-[#F3F4F6] py-1">
                  {filteredOptions.length === 0 ? (
                    <div className="text-[#9CA3AF] py-2 text-center text-[11px]">No matching options</div>
                  ) : (
                    filteredOptions.map(opt => {
                      const isChecked = selectedCheckboxValues.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => handleToggleOption(opt.value)}
                          className="flex items-center justify-between gap-2 cursor-pointer py-1 px-1.5 rounded hover:bg-[#F9FAFB]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isChecked ? (
                              <CheckSquare size={14} className="text-[#C58A22] flex-shrink-0" />
                            ) : (
                              <Square size={14} className="text-[#9CA3AF] flex-shrink-0" />
                            )}
                            <span className="truncate">{opt.label}</span>
                          </div>
                          {opt.count !== undefined && (
                            <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">
                              {opt.count}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    onClick={handleClearCheckbox}
                    className="px-2.5 py-1 text-[11px] font-semibold text-[#6B7280] hover:text-[#1F2933] bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleApplyCheckbox}
                    className="px-3 py-1 text-[11px] font-bold text-white bg-[#C58A22] hover:bg-[#B07A1A] rounded-md border-none cursor-pointer shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </>
            )}

            {/* NUMERIC FILTER TYPE */}
            {filterType === 'numeric' && (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#6B7280]">Condition</label>
                  <select
                    value={numOperator}
                    onChange={e => setNumOperator(e.target.value as any)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#C58A22]"
                  >
                    <option value="all">Any Value (No Filter)</option>
                    <option value="equals">Equals (=)</option>
                    <option value="greater">Greater Than (&gt;)</option>
                    <option value="less">Less Than (&lt;)</option>
                    <option value="between">Between</option>
                  </select>
                </div>

                {numOperator !== 'all' && (
                  <div className="space-y-2 pt-1 animate-fade-in">
                    {numOperator === 'between' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-[#9CA3AF]">Min</span>
                          <input
                            type="number"
                            placeholder="Min"
                            value={val1}
                            onChange={e => setVal1(e.target.value)}
                            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-1.5 text-xs outline-none focus:border-[#C58A22]"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#9CA3AF]">Max</span>
                          <input
                            type="number"
                            placeholder="Max"
                            value={val2}
                            onChange={e => setVal2(e.target.value)}
                            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-1.5 text-xs outline-none focus:border-[#C58A22]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-[#9CA3AF]">Value</span>
                        <input
                          type="number"
                          placeholder="Enter number..."
                          value={val1}
                          onChange={e => setVal1(e.target.value)}
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-1.5 text-xs outline-none focus:border-[#C58A22]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6] gap-2">
                  <button
                    onClick={handleClearNumeric}
                    className="px-2.5 py-1 text-[11px] font-semibold text-[#6B7280] hover:text-[#1F2933] bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleApplyNumeric}
                    className="px-3 py-1 text-[11px] font-bold text-white bg-[#C58A22] hover:bg-[#B07A1A] rounded-md border-none cursor-pointer shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </>
            )}

            {/* TEXT FILTER TYPE */}
            {filterType === 'text' && (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#6B7280]">Match Type</label>
                  <select
                    value={textMode}
                    onChange={e => setTextMode(e.target.value as any)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#C58A22]"
                  >
                    <option value="contains">Contains</option>
                    <option value="starts">Starts With</option>
                    <option value="equals">Exact Match</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#6B7280]">Search Text</label>
                  <input
                    type="text"
                    placeholder="Enter text..."
                    value={textVal}
                    onChange={e => setTextVal(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-1.5 text-xs outline-none focus:border-[#C58A22]"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6] gap-2">
                  <button
                    onClick={handleClearText}
                    className="px-2.5 py-1 text-[11px] font-semibold text-[#6B7280] hover:text-[#1F2933] bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleApplyText}
                    className="px-3 py-1 text-[11px] font-bold text-white bg-[#C58A22] hover:bg-[#B07A1A] rounded-md border-none cursor-pointer shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
