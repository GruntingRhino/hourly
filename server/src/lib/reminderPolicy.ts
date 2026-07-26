export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export function getInAppNotificationCooldownMs(type: string): number {
  return type === "AT_RISK_ALERT" ? WEEK_MS : DAY_MS;
}
