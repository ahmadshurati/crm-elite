import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";

export type CurrentUser = {
  id: number;
  username: string;
  password: string;
  role: string;
  isActive: boolean | number;
  viewSubscribers: boolean | number;
  createSubscribers: boolean | number;
  editSubscribers: boolean | number;
  deleteSubscribers: boolean | number;
  viewAccidents: boolean | number;
  createAccidents: boolean | number;
  editAccidents: boolean | number;
  deleteAccidents: boolean | number;
  viewAccounting: boolean | number;
  editPayments: boolean | number;
  viewUsers: boolean | number;
  createUsers: boolean | number;
  editUsers: boolean | number;
  deleteUsers: boolean | number;
  viewActivityLog: boolean | number;
};

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get("elite_user_id")?.value || 0);

  if (!userId) return null;

  return queryOne<CurrentUser>("SELECT * FROM AppUser WHERE id = ? LIMIT 1", [userId]);
}

export function cleanUser(user: any) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}
