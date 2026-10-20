export const CONSENT_COOKIE = "cm_cookie_consent";
export const CONSENT_EVENT = "cookie-consent-change";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 months

export type CookieConsentValue = "accepted" | "refused";

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  const value = match?.split("=")[1];
  return value === "accepted" || value === "refused" ? value : null;
}

export function writeCookieConsent(value: CookieConsentValue): void {
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<CookieConsentValue>(CONSENT_EVENT, { detail: value }));
}
