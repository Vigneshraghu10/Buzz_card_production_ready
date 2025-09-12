export async function generateQrFromText(text: string, logoUrl?: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  
  // Generate QR code optimized for scannability without logo overlay
  // Using medium error correction for better scan reliability
  const qrDataUrl = await toDataURL(text, {
    width: 256, // Reduced size for better clarity
    margin: 4, // Increased margin for better scanning
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M' // Medium error correction for optimal balance
  });

  // Return clean QR code without logo overlay for better scannability
  // Logo overlay can interfere with QR code scanning reliability
  return qrDataUrl;
}
