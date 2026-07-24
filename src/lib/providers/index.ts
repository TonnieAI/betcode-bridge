import { registerDecoder } from './registry';
import { bet9jaDecoder } from './decoders/bet9ja';
import { sportybetDecoder } from './decoders/sportybet';
import { betkingDecoder } from './decoders/betking';
import { xbetDecoder } from './decoders/xbet';
import { nairabetDecoder } from './decoders/nairabet';
import { merrybetDecoder } from './decoders/merrybet';
import { bangbetDecoder } from './decoders/bangbet';
import { msportDecoder } from './decoders/msport';
import { surebet247Decoder } from './decoders/surebet247';
import { premierbetDecoder } from './decoders/premierbet';

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  registerDecoder(bet9jaDecoder);
  registerDecoder(sportybetDecoder);
  registerDecoder(betkingDecoder);
  registerDecoder(xbetDecoder);
  registerDecoder(nairabetDecoder);
  registerDecoder(merrybetDecoder);
  registerDecoder(bangbetDecoder);
  registerDecoder(msportDecoder);
  registerDecoder(surebet247Decoder);
  registerDecoder(premierbetDecoder);
  initialized = true;
}

export { getDecoder, isDecoderAvailable, getRegisteredBookmakers } from './registry';
