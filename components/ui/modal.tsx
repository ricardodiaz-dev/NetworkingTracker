"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Native <dialog> so focus trapping, Esc-to-close and inertness come from the platform
 * rather than a hand-rolled (and usually subtly broken) implementation.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the ::backdrop reports the <dialog> itself as the target.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-[var(--radius-card)] border border-border bg-card p-0 text-foreground backdrop:bg-black/40",
        className,
      )}
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">{children}</div>
    </dialog>
  );
}
