"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TASKS_API_URL } from "@/lib/crm/constants";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  taskPriorityLabels,
  taskStatusLabels,
  taskTypeLabels,
  type CrmTaskRecord,
} from "@/lib/crm/tasks";
import type { Subscriber } from "@/lib/crm/types";
import { todayString } from "@/lib/crm/utils";

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-rose-50 text-rose-700",
};

const statusColors: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const emptyForm = {
  title: "",
  type: "follow-up",
  description: "",
  dueDate: todayString(),
  dueTime: "",
  priority: "medium",
  status: "pending",
  customerId: "",
};

export function TasksDashboard({
  subscribers,
  canEdit,
}: {
  subscribers: Subscriber[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<CrmTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const customerOptions = useMemo(() => {
    const map = new Map<number, string>();
    subscribers.forEach((item) => {
      if (item.customerId) {
        map.set(Number(item.customerId), item.subscriberName || `عميل #${item.customerId}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [subscribers]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(TASKS_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [tasks, statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(TASKS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId: form.customerId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "فشل إنشاء المهمة");
        return;
      }

      setForm(emptyForm);
      setFormOpen(false);
      await loadTasks();
    } catch (error) {
      console.error(error);
      alert("فشل إنشاء المهمة");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(task: CrmTaskRecord, status: string) {
    if (!canEdit) return;

    try {
      const res = await fetch(`${TASKS_API_URL}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        await loadTasks();
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteTask(task: CrmTaskRecord) {
    if (!canEdit || !confirm(`حذف المهمة: ${task.title}؟`)) return;

    try {
      const res = await fetch(`${TASKS_API_URL}/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        await loadTasks();
      }
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div>
          <h3 className="text-[22px] font-bold text-[#1F2937]">المهام والمتابعات</h3>
          <p className="mt-1 text-sm text-[#707A84]">تذكيرات الاتصال والمتابعة مع العملاء</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setFormOpen((value) => !value)}
            className="flex items-center gap-2 rounded-2xl bg-[#3B82F6] px-5 py-3 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            {formOpen ? "إخفاء" : "مهمة جديدة"}
          </button>
        )}
      </div>

      {formOpen && canEdit && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 rounded-[28px] border border-[#EAECEF] bg-white p-6 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">عنوان المهمة</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">النوع</span>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {taskTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">العميل</span>
            <select
              value={form.customerId}
              onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            >
              <option value="">بدون ربط</option>
              {customerOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">تاريخ الاستحقاق</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">الأولوية</span>
            <select
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {taskPriorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">الوصف</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#3B82F6] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ المهمة"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-[#EEF1F4] px-6 py-4">
          {[
            { key: "all", label: "الكل" },
            ...TASK_STATUSES.map((status) => ({ key: status, label: taskStatusLabels[status] })),
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                statusFilter === item.key ? "bg-[#3B82F6] text-white" : "bg-[#F3F4F6] text-[#4B5563]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="me-2">جاري تحميل المهام...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <p className="py-16 text-center text-[#707A84]">لا توجد مهام</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
                  <th className="px-4 py-3">المهمة</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الاستحقاق</th>
                  <th className="px-4 py-3">الأولوية</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="border-b border-[#F1F5F9] last:border-none">
                    <td className="px-4 py-4 font-semibold text-[#1F2937]">{task.title}</td>
                    <td className="px-4 py-4 text-[#4B5563]">{task.customerName || "-"}</td>
                    <td className="px-4 py-4 text-[#4B5563]">
                      {taskTypeLabels[task.type as keyof typeof taskTypeLabels] || task.type}
                    </td>
                    <td className="px-4 py-4 text-[#4B5563]" dir="ltr">
                      {task.dueDate}
                      {task.dueTime ? ` ${task.dueTime}` : ""}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityColors[task.priority] || ""}`}>
                        {taskPriorityLabels[task.priority as keyof typeof taskPriorityLabels] || task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColors[task.status] || ""}`}>
                        {taskStatusLabels[task.status as keyof typeof taskStatusLabels] || task.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {canEdit && task.status !== "done" && (
                          <button
                            type="button"
                            onClick={() => updateTaskStatus(task, "done")}
                            className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                          >
                            إنجاز
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => deleteTask(task)}
                            className="rounded-lg bg-rose-50 p-1.5 text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
