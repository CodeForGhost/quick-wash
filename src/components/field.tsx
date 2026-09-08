"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input as ShadInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectTrigger as ShadSelectTrigger } from "@/components/ui/select";
import { Textarea as ShadTextarea } from "@/components/ui/textarea";

/**
 * A field owns the id that ties its label, hint and error to the control, so
 * no call site has to invent one. Controls read it off this context.
 */
interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Merges the field's hint/error ids with anything the caller passed. */
function useFieldControl(id?: string, describedBy?: string) {
  const field = useContext(FieldContext);
  return {
    id: id ?? field?.controlId,
    "aria-describedby": [field?.describedBy, describedBy].filter(Boolean).join(" ") || undefined,
    "aria-invalid": field?.invalid ? true : undefined,
  };
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  /** Field-level validation message. Shown under the control and announced. */
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const uid = useId();
  const controlId = `${uid}-control`;
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined,
        invalid: Boolean(error),
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={controlId} className="gap-1 font-semibold text-ink">
          {label}
          {required ? (
            <>
              <span aria-hidden className="text-flag">
                *
              </span>
              <span className="sr-only">(required)</span>
            </>
          ) : null}
        </Label>
        {children}
        {hint ? (
          <p id={hintId} className="text-xs text-ink-faint">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-xs font-medium text-flag">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/* The QuickWash control shape: 44px tall so it is a comfortable tap target. */
const CONTROL = "h-11 rounded-xl border-hairline bg-surface text-[15px] shadow-none md:text-[15px]";

export function Input({ className, id, "aria-describedby": describedBy, ...props }: ComponentProps<typeof ShadInput>) {
  return <ShadInput {...useFieldControl(id, describedBy)} className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: ComponentProps<typeof ShadTextarea>) {
  return (
    <ShadTextarea
      {...useFieldControl(id, describedBy)}
      className={cn(CONTROL, "min-h-24 py-2.5", className)}
      {...props}
    />
  );
}

export function SelectTrigger({
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: ComponentProps<typeof ShadSelectTrigger>) {
  return (
    <ShadSelectTrigger
      {...useFieldControl(id, describedBy)}
      className={cn(CONTROL, "w-full data-[size=default]:h-11", className)}
      {...props}
    />
  );
}
