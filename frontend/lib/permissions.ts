import type {Role,User} from "./types";

const rolePermissions:Record<Role,Set<string>>={
  owner:new Set(["*"]),
  doctor:new Set(["patients.read","patients.create","patients.update","appointments.read_own","appointments.manage_own","encounters.create","encounters.finalize","encounters.amend","prescriptions.create","orders.manage","referrals.manage","messages.create","documents.manage"]),
  receptionist:new Set(["patients.read","patients.create","patients.update","appointments.read_all","appointments.manage_all","queue.manage","waitlist.manage","billing.create","messages.create","consents.manage","documents.manage","quality.manage"]),
  accountant:new Set(["billing.create","claims.manage","reports.view"]),
  nurse:new Set(["patients.read","appointments.read_all","queue.manage","encounters.create","consents.manage","documents.manage","quality.manage"]),
  pharmacist:new Set(["patients.read","pharmacy.read","pharmacy.dispense","pharmacy.inventory_manage","pharmacy.purchase_manage"]),
};

/** UI affordance only. The API remains authoritative for every protected action. */
export function hasPermission(user:User|undefined|null,name:string){
  if(!user)return false;
  const inherited=rolePermissions[user.role]||new Set<string>();
  return inherited.has("*")||inherited.has(name)||(user.permissions||[]).includes(name);
}

export function hasAnyPermission(user:User|undefined|null,names:string[]){
  return names.some(name=>hasPermission(user,name));
}

/** Mirrors backend PERMISSION_CATALOG (app/dependencies.py). Every string here
 * gates a real endpoint via `permission(...)`; the API remains authoritative. */
export const PERMISSION_LABELS:Record<string,string>={
  "patients.read":"View patients","patients.create":"Create patients","patients.update":"Edit patients",
  "appointments.read_own":"View own appointments","appointments.manage_own":"Manage own appointments",
  "appointments.read_all":"View all appointments","appointments.manage_all":"Manage all appointments",
  "queue.manage":"Manage queue","waitlist.manage":"Manage waitlist",
  "encounters.create":"Create clinical records","encounters.finalize":"Finalize clinical records","encounters.amend":"Amend clinical records",
  "prescriptions.create":"Manage prescriptions","orders.manage":"Manage orders","referrals.manage":"Manage referrals","consents.manage":"Manage consents",
  "documents.manage":"Manage documents","messages.create":"Send messages",
  "billing.create":"Manage billing","claims.manage":"Manage insurance",
  "pharmacy.read":"View pharmacy","pharmacy.dispense":"Dispense pharmacy orders","pharmacy.inventory_manage":"Manage pharmacy inventory","pharmacy.purchase_manage":"Manage pharmacy purchasing",
  "quality.manage":"Manage quality records","reports.view":"View analytics",
  "staff.manage":"Manage staff","settings.manage":"Manage clinic settings",
};

export const PERMISSION_CATALOG:Record<string,string[]>={
  "Patients":["patients.read","patients.create","patients.update"],
  "Appointments & queue":["appointments.read_own","appointments.manage_own","appointments.read_all","appointments.manage_all","queue.manage","waitlist.manage"],
  "Clinical records":["encounters.create","encounters.finalize","encounters.amend","prescriptions.create","orders.manage","referrals.manage","consents.manage"],
  "Documents & messaging":["documents.manage","messages.create"],
  "Billing & insurance":["billing.create","claims.manage"],
  "Pharmacy":["pharmacy.read","pharmacy.dispense","pharmacy.inventory_manage","pharmacy.purchase_manage"],
  "Quality & reporting":["quality.manage","reports.view"],
  "Administration":["staff.manage","settings.manage"],
};
