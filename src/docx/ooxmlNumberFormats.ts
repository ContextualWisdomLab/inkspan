/** Classify one Word list format into an Inkspan list kind. */
export function classifyNumberFormat(
  value: string | undefined,
): 'bulletList' | 'orderedList' | undefined {
  if (value === 'bullet') return 'bulletList';
  const orderedFormats = [
    'decimal',
    'decimalZero',
    'lowerLetter',
    'lowerRoman',
    'ordinal',
    'upperLetter',
    'upperRoman',
  ];
  return value && orderedFormats.includes(value) ? 'orderedList' : undefined;
}
