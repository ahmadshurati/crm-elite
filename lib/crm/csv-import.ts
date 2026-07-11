type CsvRow = Record<string, string>;

const headerAliases: Record<string, string[]> = {
  name: ["name", "subscribername", "اسم المشترك", "الاسم", "اسم"],
  phone: ["phone", "customernumber", "الهاتف", "رقم الهاتف"],
  email: ["email", "البريد", "البريد الإلكتروني"],
  carName: ["carname", "car", "السيارة", "اسم السيارة"],
  carNumber: ["carnumber", "platenumber", "رقم السيارة"],
  carYear: ["caryear", "سنة السيارة", "السنة"],
  insuranceCompany: ["insurancecompany", "company", "شركة التأمين", "الشركة"],
  insuranceType: ["insurancetype", "type", "نوع التأمين"],
  startDate: ["startdate", "start", "تاريخ البداية", "البداية"],
  endDate: ["enddate", "end", "تاريخ النهاية", "النهاية"],
  totalAmount: ["totalamount", "total", "المبلغ", "الإجمالي"],
  paidAmount: ["paidamount", "paid", "المدفوع"],
};

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function mapHeaders(headers: string[]) {
  const mapping = new Map<number, string>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(headerAliases)) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        mapping.set(index, field);
      }
    }
  });

  return mapping;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCustomerImportCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [] as CsvRow[], errors: ["الملف فارغ أو لا يحتوي على بيانات"] };
  }

  const headers = parseCsvLine(lines[0]);
  const mapping = mapHeaders(headers);
  const rows: CsvRow[] = [];
  const errors: string[] = [];

  if (mapping.size === 0) {
    errors.push("تعذر التعرف على عناوين الأعمدة — استخدم القالب المعروض");
  }

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    const row: CsvRow = {};

    mapping.forEach((field, cellIndex) => {
      row[field] = cells[cellIndex] || "";
    });

    if (!row.name?.trim()) {
      errors.push(`السطر ${lineIndex + 1}: اسم المشترك مطلوب`);
      continue;
    }

    rows.push(row);
  }

  return { rows, errors };
}

export function buildImportTemplateCsv() {
  return `\uFEFFname,phone,email,carName,carNumber,carYear,insuranceCompany,insuranceType,startDate,endDate,totalAmount,paidAmount
أحمد محمد,0599000000,ahmad@example.com,تويota كورولا,12-345-67,2020,شركة التأمين أ,شامل,2026-01-01,2027-01-01,2500,1000`;
}
