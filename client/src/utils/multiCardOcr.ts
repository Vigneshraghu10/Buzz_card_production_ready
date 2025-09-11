import type { ParsedContact } from "./parse";
import QrScanner from 'qr-scanner';

// Get API key from environment variables
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export interface MultiCardResult {
  cards: ParsedContact[];
  totalProcessed: number;
  errors: string[];
  qrCodesFound: number;
}

interface QRCodeData {
  type: 'contact' | 'url' | 'text';
  data: string;
  extractedInfo?: any;
  position?: { x: number; y: number; width: number; height: number };
}

/**
 * Convert file to base64 with proper format detection and optimization
 */
const getFileAsBase64 = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(new Error('Failed to read file: ' + error));
    reader.readAsDataURL(file);
  });
};

/**
 * Enhanced QR code extraction with better error handling and multiple format support
 */
async function extractQRCodes(file: File): Promise<QRCodeData[]> {
  try {
    const qrCodes: QRCodeData[] = [];
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    
    return new Promise((resolve) => {
      img.onload = async () => {
        try {
          // Try multiple scanning approaches for better detection
          const scanOptions = [
            { returnDetailedScanResult: true },
            { returnDetailedScanResult: true, highlightScanRegion: true },
            { returnDetailedScanResult: true, highlightCodeOutline: true }
          ];

          for (const options of scanOptions) {
            try {
              const qrResult = await QrScanner.scanImage(img, options);
              
              if (qrResult?.data) {
                const qrData = qrResult.data;
                let qrInfo: QRCodeData = {
                  type: 'text',
                  data: qrData
                };

                // Enhanced QR code type detection and parsing
                if (qrData.startsWith('BEGIN:VCARD')) {
                  qrInfo.type = 'contact';
                  qrInfo.extractedInfo = parseVCard(qrData);
                } else if (qrData.startsWith('MECARD:')) {
                  qrInfo.type = 'contact';
                  qrInfo.extractedInfo = parseMeCard(qrData);
                } else if (/^https?:\/\//.test(qrData)) {
                  qrInfo.type = 'url';
                  qrInfo.extractedInfo = { url: qrData };
                } else if (qrData.includes('tel:') || qrData.includes('mailto:') || 
                          /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/.test(qrData)) {
                  qrInfo.type = 'contact';
                  qrInfo.extractedInfo = extractContactFromText(qrData);
                }

                // Add position if available
                if ('corner' in qrResult) {
                  qrInfo.position = {
                    x: Math.min(...qrResult.corner.map((p: any) => p.x)),
                    y: Math.min(...qrResult.corner.map((p: any) => p.y)),
                    width: Math.max(...qrResult.corner.map((p: any) => p.x)) - Math.min(...qrResult.corner.map((p: any) => p.x)),
                    height: Math.max(...qrResult.corner.map((p: any) => p.y)) - Math.min(...qrResult.corner.map((p: any) => p.y))
                  };
                }

                qrCodes.push(qrInfo);
                break; // Found QR code, no need to try other options
              }
            } catch (scanError) {
              console.log(`QR scan attempt failed:`, scanError);
              continue;
            }
          }
        } catch (error) {
          console.log('QR code extraction error:', error);
        }
        
        URL.revokeObjectURL(imageUrl);
        resolve(qrCodes);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        resolve(qrCodes);
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('QR Code extraction error:', error);
    return [];
  }
}

/**
 * Enhanced vCard parser with better field handling
 */
function parseVCard(vCardData: string): any {
  const lines = vCardData.split(/\r?\n/);
  const contact: any = {};
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('BEGIN:') || 
        trimmedLine.startsWith('END:') || trimmedLine.startsWith('VERSION:')) continue;
    
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;
    
    const keyPart = trimmedLine.substring(0, colonIndex).trim();
    const value = trimmedLine.substring(colonIndex + 1).trim();
    
    if (!value) continue;
    
    // Parse key and parameters
    const [key, ...params] = keyPart.split(';');
    const keyUpper = key.toUpperCase();
    
    switch (keyUpper) {
      case 'FN':
        contact.name = decodeVCardValue(value);
        break;
      case 'N':
        // Parse structured name (Family;Given;Additional;Prefix;Suffix)
        const nameParts = value.split(';').map(decodeVCardValue);
        const lastName = nameParts[0] || '';
        const firstName = nameParts[1] || '';
        const middleName = nameParts[2] || '';
        const prefix = nameParts[3] || '';
        const suffix = nameParts[4] || '';
        
        const fullName = [prefix, firstName, middleName, lastName, suffix]
          .filter(part => part.trim()).join(' ').trim();
        if (fullName && !contact.name) contact.name = fullName;
        break;
      case 'ORG':
        contact.company = decodeVCardValue(value);
        break;
      case 'EMAIL':
        if (!contact.email) contact.email = decodeVCardValue(value).toLowerCase();
        break;
      case 'TEL':
        if (!contact.phones) contact.phones = [];
        const cleanPhone = normalizePhoneNumber(decodeVCardValue(value));
        if (cleanPhone && !contact.phones.includes(cleanPhone)) {
          contact.phones.push(cleanPhone);
        }
        break;
      case 'URL':
        if (!contact.website) contact.website = decodeVCardValue(value);
        break;
      case 'ADR':
        // Parse structured address
        const addressParts = value.split(';').map(decodeVCardValue).filter(part => part.trim());
        if (addressParts.length > 0) contact.address = addressParts.join(', ');
        break;
      case 'TITLE':
        if (!contact.services) contact.services = decodeVCardValue(value);
        break;
      case 'ROLE':
        if (!contact.services) contact.services = decodeVCardValue(value);
        break;
      case 'NOTE':
        if (!contact.services && value) contact.services = decodeVCardValue(value);
        break;
    }
  }
  
  return contact;
}

/**
 * Enhanced MeCard parser
 */
function parseMeCard(meCardData: string): any {
  const contact: any = {};
  
  try {
    // Clean and parse MeCard format
    const cleanData = meCardData.replace('MECARD:', '');
    const fields = cleanData.split(';');
    
    for (const field of fields) {
      const trimmedField = field.trim();
      if (!trimmedField) continue;
      
      const colonIndex = trimmedField.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmedField.substring(0, colonIndex).trim().toUpperCase();
      const value = trimmedField.substring(colonIndex + 1).trim();
      
      if (!value) continue;
      
      switch (key) {
        case 'N':
          // Parse name (lastname,firstname)
          const nameParts = value.split(',');
          const lastName = nameParts[0]?.trim() || '';
          const firstName = nameParts[1]?.trim() || '';
          contact.name = `${firstName} ${lastName}`.trim();
          break;
        case 'ORG':
          contact.company = value;
          break;
        case 'EMAIL':
          contact.email = value.toLowerCase();
          break;
        case 'TEL':
          if (!contact.phones) contact.phones = [];
          const phone = normalizePhoneNumber(value);
          if (phone) contact.phones.push(phone);
          break;
        case 'URL':
          contact.website = value;
          break;
        case 'ADR':
          contact.address = value;
          break;
        case 'NOTE':
          contact.services = value;
          break;
      }
    }
  } catch (error) {
    console.error('MeCard parsing error:', error);
  }
  
  return contact;
}

/**
 * Enhanced contact extraction from plain text
 */
function extractContactFromText(text: string): any {
  const contact: any = {};
  
  try {
    // Extract phone numbers with better regex
    const phoneRegex = /(?:(?:\+|00)[1-9]\d{0,3}[-.\s]?)?(?:\(?\d{1,4}\)?[-.\s]?)?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const phones = text.match(phoneRegex)?.map(normalizePhoneNumber).filter(Boolean);
    if (phones && phones.length > 0) contact.phones = [...new Set(phones)];
    
    // Extract email addresses
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) contact.email = emails[0].toLowerCase();
    
    // Extract URLs
    const urlRegex = /https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/g;
    const urls = text.match(urlRegex);
    if (urls && urls.length > 0) contact.website = urls[0];
    
    // Handle tel: and mailto: schemes
    if (text.includes('tel:')) {
      const telMatch = text.match(/tel:([\d+\-\s()]+)/);
      if (telMatch) {
        const phone = normalizePhoneNumber(telMatch[1]);
        if (phone) {
          if (!contact.phones) contact.phones = [];
          contact.phones.push(phone);
        }
      }
    }
    
    if (text.includes('mailto:')) {
      const mailtoMatch = text.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (mailtoMatch && !contact.email) {
        contact.email = mailtoMatch[1].toLowerCase();
      }
    }
  } catch (error) {
    console.error('Text extraction error:', error);
  }
  
  return contact;
}

