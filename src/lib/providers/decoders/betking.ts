// src/lib/providers/decoders/betking.ts
export const betkingDecoder: BetCodeDecoder = {
  bookmaker: 'betking',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{5,12}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid BetKing bet code format. Expected 5–12 alphanumeric characters.');
    }
    return generateSampleSlip('betking', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('betking', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};