export const PERMISSION_FIELDS = [
  "viewSubscribers",
  "createSubscribers",
  "editSubscribers",
  "deleteSubscribers",
  "viewAccidents",
  "createAccidents",
  "editAccidents",
  "deleteAccidents",
  "viewAccounting",
  "editPayments",
  "viewUsers",
  "createUsers",
  "editUsers",
  "deleteUsers",
  "viewActivityLog",
] as const;

export type PermissionField = (typeof PERMISSION_FIELDS)[number];

export type PermissionMap = Record<PermissionField, boolean>;

export const permissionLabels: Record<PermissionField, string> = {
  viewSubscribers: "عرض المشتركين",
  createSubscribers: "إضافة مشتركين",
  editSubscribers: "تعديل مشتركين",
  deleteSubscribers: "حذف مشتركين",
  viewAccidents: "عرض الحوادث",
  createAccidents: "إضافة حوادث",
  editAccidents: "تعديل حوادث",
  deleteAccidents: "حذف حوادث",
  viewAccounting: "عرض الحسابات",
  editPayments: "تعديل المدفوعات",
  viewUsers: "عرض المستخدمين",
  createUsers: "إضافة مستخدمين",
  editUsers: "تعديل مستخدمين",
  deleteUsers: "حذف مستخدمين",
  viewActivityLog: "عرض سجل النشاطات",
};

export function readPermissionsFromBody(body: Record<string, unknown>): PermissionMap {
  return Object.fromEntries(
    PERMISSION_FIELDS.map((field) => [field, Boolean(body[field])])
  ) as PermissionMap;
}

export function permissionSqlValues(permissions: PermissionMap) {
  return PERMISSION_FIELDS.map((field) => (permissions[field] ? 1 : 0));
}

export const defaultPermissions: PermissionMap = {
  viewSubscribers: true,
  createSubscribers: false,
  editSubscribers: false,
  deleteSubscribers: false,
  viewAccidents: true,
  createAccidents: false,
  editAccidents: false,
  deleteAccidents: false,
  viewAccounting: false,
  editPayments: false,
  viewUsers: false,
  createUsers: false,
  editUsers: false,
  deleteUsers: false,
  viewActivityLog: false,
};

export const builtInRoleTemplates: Array<{
  name: string;
  description: string;
  permissions: PermissionMap;
}> = [
  {
    name: "مدير النظام",
    description: "صلاحيات كاملة على كل الوحدات",
    permissions: Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true])) as PermissionMap,
  },
  {
    name: "موظف مبيعات",
    description: "مشتركين وصفقات ومهام بدون حذف",
    permissions: {
      ...defaultPermissions,
      viewSubscribers: true,
      createSubscribers: true,
      editSubscribers: true,
      viewAccidents: true,
      viewAccounting: true,
    },
  },
  {
    name: "محاسب",
    description: "حسابات وفواتير ومدفوعات",
    permissions: {
      ...defaultPermissions,
      viewSubscribers: true,
      viewAccounting: true,
      editPayments: true,
      viewActivityLog: true,
    },
  },
  {
    name: "دعم العملاء",
    description: "عرض ومتابعة بدون تعديل حساس",
    permissions: {
      ...defaultPermissions,
      viewSubscribers: true,
      viewAccidents: true,
      createAccidents: true,
      editAccidents: true,
    },
  },
];
