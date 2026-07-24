// src/lib/providers/decoders/merrybet.ts
export const merrybetDecoder: BetCodeDecoder = {
  bookmaker: 'merrybet',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,12}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid MerryBet bet code format. Expected 6–12 alphanumeric characters.');
    }
    return generateSampleSlip('merrybet', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('merrybet', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};