/**
 * Decode vCard encoded values (handle quoted-printable, etc.)
 */
function decodeVCardValue(value: string): string {
  // Handle basic vCard escaping
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Normalize phone numbers to a consistent format
 */
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle different international formats
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  // Validate minimum length
  if (cleaned.replace(/\+/, '').length < 7) return '';
  
  return cleaned;
}

/**
 * Enhanced phone number categorization with international support
 */
function categorizePhoneNumbers(phones: string[]): { phones: string[]; landlines: string[] } {
  const mobilePhones: string[] = [];
  const landlines: string[] = [];
  
  for (const phone of phones) {
    const cleaned = normalizePhoneNumber(phone);
    if (!cleaned) continue;
    
    const digitsOnly = cleaned.replace(/\+/, '');
    
    // Enhanced mobile detection logic
    let isMobile = false;
    
    if (cleaned.startsWith('+1')) {
      // US/Canada - more sophisticated detection needed
      isMobile = digitsOnly.length === 11;
    } else if (cleaned.startsWith('+91')) {
      // India - mobile numbers start with 6-9
      const firstDigit = digitsOnly.charAt(2);
      isMobile = digitsOnly.length === 12 && /[6-9]/.test(firstDigit);
    } else if (cleaned.startsWith('+44')) {
      // UK - mobile numbers start with 7
      const thirdDigit = digitsOnly.charAt(2);
      isMobile = thirdDigit === '7';
    } else if (cleaned.startsWith('+49')) {
      // Germany - mobile numbers start with 15, 16, 17
      const prefix = digitsOnly.substring(2, 4);
      isMobile = ['15', '16', '17'].includes(prefix);
    } else if (cleaned.length >= 10 && cleaned.length <= 15) {
      // Generic international mobile detection
      isMobile = cleaned.startsWith('+');
    } else if (!cleaned.startsWith('+') && digitsOnly.length === 10) {
      // Domestic numbers - basic heuristic
      const firstDigit = digitsOnly.charAt(0);
      isMobile = /[6-9]/.test(firstDigit);
    }
    
    if (isMobile) {
      mobilePhones.push(phone);
    } else {
      landlines.push(phone);
    }
  }
  
  return { phones: mobilePhones, landlines };
}

