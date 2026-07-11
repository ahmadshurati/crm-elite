import { execute } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { DEFAULT_SETTINGS } from "@/lib/crm/settings-defaults";
import { DEMO_COMPANY_SLUG, PLATFORM_OWNER_ROLE } from "@/lib/tenant";

type SeedUser = {
  username: string;
  password: string;
  role: "platform_owner" | "master" | "user";
  companyId?: number | null;
  permissions: Record<string, boolean>;
};

function bool(value: boolean) {
  return value ? 1 : 0;
}

const fullPermissions = {
  viewSubscribers: true,
  createSubscribers: true,
  editSubscribers: true,
  deleteSubscribers: true,
  viewAccidents: true,
  createAccidents: true,
  editAccidents: true,
  deleteAccidents: true,
  viewAccounting: true,
  editPayments: true,
  viewUsers: true,
  createUsers: true,
  editUsers: true,
  deleteUsers: true,
  viewActivityLog: true,
};

const demoPermissions = {
  viewSubscribers: true,
  createSubscribers: true,
  editSubscribers: true,
  deleteSubscribers: false,
  viewAccidents: true,
  createAccidents: true,
  editAccidents: true,
  deleteAccidents: false,
  viewAccounting: true,
  editPayments: false,
  viewUsers: false,
  createUsers: false,
  editUsers: false,
  deleteUsers: false,
  viewActivityLog: false,
};

function readSeedUsers(): SeedUser[] {
  if (process.env.SEED_USERS !== "true") {
    return [];
  }

  const users: SeedUser[] = [];

  const ownerUsername = String(process.env.SEED_OWNER_USERNAME || process.env.SEED_MASTER_USERNAME || "").trim().toLowerCase();
  const ownerPassword = String(process.env.SEED_OWNER_PASSWORD || process.env.SEED_MASTER_PASSWORD || "").trim();

  if (ownerUsername && ownerPassword) {
    users.push({
      username: ownerUsername,
      password: ownerPassword,
      role: PLATFORM_OWNER_ROLE,
      companyId: null,
      permissions: fullPermissions,
    });
  }

  const masterUsername = String(process.env.SEED_MASTER_USERNAME || "").trim().toLowerCase();
  const masterPassword = String(process.env.SEED_MASTER_PASSWORD || "").trim();

  if (masterUsername && masterPassword && masterUsername !== ownerUsername) {
    users.push({
      username: masterUsername,
      password: masterPassword,
      role: "master",
      companyId: 1,
      permissions: fullPermissions,
    });
  }

  const userUsername = String(process.env.SEED_USER_USERNAME || "").trim().toLowerCase();
  const userPassword = String(process.env.SEED_USER_PASSWORD || "").trim();

  if (userUsername && userPassword) {
    users.push({
      username: userUsername,
      password: userPassword,
      role: "user",
      companyId: 1,
      permissions: {
        ...fullPermissions,
        deleteSubscribers: false,
        deleteAccidents: false,
        viewAccounting: false,
        editPayments: false,
        viewUsers: false,
        createUsers: false,
        editUsers: false,
        deleteUsers: false,
        viewActivityLog: false,
      },
    });
  }

  const demoUsername = String(process.env.SEED_DEMO_USERNAME || "demo").trim().toLowerCase();
  const demoPassword = String(process.env.SEED_DEMO_PASSWORD || "demo1234").trim();

  if (demoUsername && demoPassword) {
    users.push({
      username: demoUsername,
      password: demoPassword,
      role: "user",
      companyId: 2,
      permissions: demoPermissions,
    });
  }

  return users;
}

async function ensureCompaniesExist() {
  await execute(
    `INSERT INTO Company (id, name, slug, isActive, isDemo, createdAt, updatedAt)
     VALUES (1, 'Elite Insurance', 'elite-insurance', 1, 0, NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name)`
  );
  await execute(
    `INSERT INTO Company (id, name, slug, isActive, isDemo, notes, createdAt, updatedAt)
     VALUES (2, 'Gosol CRM — عرض تجريبي', ?, 1, 1, 'حساب تجريبي CRM شامل للعروض التقديمية', NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), notes = VALUES(notes), isDemo = 1`,
    [DEMO_COMPANY_SLUG]
  );

  await execute(
    `INSERT INTO SystemSetting (companyId, companyName, currency, language, timezone, dateFormat, defaultTaxRate, updatedAt)
     VALUES (1, 'Elite Insurance', ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE companyName = VALUES(companyName), updatedAt = NOW()`,
    [
      DEFAULT_SETTINGS.currency,
      DEFAULT_SETTINGS.language,
      DEFAULT_SETTINGS.timezone,
      DEFAULT_SETTINGS.dateFormat,
      DEFAULT_SETTINGS.defaultTaxRate,
    ]
  );

  await execute(
    `INSERT INTO SystemSetting (companyId, companyName, logoUrl, currency, language, timezone, dateFormat, defaultTaxRate, updatedAt)
     VALUES (2, 'Gosol CRM', '/gosol-crm-logo.svg', ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE companyName = VALUES(companyName), logoUrl = VALUES(logoUrl), updatedAt = NOW()`,
    [
      DEFAULT_SETTINGS.currency,
      DEFAULT_SETTINGS.language,
      DEFAULT_SETTINGS.timezone,
      DEFAULT_SETTINGS.dateFormat,
      DEFAULT_SETTINGS.defaultTaxRate,
    ]
  );
}

export async function ensureSeedUsersFromEnv() {
  await ensureCompaniesExist();
  const users = readSeedUsers();

  for (const user of users) {
    const hashedPassword = await hashPassword(user.password);

    await execute(
      `INSERT INTO AppUser (
        username, password, role, isActive, companyId,
        viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
        viewAccidents, createAccidents, editAccidents, deleteAccidents,
        viewAccounting, editPayments,
        viewUsers, createUsers, editUsers, deleteUsers,
        viewActivityLog, createdAt, updatedAt
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        role = VALUES(role),
        companyId = VALUES(companyId),
        isActive = 1,
        viewSubscribers = VALUES(viewSubscribers),
        createSubscribers = VALUES(createSubscribers),
        editSubscribers = VALUES(editSubscribers),
        deleteSubscribers = VALUES(deleteSubscribers),
        viewAccidents = VALUES(viewAccidents),
        createAccidents = VALUES(createAccidents),
        editAccidents = VALUES(editAccidents),
        deleteAccidents = VALUES(deleteAccidents),
        viewAccounting = VALUES(viewAccounting),
        editPayments = VALUES(editPayments),
        viewUsers = VALUES(viewUsers),
        createUsers = VALUES(createUsers),
        editUsers = VALUES(editUsers),
        deleteUsers = VALUES(deleteUsers),
        viewActivityLog = VALUES(viewActivityLog),
        updatedAt = NOW()`,
      [
        user.username,
        hashedPassword,
        user.role,
        user.companyId,
        bool(user.permissions.viewSubscribers),
        bool(user.permissions.createSubscribers),
        bool(user.permissions.editSubscribers),
        bool(user.permissions.deleteSubscribers),
        bool(user.permissions.viewAccidents),
        bool(user.permissions.createAccidents),
        bool(user.permissions.editAccidents),
        bool(user.permissions.deleteAccidents),
        bool(user.permissions.viewAccounting),
        bool(user.permissions.editPayments),
        bool(user.permissions.viewUsers),
        bool(user.permissions.createUsers),
        bool(user.permissions.editUsers),
        bool(user.permissions.deleteUsers),
        bool(user.permissions.viewActivityLog),
      ]
    );
  }
}
