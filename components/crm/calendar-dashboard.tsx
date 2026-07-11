"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TASKS_API_URL } from "@/lib/crm/constants";
import { taskPriorityLabels, taskStatusLabels, taskTypeLabels, type CrmTaskRecord } from "@/lib/crm/tasks";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(date);
}

function toDateKey(value: string) {
  return value.slice(0, 10);
}

export function CalendarDashboard() {
  const [tasks, setTasks] = useState<CrmTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push(new Date(year, month, day));
    }

    return { days, weekdayOffset: (firstDay.getDay() + 6) % 7 };
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CrmTaskRecord[]>();
    tasks.forEach((task) => {
      const key = toDateKey(task.dueDate);
      map.set(key, [...(map.get(key) || []), task]);
    });
    return map;
  }, [tasks]);

  const selectedTasks = selectedDay ? tasksByDay.get(selectedDay) || [] : [];

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[22px] font-bold text-[#1F2937]">تقويم المهام</h3>
            <p className="mt-1 text-sm text-[#707A84]">عرض المهام حسب تاريخ الاستحقاق</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor((value) => addMonths(value, -1))}
              className="rounded-xl border border-[#E5E7EB] p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center font-bold text-[#1F2937]">{formatMonthTitle(cursor)}</span>
            <button
              type="button"
              onClick={() => setCursor((value) => addMonths(value, 1))}
              className="rounded-xl border border-[#E5E7EB] p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-4 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#707A84]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#8B95A1]">
                {["إ", "ث", "ث", "ر", "خ", "ج", "س"].map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: monthDays.weekdayOffset }).map((_, index) => (
                  <div key={`empty-${index}`} className="min-h-[88px]" />
                ))}
                {monthDays.days.map((day) => {
                  const key = toDateKey(day.toISOString());
                  const dayTasks = tasksByDay.get(key) || [];
                  const isSelected = selectedDay === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(key)}
                      className={`min-h-[88px] rounded-2xl border p-2 text-right transition ${
                        isSelected
                          ? "border-[#0F8B94] bg-[#F1FBFA]"
                          : "border-[#F1F5F9] bg-[#FAFAFA] hover:border-[#D1D5DB]"
                      }`}
                    >
                      <div className="text-sm font-bold text-[#1F2937]">{day.getDate()}</div>
                      {dayTasks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {dayTasks.slice(0, 2).map((task) => (
                            <div key={task.id} className="truncate rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-[#0F8B94]">
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 2 && (
                            <div className="text-[10px] text-[#8B95A1]">+{dayTasks.length - 2} أخرى</div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-5 shadow-sm">
          <h4 className="text-lg font-bold text-[#1F2937]">
            {selectedDay ? `مهام ${selectedDay}` : "اختر يوماً"}
          </h4>
          <div className="mt-4 space-y-3">
            {!selectedDay ? (
              <p className="text-sm text-[#707A84]">اضغط على يوم في التقويم لعرض المهام</p>
            ) : selectedTasks.length === 0 ? (
              <p className="text-sm text-[#707A84]">لا توجد مهام في هذا اليوم</p>
            ) : (
              selectedTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[#F1F5F9] p-3">
                  <p className="font-bold text-[#1F2937]">{task.title}</p>
                  <p className="mt-1 text-xs text-[#707A84]">
                    {taskTypeLabels[task.type as keyof typeof taskTypeLabels] || task.type}
                    {" · "}
                    {taskPriorityLabels[task.priority as keyof typeof taskPriorityLabels] || task.priority}
                  </p>
                  <p className="mt-1 text-xs text-[#8B95A1]">
                    {taskStatusLabels[task.status as keyof typeof taskStatusLabels] || task.status}
                    {task.customerName ? ` · ${task.customerName}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
