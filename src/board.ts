import leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, { i: i, j: j });
    }
    return this.knownCells.get(key)!;
  }

  getCellforPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({ i: point.lat, j: point.lng });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i, cell.j],
      [cell.i + this.tileWidth, cell.j + this.tileWidth],
    ]);
  }

  getVisibilityBounds(pos: leaflet.LatLng) {
    return leaflet.latLngBounds([
      [
        pos.lat - this.tileVisibilityRadius,
        pos.lng - this.tileVisibilityRadius,
      ],
      [
        pos.lat + this.tileVisibilityRadius,
        pos.lng + this.tileVisibilityRadius,
      ],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const originCell = this.getCellforPoint(point);
    const resultCells: Cell[] = [
      { i: originCell.i + 1, j: originCell.j }, //top
      { i: originCell.i, j: originCell.j - 1 }, //left
      { i: originCell.i - 1, j: originCell.j }, //bottom
      { i: originCell.i, j: originCell.j + 1 }, //right
      { i: originCell.i + 1, j: originCell.j - 1 }, //top-left diag
      { i: originCell.i - 1, j: originCell.j - 1 }, //bottom-left diag
      { i: originCell.i - 1, j: originCell.j + 1 }, //bottom-right diag
      { i: originCell.i + 1, j: originCell.j + 1 }, //top-right diag
    ];

    return resultCells;
  }
}
