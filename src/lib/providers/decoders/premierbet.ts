// src/lib/providers/decoders/premierbet.ts
import type { BetCodeDecoder, DecodedBetSlip, DecodedSelection } from '../../types';
import { generateDestinationCode, generateSampleSlip } from '../baseDecoder';

export const premierbetDecoder: BetCodeDecoder = {
  bookmaker: 'premierbet',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,14}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid Premier Bet bet code format. Expected 6–14 alphanumeric characters.');
    }
    return generateSampleSlip('premierbet', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('premierbet', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};