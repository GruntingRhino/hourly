import { type ReactNode } from "react";

interface ProGateProps {
  feature: string;
  benefit: string;
  children: ReactNode;
  isPro: boolean;
}

// Wraps a Pro-only section. When isPro is false, renders a locked preview
// with upgrade prompt instead of the children.
export function ProGate({ feature, benefit, children, isPro }: ProGateProps) {
  if (isPro) return <>{children}</>;

  return (
    <div className="relative rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
      <div className="pointer-events-none select-none opacity-40">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-white/80 p-4 text-center">
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          ✦ Pro
        </span>
        <p className="mt-2 text-sm font-medium text-gray-900">{feature}</p>
        <p className="mt-1 text-xs text-gray-500">{benefit}</p>
        <a
          href="mailto:hello@goodhours.app?subject=GoodHours Pro"
          className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Upgrade to Pro — $30/month
        </a>
      </div>
    </div>
  );
}

// Inline badge for Pro-only labels
export function ProBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      ✦ Pro
    </span>
  );
}
