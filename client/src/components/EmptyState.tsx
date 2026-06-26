import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; to?: string; onClick?: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <h3 className="text-lg font-semibold text-[var(--text)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-sec)] max-w-sm mb-6">{description}</p>
      {action && action.to ? (
        <Link
          to={action.to}
          className="inline-flex items-center px-4 py-2 bg-[var(--action)] text-white rounded-[3px] text-sm font-medium hover:bg-[var(--action)] transition-colors"
        >
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 bg-[var(--action)] text-white rounded-[3px] text-sm font-medium hover:bg-[var(--action)] transition-colors"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
