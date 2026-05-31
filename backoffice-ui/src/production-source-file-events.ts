export type ProductionSourceDropEventLike = {
  dataTransfer: {
    files?: ArrayLike<File> | null;
  };
};

export type ProductionSourceFileSelectionEventLike = {
  target: {
    files?: ArrayLike<File> | null;
  };
};

export function getProductionSourceDroppedFile(event: ProductionSourceDropEventLike): File | undefined {
  return event.dataTransfer.files?.[0];
}

export function getProductionSourceSelectedFile(event: ProductionSourceFileSelectionEventLike): File | undefined {
  return event.target.files?.[0];
}
