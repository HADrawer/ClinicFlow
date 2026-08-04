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
