"use client";

/**
 * FormField — composable label + control + description + error wrapper.
 *
 * Auto-wires label htmlFor → control id so a11y works without the caller
 * threading ids manually. Use the compound form for simple cases:
 *
 *   <FormField label="Email" description="We'll never share this." error={err.email}>
 *     <Input type="email" />
 *   </FormField>
 *
 * Or the explicit primitives when a custom layout is needed:
 *
 *   <FormField>
 *     <FormLabel>Email</FormLabel>
 *     <FormControl><Input type="email" /></FormControl>
 *     <FormDescription>We'll never share this.</FormDescription>
 *     <FormError>{err.email}</FormError>
 *   </FormField>
 *
 * Designed without react-hook-form coupling — the project uses useState in
 * its existing forms, and pulling in RHF would be a bigger refactor than
 * the migration warrants. Adapters can be added per-form if needed.
 */

import * as React from "react";
import { Label } from "./label";
import { cn } from "../../lib/utils";

type FormFieldContextValue = {
  id: string;
  hasError: boolean;
};
const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null,
);

function useFormFieldContext(): FormFieldContextValue | null {
  return React.useContext(FormFieldContext);
}

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional id; if omitted, an auto-generated one wires the label to the control. */
  id?: string;
  /** Compound-form shortcut: renders <FormLabel> automatically. */
  label?: React.ReactNode;
  /** Compound-form shortcut: renders <FormDescription> automatically. */
  description?: React.ReactNode;
  /** Compound-form shortcut: renders <FormError> automatically when truthy. */
  error?: React.ReactNode;
  /** When true the label is visually hidden but still announced to AT. */
  hideLabel?: boolean;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      id: idProp,
      label,
      description,
      error,
      hideLabel,
      children,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = idProp ?? generatedId;
    const hasError = error !== undefined && error !== null && error !== false;

    return (
      <FormFieldContext.Provider value={{ id, hasError }}>
        <div ref={ref} className={cn("space-y-1.5", className)} {...props}>
          {label !== undefined && (
            <FormLabel className={hideLabel ? "sr-only" : undefined}>
              {label}
            </FormLabel>
          )}
          {/* If compound-form children include their own FormControl, render
              them directly; otherwise wrap automatically. */}
          {label !== undefined ||
          description !== undefined ||
          error !== undefined ? (
            <FormControl>{children}</FormControl>
          ) : (
            children
          )}
          {description !== undefined && (
            <FormDescription>{description}</FormDescription>
          )}
          {hasError && <FormError>{error}</FormError>}
        </div>
      </FormFieldContext.Provider>
    );
  },
);
FormField.displayName = "FormField";

const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  const ctx = useFormFieldContext();
  return (
    <Label
      ref={ref}
      htmlFor={ctx?.id}
      className={cn(
        "text-sm font-medium",
        ctx?.hasError && "text-destructive",
        className,
      )}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

/**
 * Wraps the actual input/select/textarea and threads the field's id +
 * aria-invalid + aria-describedby through to the first child. The child
 * should be a single React element that accepts these props (Input,
 * Select trigger, DatePicker, etc.).
 */
const FormControl = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(({ children }, _ref) => {
  const ctx = useFormFieldContext();
  if (!ctx) return <>{children}</>;
  if (!React.isValidElement(children)) return <>{children}</>;

  return React.cloneElement(
    children as React.ReactElement<{
      id?: string;
      "aria-invalid"?: boolean;
      "aria-describedby"?: string;
    }>,
    {
      id: ctx.id,
      "aria-invalid": ctx.hasError || undefined,
      "aria-describedby": ctx.hasError ? `${ctx.id}-error` : undefined,
    },
  );
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
));
FormDescription.displayName = "FormDescription";

const FormError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const ctx = useFormFieldContext();
  return (
    <p
      ref={ref}
      id={ctx ? `${ctx.id}-error` : undefined}
      role="alert"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    />
  );
});
FormError.displayName = "FormError";

export { FormField, FormLabel, FormControl, FormDescription, FormError };
