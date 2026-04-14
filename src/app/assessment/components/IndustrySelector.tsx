"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { Industry } from "@/types/diagnostic";
import {
  MCC_INDUSTRY_TREE,
  flattenForSearch,
  type MCCCategory,
} from "@/lib/data/mcc-industries";

interface IndustrySelectorProps {
  value: { slug: Industry; displayLabel: string } | null;
  onChange: (selection: { slug: Industry; displayLabel: string }) => void;
}

export default function IndustrySelector({
  value,
  onChange,
}: IndustrySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
        inputRef.current?.blur();
      }
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  const flat = useMemo(() => flattenForSearch(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return flat.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [search, flat]);

  // Group filtered results by category
  const filteredGrouped = useMemo(() => {
    if (!filtered) return null;
    const groups: Record<string, typeof filtered> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered]);

  const handleSelect = useCallback(
    (slug: Industry, displayLabel: string) => {
      onChange({ slug, displayLabel });
      setOpen(false);
      setSearch("");
      setExpandedCategory(null);
    },
    [onChange]
  );

  const toggleCategory = useCallback((name: string) => {
    setExpandedCategory((prev) => (prev === name ? null : name));
  }, []);

  const displayText = value ? value.displayLabel : "";

  return (
    <div ref={containerRef} className="relative">
      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="form-input w-full pr-8"
          placeholder="Search or select industry..."
          value={open ? search : displayText}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          autoComplete="off"
        />
        {/* Chevron */}
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary p-1"
          onClick={() => {
            if (open) {
              setOpen(false);
              setSearch("");
            } else {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
          tabIndex={-1}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-white border border-light shadow-lg">
          {/* Search mode: filtered results */}
          {filteredGrouped ? (
            Object.keys(filteredGrouped).length === 0 ? (
              <div className="px-4 py-3 text-sm text-tertiary">
                No industries match &quot;{search}&quot;
              </div>
            ) : (
              Object.entries(filteredGrouped).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-tertiary bg-offwhite border-b border-light">
                    {category}
                  </div>
                  {items.map((item) => (
                    <button
                      key={`${category}-${item.label}`}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-navy/5 hover:text-navy transition-colors"
                      onClick={() =>
                        handleSelect(item.diagnosticSlug, item.label)
                      }
                    >
                      {highlightMatch(item.label, search)}
                    </button>
                  ))}
                </div>
              ))
            )
          ) : (
            /* Browse mode: category tree */
            MCC_INDUSTRY_TREE.map((cat) => (
              <CategoryRow
                key={cat.name}
                category={cat}
                expanded={expandedCategory === cat.name}
                onToggle={toggleCategory}
                onSelect={handleSelect}
                selectedLabel={value?.displayLabel ?? null}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category row with expand/collapse
// ---------------------------------------------------------------------------

function CategoryRow({
  category,
  expanded,
  onToggle,
  onSelect,
  selectedLabel,
}: {
  category: MCCCategory;
  expanded: boolean;
  onToggle: (name: string) => void;
  onSelect: (slug: Industry, label: string) => void;
  selectedLabel: string | null;
}) {
  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-secondary hover:bg-navy/5 transition-colors border-b border-light/50"
        onClick={() => onToggle(category.name)}
      >
        <span>{category.name}</span>
        <svg
          className={`w-3.5 h-3.5 text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {expanded && (
        <div className="bg-offwhite/50">
          {category.subcategories.map((sub) => {
            const isSelected = selectedLabel === sub.label;
            return (
              <button
                key={sub.label}
                type="button"
                className={`w-full text-left pl-8 pr-4 py-2 text-sm transition-colors ${
                  isSelected
                    ? "bg-navy/5 text-navy font-medium"
                    : "text-foreground/80 hover:bg-navy/5 hover:text-navy"
                }`}
                onClick={() => onSelect(sub.diagnosticSlug, sub.label)}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Highlight matching substring in search results
// ---------------------------------------------------------------------------

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-navy">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}
