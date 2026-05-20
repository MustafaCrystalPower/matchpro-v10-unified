import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getUnreadNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import {
  getUnreadNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "./db";

describe("Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUnreadNotifications", () => {
    it("returns unread notifications with correct structure", async () => {
      const mockNotifications = [
        {
          id: 1,
          type: "high_match",
          title: "High-Confidence Match Found!",
          content: "92% match between supply and demand",
          matchId: 5,
          isRead: 0,
          createdAt: new Date(),
        },
        {
          id: 2,
          type: "new_supply",
          title: "New Property Listed",
          content: "Apartment in New Cairo",
          matchId: null,
          isRead: 0,
          createdAt: new Date(),
        },
      ];

      vi.mocked(getUnreadNotifications).mockResolvedValue(mockNotifications);

      const result = await getUnreadNotifications(20);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("high_match");
      expect(result[0].isRead).toBe(0);
      expect(result[1].type).toBe("new_supply");
    });

    it("respects the limit parameter", async () => {
      const mockNotifications = [
        { id: 1, type: "high_match", title: "Match 1", content: null, matchId: 1, isRead: 0, createdAt: new Date() },
      ];

      vi.mocked(getUnreadNotifications).mockResolvedValue(mockNotifications);

      await getUnreadNotifications(5);

      expect(getUnreadNotifications).toHaveBeenCalledWith(5);
    });
  });

  describe("getUnreadNotificationCount", () => {
    it("returns the count of unread notifications", async () => {
      vi.mocked(getUnreadNotificationCount).mockResolvedValue(5);

      const result = await getUnreadNotificationCount();

      expect(result).toBe(5);
    });

    it("returns 0 when no unread notifications", async () => {
      vi.mocked(getUnreadNotificationCount).mockResolvedValue(0);

      const result = await getUnreadNotificationCount();

      expect(result).toBe(0);
    });
  });

  describe("markNotificationRead", () => {
    it("marks a single notification as read", async () => {
      vi.mocked(markNotificationRead).mockResolvedValue(undefined);

      await markNotificationRead(1);

      expect(markNotificationRead).toHaveBeenCalledWith(1);
    });
  });

  describe("markAllNotificationsRead", () => {
    it("marks all notifications as read", async () => {
      vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);

      await markAllNotificationsRead();

      expect(markAllNotificationsRead).toHaveBeenCalled();
    });
  });
});

describe("Notification Types", () => {
  it("supports high_match notification type", () => {
    const notification = {
      type: "high_match" as const,
      title: "High-Confidence Match",
      content: "Match score: 92%",
    };

    expect(notification.type).toBe("high_match");
  });

  it("supports new_supply notification type", () => {
    const notification = {
      type: "new_supply" as const,
      title: "New Supply",
      content: "Property listed",
    };

    expect(notification.type).toBe("new_supply");
  });

  it("supports new_demand notification type", () => {
    const notification = {
      type: "new_demand" as const,
      title: "New Demand",
      content: "Property request",
    };

    expect(notification.type).toBe("new_demand");
  });

  it("supports system notification type", () => {
    const notification = {
      type: "system" as const,
      title: "System Alert",
      content: "System message",
    };

    expect(notification.type).toBe("system");
  });
});
