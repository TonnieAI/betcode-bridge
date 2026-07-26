export type PaymentProviderName = 'paystack' | 'stripe' | 'flutterwave';

export interface InitializePaymentPayload {
  email: string;
  amountMajor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface PaymentInitializationResult {
  authorizationUrl: string;
  reference: string;
}

export interface NormalizedTransaction {
  eventType: string;
  reference: string;
  ok: boolean;
  status: string;
  gatewayTransactionId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  amountMinor: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  rawPayload: Record<string, unknown>;
}

export interface WebhookHandlingResult {
  signatureValid: boolean;
  transaction: NormalizedTransaction;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  readonly supportedCurrencies: string[];
  initializePayment(payload: InitializePaymentPayload): Promise<PaymentInitializationResult>;
  verifyPayment(reference: string): Promise<NormalizedTransaction>;
  handleWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): WebhookHandlingResult;
  normalizeTransaction(payload: unknown, source: 'verify' | 'webhook'): NormalizedTransaction;
}
