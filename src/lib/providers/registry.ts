import type { BetCodeDecoder, BookmakerId } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Registry
//
// Each bookmaker registers a decoder plug-in. In production, when official APIs
// or licensed data feeds are available, the decoder's `decode()` method is
// swapped to call that external API instead of the local simulation. The
// interface stays the same — only the implementation behind it changes.
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<BookmakerId, BetCodeDecoder>();

export function registerDecoder(decoder: BetCodeDecoder): void {
  registry.set(decoder.bookmaker, decoder);
}

export function getDecoder(id: BookmakerId): BetCodeDecoder | undefined {
  return registry.get(id);
}

export function getRegisteredBookmakers(): BookmakerId[] {
  return Array.from(registry.keys());
}

export function isDecoderAvailable(id: BookmakerId): boolean {
  return registry.has(id);
}
