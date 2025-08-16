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
  // Enhanced parsing that works well with Gemini's structured output
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  // Extract email with improved regex
  const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i);
  
  // Extract phone with multiple format support
  const phonePatterns = [
    /\+?[1-9]\d{1,14}/, // International format
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/, // US format
    /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/, // US format without area code parens
    /\d{10,}/ // Simple long number
  ];
  
  let phoneMatch = null;
  for (const pattern of phonePatterns) {
    const match = text.replace(/[^\d+\s().-]/g, ' ').match(pattern);
    if (match) {
      phoneMatch = match[0].replace(/[^\d+]/g, '');
      if (phoneMatch.length >= 10) break;
    }
  }
  
  // Extract name - look for capitalized words that appear early and aren't email/phone/company indicators
  const namePatterns = [
    // Look for lines with 2-3 capitalized words
    /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/,
    // Look for lines with proper case names
    /^([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)$/
  ];
  
  let name = "";
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line && !line.includes('@') && !(/\d{3}/.test(line)) && !(/company|corp|inc|ltd|llc/i.test(line))) {
      for (const pattern of namePatterns) {
        const match = line.match(pattern);
        if (match) {
          name = match[1];
          break;
        }
      }
      if (name) break;
    }
  }
  
  // If no pattern match, try first non-company line
  if (!name) {
    name = lines.find(l => 
      l && 
      !l.includes('@') && 
      !(/\d{6,}/.test(l)) &&
      !(/company|corp|inc|ltd|llc|technologies|solutions|services|group/i.test(l)) &&
      l.split(' ').length <= 4 &&
      /^[A-Za-z\s.]+$/.test(l)
    ) || "";
  }
  
  // Extract company - look for business indicators
  const companyIndicators = /\b(company|corp|corporation|inc|incorporated|ltd|limited|llc|llp|technologies|tech|solutions|services|group|associates|partners|consulting|studio|agency|firm|enterprises|industries)\b/i;
  const company = lines.find(l => 
    l && 
    (companyIndicators.test(l) || 
     (/^[A-Z][A-Za-z\s&.,-]+$/.test(l) && l.length > (name?.length || 0) + 5))
  ) || "";
  
  // Extract services/role - look for job titles or service descriptions
  const serviceIndicators = /\b(manager|director|ceo|cto|founder|developer|designer|consultant|analyst|specialist|coordinator|executive|president|vice|senior|junior|lead|head|chief)\b/i;
  const services = lines.find(l => 
    l && 
    l !== name && 
    l !== company && 
    (serviceIndicators.test(l) || 
     /services|solutions|consulting|development|design|marketing/i.test(l))
  ) || "";
  
  // Extract address - typically longer lines with address indicators
  const addressIndicators = /\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|place|pl|court|ct|suite|ste|floor|building|city|state|zip|postal)\b/i;
  const addressLines = lines.filter(l => 
    l && 
    l !== name && 
    l !== company && 
    l !== services &&
    !l.includes('@') &&
    (addressIndicators.test(l) || /\d{5}/.test(l) || /,\s*[A-Z]{2}\s*\d/.test(l))
  );
  const address = addressLines.join(", ");
  
  return {
    name: name || undefined,
    company: company || undefined,
    phone: phoneMatch || undefined,
    email: emailMatch?.[0] || undefined,
    services: services || undefined,
    address: address || undefined
  };
}
