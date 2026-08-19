import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { checkSitePassword, isSiteUnlocked, unlockSite } from "./siteAccess";
import splashBackground from "./site-gate-bg.png";
import "./SiteGate.css";

type Props = {
  children: ReactNode;
};

export function SiteGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(isSiteUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const ok = await checkSitePassword(password);
    setBusy(false);
    if (!ok) {
      setError("That password isn't right.");
      setPassword("");
      inputRef.current?.focus();
      return;
    }
    unlockSite();
    setUnlocked(true);
  };

  if (unlocked) return <>{children}</>;

  return (
    <main className="site-gate" aria-labelledby="site-gate-title">
      <img
        className="site-gate__bg"
        src={splashBackground}
        alt=""
        aria-hidden="true"
      />
      <section className="site-gate__shell">
        <header className="site-gate__header">
          <p className="site-gate__brand">Agent first theme</p>
          <h1 id="site-gate-title" className="site-gate__title">
            Private preview
          </h1>
          <p className="site-gate__subtitle">
            Enter the password to open this demo.
          </p>
        </header>

        <form className="site-gate__card" onSubmit={handleSubmit}>
          <div className="site-gate__field">
            <label className="site-gate__label" htmlFor="site-gate-password">
              Password
            </label>
            <input
              ref={inputRef}
              id="site-gate-password"
              className="site-gate__input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "site-gate-error" : undefined}
            />
          </div>
          {error ? (
            <p id="site-gate-error" className="site-gate__error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="site-gate__submit"
            type="submit"
            disabled={busy || !password.trim()}
          >
            Continue
          </button>
        </form>
        <p className="site-gate__disclaimer">
          This is a demo site and is not meant for product purchases or
          monetary transactions.
        </p>
      </section>
    </main>
  );
}

export default SiteGate;
