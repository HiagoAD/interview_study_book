/** "1 section", "2 sections", "0 sections": the count with its noun, made plural by an `s`. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
