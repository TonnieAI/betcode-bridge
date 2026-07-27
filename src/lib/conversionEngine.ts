import { getAdapter } from './adapters';
import type {
  BetCodeDecoder,
  BookmakerId,
  ConversionResult,
} from './types';

function applyOddsComparison(selections: ConversionResult['selections']): ConversionResult['selections'] {
  return selections.map((selection) => {
    if (selection.destinationOdds == null) {
      return {
        ...selection,
        oddsDifference: null,
        oddsChangePercent: null,
      };
    }

    const oddsDifference = +(selection.destinationOdds - selection.originalOdds).toFixed(2);
    const oddsChangePercent = selection.originalOdds === 0
      ? null
      : +(((selection.destinationOdds - selection.originalOdds) / selection.originalOdds) * 100).toFixed(2);

    return {
      ...selection,
      oddsDifference,
      oddsChangePercent,
    };
  });
}

export async function convertBetCode(
  sourceBookmaker: BookmakerId,
  destinationBookmaker: BookmakerId,
  code: string,
): Promise<ConversionResult> {

  // Prevent converting to the same bookmaker
  if (sourceBookmaker === destinationBookmaker) {
    throw new Error('Source and destination bookmaker must be different.');
  }

  const sourceAdapter = getAdapter(sourceBookmaker);

  if (!sourceAdapter) {
    throw new Error(`No adapter registered for bookmaker: ${sourceBookmaker}`);
  }

  const destinationAdapter = getAdapter(destinationBookmaker);

  if (!destinationAdapter) {
    throw new Error(`No adapter registered for bookmaker: ${destinationBookmaker}`);
  }

  if (!sourceAdapter.capability.canDecode) {
    throw new Error(
      `${sourceBookmaker} does not support decoding yet. Integration required: ${sourceAdapter.capability.requiredDataSource ?? 'official API/data source'}.`
    );
  }

  if (!destinationAdapter.capability.canGenerateSlip) {
    throw new Error(
      `${destinationBookmaker} does not support destination slip generation yet. Integration required: ${destinationAdapter.capability.requiredDataSource ?? 'official API/data source'}.`
    );
  }

  const decoded = await sourceAdapter.decodeBetCode(code);
  const extractedSelections = sourceAdapter.extractSelections(decoded);
  const eventNormalizedSelections = await sourceAdapter.normalizeEvents(extractedSelections, destinationBookmaker);
  const marketNormalizedSelections = await sourceAdapter.normalizeMarkets(eventNormalizedSelections, destinationBookmaker);
  const comparedSelections = await sourceAdapter.compareOdds(marketNormalizedSelections, destinationBookmaker);
  const convertedSelections = applyOddsComparison(comparedSelections);

  const matchedCount = convertedSelections.filter((selection) => selection.status === 'matched').length;
  const unavailableCount = convertedSelections.filter((selection) => selection.status === 'unavailable').length;
  const changedOddsCount = convertedSelections.filter((selection) => selection.status === 'odds_changed').length;
  const marketChangedCount = convertedSelections.filter((selection) => selection.status === 'market_changed').length;
  const destinationTotalOdds = +convertedSelections.reduce((acc, selection) => acc * (selection.destinationOdds ?? 1), 1).toFixed(2);


  // Return conversion result
  return {
  sourceBookmaker,
  destinationBookmaker,

  sourceCode: code.trim().toUpperCase(),

  destinationCode: await destinationAdapter.generateBetSlip(extractedSelections, sourceBookmaker),

  selections: convertedSelections,

  matchedCount,

  unavailableCount,

  changedOddsCount,

  marketChangedCount,

  originalTotalOdds: decoded.totalOdds,

  destinationTotalOdds,

  conversionPercentage:
  extractedSelections.length === 0
    ? 0
    : (matchedCount / extractedSelections.length) * 100,

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