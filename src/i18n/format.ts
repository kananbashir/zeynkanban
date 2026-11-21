/** Fills {placeholders} in a translated sentence: fill("Hello {name}", { name: "Aysel" }). */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
