// Swift-specific helpers shared across swift formatters.

import { camel, isReference } from '../../lib/utils.js';

// Flatten a dotted token path into a single Swift camelCase identifier.
// `["fg", "primary"]` -> `fgPrimary`
// `["bg", "surface", "container-inverted"]` -> `bgSurfaceContainerInverted`
// `["avatar", "bg", "amethyst"]` -> `avatarBgAmethyst`
export const flatCamel = (path) => {
  const parts = path.map((seg) => camel(String(seg)));
  const head = parts[0];
  const tail = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return head + tail.join('');
};

// "#RRGGBB" -> "UIColor(rgbHex: 0xRRGGBB)"
// "#RRGGBBAA" -> "UIColor(rgbaHex: 0xRRRR_RRRR)"  (underscore between hex byte 2 and 3)
export const hexToSwiftColor = (hex) => {
  const h = hex.replace('#', '').toUpperCase();
  if (h.length === 6) return `UIColor(rgbHex: 0x${h})`;
  if (h.length === 8) return `UIColor(rgbaHex: 0x${h.slice(0, 4)}_${h.slice(4, 8)})`;
  throw new Error(`Unexpected hex length: ${hex}`);
};

// "Inter" -> "inter", "Manrope" -> "manrope", "Martian Mono" -> "martianMono".
// Used both for the `family:` argument in TypographyStyleSpec and for the
// TypographySelection enum case.
export const fontFamilySlug = (fontName) => camel(String(fontName));

// Extract the leaf name of a `{Typography.fontWeight.semiBold}` reference for
// emitting Swift's `.semiBold` enum case. Source primitives already use
// camelCase leaves (regular, semiBold, extraBold, ...) so no transform needed.
// Falls back to a `FontWeight(rawValue: N)` form if the source isn't a ref.
export const fontWeightExpr = (entry) => {
  if (isReference(entry.ref)) {
    const leaf = String(entry.ref.slice(1, -1).split('.').pop());
    return `.${leaf}`;
  }
  return `.init(rawValue: ${entry.resolved})`;
};
