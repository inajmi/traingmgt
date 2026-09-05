import { ReactNode } from "react";
import { X } from "lucide-react";

export function Pill({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <span
      style={{ background: bg, color: fg }}
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
    >
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="min-h-[200px] flex items-center justify-center text-muted text-sm">Loading…</div>
  );
}

export function EmptyState({ children, small }: { children: ReactNode; small?: boolean }) {
  return <div className={small ? "px-4 py-6 text-center text-sm text-muted" : "px-4 py-10 text-center text-sm text-muted"}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{children}</h2>;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto bg-surface rounded-xl shadow-2xl`}>
        <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-start justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[#eee6d5] text-sub">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer }: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-surface shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-start justify-between z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[#eee6d5] text-sub">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-surface border-t border-line px-6 py-4 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function InlineNotice({ kind, children }: { kind: "ok" | "err" | "info"; children: ReactNode }) {
  const styles = {
    ok: "bg-[#e0ecdf] text-[#33623f]",
    err: "bg-[#f2e3e0] text-[#8a4136]",
    info: "bg-[#e4e9f2] text-[#3d5680]",
  } as const;
  return <div className={`rounded-md px-3 py-2 text-sm ${styles[kind]}`}>{children}</div>;
}