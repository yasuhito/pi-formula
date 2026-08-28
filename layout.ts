export interface CellDimensions {
  widthPx: number;
  heightPx: number;
}

export interface RasterLayout {
  widthPx: number;
  heightPx: number;
  columns: number;
  rows: number;
  scale: number;
}

export function calculateRasterLayout(
  imageWidth: number,
  imageHeight: number,
  display: boolean,
  availableWidth: number,
  cell: CellDimensions
): RasterLayout {
  const widthLimit = Math.max(1, Math.min(availableWidth, 255)) * cell.widthPx;
  const heightScale = display ? 1 : cell.heightPx / imageHeight;
  const scale = Math.min(heightScale, widthLimit / imageWidth, 1);
  const widthPx = Math.max(1, Math.round(imageWidth * scale));
  const heightPx = Math.max(1, Math.round(imageHeight * scale));

  return {
    widthPx,
    heightPx,
    columns: Math.ceil(widthPx / cell.widthPx),
    rows: display ? Math.ceil(heightPx / cell.heightPx) : 1,
    scale
  };
}
