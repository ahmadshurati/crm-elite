"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode; onReset?: () => void };
type State = { hasError: boolean; message: string };

/** Contains render crashes so one broken screen never takes down the whole app. */
export class DentalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : "خطأ غير متوقع" };
  }

  componentDidCatch(error: unknown) {
    console.error("Dental UI crash:", error);
  }

  reset = () => {
    this.setState({ hasError: false, message: "" });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-rose-100 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <p className="text-lg font-bold text-[#1F2937]">حدث خطأ غير متوقع في هذه الشاشة</p>
            <p className="mt-1 text-sm text-[#94A3B8]">يمكنك إعادة المحاولة أو تحديث الصفحة.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={this.reset} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </button>
            <button onClick={() => window.location.reload()} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC]">
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
