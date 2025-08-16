export type ParsedContact = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  services?: string;
  address?: string;
  qr?: string;
};

export function parseOcrToContact(text: string): ParsedContact {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.replace(/[\s\-().]/g,'').match(/(\+?\d{10,15})/);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // heuristics: first non-email/phone line w/ capitalized words ~ name
  const likelyName = lines.find(l => !l.toLowerCase().includes("phone") && !l.includes("@") && l.split(' ').every(w => /^[A-Za-z.&-]+$/.test(w)));
  const company = lines.find(l => /pvt|ltd|llp|inc|co\.|company|studio|technolog|solutions|industr/i.test(l)) ?? lines[1];

  // very lightweight
  const servicesIdx = lines.findIndex(l => /services|what we do|offerings/i.test(l));
  const services = servicesIdx >= 0 ? lines.slice(servicesIdx).join(", ") : undefined;

  // address: last 2–5 lines w/ commas & numbers
  const addrLines = lines.slice(-5).filter(l => /[,0-9]/.test(l));
  const address = addrLines.join(", ");

  return {
    name: likelyName,
    company,
    phone: phoneMatch?.[1],
    email: emailMatch?.[0],
    services,
    address
  };
}
