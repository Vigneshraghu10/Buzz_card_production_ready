import type { ParsedContact } from "./parse";
import QrScanner from 'qr-scanner';

// Get API key from environment variables
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export interface MultiCardResult {
  cards: ParsedContact[];
  totalProcessed: number;
  errors: string[];
}

/**
 * Convert file to base64 with proper format detection
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
 * Extract QR codes from image using QrScanner
 */
async function extractQRCodes(file: File): Promise<Array<{
  type: 'contact' | 'url' | 'text';
  data: string;
  extractedInfo?: any;
}>> {
  try {
    const qrCodes = [];
    
    // Create an image element for QR scanning
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    
    return new Promise((resolve) => {
      img.onload = async () => {
        try {
          // Scan for QR codes
          const qrResult = await QrScanner.scanImage(img, { returnDetailedScanResult: true });
          
          if (qrResult?.data) {
            const qrData = qrResult.data;
            let qrInfo: any = {
              type: 'text' as const,
              data: qrData
            };

            // Check if it's a vCard (contact)
            if (qrData.startsWith('BEGIN:VCARD')) {
              qrInfo.type = 'contact';
              qrInfo.extractedInfo = parseVCard(qrData);
            }
            // Check if it's a MeCard (contact)
            else if (qrData.startsWith('MECARD:')) {
              qrInfo.type = 'contact';
              qrInfo.extractedInfo = parseMeCard(qrData);
            }
            // Check if it's a URL
            else if (qrData.match(/^https?:\/\//)) {
              qrInfo.type = 'url';
              qrInfo.extractedInfo = { url: qrData };
            }
            // Check for phone numbers in text
            else if (qrData.match(/(\+?\d{1,3}[-.\s]?)?\d{10,}/)) {
              qrInfo.type = 'contact';
              qrInfo.extractedInfo = extractContactFromText(qrData);
            }

            qrCodes.push(qrInfo);
          }
        } catch (error) {
          console.log('No QR code found or error scanning:', error);
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
 * Parse vCard data into structured contact info
 */
function parseVCard(vCardData: string): any {
  const lines = vCardData.split(/\r?\n/);
  const contact: any = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('BEGIN:') || line.startsWith('END:') || line.startsWith('VERSION:')) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();
    
    if (!value) continue;
    
    // Parse different vCard fields
    if (key === 'FN' || key.startsWith('FN;')) {
      contact.name = value;
    } else if (key === 'N' || key.startsWith('N;')) {
      // Parse structured name (Family;Given;Additional;Prefix;Suffix)
      const nameParts = value.split(';');
      const lastName = nameParts[0] || '';
      const firstName = nameParts[1] || '';
      contact.name = `${firstName} ${lastName}`.trim();
    } else if (key === 'ORG' || key.startsWith('ORG;')) {
      contact.company = value;
    } else if (key === 'EMAIL' || key.startsWith('EMAIL;')) {
      contact.email = value;
    } else if (key === 'TEL' || key.startsWith('TEL;')) {
      if (!contact.phones) contact.phones = [];
      // Clean phone number
      const cleanPhone = value.replace(/[^\d+\-\s()]/g, '');
      if (cleanPhone) contact.phones.push(cleanPhone);
    } else if (key === 'URL' || key.startsWith('URL;')) {
      contact.website = value;
    } else if (key === 'ADR' || key.startsWith('ADR;')) {
      // Parse structured address (POBox;Extended;Street;City;State;PostalCode;Country)
      const addressParts = value.split(';').filter(part => part.trim());
      contact.address = addressParts.join(', ');
    } else if (key === 'TITLE' || key.startsWith('TITLE;')) {
      contact.services = value;
    } else if (key === 'NOTE' || key.startsWith('NOTE;')) {
      if (!contact.services && value) contact.services = value;
    }
  }
  
  return contact;
}

/**
 * Parse MeCard data into structured contact info
 */
function parseMeCard(meCardData: string): any {
  const contact: any = {};
  
  // MeCard format: MECARD:N:lastname,firstname;ORG:company;URL:website;EMAIL:email;TEL:phone;ADR:address;NOTE:note;;
  const fields = meCardData.replace('MECARD:', '').split(';');
  
  for (const field of fields) {
    if (!field.trim()) continue;
    
    const [key, ...valueParts] = field.split(':');
    const value = valueParts.join(':').trim();
    
    if (!value) continue;
    
    switch (key.toUpperCase()) {
      case 'N':
        // Parse name (lastname,firstname)
        const nameParts = value.split(',');
        const lastName = nameParts[0] || '';
        const firstName = nameParts[1] || '';
        contact.name = `${firstName} ${lastName}`.trim();
        break;
      case 'ORG':
        contact.company = value;
        break;
      case 'EMAIL':
        contact.email = value;
        break;
      case 'TEL':
        if (!contact.phones) contact.phones = [];
        contact.phones.push(value);
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
  
  return contact;
}

/**
 * Extract contact info from text (like phone numbers, emails)
 */
function extractContactFromText(text: string): any {
  const contact: any = {};
  
  // Extract phone numbers
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const phones = text.match(phoneRegex);
  if (phones) contact.phones = phones;
  
  // Extract email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  if (emails) contact.email = emails[0];
  
  // Extract URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex);
  if (urls) contact.website = urls[0];
  
  return contact;
}

/**
 * Separate phone numbers into mobile and landline categories
 */
function categorizePhoneNumbers(phones: string[]): { phones: string[]; landlines: string[] } {
  const mobilePhones: string[] = [];
  const landlines: string[] = [];
  
  for (const phone of phones) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Simple heuristic: mobile numbers typically start with certain digits
    // This can be customized based on your country's numbering plan
    if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
      // Indian mobile numbers start with 6-9
      mobilePhones.push(phone);
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      // US/Canada mobile numbers
      mobilePhones.push(phone);
    } else if (cleanPhone.length >= 12 && cleanPhone.startsWith('+')) {
      // International mobile numbers
      mobilePhones.push(phone);
    } else {
      // Assume landline for other patterns
      landlines.push(phone);
    }
  }
  
  return { phones: mobilePhones, landlines };
}

/**
 * Enhanced Gemini API call for multi-card detection and processing
 */
export async function processMultipleBusinessCards(file: File): Promise<MultiCardResult> {
  console.log('Starting multi-card processing...');
  
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not found. Please set VITE_GEMINI_API_KEY environment variable.");
  }

  const errors: string[] = [];
  const cards: ParsedContact[] = [];

  try {
    // First, extract QR codes from the image
    console.log('Extracting QR codes...');
    const qrCodes = await extractQRCodes(file);
    console.log(`Found ${qrCodes.length} QR codes`);

    // Convert image to base64
    const { base64, mimeType } = await getFileAsBase64(file);

    // Enhanced prompt for multi-card detection
    const prompt = `
    Analyze this image that may contain multiple business cards. For each business card you detect, extract the following information and return a JSON array where each object represents one business card:

    [
      {
        "cardNumber": 1,
        "name": "Full name of the person",
        "company": "Company or organization name", 
        "email": "Email address",
        "phones": ["Phone number 1", "Phone number 2", "etc"],
        "landlines": ["Landline number 1", "Landline number 2", "etc"],
        "services": "Job title, position, or services offered",
        "address": "Complete address (street, city, state, zip)",
        "website": "Website URL if present",
        "social": "Social media handles if present"
      }
    ]

    Rules:
    - Detect and process EACH individual business card in the image
    - Return a JSON array even if there's only one card
    - Use empty arrays [] for missing phone/landline numbers, empty string "" for other missing information
    - Separate mobile phones and landline numbers into different arrays
    - Clean and format extracted text properly
    - For phone numbers, include country code if visible
    - Extract complete addresses including all components
    - Be accurate and avoid hallucination
    - If text is unclear, use best interpretation but don't guess
    - Number each card starting from 1
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
        topP: 1,
        maxOutputTokens: 4096,
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

    console.log('Calling Gemini API for multi-card detection...');
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
    
    // Clean and parse the response
    let jsonText = extractedText.trim();
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON array in the response
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    } else {
      throw new Error('No valid JSON array found in API response');
    }

    try {
      const parsedCards = JSON.parse(jsonText) as any[];
      
      // Process each detected card
      for (let i = 0; i < parsedCards.length; i++) {
        const cardData = parsedCards[i];
        
        try {
          // Clean and validate the extracted data
          const cleanedCard: ParsedContact = {
            name: (cardData.name || '').toString().trim(),
            company: (cardData.company || '').toString().trim(),
            email: (cardData.email || '').toString().toLowerCase().trim(),
            services: (cardData.services || '').toString().trim(),
            address: (cardData.address || '').toString().trim(),
            website: (cardData.website || '').toString().trim(),
            social: (cardData.social || '').toString().trim(),
          };

          // Process phone numbers
          const allPhones = Array.isArray(cardData.phones) ? cardData.phones : 
                           cardData.phones ? [cardData.phones] : [];
          const allLandlines = Array.isArray(cardData.landlines) ? cardData.landlines :
                              cardData.landlines ? [cardData.landlines] : [];

          if (allPhones.length > 0) {
            cleanedCard.phones = allPhones.map((p: any) => p.toString().trim()).filter((p: string) => p);
          }
          if (allLandlines.length > 0) {
            cleanedCard.landlines = allLandlines.map((p: any) => p.toString().trim()).filter((p: string) => p);
          }

          // Add QR code data if available
          if (qrCodes.length > 0) {
            cleanedCard.qrCodes = qrCodes;
            
            // Merge QR code contact info with OCR data
            for (const qr of qrCodes) {
              if (qr.type === 'contact' && qr.extractedInfo) {
                const qrContact = qr.extractedInfo;
                if (qrContact.name && !cleanedCard.name) cleanedCard.name = qrContact.name;
                if (qrContact.company && !cleanedCard.company) cleanedCard.company = qrContact.company;
                if (qrContact.email && !cleanedCard.email) cleanedCard.email = qrContact.email;
                if (qrContact.website && !cleanedCard.website) cleanedCard.website = qrContact.website;
                if (qrContact.address && !cleanedCard.address) cleanedCard.address = qrContact.address;
                if (qrContact.services && !cleanedCard.services) cleanedCard.services = qrContact.services;
                
                // Merge phone numbers
                if (qrContact.phones) {
                  const { phones, landlines } = categorizePhoneNumbers(qrContact.phones);
                  if (phones.length > 0) {
                    cleanedCard.phones = [...(cleanedCard.phones || []), ...phones];
                  }
                  if (landlines.length > 0) {
                    cleanedCard.landlines = [...(cleanedCard.landlines || []), ...landlines];
                  }
                }
              }
            }
          }

          // Remove empty fields
          Object.keys(cleanedCard).forEach(key => {
            const value = cleanedCard[key as keyof ParsedContact];
            if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
              delete cleanedCard[key as keyof ParsedContact];
            }
          });

          cards.push(cleanedCard);
          console.log(`Successfully processed card ${i + 1}:`, cleanedCard);
          
        } catch (cardError) {
          const errorMsg = `Error processing card ${i + 1}: ${cardError}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Failed to parse text:', jsonText);
      throw new Error('Failed to parse extracted card data. Please try with a clearer image.');
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
    errors
  };
}

/**
 * Validate if a file is a supported image format
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB for multi-card images
  
  if (!validTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Please upload JPG, PNG, GIF, or WebP images.`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 10MB.`);
  }
  
  return true;
}