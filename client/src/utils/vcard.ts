export function buildVCard(profile: {
  firstName?: string; 
  lastName?: string; 
  title?: string; 
  company?: string;
  email?: string; 
  phone?: string; 
  website?: string; 
  address?: string;
}) {
  const fn = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const n = `${profile.lastName || ""};${profile.firstName || ""};;;`;
  const org = profile.company || "";
  const title = profile.title || "";
  const tel = profile.phone || "";
  const email = profile.email || "";
  const url = profile.website || "";
  const adr = profile.address ? `;;${profile.address.replace(/\n/g,";")}` : ";;;;;";
  
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fn}`,
    `N:${n}`,
    `ORG:${org}`,
    `TITLE:${title}`,
    tel ? `TEL;TYPE=CELL:${tel}` : null,
    email ? `EMAIL:${email}` : null,
    url ? `URL:${url}` : null,
    `ADR:${adr}`,
    "END:VCARD"
  ].filter(Boolean).join("\n");
}
