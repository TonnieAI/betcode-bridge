// src/lib/providers/decoders/bangbet.ts
export const bangbetDecoder: BetCodeDecoder = {
  bookmaker: 'bangbet',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,14}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid BangBet bet code format. Expected 6–14 alphanumeric characters.');
    }
    return generateSampleSlip('bangbet', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('bangbet', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};