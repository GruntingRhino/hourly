import { useEffect, useId, useMemo, useRef, useState } from "react";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  emptyMessage?: string;
  allowCustomValue?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  required = false,
  disabled = false,
  clearable = false,
  emptyMessage = "No matches found.",
  allowCustomValue = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery(value);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, value]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;

    return options
      .map((option) => {
        const idx = option.toLowerCase().indexOf(normalized);
        return { option, idx };
      })
      .filter(({ idx }) => idx !== -1)
      .sort((a, b) => a.idx - b.idx || a.option.localeCompare(b.option))
      .map(({ option }) => option);
  }, [options, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  const commitValue = (nextValue: string) => {
    onChange(nextValue);
    setQuery(nextValue);
    setIsOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement)) {
        if (allowCustomValue) {
          const normalized = query.trim();
          if (normalized !== value) {
            onChange(normalized);
          }
          setQuery(normalized);
        } else {
          setQuery(value);
        }
        setIsOpen(false);
      }
    }, 0);
  };

  return (
    <div ref={rootRef} className="relative" onBlur={handleBlur}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          const nextValue = e.target.value;
          setQuery(nextValue);
          if (allowCustomValue) {
            onChange(nextValue);
          }
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setIsOpen(true);
            return;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)));
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
            return;
          }

          if (e.key === "Enter") {
            const exactMatch = options.find((option) => option.toLowerCase() === query.trim().toLowerCase());
            const highlighted = filteredOptions[highlightedIndex];
            if (exactMatch || highlighted) {
              e.preventDefault();
              commitValue(exactMatch ?? highlighted);
            } else if (allowCustomValue) {
              e.preventDefault();
              commitValue(query.trim());
            }
            return;
          }

          if (e.key === "Escape") {
            setIsOpen(false);
            setQuery(value);
          }
        }}
        className={className}
      />
      {clearable && value && !disabled && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            setQuery("");
            setIsOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-sec)]"
          aria-label="Clear selection"
        >
          ×
        </button>
      )}
      {isOpen && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[2px] border border-[var(--border)] bg-white py-1 "
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isActive = index === highlightedIndex;
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commitValue(option)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    isActive ? "bg-[var(--in-bg)] text-[var(--action)]" : "text-[var(--text)]"
                  } ${isSelected ? "font-medium" : ""}`}
                >
                  {option}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-[var(--text-sec)]">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}
