import { useState, type FormEvent } from "react";
import "./AgentMessageCards.css";

export type OrderLookupValues = {
  email: string;
  orderNo: string;
  zip: string;
};

export type AgentOrderLookupFormProps = {
  /** Acknowledgement copy shown above the fields, inside the same card. */
  acknowledgement?: string;
  /** Called with trimmed values once every field passes validation. */
  onSubmit: (values: OrderLookupValues) => void;
  /** Locks the form after a lookup has been submitted. */
  submitted?: boolean;
  /** Optional class name appended to the root element. */
  className?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/**
 * AgentOrderLookupForm is the guest "Where is my order?" card rendered in the
 * SidecarAssistant chat panel: one summary-style card holding the
 * acknowledgement, the email / order number / ZIP fields and a Track Order
 * button.
 */
export function AgentOrderLookupForm({
  acknowledgement,
  onSubmit,
  submitted = false,
  className,
}: AgentOrderLookupFormProps) {
  const [values, setValues] = useState<OrderLookupValues>({
    email: "",
    orderNo: "",
    zip: "",
  });
  // Errors are only raised by pressing Track Order, never while typing. Each
  // one clears as soon as the shopper edits that field, and the next press
  // checks again.
  const [shownErrors, setShownErrors] = useState<
    Partial<Record<keyof OrderLookupValues, boolean>>
  >({});

  const errors: Partial<Record<keyof OrderLookupValues, string>> = {
    email: EMAIL_PATTERN.test(values.email.trim())
      ? undefined
      : "Enter a valid email address.",
    orderNo: values.orderNo.trim() ? undefined : "Enter your order number.",
    zip: ZIP_PATTERN.test(values.zip.trim())
      ? undefined
      : "Enter a 5-digit ZIP code.",
  };
  const valid = !errors.email && !errors.orderNo && !errors.zip;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitted) return;
    if (!valid) {
      setShownErrors({
        email: Boolean(errors.email),
        orderNo: Boolean(errors.orderNo),
        zip: Boolean(errors.zip),
      });
      return;
    }
    onSubmit({
      email: values.email.trim(),
      orderNo: values.orderNo.trim(),
      zip: values.zip.trim(),
    });
  };

  const fields: Array<{
    key: keyof OrderLookupValues;
    label: string;
    placeholder: string;
    type: string;
    inputMode?: "email" | "numeric";
    autoComplete: string;
  }> = [
    {
      key: "email",
      label: "Email Address",
      placeholder: "guest@example.com",
      type: "email",
      inputMode: "email",
      autoComplete: "email",
    },
    {
      key: "orderNo",
      label: "Order No",
      placeholder: "ORD-1000000001",
      type: "text",
      autoComplete: "off",
    },
    {
      key: "zip",
      label: "ZIP Code",
      placeholder: "94102",
      type: "text",
      inputMode: "numeric",
      autoComplete: "postal-code",
    },
  ];

  const rootClass =
    "agent-summary__card" + (className ? " " + className : "");

  return (
    <article className={rootClass} data-component="agent-order-lookup-form">
      <form
        className="agent-summary__card-content"
        onSubmit={handleSubmit}
        noValidate
      >
        {acknowledgement ? (
          <div className="agent-summary__row">
            <p className="agent-summary__acknowledgement">{acknowledgement}</p>
          </div>
        ) : null}

        <div className="agent-summary__row agent-lookup__form">
          {fields.map((field) => {
            const showError = shownErrors[field.key] && errors[field.key];
            const id = `agent-lookup-${field.key}`;
            return (
              <div className="agent-lookup__field" key={field.key}>
                <label className="agent-lookup__label" htmlFor={id}>
                  {field.label}
                </label>
                <input
                  id={id}
                  className="agent-summary__promo-input"
                  type={field.type}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  value={values[field.key]}
                  disabled={submitted}
                  aria-invalid={showError ? true : undefined}
                  aria-describedby={showError ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                    setShownErrors((current) =>
                      current[field.key]
                        ? { ...current, [field.key]: false }
                        : current,
                    );
                  }}
                />
                {showError ? (
                  <p className="agent-lookup__error" id={`${id}-error`}>
                    {errors[field.key]}
                  </p>
                ) : null}
              </div>
            );
          })}
          <button
            type="submit"
            className="agent-msg__btn agent-msg__btn--primary agent-msg__btn--lg"
            disabled={submitted}
          >
            Track Order
          </button>
        </div>
      </form>
    </article>
  );
}

export default AgentOrderLookupForm;
