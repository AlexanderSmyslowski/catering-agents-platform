export type ProductionWindowDragData = {
  types?: { includes: (type: string) => boolean };
  files?: ArrayLike<File>;
};

export type ProductionWindowDragEventLike = {
  dataTransfer?: ProductionWindowDragData | null;
  relatedTarget?: EventTarget | null;
};

export function shouldActivateProductionWindowDrag(event: ProductionWindowDragEventLike): boolean {
  return Boolean(event.dataTransfer?.types?.includes("Files"));
}

export function getProductionWindowDropFile(event: ProductionWindowDragEventLike): File | undefined {
  const files = event.dataTransfer?.files;
  return files && files.length > 0 ? files[0] : undefined;
}

export function shouldClearProductionWindowDrag(event: ProductionWindowDragEventLike): boolean {
  return event.relatedTarget === null;
}
