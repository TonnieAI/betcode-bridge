// src/lib/providers/decoders/surebet247.ts
import type { BetCodeDecoder, DecodedBetSlip, DecodedSelection } from '../../types';
import { generateDestinationCode, generateSampleSlip } from '../baseDecoder';

export const surebet247Decoder: BetCodeDecoder = {
  bookmaker: 'surebet247',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{5,12}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid SureBet247 bet code format. Expected 5–12 alphanumeric characters.');
    }
    return generateSampleSlip('surebet247', code.trim().toUpperCase());
  },
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('surebet247', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};