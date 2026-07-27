import type { BookmakerId } from '../types';
import type { BookmakerAdapter } from './types';

const registry = new Map<BookmakerId, BookmakerAdapter>();

export function registerBookmakerAdapter(adapter: BookmakerAdapter): void {
  registry.set(adapter.bookmaker, adapter);
}

export function getBookmakerAdapter(id: BookmakerId): BookmakerAdapter | undefined {
  return registry.get(id);
}

export function getAllBookmakerAdapters(): BookmakerAdapter[] {
  return Array.from(registry.values());
}

export function getRegisteredAdapterBookmakers(): BookmakerId[] {
  return Array.from(registry.keys());
}
