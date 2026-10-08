import { useApiQuery } from "./useApi";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  /** A web path such as "/missions"; map it with routeForWebPath(). */
  link: string | null;
  read: boolean;
  createdAt: string;
};
export type NotificationsResponse = { items: NotificationItem[]; unread: number };

/**
 * GET /api/notifications — the same feed as the web's bell. The web polls too
 * (there is no push channel on the backend), so poll while the app is open.
 */
export function useNotifications() {
  return useApiQuery<NotificationsResponse>("/api/notifications", undefined, { refetchInterval: 60_000 });
}