/**
 * Clean and validate extracted text fields
 */
function cleanExtractedField(value: any, type: 'text' | 'email' | 'url' | 'phone' = 'text'): string {
  if (!value) return '';
  
  let cleaned = value.toString().trim();
  
  switch (type) {
    case 'email':
      cleaned = cleaned.toLowerCase();
      // Validate email format
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) {
        return '';
      }
      break;
    case 'url':
      // Ensure URL has protocol
      if (cleaned && !cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
      }
      break;
    case 'phone':
      cleaned = normalizePhoneNumber(cleaned);
      break;
  }
  
  return cleaned;
}

/**
 * Enhanced Gemini API call with improved prompting and error handling
 */
export async function processMultipleBusinessCards(file: File): Promise<MultiCardResult> {
  console.log('Starting enhanced multi-card processing...');
  
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not found. Please set VITE_GEMINI_API_KEY environment variable.");
  }

  const errors: string[] = [];
  const cards: ParsedContact[] = [];

  try {
    // Extract QR codes first
    console.log('Extracting QR codes...');
    const qrCodes = await extractQRCodes(file);
    console.log(`Found ${qrCodes.length} QR codes`);

    // Convert image to base64
    const { base64, mimeType } = await getFileAsBase64(file);

    // Enhanced prompt with better instructions
    const prompt = `
Analyze this image that may contain one or more business cards. Extract information from EACH business card you can identify and return a JSON array.

IMPORTANT INSTRUCTIONS:
- Look carefully for multiple business cards in the image (side by side, overlapping, etc.)
- Extract text accurately, don't hallucinate information
- Pay special attention to phone numbers, emails, and names
- Distinguish between mobile phones and landlines when possible
- Clean up any OCR artifacts or unclear text

For each business card found, return this JSON structure:

[
  {
    "cardNumber": 1,
    "name": "Full name (first and last name)",
    "company": "Company or organization name",
    "email": "email@domain.com",
    "phones": ["mobile numbers only"],
    "landlines": ["landline numbers only"],
    "services": "Job title, position, or services description",
    "address": "Complete address with street, city, state/province, postal code",
    "website": "Website URL (include https://)",
    "social": "Social media handles or other contact info",
    "confidence": "high|medium|low - your confidence in the extraction"
  }
]

RULES:
- Return a JSON array even for single cards
- Use empty arrays [] for missing phones/landlines
- Use empty string "" for missing text fields  
- Separate mobile and landline numbers correctly
- Include country codes when visible
- Extract complete, properly formatted addresses
- Don't guess or make up information
- Number cards starting from 1
- Be conservative with confidence ratings
`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('Calling Gemini API for enhanced multi-card detection...');
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error Response:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Gemini API response received');
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('Invalid response from Gemini API - no content found');
    }

    const extractedText = result.candidates[0].content.parts[0].text;
    console.log('Raw API response:', extractedText);
    
    // Enhanced JSON extraction
    let jsonText = extractedText.trim();
    
    // Remove markdown code blocks
    jsonText = jsonText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON array - try multiple patterns
    let jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Try finding JSON object and wrapping in array
      const objectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = `[${objectMatch[0]}]`;
      } else {
        throw new Error('No valid JSON found in API response');
      }
    } else {
      jsonText = jsonMatch[0];
    }

    try {
      const parsedCards = JSON.parse(jsonText) as any[];
      
      // Process each detected card
      for (let i = 0; i < parsedCards.length; i++) {
        const cardData = parsedCards[i];
        
        try {
          // Enhanced data cleaning and validation
          const cleanedCard: ParsedContact = {};

          // Clean text fields
          if (cardData.name) cleanedCard.name = cleanExtractedField(cardData.name, 'text');
          if (cardData.company) cleanedCard.company = cleanExtractedField(cardData.company, 'text');
          if (cardData.email) {
            const cleanEmail = cleanExtractedField(cardData.email, 'email');
            if (cleanEmail) cleanedCard.email = cleanEmail;
          }
          if (cardData.services) cleanedCard.services = cleanExtractedField(cardData.services, 'text');
          if (cardData.address) cleanedCard.address = cleanExtractedField(cardData.address, 'text');
          if (cardData.website) {
            const cleanWebsite = cleanExtractedField(cardData.website, 'url');
            if (cleanWebsite) cleanedCard.website = cleanWebsite;
          }
          if (cardData.social) cleanedCard.social = cleanExtractedField(cardData.social, 'text');

          // Process and categorize phone numbers
          const allPhones: string[] = [];
          
          if (Array.isArray(cardData.phones)) {
            allPhones.push(...cardData.phones.map((p: any) => cleanExtractedField(p, 'phone')).filter(Boolean));
          }
          if (Array.isArray(cardData.landlines)) {
            allPhones.push(...cardData.landlines.map((p: any) => cleanExtractedField(p, 'phone')).filter(Boolean));
          }
          
          if (allPhones.length > 0) {
            const { phones, landlines } = categorizePhoneNumbers(allPhones);
            if (phones.length > 0) cleanedCard.phones = phones;
            if (landlines.length > 0) cleanedCard.landlines = landlines;
          }

          // Merge QR code data if available and relevant
          if (qrCodes.length > 0) {
            cleanedCard.qrCodes = qrCodes;
            
            for (const qr of qrCodes) {
              if (qr.type === 'contact' && qr.extractedInfo) {
                const qrContact = qr.extractedInfo;
                
                // Only merge if current field is empty or QR data seems more complete
                if (qrContact.name && !cleanedCard.name) cleanedCard.name = qrContact.name;
                if (qrContact.company && !cleanedCard.company) cleanedCard.company = qrContact.company;
                if (qrContact.email && !cleanedCard.email) cleanedCard.email = qrContact.email.toLowerCase();
                if (qrContact.website && !cleanedCard.website) cleanedCard.website = qrContact.website;
                if (qrContact.address && !cleanedCard.address) cleanedCard.address = qrContact.address;
                if (qrContact.services && !cleanedCard.services) cleanedCard.services = qrContact.services;
                
                // Merge phone numbers
                if (qrContact.phones && Array.isArray(qrContact.phones)) {
                  const { phones: qrPhones, landlines: qrLandlines } = categorizePhoneNumbers(qrContact.phones);
                  if (qrPhones.length > 0) {
                    cleanedCard.phones = [...new Set([...(cleanedCard.phones || []), ...qrPhones])];
                  }
                  if (qrLandlines.length > 0) {
                    cleanedCard.landlines = [...new Set([...(cleanedCard.landlines || []), ...qrLandlines])];
                  }
                }
              }
            }
          }

          // Final validation - only add card if it has substantial information
          const hasSubstantialInfo = cleanedCard.name || cleanedCard.company || 
                                   cleanedCard.email || cleanedCard.phones || cleanedCard.landlines;
          
          if (hasSubstantialInfo) {
            // Remove empty fields
            Object.keys(cleanedCard).forEach(key => {
              const value = cleanedCard[key as keyof ParsedContact];
              if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
                delete cleanedCard[key as keyof ParsedContact];
              }
            });

            cards.push(cleanedCard);
            console.log(`Successfully processed card ${i + 1}:`, cleanedCard);
          } else {
            errors.push(`Card ${i + 1} skipped - insufficient information extracted`);
          }
          
        } catch (cardError: any) {
          const errorMsg = `Error processing card ${i + 1}: ${cardError.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
    } catch (parseError: any) {
      console.error('JSON parsing error:', parseError);
      console.error('Failed to parse text:', jsonText);
      throw new Error(`Failed to parse extracted card data: ${parseError.message}. Please try with a clearer image.`);
    }

  } catch (error: any) {
    console.error('Multi-card OCR Error:', error);
    const errorMsg = `Processing failed: ${error.message}`;
    errors.push(errorMsg);
    
    if (cards.length === 0) {
      throw error; // Re-throw if no cards were processed
    }
  }

  return {
    cards,
    totalProcessed: cards.length,
    errors,
    qrCodesFound: await extractQRCodes(file).then(codes => codes.length)
  };
}

/**
 * Enhanced file validation with better error messages
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  const maxSize = 15 * 1024 * 1024; // 15MB for high-res multi-card images
  const minSize = 1024; // 1KB minimum
  
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error(`Invalid file type: ${file.type}. Please upload JPG, PNG, GIF, WebP, or BMP images.`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 15MB.`);
  }
  
  if (file.size < minSize) {
    throw new Error(`File too small: ${file.size} bytes. Minimum size is 1KB.`);
  }
  
  return true;
}

