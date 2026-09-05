"use client";

import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NOTIFICATIONS_API_URL } from "@/lib/crm/constants";
import type { CrmNotificationRecord } from "@/lib/crm/notifications";
import type { MenuKey } from "@/lib/menu-navigation";

export function CrmNotificationsPanel({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: MenuKey) => void;
}) {
  const [items, setItems] = useState<CrmNotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(NOTIFICATIONS_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  async function markAllRead() {
    await fetch(NOTIFICATIONS_API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadNotifications();
  }

  function sectionForNotification(item: CrmNotificationRecord): MenuKey {
    if (item.entityType === "task") return "tasks";
    if (item.entityType === "invoice") return "invoices";
    if (item.entityType === "insurance") return "renewals-this-month";
    return "tasks";
  }

  if (!open) return null;

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-transparent" aria-label="Close notifications" />
      <div dir="rtl" className="fixed right-[82px] top-[96px] z-50 w-[min(390px,calc(100vw-48px))] overflow-hidden rounded-[28px] border border-[#EAECEF] bg-white shadow-2xl">
        <div className="border-b border-[#EEF1F4] px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[18px] font-bold text-[#1F2937]">التنبيهات</h3>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-[#707A84] hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[13px] text-[#707A84]">{items.filter((item) => !item.isRead).length} غير مقروء</p>
            <button type="button" onClick={markAllRead} className="text-xs font-bold text-[#3B82F6]">تعليم الكل كمقروء</button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-[#707A84]">جاري التحميل...</p>
          ) : items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF4FF]">
                <Bell className="h-6 w-6 text-[#3B82F6]" />
              </div>
              <p className="text-[14px] font-semibold text-[#1F2937]">لا توجد تنبيهات حالياً</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(sectionForNotification(item));
                  onClose();
                }}
                className={`block w-full border-b border-[#F1F5F9] px-5 py-4 text-right transition last:border-none hover:bg-[#F8FAFC] ${item.isRead ? "opacity-70" : ""}`}
              >
                <p className="text-[14px] font-bold text-[#1F2937]">{item.title}</p>
                <p className="mt-1 text-[12px] text-[#707A84]">{item.body}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export function useNotificationCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(NOTIFICATIONS_API_URL, { cache: "no-store" });
        const data = await res.json();
        if (active && res.ok) setCount(Number(data.unreadCount || 0));
      } catch {
        if (active) setCount(0);
      }
    }
    load();
    // Poll every 5 minutes, and skip while the tab is hidden, to keep the
    // database's hourly connection usage low.
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, 300000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return count;
}
