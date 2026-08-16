import { execute, query, queryOne } from "@/lib/db";
import { serializeLineItems } from "@/lib/crm/line-items";
import { DEMO_COMPANY_ID } from "@/lib/tenant";

const ELITE_COMPANY_ID = 1;

type EliteSnapshot = {
  customers: number;
  insurances: number;
  deals: number;
  tasks: number;
};

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function daysAgo(days: number) {
  return daysFromNow(-days);
}

async function getEliteSnapshot(): Promise<EliteSnapshot> {
  const row = await queryOne<EliteSnapshot>(
    `SELECT
      (SELECT COUNT(*) FROM Customer WHERE companyId = ?) AS customers,
      (SELECT COUNT(*) FROM Insurance i INNER JOIN Customer c ON c.id = i.customerId WHERE c.companyId = ?) AS insurances,
      (SELECT COUNT(*) FROM Deal d INNER JOIN Customer c ON c.id = d.customerId WHERE c.companyId = ?) AS deals,
      (SELECT COUNT(*) FROM CrmTask t
        LEFT JOIN Customer c ON c.id = t.customerId
        LEFT JOIN AppUser u ON u.id = t.createdByUserId
        WHERE c.companyId = ? OR u.companyId = ?) AS tasks`,
    [ELITE_COMPANY_ID, ELITE_COMPANY_ID, ELITE_COMPANY_ID, ELITE_COMPANY_ID, ELITE_COMPANY_ID]
  );
  return {
    customers: Number(row?.customers || 0),
    insurances: Number(row?.insurances || 0),
    deals: Number(row?.deals || 0),
    tasks: Number(row?.tasks || 0),
  };
}

function assertEliteUnchanged(before: EliteSnapshot, after: EliteSnapshot) {
  for (const key of Object.keys(before) as (keyof EliteSnapshot)[]) {
    if (before[key] !== after[key]) {
      throw new Error(
        `Elite data safety check failed: ${key} changed from ${before[key]} to ${after[key]}`
      );
    }
  }
}

async function getDemoUserId() {
  const user = await queryOne<{ id: number }>(
    "SELECT id FROM AppUser WHERE username = 'demo' AND companyId = ? LIMIT 1",
    [DEMO_COMPANY_ID]
  );
  if (!user) {
    throw new Error("Demo user not found. Run npm run bootstrap:users first.");
  }
  return user.id;
}

export async function clearDemoCompanyData(companyId = DEMO_COMPANY_ID) {
  if (companyId === ELITE_COMPANY_ID) {
    throw new Error("Refusing to clear Elite company data");
  }

  const demoCustomers = await query<{ id: number }>(
    "SELECT id FROM Customer WHERE companyId = ?",
    [companyId]
  );
  const customerIds = demoCustomers.map((row) => row.id);

  const demoUsers = await query<{ id: number }>(
    "SELECT id FROM AppUser WHERE companyId = ?",
    [companyId]
  );
  const userIds = demoUsers.map((row) => row.id);

  if (userIds.length) {
    const placeholders = userIds.map(() => "?").join(", ");
    await execute(`DELETE FROM CrmNotification WHERE userId IN (${placeholders})`, userIds);
  }

  if (customerIds.length) {
    const placeholders = customerIds.map(() => "?").join(", ");
    await execute(
      `DELETE FROM Document WHERE insuranceId IN (SELECT id FROM Insurance WHERE customerId IN (${placeholders}))`,
      customerIds
    );
    await execute(
      `DELETE FROM PaymentCheck WHERE insuranceId IN (SELECT id FROM Insurance WHERE customerId IN (${placeholders}))`,
      customerIds
    );
    await execute(`DELETE FROM Insurance WHERE customerId IN (${placeholders})`, customerIds);
    await execute(
      `DELETE FROM AccidentUpdate WHERE accidentCaseId IN (SELECT id FROM AccidentCase WHERE customerId IN (${placeholders}))`,
      customerIds
    );
    await execute(`DELETE FROM AccidentCase WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM Deal WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM Quote WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM Invoice WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM Contract WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM CustomerCommunication WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM InboundMessage WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM OutboundMessage WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM CrmFile WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM CrmTask WHERE customerId IN (${placeholders})`, customerIds);
    await execute(`DELETE FROM Car WHERE customerId IN (${placeholders})`, customerIds);
  }

  if (userIds.length) {
    const userPlaceholders = userIds.map(() => "?").join(", ");
    await execute(
      `DELETE FROM CrmTask WHERE customerId IS NULL AND (createdByUserId IN (${userPlaceholders}) OR assignedUserId IN (${userPlaceholders}))`,
      [...userIds, ...userIds]
    );
    await execute(
      `DELETE FROM OutboundMessage WHERE userId IN (${userPlaceholders})`,
      userIds
    );
  }

  await execute("DELETE FROM Customer WHERE companyId = ?", [companyId]);
}