/**
 * Utility function to merge duplicate contacts
 */
export function mergeDuplicateContacts(contacts: ParsedContact[]): ParsedContact[] {
  const merged: ParsedContact[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < contacts.length; i++) {
    if (processed.has(i)) continue;
    
    const contact = { ...contacts[i] };
    processed.add(i);
    
    // Look for duplicates
    for (let j = i + 1; j < contacts.length; j++) {
      if (processed.has(j)) continue;
      
      const other = contacts[j];
      const isSimilar = 
        (contact.email && other.email && contact.email === other.email) ||
        (contact.name && other.name && 
         contact.name.toLowerCase().replace(/\s+/g, ' ') === 
         other.name.toLowerCase().replace(/\s+/g, ' ')) ||
        (contact.phones && other.phones && 
         contact.phones.some(p => other.phones?.includes(p)));
      
      if (isSimilar) {
        // Merge the contacts
        if (!contact.name && other.name) contact.name = other.name;
        if (!contact.company && other.company) contact.company = other.company;
        if (!contact.email && other.email) contact.email = other.email;
        if (!contact.website && other.website) contact.website = other.website;
        if (!contact.address && other.address) contact.address = other.address;
        if (!contact.services && other.services) contact.services = other.services;
        if (!contact.social && other.social) contact.social = other.social;
        
        if (other.phones) {
          contact.phones = [...new Set([...(contact.phones || []), ...other.phones])];
        }
        if (other.landlines) {
          contact.landlines = [...new Set([...(contact.landlines || []), ...other.landlines])];
        }
        if (other.qrCodes) {
          contact.qrCodes = [...(contact.qrCodes || []), ...other.qrCodes];
        }
        
        processed.add(j);
      }
    }
    
    merged.push(contact);
  }
  
  return merged;
}

