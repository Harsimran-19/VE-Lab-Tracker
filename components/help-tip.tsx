"use client";
import { useId, useState } from "react";
import { QuestionIcon as CircleHelp } from "@phosphor-icons/react";
export function HelpTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="help-tip">
      <button
        type="button"
        className="help-button"
        aria-label={`Help: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <CircleHelp size={17} />
      </button>
      {open && (
        <span className="help-content" id={id} role="note">
          {children}
        </span>
      )}
    </span>
  );
}
