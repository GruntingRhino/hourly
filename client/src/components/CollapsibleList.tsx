import { useState, type ReactNode } from "react";

type CollapsibleListProps = {
  items: ReactNode[];
  limit?: number;
  className?: string;
};

export function CollapsibleList({ items, limit = 5, className = "" }: CollapsibleListProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const showToggle = items.length > limit;
  const visible = showToggle && !expanded ? items.slice(0, limit) : items;
  const hiddenCount = items.length - limit;

  return (
    <div className={className}>
      {visible}
      {showToggle && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer mt-1"
        >
          {expanded
            ? `Show less`
            : `Show all (${hiddenCount} more)`}
        </button>
      )}
    </div>
  );
}
