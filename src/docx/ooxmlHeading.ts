/** Resolve a Word heading label such as `Heading 2` or `Heading2`. */
export function headingLevelFromLabel(label: string): number | undefined {
  let compact = '';
  for (const character of label) {
    if (!character.trim()) continue;
    compact += character.toLowerCase();
  }
  for (let level = 1; level <= 6; level += 1) {
    if (compact === `heading${level}`) return level;
  }
  return undefined;
}
