import type { BookmakerId } from '../types';
import { bet9jaDecoder } from '../providers/decoders/bet9ja';
import { sportybetDecoder } from '../providers/decoders/sportybet';
import { betkingDecoder } from '../providers/decoders/betking';
import { xbetDecoder } from '../providers/decoders/xbet';
import { nairabetDecoder } from '../providers/decoders/nairabet';
import { merrybetDecoder } from '../providers/decoders/merrybet';
import { bangbetDecoder } from '../providers/decoders/bangbet';
import { msportDecoder } from '../providers/decoders/msport';
import { surebet247Decoder } from '../providers/decoders/surebet247';
import { premierbetDecoder } from '../providers/decoders/premierbet';
import { createLegacyDecoderAdapter } from './legacyDecoderAdapter';
import { getBookmakerAdapter as getRegisteredAdapter, getAllBookmakerAdapters, registerBookmakerAdapter } from './registry';
import type { BookmakerAdapter, BookmakerCapability } from './types';
import { ukBookmakerAdapters } from './ukUnavailableAdapters';

let initialized = false;

export function initBookmakerAdapters(): void {
  if (initialized) return;

  registerBookmakerAdapter(createLegacyDecoderAdapter(bet9jaDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(sportybetDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(betkingDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(xbetDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(nairabetDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(merrybetDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(bangbetDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(msportDecoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(surebet247Decoder));
  registerBookmakerAdapter(createLegacyDecoderAdapter(premierbetDecoder));

  for (const adapter of ukBookmakerAdapters) {
    registerBookmakerAdapter(adapter);
  }

  initialized = true;
}

export function getAdapter(id: BookmakerId): BookmakerAdapter | undefined {
  initBookmakerAdapters();
  return getRegisteredAdapter(id);
}

export function getBookmakerCapability(id: BookmakerId): BookmakerCapability | undefined {
  return getAdapter(id)?.capability;
}

export function listBookmakerCapabilities(): BookmakerCapability[] {
  initBookmakerAdapters();
  return getAllBookmakerAdapters().map((adapter) => adapter.capability);
}

export function getAvailabilityLabel(id: BookmakerId): string {
  const capability = getBookmakerCapability(id);
  if (!capability) return 'Integration required';

  if (capability.availability === 'full') {
    return 'Full conversion available';
  }

  if (capability.availability === 'partial') {
    return 'Decode only';
  }

  if (capability.availability === 'integration_required') {
    return 'Integration required';
  }

  return 'Integration required';
}