/**
 * Advanced image preprocessing for better OCR accuracy
 */
export async function preprocessImageForOCR(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (!ctx) {
          resolve(file);
          return;
        }
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply image enhancement filters
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale with better contrast
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          
          // Apply contrast enhancement
          const contrast = 1.2;
          const enhanced = Math.min(255, Math.max(0, contrast * (gray - 128) + 128));
          
          // Apply brightness adjustment
          const brightness = enhanced > 128 ? enhanced * 1.1 : enhanced * 0.9;
          const final = Math.min(255, Math.max(0, brightness));
          
          data[i] = final;     // Red
          data[i + 1] = final; // Green
          data[i + 2] = final; // Blue
          // Alpha channel stays the same
        }
        
        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert back to file
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], file.name, {
              type: 'image/png',
              lastModified: Date.now()
            });
            resolve(processedFile);
          } else {
            resolve(file);
          }
        }, 'image/png', 0.95);
        
      } catch (error) {
        console.log('Image preprocessing failed, using original:', error);
        resolve(file);
      }
    };
    
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Batch processing for multiple files
 */
export async function processBatchBusinessCards(files: File[]): Promise<{
  results: MultiCardResult[];
  totalCards: number;
  totalErrors: string[];
  processingTime: number;
}> {
  const startTime = Date.now();
  const results: MultiCardResult[] = [];
  const totalErrors: string[] = [];
  let totalCards = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
    
    try {
      validateImageFile(file);
      
      // Optionally preprocess image for better results
      const preprocessedFile = await preprocessImageForOCR(file);
      const result = await processMultipleBusinessCards(preprocessedFile);
      
      results.push(result);
      totalCards += result.totalProcessed;
      totalErrors.push(...result.errors);
      
    } catch (error: any) {
      const errorMsg = `Failed to process ${file.name}: ${error.message}`;
      console.error(errorMsg);
      totalErrors.push(errorMsg);
      
      // Add empty result for failed file
      results.push({
        cards: [],
        totalProcessed: 0,
        errors: [errorMsg],
        qrCodesFound: 0
      });
    }
  }
  
  const processingTime = Date.now() - startTime;
  
  return {
    results,
    totalCards,
    totalErrors,
    processingTime
  };
}

