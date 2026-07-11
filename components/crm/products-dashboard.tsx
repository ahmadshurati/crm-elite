"use client";

import { Loader2, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PRODUCTS_API_URL } from "@/lib/crm/constants";

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  unitPrice: number;
  isActive: boolean;
};

const emptyForm = { sku: "", name: "", category: "insurance", description: "", unitPrice: 0 };

export function ProductsDashboard({ canEdit }: { canEdit: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(PRODUCTS_API_URL, { cache: "no-store" });
      if (res.ok) setProducts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(PRODUCTS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        alert((await res.json()).error || "فشل الإضافة");
        return;
      }
      setForm(emptyForm);
      await loadProducts();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#F1FBFA] p-2 text-[#0F8B94]">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[22px] font-bold text-[#1F2937]">المنتجات والخدمات</h3>
            <p className="text-sm text-[#707A84]">دليل للتأمينات والخدمات المستخدمة في العروض والفواتير</p>
          </div>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={handleCreate} className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="SKU"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
              dir="ltr"
              required
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم المنتج"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
              required
            />
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="التصنيف"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
            <input
              type="number"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
              placeholder="السعر"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : "إضافة منتج"}
          </button>
        </form>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[#707A84]">
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3">الاسم</th>
                <th className="px-6 py-3">التصنيف</th>
                <th className="px-6 py-3">السعر</th>
                <th className="px-6 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[#F1F5F9]">
                  <td className="px-6 py-3" dir="ltr">
                    {product.sku}
                  </td>
                  <td className="px-6 py-3 font-bold">{product.name}</td>
                  <td className="px-6 py-3">{product.category}</td>
                  <td className="px-6 py-3">{product.unitPrice}</td>
                  <td className="px-6 py-3">{product.isActive ? "فعّال" : "معطّل"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
