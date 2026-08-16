"use client";

import Image from "next/image";
import {
  AlertTriangle,
  ChevronLeft,
  FolderOpen,
  LayoutGrid,
  MessageCircle,
  Plus,
  Settings2,
  Shield,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MenuKey } from "@/lib/menu-navigation";
import {
  buildSidebarSections,
  sectionContainsKey,
  type SidebarSection,
} from "@/lib/crm/sidebar-config";
import { getCrmVocabulary, type TenantBranding } from "@/lib/crm/vocabulary";

const sectionIcons: Record<string, typeof Shield> = {
  dashboard: LayoutGrid,
  subscribers: Shield,
  "subscriber-tools": Sparkles,
  communications: MessageCircle,
  "crm-ops": LayoutGrid,
  accidents: AlertTriangle,
  finance: Wallet,
  admin: Settings2,
};

function defaultOpenSections(sections: SidebarSection[], activeMenu: MenuKey) {
  const open = new Set<string>();
  for (const section of sections) {
    if (sectionContainsKey(section, activeMenu)) {
      open.add(section.id);
    }
  }
  if (!open.size && sections[0]) {
    open.add(sections[0].id);
  }
  return open;
}

export function CrmSidebar({
  activeMenu,
  onNavigate,
  branding,
  canCreateSubscribers,
  canViewSubscribers,
  canEditSubscribers,
  canViewAccidents,
  canViewAccounting,
  canViewUsers,
  canEditUsers,
  canViewActivityLog,
  renewalsThisMonthCount,
  isMaster,
  open = false,
  onClose,
}: {
  activeMenu: MenuKey;
  onNavigate: (key: MenuKey) => void;
  open?: boolean;
  onClose?: () => void;
  branding: TenantBranding;
  canCreateSubscribers: boolean;
  canViewSubscribers: boolean;
  canEditSubscribers: boolean;
  canViewAccidents: boolean;
  canViewAccounting: boolean;
  canViewUsers: boolean;
  canEditUsers: boolean;
  canViewActivityLog: boolean;
  renewalsThisMonthCount: number;
  isMaster: boolean;
}) {
  const vocabulary = getCrmVocabulary(branding.isDemo);
  const demoBrandName =
    branding.companyName && !/elite/i.test(branding.companyName)
      ? branding.companyName
      : "Gosol CRM";
  const sections = useMemo(
    () =>
      buildSidebarSections({
        canViewSubscribers,
        canCreateSubscribers,
        canEditSubscribers,
        canViewAccidents,
        canViewAccounting,
        canViewUsers,
        canEditUsers,
        canViewActivityLog,
        renewalsThisMonthCount,
        isDemo: branding.isDemo,
        isMaster,
      }),
    [
      canViewSubscribers,
      canCreateSubscribers,
      canEditSubscribers,
      canViewAccidents,
      canViewAccounting,
      canViewUsers,
      canEditUsers,
      isMaster,
      canViewActivityLog,
      renewalsThisMonthCount,
      branding.isDemo,
    ]
  );

  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    defaultOpenSections(sections, activeMenu)
  );

  useEffect(() => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      for (const section of sections) {
        if (sectionContainsKey(section, activeMenu)) {
          next.add(section.id);
        }
      }
      return next;
    });
  }, [activeMenu, sections]);

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function go(key: MenuKey) {
    onNavigate(key);
    onClose?.();
  }

  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex h-screen w-[272px] max-w-[85vw] shrink-0 flex-col border-l border-[#E5E9EF] bg-[#FAFBFC] transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:translate-x-0 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
      <div className="relative flex h-[76px] items-center justify-center border-b border-[#E9EDF1] bg-white px-5">
        <button type="button" onClick={onClose} aria-label="إغلاق القائمة" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] lg:hidden">
          <X className="h-5 w-5" />
        </button>
        {branding.isDemo ? (
          <span className="text-[22px] font-extrabold tracking-tight text-[#0F8B94]">
            {demoBrandName}
          </span>
        ) : (
          <Image
            src={branding.logoUrl || "/loag.png"}
            alt={branding.companyName}
            width={150}
            height={34}
            className="max-h-[40px] w-auto object-contain"
            priority
          />
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="القائمة الرئيسية">
        {sections.map((section) => {
          const Icon = sectionIcons[section.id] || FolderOpen;
          const isOpen = openSections.has(section.id);
          const isSingleItem = section.items.length === 1;
          const sectionActive = section.items.some((item) => item.key === activeMenu);

          if (isSingleItem) {
            const item = section.items[0];
            const active = activeMenu === item.key;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => go(item.key)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right transition ${
                  active
                    ? "bg-white font-bold text-[#0F8B94] shadow-sm ring-1 ring-[#D7ECEB]"
                    : "text-[#475569] hover:bg-white/80"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active ? "bg-[#E7F6F5] text-[#0F8B94]" : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-[14px]">{item.label}</span>
              </button>
            );
          }

          return (
            <div key={section.id} className="rounded-2xl">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-right transition hover:bg-white/70 ${
                  sectionActive ? "text-[#0F8B94]" : "text-[#334155]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    sectionActive ? "bg-[#E7F6F5] text-[#0F8B94]" : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-[13px] font-bold">{section.label}</span>
                <ChevronLeft
                  className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform ${
                    isOpen ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="me-2 mt-0.5 space-y-0.5 border-r-2 border-[#E2E8F0] pe-2 ps-1">
                  {section.items.map((item) => {
                    const active = activeMenu === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => go(item.key)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right text-[13px] transition ${
                          active
                            ? "bg-white font-bold text-[#0F8B94] shadow-sm ring-1 ring-[#D7ECEB]"
                            : "text-[#64748B] hover:bg-white/90 hover:text-[#334155]"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {typeof item.count === "number" && item.count > 0 && (
                          <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {canCreateSubscribers && (
        <div className="border-t border-[#EEF1F4] p-3">
          <button
            type="button"
            onClick={() => go("add-new-subscriber")}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              activeMenu === "add-new-subscriber"
                ? "bg-[#0B6E75] text-white shadow-md"
                : "bg-[#0F8B94] text-white hover:bg-[#0B6E75]"
            }`}
          >
            <Plus className="h-4 w-4" />
            {vocabulary.addCustomer}
          </button>
        </div>
      )}
      </aside>
    </>
  );
}
