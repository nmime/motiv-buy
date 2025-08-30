export function formatTitleFromClassName(className: string): string {
  return className
    .replace(/Exception$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}
