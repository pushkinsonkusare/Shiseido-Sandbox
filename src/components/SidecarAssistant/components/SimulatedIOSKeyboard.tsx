import type { ReactNode } from "react";
import "./SimulatedIOSKeyboard.css";

type Props = {
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onReturn: () => void;
  onDismiss: () => void;
};

const ROW_1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] as const;
const ROW_2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"] as const;
const ROW_3 = ["z", "x", "c", "v", "b", "n", "m"] as const;

function KeyButton({
  label,
  ariaLabel,
  className = "",
  wide,
  onPress,
}: {
  label: ReactNode;
  ariaLabel: string;
  className?: string;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={
        "sim-ios-keyboard__key" +
        (wide ? " sim-ios-keyboard__key--wide" : "") +
        (className ? ` ${className}` : "")
      }
      aria-label={ariaLabel}
      tabIndex={-1}
      onPointerDown={(event) => {
        /* Keep the chat input focused while tapping keys (mouse/touch/pen). */
        event.preventDefault();
      }}
      onClick={onPress}
    >
      {label}
    </button>
  );
}

/**
 * Demo-only iOS-style software keyboard for the mobile viewport switcher.
 * Shown when the shopper focuses the assistant input inside the 402×874 frame.
 */
export function SimulatedIOSKeyboard({
  onInsert,
  onBackspace,
  onReturn,
  onDismiss,
}: Props) {
  return (
    <div
      className="sim-ios-keyboard"
      role="group"
      aria-label="Simulated keyboard"
      onPointerDown={(event) => {
        event.preventDefault();
      }}
    >
      <div className="sim-ios-keyboard__accessory">
        <span className="sim-ios-keyboard__accessory-spacer" aria-hidden="true" />
        <button
          type="button"
          className="sim-ios-keyboard__dismiss"
          aria-label="Dismiss keyboard"
          tabIndex={-1}
          onPointerDown={(event) => event.preventDefault()}
          onClick={onDismiss}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4.5 7.25 10 12.75 15.5 7.25"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="sim-ios-keyboard__suggestions" aria-hidden="true">
        <span className="sim-ios-keyboard__suggestion">I</span>
        <span className="sim-ios-keyboard__suggestion">The</span>
        <span className="sim-ios-keyboard__suggestion">I&apos;m</span>
      </div>

      <div className="sim-ios-keyboard__rows">
        <div className="sim-ios-keyboard__row">
          {ROW_1.map((key) => (
            <KeyButton
              key={key}
              label={key}
              ariaLabel={key}
              onPress={() => onInsert(key)}
            />
          ))}
        </div>
        <div className="sim-ios-keyboard__row sim-ios-keyboard__row--inset">
          {ROW_2.map((key) => (
            <KeyButton
              key={key}
              label={key}
              ariaLabel={key}
              onPress={() => onInsert(key)}
            />
          ))}
        </div>
        <div className="sim-ios-keyboard__row">
          <KeyButton
            label="⇧"
            ariaLabel="Shift"
            className="sim-ios-keyboard__key--modifier"
            wide
            onPress={() => undefined}
          />
          {ROW_3.map((key) => (
            <KeyButton
              key={key}
              label={key}
              ariaLabel={key}
              onPress={() => onInsert(key)}
            />
          ))}
          <KeyButton
            label="⌫"
            ariaLabel="Delete"
            className="sim-ios-keyboard__key--modifier"
            wide
            onPress={onBackspace}
          />
        </div>
        <div className="sim-ios-keyboard__row">
          <KeyButton
            label="123"
            ariaLabel="Numbers"
            className="sim-ios-keyboard__key--modifier"
            wide
            onPress={() => undefined}
          />
          <KeyButton
            label="😊"
            ariaLabel="Emoji"
            className="sim-ios-keyboard__key--modifier"
            onPress={() => undefined}
          />
          <KeyButton
            label="space"
            ariaLabel="Space"
            className="sim-ios-keyboard__key--space"
            onPress={() => onInsert(" ")}
          />
          <KeyButton
            label="return"
            ariaLabel="Return"
            className="sim-ios-keyboard__key--modifier sim-ios-keyboard__key--return"
            wide
            onPress={onReturn}
          />
        </div>
      </div>
    </div>
  );
}

export default SimulatedIOSKeyboard;
