export async function generateQrFromText(text: string, logoUrl?: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  
  // Generate QR code with higher error correction for logo overlay
  const qrDataUrl = await toDataURL(text, {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'H' // High error correction allows for logo overlay
  });

  // If no logo is provided, return the basic QR code
  if (!logoUrl) {
    return qrDataUrl;
  }

  try {
    // Create canvas for compositing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('Canvas context not available, returning basic QR code');
      return qrDataUrl;
    }

    // Load QR code image
    const qrImage = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImage.onload = () => resolve();
      qrImage.onerror = () => reject(new Error('Failed to load QR code'));
      qrImage.src = qrDataUrl;
    });

    // Set canvas dimensions
    canvas.width = qrImage.width;
    canvas.height = qrImage.height;

    // Draw QR code
    ctx.drawImage(qrImage, 0, 0);

    // Load company logo
    const logoImage = new Image();
    logoImage.crossOrigin = 'anonymous'; // Handle CORS for external images
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Logo loading timeout'));
      }, 5000); // 5 second timeout

      logoImage.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      logoImage.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load logo'));
      };
      logoImage.src = logoUrl;
    });

    // Calculate logo dimensions (20-25% of QR code size)
    const logoSize = Math.min(canvas.width, canvas.height) * 0.22;
    const logoX = (canvas.width - logoSize) / 2;
    const logoY = (canvas.height - logoSize) / 2;

    // Draw white background circle for logo visibility
    const circleRadius = logoSize * 0.6;
    const circleX = canvas.width / 2;
    const circleY = canvas.height / 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Add subtle border to the circle
    ctx.strokeStyle = '#E5E5E5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw logo with rounded corners
    ctx.save();
    
    // Create rounded rectangle clipping path for logo
    const logoRadius = logoSize * 0.1;
    ctx.beginPath();
    ctx.roundRect(logoX, logoY, logoSize, logoSize, logoRadius);
    ctx.clip();
    
    // Draw the logo
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    
    ctx.restore();

    // Convert canvas to data URL
    return canvas.toDataURL('image/png', 0.9);

  } catch (error) {
    console.warn('Failed to overlay logo on QR code:', error);
    // Return basic QR code if logo overlay fails
    return qrDataUrl;
  }
}
