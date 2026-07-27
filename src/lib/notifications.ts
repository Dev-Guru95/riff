import { prisma } from "./prisma";

export type NotifyInput = {
  type:
    | "badge"
    | "levelup"
    | "mission"
    | "audit"
    | "reward"
    | "community"
    | "certificate"
    | "system"
    // Project-management (Kanban) events:
    | "mention"
    | "comment"
    | "task"
    | "due"
    | "board";
  title: string;
  body?: string;
  link?: string;
};

/** Create an in-app notification (best-effort; never throws into the caller). */
export async function notify(userId: string, n: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type: n.type, title: n.title, body: n.body ?? "", link: n.link ?? null },
    });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
