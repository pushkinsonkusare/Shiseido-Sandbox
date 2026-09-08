import { useAgentMode } from "../AgentModeBar/AgentModeContext";
import { usePrototypeNavigation } from "../../prototypeRoutes";
import "./MobileChrome.css";

function CellularIcon() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
      <rect x="0" y="7.4" width="2.6" height="3.6" rx="0.5" fill="currentColor" />
      <rect x="4.4" y="5.2" width="2.6" height="5.8" rx="0.5" fill="currentColor" />
      <rect x="8.8" y="2.6" width="2.6" height="8.4" rx="0.5" fill="currentColor" />
      <rect x="13.2" y="0" width="2.6" height="11" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg
      className="mobile-chrome__battery-icon"
      width="27"
      height="13"
      viewBox="0 0 27 13"
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="12"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x="1.7" y="1.7" width="13.6" height="9.6" rx="2" fill="currentColor" />
      <path
        d="M24.1 4.1h1.15c.7 0 1.25.55 1.25 1.25v2.3c0 .7-.55 1.25-1.25 1.25H24.1V4.1Z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="13" height="21" viewBox="0 0 13 21" fill="none" aria-hidden="true">
      <path
        d="M11.2 1.4 1.8 10.5l9.4 9.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TabsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="5.25" y="5.25" width="11.5" height="11.5" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12.6 3.1H4.4A1.3 1.3 0 0 0 3.1 4.4v8.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M15.2 9A6.2 6.2 0 1 1 13.4 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15.3 2.4v3.4h-3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OverflowIcon() {
  return (
    <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden="true">
      <circle cx="2.2" cy="3" r="1.7" fill="currentColor" />
      <circle cx="9" cy="3" r="1.7" fill="currentColor" />
      <circle cx="15.8" cy="3" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function MobileChrome() {
  const { viewportMode, mobileChrome } = useAgentMode();
  const { isPageLoading } = usePrototypeNavigation();
  if (viewportMode !== "mobile" || !mobileChrome) return null;

  return (
    <div className="mobile-chrome" aria-hidden="true">
      {isPageLoading ? <div className="mobile-chrome__page-progress" /> : null}
      <div className="mobile-chrome__status">
        <span className="mobile-chrome__time">12:47</span>
        <span className="mobile-chrome__island" />
        <span className="mobile-chrome__status-end">
          <CellularIcon />
          <span className="mobile-chrome__network">5G</span>
          <span className="mobile-chrome__battery-wrap">
            <BatteryIcon />
            <span className="mobile-chrome__battery-pct">66</span>
          </span>
        </span>
      </div>
      <div className="mobile-chrome__address">
        <span className="mobile-chrome__tool">
          <BackIcon />
        </span>
        <span className="mobile-chrome__tool">
          <TabsIcon />
        </span>
        <span
          className={
            "mobile-chrome__url" +
            (isPageLoading ? " mobile-chrome__url--loading" : "")
          }
        >
          {isPageLoading ? <span className="mobile-chrome__spinner" /> : null}
          <span className="mobile-chrome__url-text">shiseido.com</span>
          {isPageLoading ? <span className="mobile-chrome__url-progress" /> : null}
        </span>
        <span className="mobile-chrome__tool">
          <RefreshIcon />
        </span>
        <span className="mobile-chrome__tool">
          <OverflowIcon />
        </span>
      </div>
    </div>
  );
}
