import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const control =
  "focus-ring w-full rounded-xl border bg-white px-4 text-[15px] text-navy-950 placeholder:text-steel-400 min-h-11 border-navy-950/15 aria-[invalid=true]:border-status-red";

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-navy-950">
      {children}
      {optional ? <span className="ml-1 font-normal text-steel-400">(optional)</span> : null}
    </label>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-status-red">
      {error}
    </p>
  );
}

export function TextField({
  id,
  label,
  error,
  optional,
  hint,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
}) {
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <input
        id={id}
        name={rest.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined
        }
        className={control}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-steel-400">
          {hint}
        </p>
      ) : null}
      <ErrorText id={errId} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  optional,
  options,
  placeholder = "Select one",
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  placeholder?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const errId = `${id}-error`;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <select
        id={id}
        name={rest.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={`${control} bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239A9FA6%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] appearance-none bg-[length:20px_20px] bg-[position:right_12px_center] bg-no-repeat pr-10`}
        {...rest}
        defaultValue={rest.defaultValue ?? ""}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ErrorText id={errId} error={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  optional,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
}) {
  const errId = `${id}-error`;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <textarea
        id={id}
        name={rest.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={`${control} min-h-28 py-3`}
        {...rest}
      />
      <ErrorText id={errId} error={error} />
    </div>
  );
}

export function CheckboxGroup({
  name,
  legend,
  options,
  error,
  defaultValues = [],
}: {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
  defaultValues?: readonly string[];
}) {
  const errId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errId : undefined}>
      <legend className="mb-2 block text-sm font-semibold text-navy-950">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-navy-950/15 bg-white px-3.5 text-[15px] focus-within:focus-ring has-checked:border-blue-600 has-checked:bg-blue-600/5"
            >
              <input
                id={id}
                type="checkbox"
                name={name}
                value={o.value}
                defaultChecked={defaultValues.includes(o.value)}
                className="size-5 shrink-0 accent-blue-600"
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      <ErrorText id={errId} error={error} />
    </fieldset>
  );
}
