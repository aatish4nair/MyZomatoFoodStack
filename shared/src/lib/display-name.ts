// An opening bracket, then everything up to its matching close (or the end of the string if unclosed).
const BRACKETED = /\([^)]*(?:\)|$)|\[[^\]]*(?:\]|$)|\{[^}]*(?:\}|$)/g;

const COUNT_UNIT = String.raw`(?:pcs?|pieces?|nos?\.?|no\.)`;
const SIZE_UNIT = String.raw`(?:ml|ltrs?|litres?|liters?|l|kgs?|g|gms?|grams?|oz)`;
const NUMBER = String.raw`\d+(?:[./]\d+)?`;

/**
 * Metadata that is not part of the dish name. Every rule needs a number next to a unit (or the word
 * "serves"), so meaningful names such as "Chicken 65", "7 Up" or "No Added Sugar" are untouched.
 */
const METADATA: readonly RegExp[] = [
  // Packaging joined to a quantity: "Box - 4 pcs", "Pack of 2" (not "Bucket": it names the dish).
  new RegExp(
    String.raw`\s*\b(?:box|pack|tub)\b\s*(?:of\s*)?[-–:]?\s*\d+\s*${COUNT_UNIT}?(?=[\s.,;:\-–]|$)`,
    'gi',
  ),
  // Piece counts: "4 Pc", "6pc", "4 pcs", "2 Nos.", "12 pieces".
  new RegExp(String.raw`\b\d+\s*${COUNT_UNIT}(?=[\s.,;:\-–]|$)`, 'gi'),
  // Pack sizes and weights: "100ml", "500 ml", "1/2 Kg", "1.5L", "250g".
  new RegExp(String.raw`\b${NUMBER}\s*${SIZE_UNIT}\b\.?`, 'gi'),
  // Serving information: "Serves 1-2", "Serves 2 to 3", "serve 1".
  /\bserves?\s*\d+(?:\s*(?:-|–|to)\s*\d+)?\b\.?/gi,
];

/**
 * The clean dish name for display (search placeholder, "which one?" options, result heading,
 * image labels). It removes:
 * - bracketed parts: "(Medium Fat)", "[1/2 Kg]", "(6Pc)", "(breast Pcs)";
 * - quantities, piece counts and pack sizes: "4 Pc", "6pc", "2 Nos.", "100ml", "1/2Kg";
 * - serving information: "Serves 1-2";
 * - leftover separators and trailing punctuation.
 * "+ 1 Dip" becomes "and Dip". Display only: the original name stays unchanged in the data and is
 * what search matching and food-art categories use. Returns an empty string when nothing
 * readable is left (callers then fall back to the original name).
 */
export function toDisplayName(itemName: string): string {
  let name = itemName;
  // Repeat so nested brackets like "Thali (Veg (Large))" are fully removed.
  for (let previous = ''; previous !== name;) {
    previous = name;
    name = name.replace(BRACKETED, ' ');
  }
  name = name.replace(/[)\]}]/g, ' ').replace(/\s*\+\s*(?:\d+\s*(?:x\s*)?)?/gi, ' and ');
  for (const pattern of METADATA) name = name.replace(pattern, ' ');
  return name
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:])(?=[,.;:])/g, '')
    .replace(/(?:\s+[-–—])+(?=\s|$)/g, ' ')
    .replace(/^(?:and\s+)|\s+and$/gi, '')
    .replace(/^[\s,.;:\-–—]+|[\s,.;:\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
