import { type ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function SystemWindow({ title, subtitle, children, className = '' }: Props) {
  return (
    <div className={`sys-window p-5 ${className}`}>
      <span className="corner-mark tl" />
      <span className="corner-mark tr" />
      <span className="corner-mark bl" />
      <span className="corner-mark br" />
      {(title || subtitle) && (
        <div className="mb-4 flex items-baseline justify-between border-b border-sys-border/30 pb-2">
          <span className="sys-title">{title}</span>
          {subtitle && (
            <span className="text-[10px] uppercase tracking-widest text-sys-muted">
              {subtitle}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
