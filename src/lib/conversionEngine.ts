import { getDecoder } from './providers/registry';

export async function convertBetCode(
  sourceBookmaker: BookmakerId,
  destinationBookmaker: BookmakerId,
  code: string,
): Promise<ConversionResult> {

  // Prevent converting to the same bookmaker
  if (sourceBookmaker === destinationBookmaker) {
    throw new Error('Source and destination bookmaker must be different.');
  }

  // Get source bookmaker decoder
  const decoder = getDecoder(sourceBookmaker);

  if (!decoder) {
    throw new Error(`No decoder registered for bookmaker: ${sourceBookmaker}`);
  }

  // Validate input code
  if (!decoder.validateCode(code)) {
    throw new Error(`Invalid bet code format for ${sourceBookmaker}.`);
  }


  // Check code expiry if timestamp is available
  const codeTimestamp = decoder.getCodeTimestamp?.(code);

  if (codeTimestamp) {
    const now = new Date();
    const codeDate = new Date(codeTimestamp);

    const diffInHours =
      (now.getTime() - codeDate.getTime()) /
      (1000 * 60 * 60);

    if (diffInHours > 24) {
      throw new Error(
        'Bet code has expired. Codes are valid for 24 hours.'
      );
    }
  }


  // Get destination bookmaker encoder
  const destinationDecoder = getDecoder(destinationBookmaker);

  if (!destinationDecoder) {
    throw new Error(
      `No decoder registered for bookmaker: ${destinationBookmaker}`
    );
  }


  // Decode original bet slip
  const decoded: DecodedBetSlip = await decoder.decode(code);


  // Convert decoded selections into destination selections
const convertedSelections: ConvertedSelection[] =
  decoded.selections.map(selection => ({
    fixture: selection.match,
    league: selection.league,
    kickoff: selection.kickoff,
    market: selection.market,
    selection: selection.selection,
    originalOdds: selection.odds,
    destinationOdds: selection.odds,
    oddsDifference: 0,
    oddsChangePercent: 0,
    availability: 'available',
    status: 'matched',
    notes: '',
  }));


  /*
    Future conversion logic goes here:

    Example:

    Bet9ja:
       Chelsea vs Arsenal
       Home Win

    ↓

    SportyBet:
       Chelsea vs Arsenal
       1

  */


  // Return conversion result
  return {
  sourceBookmaker,
  destinationBookmaker,

  sourceCode: code.trim().toUpperCase(),

  destinationCode: await destinationDecoder.encode(decoded.selections),

  selections: convertedSelections,

  matchedCount: convertedSelections.length,

  unavailableCount: 0,

  changedOddsCount: 0,

  marketChangedCount: 0,

  originalTotalOdds: decoded.totalOdds,

  destinationTotalOdds: decoded.totalOdds,

  conversionPercentage:
  decoded.selections.length === 0
    ? 0
    : (convertedSelections.length / decoded.selections.length) * 100,

  createdAt: new Date().toISOString(),
};
}



export function isCodeExpired(
  code: string,
  decoder: BetCodeDecoder
): boolean {

  const codeTimestamp = decoder.getCodeTimestamp?.(code);

  if (!codeTimestamp) {
    return false;
  }


  const now = new Date();
  const codeDate = new Date(codeTimestamp);

  const diffInHours =
    (now.getTime() - codeDate.getTime()) /
    (1000 * 60 * 60);


  return diffInHours > 24;
}