const DEMO_CUSTOMERS = [
  {
    name: "شركة النور للتجارة",
    phone: "0599001001",
    email: "contact@alnoor-demo.com",
    city: "رام الله",
    carName: "باقة Pro",
    carNumber: "ACC-1001",
    insuranceCompany: "Gosol CRM",
    total: 4800,
    paid: 4800,
    status: "فعال" as const,
    startDaysAgo: 120,
    endDaysFromNow: 245,
  },
  {
    name: "مؤسسة سارة للخدمات",
    phone: "0599001002",
    email: "sara@services-demo.com",
    city: "نابلس",
    carName: "باقة Business",
    carNumber: "ACC-1002",
    insuranceCompany: "Gosol CRM",
    total: 7200,
    paid: 3600,
    status: "فعال" as const,
    startDaysAgo: 90,
    endDaysFromNow: 12,
  },
  {
    name: "محمد للاستشارات",
    phone: "0599001003",
    email: "info@mohammad-demo.com",
    city: "الخليل",
    carName: "باقة Enterprise",
    carNumber: "ACC-1003",
    insuranceCompany: "Gosol CRM",
    total: 12000,
    paid: 12000,
    status: "فعال" as const,
    startDaysAgo: 200,
    endDaysFromNow: 165,
  },
  {
    name: "ليان للتسويق الرقمي",
    phone: "0599001004",
    email: "hello@layan-demo.com",
    city: "بيت لحم",
    carName: "باقة Starter",
    carNumber: "ACC-1004",
    insuranceCompany: "Gosol CRM",
    total: 2400,
    paid: 0,
    status: "فعال" as const,
    startDaysAgo: 30,
    endDaysFromNow: 335,
  },
  {
    name: "كريم للحلول التقنية",
    phone: "0599001005",
    email: "kareem@tech-demo.com",
    city: "جنين",
    carName: "باقة Pro",
    carNumber: "ACC-1005",
    insuranceCompany: "Gosol CRM",
    total: 4800,
    paid: 4800,
    status: "منتهي" as const,
    startDaysAgo: 400,
    endDaysFromNow: -20,
  },
  {
    name: "نور للتصميم",
    phone: "0599001006",
    email: "noor@design-demo.com",
    city: "طولكرم",
    carName: "باقة Business",
    carNumber: "ACC-1006",
    insuranceCompany: "Gosol CRM",
    total: 7200,
    paid: 3600,
    status: "فعال" as const,
    startDaysAgo: 60,
    endDaysFromNow: 18,
  },
  {
    name: "ياسر للمقاولات",
    phone: "0599001007",
    email: "yaser@build-demo.com",
    city: "قلقيلية",
    carName: "باقة Enterprise",
    carNumber: "ACC-1007",
    insuranceCompany: "Gosol CRM",
    total: 15000,
    paid: 15000,
    status: "فعال" as const,
    startDaysAgo: 45,
    endDaysFromNow: 320,
  },
  {
    name: "رنا للتجارة الإلكترونية",
    phone: "0599001008",
    email: "rana@shop-demo.com",
    city: "أريحا",
    carName: "باقة Pro",
    carNumber: "ACC-1008",
    insuranceCompany: "Gosol CRM",
    total: 4800,
    paid: 2400,
    status: "فعال" as const,
    startDaysAgo: 150,
    endDaysFromNow: 215,
  },
];

