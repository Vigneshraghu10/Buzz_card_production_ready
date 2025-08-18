export async function callVisionAPI(imageUrl: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your environment variables.');
  }

  try {
    // Convert image URL to base64
    const imageResponse = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'same-origin'
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    const imageBase64 = await blobToBase64(imageBlob);
    const base64Data = imageBase64.split(',')[1]; // Remove data URL prefix

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: "You are an expert at extracting information from business cards. Please analyze this business card image and extract all the text content you can see. Return the extracted text as plain text, preserving the layout and structure as much as possible."
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1000
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    return extractedText;
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
}

// Enhanced OCR function using Gemini 1.5 Flash that returns structured data
export async function callGeminiAPI(imageUrl: string): Promise<import('./parse').ParsedContact> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your environment variables.');
  }

  try {
    // Convert image URL to base64
    const imageResponse = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'same-origin'
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    const imageBase64 = await blobToBase64(imageBlob);
    const base64Data = imageBase64.split(',')[1]; // Remove data URL prefix

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are an expert at extracting structured information from business cards. Please analyze this business card image and extract the following information in JSON format:

{
  "name": "Full name of the person",
  "company": "Company/Organization name", 
  "phone": "Phone number (clean format)",
  "email": "Email address",
  "services": "Job title or services offered",
  "address": "Complete address if available"
}

Only include fields that you can clearly identify from the image. Use null for fields that are not visible or unclear. Be precise and accurate. Return only the JSON object without any additional text or formatting.`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Try to parse JSON response
    try {
      // Clean up the response text to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        return {
          name: parsedData.name || undefined,
          company: parsedData.company || undefined,
          phone: parsedData.phone || undefined,
          email: parsedData.email || undefined,
          services: parsedData.services || undefined,
          address: parsedData.address || undefined
        };
      }
    } catch (jsonError) {
      console.log("JSON parsing failed, falling back to text parsing:", jsonError);
    }
    
    // Fallback to text parsing if JSON parsing fails
    const { parseOcrToContact } = await import('./parse');
    return parseOcrToContact(responseText);
    
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    throw error;
  }
}

// Helper function to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
