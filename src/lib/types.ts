// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for BetCode Bridge
// ─────────────────────────────────────────────────────────────────────────────

export type BookmakerId =
  | 'bet9ja'
  | 'sportybet'
  | 'betking'
  | '1xbet'
  | 'nairabet'
  | 'merrybet'
  | 'bangbet'
  | 'msport'
  | 'surebet247'
  | 'premierbet'
  | 'bet365'
  | 'williamhill'
  | 'ladbrokes'
  | 'coral'
  | 'paddypower'
  | 'skybet'
  | 'betfair'
  | 'betvictor'
  | 'unibet'
  | '888sport';

export type IntegrationMode = 'live' | 'simulated';

export interface Bookmaker {
  id: BookmakerId;
  name: string;
  shortName: string;
  color: string;
  logoUrl?: string;
  website: string;
  active: boolean;
  integrationMode: IntegrationMode;
}

// ── Normalized decoded selection ──────────────────────────────────────────────

export interface DecodedSelection {
  /** Original raw match string from the bet slip */
  match: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO 8601
  market: string;
  selection: string;
  odds: number;
}

export interface DecodedBetSlip {
  bookmaker: BookmakerId;
  code: string;
  selections: DecodedSelection[];
  totalOdds: number;
  stake?: number;
  potentialReturn?: number;
  decodedAt: string;
}

// ── Conversion result ──────────────────────────────────────────────────────────

export type SelectionStatus =
  | 'matched'
  | 'unavailable'
  | 'odds_changed'
  | 'market_changed'
  | 'suspended';

export interface ConvertedSelection {
  fixture: string;
  league: string;
  kickoff: string;
  market: string;
  selection: string;
  originalOdds: number;
  destinationOdds: number | null;
  oddsDifference: number | null;
  oddsChangePercent: number | null;
  availability: 'available' | 'unavailable' | 'suspended';
  status: SelectionStatus;
  notes?: string;
}

export interface ConversionResult {
  sourceBookmaker: BookmakerId;
  destinationBookmaker: BookmakerId;
  sourceCode: string;
  destinationCode: string;
  selections: ConvertedSelection[];
  matchedCount: number;
  unavailableCount: number;
  changedOddsCount: number;
  marketChangedCount: number;
  originalTotalOdds: number;
  destinationTotalOdds: number;
  conversionPercentage: number;
  createdAt: string;
}

// ── External provider response models ────────────────────────────────────────

export interface ShareCodeOutcome {
  eventId: string;
  eventName: string;
  marketName: string;
  specifier: string | null;
  odds: string;
}

export interface ShareCodeResponseData {
  shareCode: string;
  outcomes: ShareCodeOutcome[];
}

export interface ShareCodeApiResponse {
  code: string;
  message: string;
  data: ShareCodeResponseData;
}

// ── Provider interface ─────────────────────────────────────────────────────────

export interface BetCodeDecoder {
  bookmaker: BookmakerId;
  /** Validate that a code looks well-formed for this bookmaker */
  validateCode(code: string): boolean;
  /** Decode a bet code into normalized selections. Throws on failure. */
  decode(code: string): Promise<DecodedBetSlip>;
  /** Encode normalized selections into a bet code for this bookmaker. Throws on failure. */
  encode(selections: DecodedSelection[]): Promise<string>;
  /** Extract the timestamp from the bet code. Returns null if not available. */
  getCodeTimestamp?(code: string): string | null;
}

export interface OddsProvider {
  bookmaker: BookmakerId;
  /** Fetch live odds for a fixture + market. Returns null when unavailable. */
  fetchOdds(
    fixture: NormalizedFixture,
    market: NormalizedMarket,
  ): Promise<number | null>;
}

export interface NormalizedFixture {
  canonicalName: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
}

export interface NormalizedMarket {
  canonicalName: string;
  selection: string;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'enterprise';

export type BillingCycle = 'monthly' | 'yearly';

export type SubscriptionStatus = 'active' | 'pending' | 'failed' | 'cancelled' | 'expired';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'refunded';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price: number;
  currency: string;
  country?: string;
  currency_symbol?: string;
  payment_provider?: 'paystack' | 'flutterwave' | 'stripe';
  localized_price?: number | null;
  duration: BillingCycle;
  usage_limit: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: SubscriptionPlan;
  payment_provider: 'paystack' | 'flutterwave' | 'stripe';
  transaction_reference: string;
  subscription_status: SubscriptionStatus;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  start_date: string | null;
  expiry_date: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  subscription_id: string | null;
  transaction_id: string | null;
  gateway_reference: string;
  amount: number;
  status: PaymentStatus;
  payment_method: string | null;
  payment_provider: 'paystack' | 'flutterwave' | 'stripe';
  currency: string;
  paid_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  country: string;
  currency: string;
  language: 'en' | 'pt' | 'fr';
  plan: SubscriptionPlan;
  conversionsThisMonth: number;
  conversionLimit: number;
  createdAt: string;
  role: 'user' | 'admin';
}

// ── History / favorites ────────────────────────────────────────────────────────

export interface ConversionRecord {
  id: string;
  userId: string;
  sourceBookmaker: BookmakerId;
  destinationBookmaker: BookmakerId;
  code: string;
  conversionPercentage: number;
  matchedCount: number;
  unavailableCount: number;
  totalSelections: number;
  originalTotalOdds: number;
  destinationTotalOdds: number;
  createdAt: string;
  result: ConversionResult;
}

export interface FavoritePair {
  id: string;
  userId: string;
  sourceBookmaker: BookmakerId;
  destinationBookmaker: BookmakerId;
  createdAt: string;
}

// ── Notifications ──────────────────────────────────────────────────────────────

export type NotificationType =
  | 'conversion_completed'
  | 'match_unavailable'
  | 'odds_changed'
  | 'maintenance'
  | 'subscription_expiring';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