export async function seedDemoCompanyData(companyId = DEMO_COMPANY_ID) {
  if (companyId === ELITE_COMPANY_ID) {
    throw new Error("Refusing to seed Elite company with demo data");
  }

  const demoUserId = await getDemoUserId();
  const customerIds: number[] = [];
  const insuranceIds: number[] = [];
  const carIds: number[] = [];

  for (const item of DEMO_CUSTOMERS) {
    const customerResult = await execute(
      `INSERT INTO Customer (companyId, name, phone, email, city, country, customerStatus, source, tags, createdAt)
       VALUES (?, ?, ?, ?, ?, 'فلسطين', 'فعال', 'CRM', 'عميل,CRM,تجريبي', NOW())`,
      [companyId, item.name, item.phone, item.email, item.city]
    );
    const customerId = Number(customerResult.insertId);
    customerIds.push(customerId);

    const carResult = await execute(
      "INSERT INTO Car (customerId, carName, carNumber, carYear) VALUES (?, ?, ?, '2021')",
      [customerId, item.carName, item.carNumber]
    );
    const carId = Number(carResult.insertId);
    carIds.push(carId);

    const remaining = Math.max(item.total - item.paid, 0);
    const paymentStatus =
      item.paid <= 0 ? "غير مدفوع" : item.paid >= item.total ? "مدفوع كامل" : "مدفوع جزئي";

    const insuranceResult = await execute(
      `INSERT INTO Insurance (
        customerId, carId, insuranceType, insuranceCompany, startDate, endDate, status, paymentMethod,
        hofaaEnabled, hofaaPrice, thirdPartyEnabled, thirdPartyPrice, fullEnabled, fullPrice,
        totalAmount, paidAmount, cashAmount, visaAmount, checksAmount, remainingAmount, paymentStatus
      ) VALUES (?, ?, 'اشتراك SaaS', ?, ?, ?, ?, 'تحويل بنكي + فيزا', 0, 0, 0, 0, 1, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        customerId,
        carId,
        item.insuranceCompany,
        daysAgo(item.startDaysAgo),
        daysFromNow(item.endDaysFromNow),
        item.status,
        item.total,
        item.total,
        item.paid,
        Math.min(item.paid, item.total * 0.6),
        Math.max(item.paid - item.total * 0.6, 0),
        remaining,
        paymentStatus,
      ]
    );
    insuranceIds.push(Number(insuranceResult.insertId));
  }

  const deals = [
    { idx: 0, title: "ترقية باقة Pro إلى Enterprise", stage: "negotiation", value: 8500, probability: 70 },
    { idx: 1, title: "اشتراك CRM جديد — 15 مستخدم", stage: "proposal", value: 12000, probability: 50 },
    { idx: 2, title: "توسعة فريق المبيعات", stage: "new-lead", value: 6200, probability: 30 },
    { idx: 3, title: "عقد سنوي — 3 فروع", stage: "won", value: 36000, probability: 100 },
    { idx: 4, title: "مشروع تخصيص API", stage: "lost", value: 22000, probability: 0 },
    { idx: 5, title: "تجديد اشتراك سنوي", stage: "qualified", value: 4800, probability: 60 },
    { idx: 6, title: "إضافة وحدة الأتمتة", stage: "negotiation", value: 3200, probability: 75 },
  ];

  for (const deal of deals) {
    await execute(
      `INSERT INTO Deal (customerId, assignedUserId, title, stage, value, probability, expectedClose, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'صفقة تجريبية للعرض', NOW(), NOW())`,
      [
        customerIds[deal.idx],
        demoUserId,
        deal.title,
        deal.stage,
        deal.value,
        deal.probability,
        daysFromNow(14 + deal.idx * 3),
      ]
    );
  }

  const tasks = [
    { idx: 0, title: "متابعة تجديد اشتراك شركة النور", status: "pending", days: 0, priority: "high" },
    { idx: 1, title: "اتصال بمؤسسة سارة بخصوص الدفع", status: "in_progress", days: -2, priority: "high" },
    { idx: 2, title: "إرسال عرض سعر لمحمد للاستشارات", status: "pending", days: 1, priority: "medium" },
    { idx: 3, title: "تذكير ليان بالدفع المتبقي", status: "pending", days: 3, priority: "medium" },
    { idx: 4, title: "متابعة تذكرة دعم DEMO-SUP-001", status: "in_progress", days: 0, priority: "high" },
    { idx: 5, title: "مكالمة متابعة نور للتصميم", status: "done", days: -5, priority: "low" },
    { idx: 6, title: "تحضير عقد ياسر للمقاولات", status: "pending", days: 7, priority: "medium" },
    { idx: 7, title: "إرسال فاتورة رنا للتجارة", status: "pending", days: -1, priority: "high" },
    { idx: null, title: "اجتماع فريق المبيعات الأسبوعي", status: "pending", days: 2, priority: "low" },
    { idx: 2, title: "تجهيز عرض تقديمي للعميل", status: "in_progress", days: 4, priority: "medium" },
  ];

  for (const task of tasks) {
    await execute(
      `INSERT INTO CrmTask (customerId, assignedUserId, createdByUserId, title, type, description, dueDate, priority, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'follow-up', 'مهمة تجريبية للعرض التقديمي', ?, ?, ?, NOW(), NOW())`,
      [
        task.idx != null ? customerIds[task.idx] : null,
        demoUserId,
        demoUserId,
        task.title,
        daysFromNow(task.days),
        task.priority,
        task.status,
      ]
    );
  }

  const lineItem = serializeLineItems([
    { description: "اشتراك Gosol CRM — سنة", quantity: 1, unitPrice: 4800, total: 4800 },
  ]);

  for (let i = 0; i < 5; i++) {
    const customerId = customerIds[i];
    await execute(
      `INSERT INTO Quote (customerId, createdByUserId, quoteNumber, title, status, lineItems, subtotal, taxRate, taxAmount, discount, total, validUntil, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 3200, 0, 0, 0, 3200, ?, 'عرض سعر تجريبي', NOW(), NOW())`,
      [
        customerId,
        demoUserId,
        `DEMO-Q-2026-${String(i + 1).padStart(4, "0")}`,
        `عرض اشتراك CRM — ${DEMO_CUSTOMERS[i].name}`,
        i % 2 === 0 ? "sent" : "draft",
        lineItem,
        daysFromNow(30),
      ]
    );
  }

  const invoiceStatuses = ["paid", "unpaid", "partial", "overdue", "unpaid"];
  for (let i = 0; i < 5; i++) {
    const total = 2500 + i * 400;
    const paid = invoiceStatuses[i] === "paid" ? total : invoiceStatuses[i] === "partial" ? total * 0.5 : 0;
    await execute(
      `INSERT INTO Invoice (customerId, createdByUserId, invoiceNumber, title, status, lineItems, subtotal, taxRate, taxAmount, discount, total, paidAmount, dueDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, 'فاتورة تجريبية', NOW(), NOW())`,
      [
        customerIds[i],
        demoUserId,
        `DEMO-INV-2026-${String(i + 1).padStart(4, "0")}`,
        `فاتورة اشتراك — ${DEMO_CUSTOMERS[i].name}`,
        invoiceStatuses[i],
        lineItem,
        total,
        total,
        paid,
        daysFromNow(invoiceStatuses[i] === "overdue" ? -10 : 14),
      ]
    );
  }

  for (let i = 0; i < 4; i++) {
    await execute(
      `INSERT INTO Contract (customerId, createdByUserId, contractNumber, title, status, startDate, endDate, renewalDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'عقد تجريبي', NOW(), NOW())`,
      [
        customerIds[i],
        demoUserId,
        `DEMO-C-2026-${String(i + 1).padStart(4, "0")}`,
        `عقد خدمة سنوي — ${DEMO_CUSTOMERS[i].name}`,
        i === 0 ? "active" : i === 1 ? "draft" : "active",
        daysAgo(30),
        daysFromNow(335),
        daysFromNow(300),
      ]
    );
  }

  const accidentCases = [
    { idx: 0, caseNumber: "DEMO-SUP-001", details: "العميل يواجه مشكلة في مزامنة البريد — بيانات تجريبية", status: "open" },
    { idx: 2, caseNumber: "DEMO-SUP-002", details: "طلب تفعيل API للتكامل مع المتجر — للعرض فقط", status: "in_progress" },
    { idx: 5, caseNumber: "DEMO-SUP-003", details: "استفسار عن صلاحيات المستخدمين — مغلق", status: "closed" },
  ];

  for (const accident of accidentCases) {
    const result = await execute(
      `INSERT INTO AccidentCase (customerId, carId, caseNumber, details, status, openedAt)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        customerIds[accident.idx],
        carIds[accident.idx],
        accident.caseNumber,
        accident.details,
        accident.status,
      ]
    );
    const accidentId = Number(result.insertId);
    await execute(
      "INSERT INTO AccidentUpdate (accidentCaseId, text, createdAt) VALUES (?, ?, NOW())",
      [accidentId, "تم فتح تذكرة الدعم — بيانات تجريبية للعرض"]
    );
    await execute(
      "INSERT INTO AccidentUpdate (accidentCaseId, text, createdAt) VALUES (?, ?, NOW())",
      [accidentId, "تم التواصل مع العميل وجدولة جلسة دعم"]
    );
  }

  const communications = [
    { idx: 0, type: "call", summary: "اتصال: العميل يسأل عن ترقية الباقة" },
    { idx: 0, type: "whatsapp", summary: "واتساب: شكراً على سرعة الرد من فريق الدعم" },
    { idx: 1, type: "call", summary: "اتصال: متابعة الدفع المتبقي للاشتراك" },
    { idx: 2, type: "email", summary: "بريد: إرسال عرض سعر مفصل لـ 15 مستخدم" },
    { idx: 3, type: "visit", summary: "زيارة: توقيع عقد الخدمة السنوي" },
    { idx: 4, type: "call", summary: "اتصال: استفسار عن حالة تذكرة الدعم" },
    { idx: 5, type: "whatsapp", summary: "واتساب: تأكيد موعد تجديد الاشتراك" },
    { idx: 6, type: "sms", summary: "SMS: تذكير بموعد الدفع" },
    { idx: 7, type: "call", summary: "اتصال: متابعة الفاتورة المفتوحة" },
  ];

  for (const comm of communications) {
    await execute(
      `INSERT INTO CustomerCommunication (customerId, userId, username, type, occurredAt, summary, createdAt)
       VALUES (?, ?, 'demo', ?, ?, ?, NOW())`,
      [customerIds[comm.idx], demoUserId, comm.type, daysAgo(comm.idx + 1), comm.summary]
    );
  }

  const inboundMessages = [
    {
      idx: 0,
      channel: "whatsapp",
      sender: "0599001001",
      senderName: "شركة النور للتجارة",
      body: "مرحباً، نريد ترقية اشتراك CRM إلى باقة Enterprise. ما الخطوات؟",
      daysAgo: 0,
      unread: true,
    },
    {
      idx: 1,
      channel: "whatsapp",
      sender: "0599001002",
      senderName: "مؤسسة سارة للخدمات",
      body: "هل يمكن تقسيط مبلغ الاشتراك المتبقي على 3 أشهر؟",
      daysAgo: 1,
      unread: true,
    },
    {
      idx: 2,
      channel: "email",
      sender: "info@mohammad-demo.com",
      senderName: "محمد للاستشارات",
      subject: "طلب عرض سعر CRM",
      body: "السلام عليكم، نحتاج عرض سعر لـ 15 مستخدم مع وحدة الأتمتة والتقارير.",
      daysAgo: 2,
      unread: false,
    },
    {
      idx: 3,
      channel: "sms",
      sender: "0599001004",
      senderName: "ليان للتسويق الرقمي",
      body: "تذكير: موعد الدفع غداً. شكراً.",
      daysAgo: 0,
      unread: true,
    },
    {
      idx: 5,
      channel: "whatsapp",
      sender: "0599001006",
      senderName: "نور للتصميم",
      body: "متى ينتهي اشتراكنا الحالي؟ نريد التجديد قبل انتهاء المدة.",
      daysAgo: 3,
      unread: false,
    },
    {
      idx: 6,
      channel: "instagram",
      sender: "@yaser_build",
      senderName: "ياسر للمقاولات",
      body: "شفت إعلانكم، ممكن تفاصيل عن باقة Enterprise للفرق الكبيرة؟",
      daysAgo: 1,
      unread: true,
    },
    {
      idx: 7,
      channel: "gmail",
      sender: "rana@shop-demo.com",
      senderName: "رنا للتجارة الإلكترونية",
      subject: "Re: الفاتورة",
      body: "تم الدفع جزئياً. أرجو تأكيد الاستلام.",
      daysAgo: 4,
      unread: false,
    },
  ];

  for (const msg of inboundMessages) {
    await execute(
      `INSERT INTO InboundMessage (channel, sender, senderName, subject, body, provider, providerId, customerId, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, 'demo-seed', ?, ?, ?, ?)`,
      [
        msg.channel,
        msg.sender,
        msg.senderName,
        msg.subject || null,
        msg.body,
        `demo-in-${msg.idx}-${msg.channel}`,
        customerIds[msg.idx],
        msg.unread ? 0 : 1,
        daysAgo(msg.daysAgo),
      ]
    );
  }

  const outboundMessages = [
    {
      idx: 0,
      channel: "whatsapp",
      recipient: "0599001001",
      body: "أهلاً، يسعدنا مساعدتكم. سأرسل خيارات الترقية خلال ساعة.",
      daysAgo: 0,
    },
    {
      idx: 1,
      channel: "whatsapp",
      recipient: "0599001002",
      body: "مرحباً، نعم يمكن تقسيط المبلغ. سأرسل تفاصيل الخطة.",
      daysAgo: 1,
    },
    {
      idx: 2,
      channel: "email",
      recipient: "info@mohammad-demo.com",
      subject: "عرض سعر Gosol CRM",
      body: "مرفق عرض السعر المطلوب. نحن جاهزون للإجابة على أي استفسار.",
      daysAgo: 2,
    },
    {
      idx: 4,
      channel: "sms",
      recipient: "0599001005",
      body: "تم تحديث تذكرة الدعم DEMO-SUP-001. سنتواصل معكم قريباً.",
      daysAgo: 1,
    },
  ];

  for (const msg of outboundMessages) {
    await execute(
      `INSERT INTO OutboundMessage (channel, recipient, subject, body, status, customerId, userId, createdAt, sentAt, isRead)
       VALUES (?, ?, ?, ?, 'sent', ?, ?, ?, ?, 1)`,
      [
        msg.channel,
        msg.recipient,
        msg.subject || null,
        msg.body,
        customerIds[msg.idx],
        demoUserId,
        daysAgo(msg.daysAgo),
        daysAgo(msg.daysAgo),
      ]
    );
  }

  for (let i = 0; i < 4; i++) {
    await execute(
      `INSERT INTO CrmFile (customerId, folder, fileName, fileUrl, mimeType, fileSize, uploadedByUserId, createdAt)
       VALUES (?, 'documents', ?, ?, 'application/pdf', 125000, ?, NOW())`,
      [
        customerIds[i],
        `demo-contract-${i + 1}.pdf`,
        `https://placehold.co/600x800/png?text=Demo+Contract+${i + 1}`,
        demoUserId,
      ]
    );
  }

  await execute(
    `INSERT INTO CrmNotification (userId, type, title, body, entityType, entityId, isRead, createdAt)
     VALUES (?, 'demo_welcome', 'مرحباً في Gosol CRM', 'هذه بيانات تجريبية لعرض إمكانيات النظام الكاملة', NULL, NULL, 0, NOW())`,
    [demoUserId]
  );

  await execute(
    `UPDATE SystemSetting SET companyName = 'Gosol CRM', logoUrl = '/gosol-crm-logo.svg', updatedAt = NOW()
     WHERE companyId = ?`,
    [companyId]
  );

  return {
    customers: customerIds.length,
    insurances: insuranceIds.length,
    deals: deals.length,
    tasks: tasks.length,
    messages: inboundMessages.length + outboundMessages.length,
  };
}

export async function resetDemoCompanyData(companyId = DEMO_COMPANY_ID) {
  const eliteBefore = await getEliteSnapshot();
  await clearDemoCompanyData(companyId);
  const seeded = await seedDemoCompanyData(companyId);
  const eliteAfter = await getEliteSnapshot();
  assertEliteUnchanged(eliteBefore, eliteAfter);
  return seeded;
}
