import { useState } from "react";
import { setSessionPref } from "../lib/authSession";

interface Props {
  onDismiss: () => void;
}

export default function SessionPrefBanner({ onDismiss }: Props) {
  const [leaving, setLeaving] = useState(false);

  function choose(pref: "persistent" | "session") {
    setLeaving(true);
    setSessionPref(pref);
    setTimeout(onDismiss, 300);
  }

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 ${
        leaving ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white  shadow-gray-200/60 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
            {/* Icon + text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-0.5 flex-shrink-0 rounded-[3px] bg-[var(--in-bg)] p-2">
                <svg className="h-5 w-5 text-[var(--action)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">Stay signed in across sessions?</p>
                <p className="text-xs text-[var(--text-sec)] mt-0.5 leading-relaxed">
                  GoodHours can remember you between browser sessions so you don't have to sign in each time.
                  Choose what feels right for your device.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 pl-0 sm:pl-2">
              <button
                onClick={() => choose("session")}
                className="rounded-[3px] border border-[var(--border)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:border-[var(--border-s)] transition-colors whitespace-nowrap"
              >
                This session only
              </button>
              <button
                onClick={() => choose("persistent")}
                className="rounded-[3px] bg-[var(--action)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--action)] transition-colors whitespace-nowrap"
              >
                Keep me signed in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
