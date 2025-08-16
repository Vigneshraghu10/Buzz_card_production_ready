export async function generateQrFromText(text: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return await toDataURL(text);
}
