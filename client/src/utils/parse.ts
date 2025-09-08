export type ParsedContact = {
  name?: string;
  company?: string;
  phones?: string[];
  landlines?: string[];
  email?: string;
  services?: string;
  address?: string;
  website?: string;
  social?: string;
  qrCodes?: Array<{
    type: 'contact' | 'url' | 'text';
    data: string;
    extractedInfo?: any;
  }>;
};

function extractPhoneNumbers(text: string): string[] {
  // A more comprehensive regex for phone numbers
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{2,5}[-.\s]?\d{2,5}[-.\s]?\d{2,5}/g;
  
  // Normalize text to improve matching
  const normalizedText = text.replace(/o/gi, '0').replace(/[l]/gi, '1');
  
  const matches = normalizedText.match(phoneRegex);

  if (!matches) {
    return [];
  }

  const uniquePhones = new Set<string>();
  matches.forEach(match => {
    // Clean the number by removing all non-digit characters, except for a potential leading '+'
    let cleaned = match.replace(/[^\d+]/g, '');
    
    // Remove leading '0' if a country code is likely present
    if (cleaned.startsWith('0') && cleaned.length > 10) {
      cleaned = cleaned.substring(1);
    }
    
    // Basic validation for length
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      uniquePhones.add(cleaned);
    }
  });

  return Array.from(uniquePhones);
}

export function parseOcrToContact(text: string): ParsedContact {
  // Enhanced parsing that works well with Gemini's structured output
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  // Extract email with improved regex
  const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i);
  
  // Use the new robust phone number extraction
  const phoneMatches = extractPhoneNumbers(text);
  
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
    phones: phoneMatches.length > 0 ? phoneMatches : undefined,
    email: emailMatch?.[0] || undefined,
    services: services || undefined,
    address: address || undefined
  };
}
