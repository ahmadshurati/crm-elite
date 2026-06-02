import { execute } from "@/lib/db";
import { hashPassword } from "@/lib/password";

type SeedUser = {
  username: string;
  password: string;
  role: "master" | "user";
  permissions: Record<string, boolean>;
};

function bool(value: boolean) {
  return value ? 1 : 0;
}

function readSeedUsers(): SeedUser[] {
  if (process.env.SEED_USERS !== "true") {
    return [];
  }

  const users: SeedUser[] = [];

  const masterUsername = String(process.env.SEED_MASTER_USERNAME || "").trim().toLowerCase();
  const masterPassword = String(process.env.SEED_MASTER_PASSWORD || "").trim();

  if (masterUsername && masterPassword) {
    users.push({
      username: masterUsername,
      password: masterPassword,
      role: "master",
      permissions: {
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
      },
    });
  }

  const userUsername = String(process.env.SEED_USER_USERNAME || "").trim().toLowerCase();
  const userPassword = String(process.env.SEED_USER_PASSWORD || "").trim();

  if (userUsername && userPassword) {
    users.push({
      username: userUsername,
      password: userPassword,
      role: "user",
      permissions: {
        viewSubscribers: true,
        createSubscribers: true,
        editSubscribers: true,
        deleteSubscribers: false,
        viewAccidents: true,
        createAccidents: true,
        editAccidents: true,
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

  return users;
}

export async function ensureSeedUsersFromEnv() {
  const users = readSeedUsers();

  for (const user of users) {
    const hashedPassword = await hashPassword(user.password);

    await execute(
      `INSERT INTO AppUser (
        username, password, role, isActive,
        viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
        viewAccidents, createAccidents, editAccidents, deleteAccidents,
        viewAccounting, editPayments,
        viewUsers, createUsers, editUsers, deleteUsers,
        viewActivityLog, createdAt, updatedAt
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE username = username`,
      [
        user.username,
        hashedPassword,
        user.role,
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
