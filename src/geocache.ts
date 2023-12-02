import { Board, Cell } from "./board";
import luck from "./luck";

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

export class Coin {
  cell: Cell;
  serial: number;

  constructor(cell: Cell, serial: number) {
    this.cell = cell;
    this.serial = serial;
  }

  toString(): string {
    return `${this.cell.i}:${this.cell.j}#${this.serial}`;
  }
}

export class Geocache implements Momento<string> {
  cell: Cell;
  private board: Board;
  private currentCoins: Coin[];
  constructor(cell: Cell, board: Board, coinArray?: Coin[]) {
    this.cell = cell;
    this.board = board;
    if (coinArray != undefined) {
      this.currentCoins = coinArray;
      return this;
    }
    this.currentCoins = [];
    const numCoins = Math.floor(
      luck([cell.i, cell.j, "initialnumCoins"].toString()) * 10
    );
    for (let k = 0; k < numCoins; k++) {
      this.addCoin(new Coin(cell, k));
    }
  }

  //returns geocache obj from JSON representation
  fromJSON(json: string): Geocache {
    const parsedData = JSON.parse(json) as Geocache;
    const geocache = new Geocache(
      this.board.getCanonicalCell({
        i: parsedData.cell.i,
        j: parsedData.cell.j,
      }),
      this.board,
      parsedData.currentCoins
    );
    const currentCoins: Coin[] = [];
    geocache.currentCoins.forEach((_coin, index) =>
      currentCoins.push(new Coin(geocache.cell, index))
    );
    geocache.currentCoins = currentCoins;
    return geocache;
  }

  addCoin(coin: Coin) {
    this.currentCoins.push(coin);
  }

  removeCoin(coinName: string): Coin | undefined {
    const removedCoin = this.currentCoins.find((coin) => {
      return coin.toString() == coinName;
    });
    if (removedCoin != undefined) {
      this.currentCoins = this.currentCoins.filter(
        (coin) => coin != removedCoin
      );
    }
    return removedCoin;
  }

  getNumCoins(): number {
    return this.currentCoins.length;
  }

  getCoinNames(): string[] {
    return this.currentCoins.map((coin) => coin.toString());
  }

  toMomento(): string {
    return JSON.stringify(this);
  }

  fromMomento(momento: string) {
    const recoveredGeocache = this.fromJSON(momento);
    this.cell = recoveredGeocache.cell;
    this.currentCoins = recoveredGeocache.currentCoins;
  }
}
