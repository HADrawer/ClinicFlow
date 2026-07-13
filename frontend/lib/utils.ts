export const cn=(...values:(string|false|null|undefined)[])=>values.filter(Boolean).join(" ");
export const money=(value:string|number)=>new Intl.NumberFormat("en-BH",{style:"currency",currency:"BHD",minimumFractionDigits:3}).format(Number(value));
export const dateTime=(value:string)=>new Intl.DateTimeFormat("en-BH",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
export const shortDate=(value:string)=>new Intl.DateTimeFormat("en-BH",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value));
export const titleCase=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

