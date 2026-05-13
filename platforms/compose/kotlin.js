// Kotlin/Compose-specific helpers shared across compose formatters.

import { camel } from '../../lib/utils.js';

// Kotlin identifier: backtick-escape if the name isn't a legal bare identifier.
export const ktIdent = (s) =>
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) ? s : `\`${s}\``;

export const propertyName = (segment) => ktIdent(camel(String(segment)));

// "#RRGGBB" or "#RRGGBBAA" -> "Color(0xAARRGGBB)" (Compose ARGB literal).
export const hexToComposeColor = (hex) => {
  const h = hex.replace('#', '').toLowerCase();
  let argb;
  if (h.length === 6) argb = `FF${h}`;
  else if (h.length === 8) argb = `${h.slice(6, 8)}${h.slice(0, 6)}`;
  else throw new Error(`Unexpected hex length: ${hex}`);
  return `Color(0x${argb.toUpperCase()})`;
};

// Compose FontWeight constants, keyed by the lowercased token name.
export const FONT_WEIGHT_CONSTANT = {
  thin: 'FontWeight.Thin',
  extralight: 'FontWeight.ExtraLight',
  light: 'FontWeight.Light',
  normal: 'FontWeight.Normal',
  regular: 'FontWeight.Normal',
  medium: 'FontWeight.Medium',
  semibold: 'FontWeight.SemiBold',
  bold: 'FontWeight.Bold',
  extrabold: 'FontWeight.ExtraBold',
  black: 'FontWeight.Black',
};
