// src/lib/providers/decoders/nairabet.ts

import type { BetCodeDecoder, DecodedBetSlip, DecodedSelection } from '@/lib/types';

export const nairabetDecoder: BetCodeDecoder = {
  bookmaker: 'nairabet',

  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,12}$/.test(cleaned);
  },


  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error(
        'Invalid NairaBet bet code format. Expected 6–12 alphanumeric characters.'
      );
    }


    return {
      bookmaker: 'nairabet',

      code: code.trim().toUpperCase(),

      selections: [] as DecodedSelection[],

      totalOdds: 0,

      decodedAt: new Date().toISOString(),
    };
  },


  async encode(selections: DecodedSelection[]): Promise<string> {

    // Temporary placeholder until NairaBet API/share-code generation exists
    if (!selections.length) {
      throw new Error('Cannot generate NairaBet code without selections.');
    }

    return `NAIRA-${Date.now()}`;
  },


  getCodeTimestamp(code: string): string | null {

    // Placeholder:
    // Real implementation requires NairaBet code structure/API

    return null;
  },
};