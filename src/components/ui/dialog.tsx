"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;

function DialogOverlay({ className = "" }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={`dialog-overlay fixed inset-0 z-50 bg-black/70 ${className}`}
    />
  );
}

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  label: string;
}

/**
 * Bottom sheet on mobile, centered dialog on sm+.
 * Positioning uses top/left (no transform utilities) so the open/close
 * keyframes — which animate opacity + `translate` — never fight layout.
 * Scrolling happens in DialogBody; header rows stay fixed outside of it.
 */
function DialogContent({ className = "", label, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-label={label}
        className={`dialog-content fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-white shadow-2xl outline-none
          bottom-0 left-0 right-0 rounded-t-3xl
          sm:bottom-auto sm:top-[5dvh] sm:mx-auto sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:rounded-2xl
          ${className}`}
        {...props}
      >
        {/* Radix requires a Title for a11y — callers pass visible headings,
            this keeps screen readers happy without visual duplication. */}
        <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogBody({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>{children}</div>
  );
}

export { Dialog, DialogTrigger, DialogClose, DialogOverlay, DialogContent, DialogBody, DialogTitle };