/**
 * Export contacts to various formats
 */
export class ContactExporter {
  /**
   * Export to VCF (vCard) format
   */
  static toVCF(contacts: ParsedContact[]): string {
    return contacts.map(contact => {
      const vcard = ['BEGIN:VCARD', 'VERSION:3.0'];
      
      if (contact.name) {
        vcard.push(`FN:${contact.name}`);
        const nameParts = contact.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        vcard.push(`N:${lastName};${firstName};;;`);
      }
      
      if (contact.company) vcard.push(`ORG:${contact.company}`);
      if (contact.services) vcard.push(`TITLE:${contact.services}`);
      if (contact.email) vcard.push(`EMAIL:${contact.email}`);
      if (contact.website) vcard.push(`URL:${contact.website}`);
      if (contact.address) vcard.push(`ADR:;;${contact.address};;;;`);
      
      if (contact.phones) {
        contact.phones.forEach(phone => {
          vcard.push(`TEL;TYPE=CELL:${phone}`);
        });
      }
      
      if (contact.landlines) {
        contact.landlines.forEach(phone => {
          vcard.push(`TEL;TYPE=WORK:${phone}`);
        });
      }
      
      if (contact.social) vcard.push(`NOTE:${contact.social}`);
      
      vcard.push('END:VCARD');
      return vcard.join('\r\n');
    }).join('\r\n\r\n');
  }
  
