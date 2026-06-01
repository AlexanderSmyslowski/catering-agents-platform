export function cleanedSearchLabel(label: string): string {
  const segments = label
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const keptSegments = segments.filter((segment) => {
    const normalized = segment.toLowerCase();
    if (/^(de\s*luxe?|de\s*lux|frischged[öo]ns|topping)$/i.test(normalized)) {
      return false;
    }
    return true;
  });

  const merged = keptSegments.length > 0 ? keptSegments.join(" ") : label;
  return merged
    .replace(/[&/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function primarySearchSegment(label: string): string {
  return label.split("|")[0]?.trim() || label.trim();
}
