// src/lib/providers/decoders/xbet.ts
import type { BetCodeDecoder, DecodedBetSlip, DecodedSelection } from '../../types';
import { generateDestinationCode, generateSampleSlip } from '../baseDecoder';

export const xbetDecoder: BetCodeDecoder = {
  bookmaker: '1xbet',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{8,20}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid 1xBet bet code format. Expected 8–20 alphanumeric characters.');
    }
    return generateSampleSlip('1xbet', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('1xbet', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};