  /**
   * Export to CSV format
   */
  static toCSV(contacts: ParsedContact[]): string {
    const headers = [
      'Name', 'Company', 'Email', 'Mobile Phones', 'Landlines', 
      'Services', 'Address', 'Website', 'Social'
    ];
    
    const rows = contacts.map(contact => [
      contact.name || '',
      contact.company || '',
      contact.email || '',
      (contact.phones || []).join('; '),
      (contact.landlines || []).join('; '),
      contact.services || '',
      contact.address || '',
      contact.website || '',
      contact.social || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    return csvContent;
  }
  
  /**
   * Export to JSON format
   */
  static toJSON(contacts: ParsedContact[], pretty: boolean = true): string {
    return JSON.stringify(contacts, null, pretty ? 2 : 0);
  }
}

/**
 * Quality assessment for extracted contacts
 */
export function assessContactQuality(contact: ParsedContact): {
  score: number;
  issues: string[];
  completeness: number;
} {
  const issues: string[] = [];
  let score = 0;
  let fieldsPresent = 0;
  const totalFields = 7; // name, company, email, phones, services, address, website
  
  // Check essential fields
  if (contact.name) {
    score += 25;
    fieldsPresent++;
    if (contact.name.length < 3) issues.push('Name seems too short');
  } else {
    issues.push('Missing name');
  }
  
  if (contact.email) {
    score += 20;
    fieldsPresent++;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      issues.push('Email format may be incorrect');
      score -= 5;
    }
  } else {
    issues.push('Missing email');
  }
  
  if (contact.phones || contact.landlines) {
    score += 20;
    fieldsPresent++;
    
    const allPhones = [...(contact.phones || []), ...(contact.landlines || [])];
    if (allPhones.some(phone => phone.replace(/\D/g, '').length < 7)) {
      issues.push('Some phone numbers seem too short');
      score -= 5;
    }
  } else {
    issues.push('Missing phone numbers');
  }
  
  if (contact.company) {
    score += 15;
    fieldsPresent++;
  }
  
  if (contact.services) {
    score += 10;
    fieldsPresent++;
  }
  
  if (contact.address) {
    score += 5;
    fieldsPresent++;
    if (contact.address.length < 10) {
      issues.push('Address seems incomplete');
      score -= 2;
    }
  }
  
  if (contact.website) {
    score += 5;
    fieldsPresent++;
    if (!contact.website.match(/^https?:\/\//)) {
      issues.push('Website URL format may be incorrect');
      score -= 2;
    }
  }
  
  const completeness = (fieldsPresent / totalFields) * 100;
  
  // Bonus points for completeness
  if (completeness > 80) score += 10;
  else if (completeness > 60) score += 5;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    completeness
  };
}

/**
 * Advanced contact deduplication with fuzzy matching
 */
export function deduplicateContacts(contacts: ParsedContact[]): {
  unique: ParsedContact[];
  duplicates: ParsedContact[][];
  merged: number;
} {
  const unique: ParsedContact[] = [];
  const duplicates: ParsedContact[][] = [];
  const processed = new Set<number>();
  let merged = 0;
  
  for (let i = 0; i < contacts.length; i++) {
    if (processed.has(i)) continue;
    
    const contact = { ...contacts[i] };
    const duplicateGroup = [contacts[i]];
    processed.add(i);
    
    // Find potential duplicates
    for (let j = i + 1; j < contacts.length; j++) {
      if (processed.has(j)) continue;
      
      const other = contacts[j];
      const similarity = calculateContactSimilarity(contact, other);
      
      if (similarity > 0.7) { // 70% similarity threshold
        duplicateGroup.push(other);
        
        // Merge information
        mergeContactInformation(contact, other);
        processed.add(j);
        merged++;
      }
    }
    
    unique.push(contact);
    if (duplicateGroup.length > 1) {
      duplicates.push(duplicateGroup);
    }
  }
  
  return { unique, duplicates, merged };
}

/**
 * Calculate similarity between two contacts
 */
function calculateContactSimilarity(contact1: ParsedContact, contact2: ParsedContact): number {
  let matches = 0;
  let total = 0;
  
  // Name similarity
  if (contact1.name && contact2.name) {
    total++;
    const similarity = calculateStringSimilarity(
      contact1.name.toLowerCase(),
      contact2.name.toLowerCase()
    );
    if (similarity > 0.8) matches += similarity;
  }
  
  // Email exact match
  if (contact1.email && contact2.email) {
    total++;
    if (contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      matches++;
    }
  }
  
  // Phone number overlap
  const phones1 = [...(contact1.phones || []), ...(contact1.landlines || [])];
  const phones2 = [...(contact2.phones || []), ...(contact2.landlines || [])];
  
  if (phones1.length > 0 && phones2.length > 0) {
    total++;
    const overlap = phones1.some(p1 => 
      phones2.some(p2 => 
        normalizePhoneNumber(p1) === normalizePhoneNumber(p2)
      )
    );
    if (overlap) matches++;
  }
  
  // Company similarity
  if (contact1.company && contact2.company) {
    total++;
    const similarity = calculateStringSimilarity(
      contact1.company.toLowerCase(),
      contact2.company.toLowerCase()
    );
    if (similarity > 0.7) matches += similarity;
  }
  
  return total > 0 ? matches / total : 0;
}

/**
 * Simple string similarity calculation (Jaro-Winkler approximation)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(str1, str2);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null)
  );
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,         // insertion
        matrix[j - 1][i] + 1,         // deletion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Merge information from two contacts
 */
function mergeContactInformation(target: ParsedContact, source: ParsedContact): void {
  // Merge fields, preferring longer/more complete values
  if (!target.name || (source.name && source.name.length > target.name.length)) {
    target.name = source.name;
  }
  
  if (!target.company || (source.company && source.company.length > target.company.length)) {
    target.company = source.company;
  }
  
  if (!target.email && source.email) target.email = source.email;
  if (!target.website && source.website) target.website = source.website;
  
  if (!target.address || (source.address && source.address.length > target.address.length)) {
    target.address = source.address;
  }
  
  if (!target.services || (source.services && source.services.length > target.services.length)) {
    target.services = source.services;
  }
  
  if (!target.social && source.social) target.social = source.social;
  
  // Merge phone arrays
  if (source.phones) {
    target.phones = [...new Set([...(target.phones || []), ...source.phones])];
  }
  
  if (source.landlines) {
    target.landlines = [...new Set([...(target.landlines || []), ...source.landlines])];
  }
  
  // Merge QR codes
  if (source.qrCodes) {
    target.qrCodes = [...(target.qrCodes || []), ...source.qrCodes];
  }
}

// Export all functions and classes
export {
  extractQRCodes,
  parseVCard,
  parseMeCard,
  extractContactFromText,
  normalizePhoneNumber,
  categorizePhoneNumbers,
  cleanExtractedField
};