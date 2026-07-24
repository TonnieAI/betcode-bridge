import type { BetCodeDecoder, DecodedBetSlip, DecodedSelection } from '../../types';
import { generateSampleSlip, generateDestinationCode } from '../baseDecoder';

interface SportyBetSelectionNode {
  eventId: string;
  marketId: string;
  specifier: string | null;
  outcomeId: string;
  productId: string | null;
  stake: string | null;
}

interface SportyBetOutcomeNode {
  eventId: string;
  homeTeamName: string;
  awayTeamName: string;
  league: string;
  kickoff: string;
  marketId: string;
  marketName: string;
  marketDescription: string;
  outcomeId: string;
  outcomeDescription: string;
  odds: number;
}

function directChildren(element: Element, tagName: string): Element[] {
  return Array.from(element.children).filter((child) => child.tagName === tagName);
}

function firstDirectChild(element: Element, tagName: string): Element | null {
  return directChildren(element, tagName)[0] ?? null;
}

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? '';
}

function parseOutcomeNode(node: Element): SportyBetOutcomeNode | null {
  const eventId = textOf(firstDirectChild(node, 'eventId'));
  if (!eventId) return null;

  const sportNode = firstDirectChild(node, 'sport');
  const categoryNode = sportNode ? firstDirectChild(sportNode, 'category') : null;
  const tournamentNode = categoryNode ? firstDirectChild(categoryNode, 'tournament') : null;

  const marketContainer = firstDirectChild(node, 'markets');
  const marketNode = marketContainer ? firstDirectChild(marketContainer, 'markets') : null;
  const outcomeContainer = marketNode ? firstDirectChild(marketNode, 'outcomes') : null;
  const outcomeNode = outcomeContainer ? firstDirectChild(outcomeContainer, 'outcomes') : null;

  const marketId = textOf(firstDirectChild(marketNode ?? node, 'id'));
  const marketName = textOf(firstDirectChild(marketNode ?? node, 'title')) || textOf(firstDirectChild(marketNode ?? node, 'name')) || textOf(firstDirectChild(marketNode ?? node, 'desc'));
  const marketDescription = textOf(firstDirectChild(marketNode ?? node, 'desc')) || marketName;
  const outcomeId = textOf(firstDirectChild(outcomeNode ?? node, 'id'));
  const outcomeDescription = textOf(firstDirectChild(outcomeNode ?? node, 'desc'));
  const odds = Number.parseFloat(textOf(firstDirectChild(outcomeNode ?? node, 'odds')));
  const kickoff = textOf(firstDirectChild(node, 'estimateStartTime'));

  const leagueParts = [textOf(categoryNode ? firstDirectChild(categoryNode, 'name') : null), textOf(tournamentNode ? firstDirectChild(tournamentNode, 'name') : null)].filter(Boolean);

  return {
    eventId,
    homeTeamName: textOf(firstDirectChild(node, 'homeTeamName')),
    awayTeamName: textOf(firstDirectChild(node, 'awayTeamName')),
    league: leagueParts.join(' · '),
    kickoff: kickoff ? new Date(Number.parseInt(kickoff, 10)).toISOString() : new Date().toISOString(),
    marketId,
    marketName,
    marketDescription,
    outcomeId,
    outcomeDescription,
    odds: Number.isFinite(odds) ? odds : 0,
  };
}

function parseSelectionNode(node: Element): SportyBetSelectionNode | null {
  const eventId = textOf(firstDirectChild(node, 'eventId'));
  const marketId = textOf(firstDirectChild(node, 'marketId'));
  const outcomeId = textOf(firstDirectChild(node, 'outcomeId'));

  if (!eventId || !marketId || !outcomeId) return null;

  return {
    eventId,
    marketId,
    specifier: textOf(firstDirectChild(node, 'specifier')) || null,
    outcomeId,
    productId: textOf(firstDirectChild(node, 'productId')) || null,
    stake: textOf(firstDirectChild(node, 'stake')) || null,
  };
}

