export type ScreenLayoutItem = {
  id: string;
  col: number;
  row: number;
  width?: number;
  height?: number;
  rotate?: number;
};

export const stageBounds = { width: 11, height: 6.4 };

export const screenLayoutItems: ScreenLayoutItem[] = [
  { id: "A1", col: 5.5, row: 0.7, width: 3.9, height: 1.05 },
  { id: "B1", col: 2.9, row: 1.75 },
  { id: "B2", col: 3.95, row: 1.75 },
  { id: "B3", col: 5.0, row: 1.75 },
  { id: "B4", col: 6.05, row: 1.75 },
  { id: "B5", col: 7.1, row: 1.75 },
  { id: "B6", col: 8.15, row: 1.75 },
  { id: "C1", col: 1.75, row: 2.55, rotate: -14 },
  { id: "C2", col: 2.55, row: 2.35, rotate: -4 },
  { id: "C3", col: 8.45, row: 2.35, rotate: 4 },
  { id: "C4", col: 9.25, row: 2.55, rotate: 14 },
  { id: "D1", col: 4.2, row: 3.35 },
  { id: "D2", col: 5.5, row: 3.15 },
  { id: "D3", col: 6.8, row: 3.35 },
  { id: "E1", col: 5.5, row: 4.35, width: 1.15 },
  { id: "F1", col: 5.5, row: 5.55, width: 1.2 },
  { id: "L1", col: 0.95, row: 4.2, height: 0.82 },
  { id: "L2", col: 0.95, row: 5.4, height: 0.82 },
  { id: "R1", col: 10.05, row: 4.2, height: 0.82 },
  { id: "R2", col: 10.05, row: 5.4, height: 0.82 }
];

export const screenLayoutOrder = screenLayoutItems.map((s) => s.id);

export function getScreenLayoutStyle(
  item: ScreenLayoutItem,
  bounds: { width: number; height: number } = stageBounds
): React.CSSProperties {
  const width = item.width ?? 0.78;
  const height = item.height ?? 0.52;
  return {
    left: `${((item.col - width / 2) / bounds.width) * 100}%`,
    top: `${((item.row - height / 2) / bounds.height) * 100}%`,
    width: `${(width / bounds.width) * 100}%`,
    height: `${(height / bounds.height) * 100}%`,
    transform: item.rotate ? `rotate(${item.rotate}deg)` : undefined
  };
}
