import leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibility: number) {
    this.tileWidth = tileWidth; //1e-4
    this.tileVisibilityRadius = tileVisibility / this.tileWidth;
    this.knownCells = new Map();
  }

  getCellCoords(cell: Cell): leaflet.LatLng {
    return leaflet.latLng(cell.i * this.tileWidth, cell.j * this.tileWidth);
  }

  getCanonicalCell(cell: Cell): Cell {
    const key = [cell.i, cell.j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellforPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    const cell = { i: i, j: j };
    return this.getCanonicalCell(cell);
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [(cell.i - 0) * this.tileWidth, (cell.j + 0) * this.tileWidth],
      [(cell.i + 1) * this.tileWidth, (cell.j + 1) * this.tileWidth],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const originCell = this.getCellforPoint(point);
    const resultCells: Cell[] = [];
    for (
      let i = -this.tileVisibilityRadius;
      i < this.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = -this.tileVisibilityRadius;
        j < this.tileVisibilityRadius;
        j++
      ) {
        resultCells.push(
          this.getCanonicalCell({ i: originCell.i + i, j: originCell.j + j })
        );
      }
    }

    return resultCells;
  }
}
