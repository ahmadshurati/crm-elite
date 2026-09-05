import { mapCustomerProfileFromRow } from "@/lib/crm/customer-profile";
import type { AccidentCase, CustomerNode, Subscriber } from "@/lib/crm/types";
import {
  formatDateForInput,
  isPastDate,
  normalizePaid,
  normalizeStatus,
  numberValue,
} from "@/lib/crm/utils";

export function mapDbCustomersToSubscribers(customers: unknown[]): Subscriber[] {
  const subscribersList: Subscriber[] = [];

  (customers as Record<string, unknown>[]).forEach((customer) => {
    const cars = Array.isArray(customer.cars) ? customer.cars : [];

    cars.forEach((car: Record<string, unknown>) => {
      const insurances = Array.isArray(car.insurances) ? car.insurances : [];

      insurances.forEach((insurance: Record<string, unknown>) => {
        const documents = Array.isArray(insurance.documents) ? insurance.documents : [];

        const findDocument = (type: string) =>
          (documents as Record<string, unknown>[]).find((doc) => doc.type === type)?.fileUrl ||
          "";

        const checks = Array.isArray(insurance.checks)
          ? (insurance.checks as Record<string, unknown>[]).map((check) => ({
              checkNumber: String(check.checkNumber || ""),
              bankName: String(check.bankName || ""),
              dueDate: formatDateForInput(check.dueDate),
              amount: numberValue(check.amount),
            }))
          : [];

        const profile = mapCustomerProfileFromRow(customer as Record<string, unknown>);

        subscribersList.push({
          id: Number(insurance.id),
          customerId: Number(customer.id),
          carId: Number(car.id),
          subscriberName: String(customer.name || ""),
          carName: String(car.carName || ""),
          carNumber: String(car.carNumber || ""),
          carYear: String(car.carYear || ""),
          customerNumber: String(customer.phone || ""),
          dateAdded: formatDateForInput(customer.createdAt),
          ...profile,
          insuranceType: String(insurance.insuranceType || "غير محدد"),
          insuranceCompany: String(insurance.insuranceCompany || ""),
          startDate: formatDateForInput(insurance.startDate),
          endDate: formatDateForInput(insurance.endDate),
          insuranceStatus: isPastDate(formatDateForInput(insurance.endDate))
            ? "منتهي"
            : normalizeStatus(insurance.status),
          paidStatus: normalizePaid(insurance.paymentMethod),
          hofaaEnabled: Boolean(insurance.hofaaEnabled),
          hofaaPrice: numberValue(insurance.hofaaPrice),
          thirdPartyEnabled: Boolean(insurance.thirdPartyEnabled),
          thirdPartyPrice: numberValue(insurance.thirdPartyPrice),
          fullEnabled: Boolean(insurance.fullEnabled),
          fullPrice: numberValue(insurance.fullPrice),
          totalAmount: numberValue(insurance.totalAmount),
          paidAmount: numberValue(insurance.paidAmount),
          cashAmount: numberValue(insurance.cashAmount),
          visaAmount: numberValue(insurance.visaAmount),
          checksAmount: numberValue(insurance.checksAmount),
          remainingAmount: numberValue(insurance.remainingAmount),
          paymentStatus: String(insurance.paymentStatus || "غير مدفوع"),
          checks,
          history: "لا يوجد سجل بعد",
          policyImage:
            String(findDocument("policyImage") || "") ||
            "https://placehold.co/800x520/png?text=Policy",
          documents: {
            drivingLicense: String(findDocument("drivingLicense") || ""),
            carLicense: String(findDocument("carLicense") || ""),
            companionId: String(findDocument("companionId") || ""),
            carImage1: String(findDocument("carImage1") || ""),
            carImage2: String(findDocument("carImage2") || ""),
            carImage3: String(findDocument("carImage3") || ""),
            carImage4: String(findDocument("carImage4") || ""),
            carImage5: String(findDocument("carImage5") || ""),
            insurancePolicy1: String(findDocument("insurancePolicy1") || ""),
            insurancePolicy2: String(findDocument("insurancePolicy2") || ""),
            otherDocument:
              String(findDocument("otherDocument") || "") || String(findDocument("other") || ""),
            otherDocument2: String(findDocument("otherDocument2") || ""),
            otherDocument3: String(findDocument("otherDocument3") || ""),
          },
        });
      });
    });
  });

  return subscribersList;
}

export function mapDbAccidentToCase(accident: Record<string, unknown>): AccidentCase {
  const customer = accident.customer as Record<string, unknown> | undefined;
  const car = accident.car as Record<string, unknown> | undefined;

  return {
    id: Number(accident.id),
    customerId: Number(accident.customerId),
    carId: Number(accident.carId),
    caseNumber: String(accident.caseNumber || ""),
    subscriberName: String(customer?.name || ""),
    customerNumber: String(customer?.phone || ""),
    carName: String(car?.carName || ""),
    carNumber: String(car?.carNumber || ""),
    insuranceCompany: "",
    insuranceType: "",
    details: String(accident.details || ""),
    status: accident.status === "مغلق" ? "مغلق" : "مفتوح",
    openedAt: formatDateForInput(accident.openedAt),
    updates: Array.isArray(accident.updates)
      ? (accident.updates as Record<string, unknown>[]).map((update) => ({
          id: Number(update.id),
          text: String(update.text || ""),
          date: formatDateForInput(update.createdAt),
        }))
      : [],
  };
}

export function buildCustomerNodes(subscribers: Subscriber[]): CustomerNode[] {
  const map = new Map<string, CustomerNode>();

  subscribers.forEach((subscriber) => {
    const phone = String(subscriber.customerNumber ?? "").trim();
    const name = String(subscriber.subscriberName ?? "").trim();
    const key = String(subscriber.customerId || phone || name || `customer-${subscriber.id}`);

    if (!map.has(key)) {
      map.set(key, {
        customerKey: key,
        customerId: subscriber.customerId,
        subscriberName: name || "بدون اسم",
        customerNumber: phone,
        cars: [],
      });
    }

    map.get(key)?.cars.push(subscriber);
  });

  return Array.from(map.values()).sort((a, b) =>
    a.subscriberName.localeCompare(b.subscriberName, "ar")
  );
}
