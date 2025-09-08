import type { ParsedContact } from "./parse";

// Get API key from environment variables (supports both Vite and Next.js)
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  try {
    console.log('Fetching image from URL:', imageUrl.substring(0, 50) + '...');
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(imageUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 efficiently
    const chunkSize = 8192;
    let binary = '';
    
    for (let i = 0; i < uint8Array.byteLength; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binary);
    console.log(`Image converted to base64, size: ${base64.length} characters`);

    return {
      base64,
      mimeType: contentType
    };
  } catch (error: any) {
    console.error('Error fetching image:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Image fetch timeout. Please try again.');
    }
    
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}

/**
 * Call Gemini API with image for OCR and data extraction
 * @param imageInput - Either a File object or image URL
 * @returns Promise<ParsedContact>
 */
export async function callGeminiAPI(imageInput: File | string): Promise<ParsedContact> {
  console.log('Starting Gemini API call...');
  
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not found. Please set VITE_GEMINI_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY environment variable.");
  }

  try {
    let base64Image: string;
    let mimeType: string;

    // Handle File input (recommended for bulk uploads)
    if (imageInput instanceof File) {
      console.log('Processing File input:', imageInput.name);
      const fileData = await getFileAsBase64(imageInput);
      base64Image = fileData.base64;
      mimeType = fileData.mimeType;
    } else {
      // Handle URL input (for single uploads after Firebase storage)
      console.log('Processing URL input');
      const imageData = await fetchImageAsBase64(imageInput);
      base64Image = imageData.base64;
      mimeType = imageData.mimeType;
    }

    const prompt = `
    Analyze this business card image and extract the following information. Return ONLY a valid JSON object with this exact structure:
    
    {
      "name": "Full name of the person",
      "company": "Company or organization name",
      "email": "Email address",
      "phone": "Phone number (with country code if visible)",
      "services": "Job title, position, or services offered",
      "address": "Complete address (street, city, state, zip)",
      "website": "Website URL if present",
      "social": "Social media handles if present"
    }
    
    Rules:
    - Return ONLY valid JSON, no additional text or explanation
    - Use empty string "" for missing information, not null
    - Clean and format extracted text properly
    - For phone numbers, include country code if visible
    - Extract complete addresses including all components
    - Be accurate and avoid hallucination
    - If text is unclear, use best interpretation but don't guess
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
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 1024,
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

    // Call API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    console.log('Calling Gemini API...');
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(requestBody)
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error Response:', errorText);
      
      if (response.status === 429) {
        throw new Error('API rate limit exceeded. Please wait before trying again.');
      } else if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Gemini API configuration.');
      } else if (response.status === 403) {
        throw new Error('API access forbidden. Please check your API key permissions.');
      } else if (response.status >= 500) {
        throw new Error('Gemini API server error. Please try again later.');
      } else {
        throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
      }
    }

    const result = await response.json();
    console.log('Gemini API response received');
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      console.error('Invalid API response structure:', result);
      throw new Error('Invalid response from Gemini API - no content found');
    }

    const extractedText = result.candidates[0].content.parts[0].text;
    console.log('Raw API response:', extractedText);
    
    // Clean the response to extract JSON
    let jsonText = extractedText.trim();
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON object in the response
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    } else {
      throw new Error('No valid JSON found in API response');
    }

    // Clean up common JSON formatting issues
    jsonText = jsonText
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();

    try {
      const parsedData = JSON.parse(jsonText) as any;
      
      // Clean and validate the extracted data
      const cleanedData: ParsedContact = {
        name: (parsedData.name || '').toString().trim(),
        company: (parsedData.company || '').toString().trim(),
        email: (parsedData.email || '').toString().toLowerCase().trim(),
        phones: [(parsedData.phone || '').toString().trim()].filter(p => p),
        services: (parsedData.services || '').toString().trim(),
        address: (parsedData.address || '').toString().trim(),
        website: (parsedData.website || '').toString().trim(),
        social: (parsedData.social || '').toString().trim(),
      };

      // Convert empty strings to undefined for cleaner data
      Object.keys(cleanedData).forEach(key => {
        const value = cleanedData[key as keyof ParsedContact];
        if (!value || value === '') {
          delete cleanedData[key as keyof ParsedContact];
        }
      });

      console.log('Successfully parsed contact data:', cleanedData);
      return cleanedData;
      
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Failed to parse text:', jsonText);
      throw new Error('Failed to parse extracted data. Please try with a clearer image.');
    }

  } catch (error: any) {
    console.error('Gemini OCR Error:', error);
    
    // Handle timeout errors
    if (error.name === 'AbortError') {
      throw new Error('API request timeout. Please try again.');
    }
    
    // Re-throw specific errors as-is
    if (error.message?.includes('API key') || 
        error.message?.includes('rate limit') || 
        error.message?.includes('API access forbidden') ||
        error.message?.includes('API Error:')) {
      throw error;
    }
    
    // Handle network errors
    if (error.message?.includes('Failed to fetch') || 
        error.name === 'TypeError' || 
        error.message?.includes('Network')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    // Handle parsing errors
    if (error.message?.includes('parse') || error.message?.includes('JSON')) {
      throw error;
    }
    
    // Generic error fallback
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

/**
 * Call Gemini API with retry logic and exponential backoff
 * @param imageInput - Either a File object or image URL
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<ParsedContact>
 */
export async function callGeminiAPIWithRetry(imageInput: File | string, maxRetries: number = 3): Promise<ParsedContact> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini API attempt ${attempt}/${maxRetries}`);
      return await callGeminiAPI(imageInput);
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.message?.includes('API key') || 
          error.message?.includes('Invalid API key') ||
          error.message?.includes('API access forbidden')) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      let delay: number;
      if (error.message?.includes('rate limit')) {
        // Longer delay for rate limit errors
        delay = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
      } else {
        // Standard delay for other errors
        delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      }
      
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Alternative OCR method using different approach
 * This can be used as fallback if Gemini API fails
 */
export async function extractTextFromImage(file: File): Promise<string> {
  // This is a placeholder for alternative OCR implementation
  // You could integrate with Tesseract.js, AWS Textract, or other services
  console.warn('Alternative OCR method not implemented');
  throw new Error('Alternative OCR method not implemented');
}

/**
 * Validate if a file is a supported image format
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!validTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Please upload JPG, PNG, GIF, or WebP images.`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 5MB.`);
  }
  
  return true;
}

/**
 * Check if Gemini API is properly configured
 */
export function isGeminiAPIConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Get current API configuration info (for debugging)
 */
export function getAPIInfo() {
  return {
    hasApiKey: !!GEMINI_API_KEY,
    apiKeyPreview: GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 8)}...` : 'Not set',
    apiUrl: GEMINI_API_URL
  };
}