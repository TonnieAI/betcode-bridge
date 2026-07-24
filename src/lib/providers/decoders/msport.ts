// src/lib/providers/decoders/msport.ts
export const msportDecoder: BetCodeDecoder = {
  bookmaker: 'msport',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,14}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid MSport bet code format. Expected 6–14 alphanumeric characters.');
    }
    return generateSampleSlip('msport', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('msport', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};