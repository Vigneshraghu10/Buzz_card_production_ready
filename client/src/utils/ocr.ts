export async function callVisionAPI(imageUrl: string): Promise<string> {
  const key = import.meta.env.VITE_GCLOUD_VISION_API_KEY || import.meta.env.VITE_GOOGLE_CLOUD_VISION_API_KEY || "default_key";
  
  try {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [{ type: "TEXT_DETECTION" }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    const json = await response.json();
    return json?.responses?.[0]?.fullTextAnnotation?.text ?? "";
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
}