function parseSportyBetSlipXml(xmlText: string, bookmaker: 'sportybet', code: string): DecodedBetSlip {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = xmlDoc.querySelector('parsererror');

  if (parseError) {
    throw new Error('SportyBet response could not be parsed as XML.');
  }

  const baseRsp = xmlDoc.documentElement;
  const bizCode = textOf(firstDirectChild(baseRsp, 'bizCode'));
  const message = textOf(firstDirectChild(baseRsp, 'message'));

  if (bizCode !== '10000' && message.toLowerCase() !== 'success') {
    throw new Error(message || 'SportyBet booking code lookup failed.');
  }

  const dataNode = firstDirectChild(baseRsp, 'data');
  const ticketNode = dataNode ? firstDirectChild(dataNode, 'ticket') : null;
  const selectionsContainer = ticketNode ? firstDirectChild(ticketNode, 'selections') : null;
  const selectionNodes = selectionsContainer ? directChildren(selectionsContainer, 'selections') : [];
  const outcomeNodes = dataNode ? directChildren(dataNode, 'outcomes') : [];

  const outcomesByEventId = new Map<string, SportyBetOutcomeNode>();
  for (const outcomeNode of outcomeNodes) {
    const parsedOutcome = parseOutcomeNode(outcomeNode);
    if (parsedOutcome) {
      outcomesByEventId.set(parsedOutcome.eventId, parsedOutcome);
    }
  }

  const selections: DecodedSelection[] = selectionNodes.map((selectionNode, index) => {
    const parsedSelection = parseSelectionNode(selectionNode);
    if (!parsedSelection) {
      throw new Error(`SportyBet selection ${index + 1} is missing required fields.`);
    }

    const matchedOutcome = outcomesByEventId.get(parsedSelection.eventId);
    const odds = matchedOutcome?.odds ?? 0;
    const homeTeam = matchedOutcome?.homeTeamName ?? '';
    const awayTeam = matchedOutcome?.awayTeamName ?? '';
    const match = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : parsedSelection.eventId;
    const league = matchedOutcome?.league || 'SportyBet';
    const market = matchedOutcome?.marketDescription || matchedOutcome?.marketName || `Market ${parsedSelection.marketId}`;
    const selection = matchedOutcome?.outcomeDescription || parsedSelection.specifier || `Outcome ${parsedSelection.outcomeId}`;

    return {
      match,
      league,
      homeTeam: homeTeam || match,
      awayTeam,
      kickoff: matchedOutcome?.kickoff ?? new Date().toISOString(),
      market,
      selection,
      odds,
    };
  });

  const totalOdds = +selections.reduce((acc, selection) => acc * (selection.odds || 1), 1).toFixed(2);

  return {
    bookmaker,
    code,
    selections,
    totalOdds,
    decodedAt: new Date().toISOString(),
  };
}

async function fetchSportyBetShareCode(code: string): Promise<string> {
  const shareCode = code.trim().toUpperCase().replace(/\s/g, '');
  const url = `https://www.sportybet.com/api/ng/orders/share/${encodeURIComponent(shareCode)}?_t=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/xml, text/xml, application/xhtml+xml, text/plain;q=0.9, */*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`SportyBet returned HTTP ${response.status}.`);
  }

  return response.text();
}

export const sportybetDecoder: BetCodeDecoder = {
  bookmaker: 'sportybet',
  validateCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
    return /^[A-Z0-9]{6,14}$/.test(cleaned);
  },
  async decode(code: string): Promise<DecodedBetSlip> {
    if (!this.validateCode(code)) {
      throw new Error('Invalid SportyBet bet code format. Expected 6–14 alphanumeric characters.');
    }

    const normalizedCode = code.trim().toUpperCase().replace(/\s/g, '');

    try {
  const xmlText = await fetchSportyBetShareCode(normalizedCode);
  return parseSportyBetSlipXml(xmlText, 'sportybet', normalizedCode);
} catch (error) {
  console.error('SportyBet live decode failed:', error);
  throw new Error(
    'Unable to decode SportyBet code. Please check the code or try again.'
  );
}
},
  async encode(selections: DecodedSelection[]): Promise<string> {
    return generateDestinationCode('sportybet', selections);
  },
  // Add the safe fallback for getCodeTimestamp
  getCodeTimestamp(code: string): string | null {
    // TODO: Implement timestamp extraction for SportyBet codes
    // For now, return null to fall back to the default behavior.
    return null;
  },
};