const NUMBER_PATTERN = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)`;
// Tesseract commonly reads small “100 g” headings as 1O0 g, l00 q or 1009.
// A slash followed by 100 is also accepted when the unit itself was lost.
const PER_100_AMOUNT_PATTERN = String.raw`(?:1|l|i)[0o]{2}\s*(?:g(?:r)?|q|9|ml|m[li1])`;
const PER_100_REFERENCE_PATTERN = new RegExp(
  String.raw`(?:\b(?:per|por|na|w)\s*|[/\\|]\s*)${PER_100_AMOUNT_PATTERN}(?:\b|(?=\s|$))|[/\\|]\s*(?:1|l|i)[0o]{2}(?!\d)|\b${PER_100_AMOUNT_PATTERN}(?:\b|(?=\s|$))`,
  'i'
);

const normalizeText = (value) => String(value || '')
  .toLocaleLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l')
  .replace(/ß/g, 'ss')
  .replace(/[|]/g, 'l')
  .replace(/[ \t]+/g, ' ');

const parseNumber = (value) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : null;
};

const chooseMatch = (matches, preferredColumn) => {
  if (matches.length === 0) return null;
  return preferredColumn === 'last' ? matches.at(-1) : matches[0];
};

const findPreferredColumn = (lines) => {
  const portionPattern = /por(?:cion|cja)|serving/;
  const per100Pattern = PER_100_REFERENCE_PATTERN;

  for (const line of lines) {
    const portionIndex = line.search(portionPattern);
    const per100Index = line.search(per100Pattern);
    if (portionIndex < 0 || per100Index < 0) continue;
    return per100Index > portionIndex ? 'last' : 'first';
  }

  return 'first';
};

const findKcal = (lines, fullText, preferredColumn) => {
  const energyLabel = /energia|energija|energy|wartosc energetyczna|energijska vrednost|kalori|calori|brennwert/;
  const kcalPattern = new RegExp(`${NUMBER_PATTERN}\\s*k\\s*cal\\b`, 'gi');

  for (const line of lines) {
    if (!energyLabel.test(line)) continue;
    const matches = [...line.matchAll(kcalPattern)];
    const match = chooseMatch(matches, preferredColumn);
    if (match) return parseNumber(match[1]);
  }

  const fallback = [...fullText.matchAll(kcalPattern)][0];
  return fallback ? parseNumber(fallback[1]) : null;
};

const findGrams = (lines, labels, excludedLabels = [], preferredColumn = 'first') => {
  const labelPattern = new RegExp(labels.join('|'), 'i');
  const excludedPattern = excludedLabels.length
    ? new RegExp(excludedLabels.join('|'), 'i')
    : null;
  const gramsPattern = new RegExp(`${NUMBER_PATTERN}\\s*g\\b`, 'gi');

  for (const line of lines) {
    const labelMatch = line.match(labelPattern);
    if (!labelMatch || (excludedPattern && excludedPattern.test(line))) continue;

    const afterLabel = line.slice((labelMatch.index || 0) + labelMatch[0].length);
    const matches = [...afterLabel.matchAll(gramsPattern)];
    const match = chooseMatch(matches, preferredColumn);
    if (match) return parseNumber(match[1]);
  }

  return null;
};

export const parseNutritionText = (rawText) => {
  const normalized = normalizeText(rawText);
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const preferredColumn = findPreferredColumn(lines);

  const values = {
    kcal: findKcal(lines, normalized, preferredColumn),
    protein: findGrams(lines, [
      String.raw`\bproteins?\b`,
      String.raw`\bproteinas?\b`,
      String.raw`\bbialko\b`,
      String.raw`\bproteini\b`,
      String.raw`\bbeljakovine\b`,
      String.raw`\beiweiss\b`
    ], [], preferredColumn),
    carbs: findGrams(lines, [
      String.raw`\bcarbohydrates?\b`,
      String.raw`\bhidratos?(?: de carbono)?\b`,
      String.raw`\bweglowodany\b`,
      String.raw`\bugljeni\s+hidrati\b`,
      String.raw`\bogljikovi\s+hidrati\b`,
      String.raw`\bglucides?\b`,
      String.raw`\bkohlenhydrate\b`
    ], [], preferredColumn),
    fat: findGrams(lines, [
      String.raw`\bfats?\b`,
      String.raw`\bgrasas?\b`,
      String.raw`\btluszcz(?:e|u)?\b`,
      String.raw`\bmasti\b`,
      String.raw`\bmascobe\b`,
      String.raw`\blipides?\b`,
      String.raw`\bfett\b`
    ], [
      String.raw`nasycon`,
      String.raw`saturat`,
      String.raw`saturad`,
      String.raw`zasic`,
      String.raw`nasic`,
      String.raw`gesatt`
    ], preferredColumn)
  };

  return {
    ...values,
    detectedCount: Object.values(values).filter((value) => value !== null).length,
    hasPer100Reference: PER_100_REFERENCE_PATTERN.test(normalized)
  };
};
