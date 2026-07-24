// src/lib/providers/decoders/bet9ja.ts

import type {
  BetCodeDecoder,
  DecodedBetSlip,
  DecodedSelection
} from '../../types';

import {
  generateSampleSlip,
  generateDestinationCode,
} from '../baseDecoder';

export const bet9jaDecoder: BetCodeDecoder = {
  bookmaker: 'bet9ja',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,12}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
  if (!this.validateCode(code)) {
    throw new Error(
      'Invalid Bet9ja bet code format. Expected 6–12 alphanumeric characters.'
    );
  }

  const normalizedCode = code.trim().toUpperCase();

  

  return generateSampleSlip('bet9ja', normalizedCode);
},
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('bet9ja', selections);
  },
  getCodeTimestamp(code: string): string | null {
    // Extract the timestamp from the bet code
    // This is a placeholder; implement based on the actual code structure
    return null; // Return null if the timestamp cannot be extracted
  },
};