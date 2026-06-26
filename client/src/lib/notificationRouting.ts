export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: string | null;
}

interface NotificationRouteData {
  href?: string;
}

export function parseNotificationData(data?: string | null): NotificationRouteData {
  if (!data) return {};
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null ? parsed as NotificationRouteData : {};
  } catch {
    return {};
  }
}

export function getNotificationHref(notification: AppNotification): string {
  const data = parseNotificationData(notification.data);
  if (typeof data.href === "string" && data.href.trim()) return data.href;

  switch (notification.type) {
    case "NEW_MESSAGE":
      return "/messages?tab=inbox";
    case "SCHOOL_ANNOUNCEMENT":
      return "/messages?tab=notifications";
    case "SCHOOL_PARTNER_REQUEST":
      return "/partners?tab=requests";
    case "SCHOOL_PARTNER_APPROVED":
      return "/partners";
    case "ADMIN_PENDING_REVIEW_ALERT":
      return "/submissions";
    case "VERIFICATION_UPDATE":
      return "/submit";
    case "DEADLINE_REMINDER":
    case "AT_RISK_ALERT":
    case "SIGNUP_CONFIRMED":
    case "OPPORTUNITY_CANCELLED":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}
