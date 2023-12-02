import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Cell, Board } from "./board";
import { Coin, Geocache } from "./geocache";

// ---------------------------------------------- Global Vars --------------------------------------------------------------------------------------------
const zoomLevel = 19;
const tileDegrees = 1e-4;
const neighborhoodSize = 1e-2;
const binFrequency = 0.01;
const maxZoom = 19;
const NULLIsland = leaflet.latLng({
  lat: 0,
  lng: 0,
});
const merrillClass = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const mapContainer = document.querySelector<HTMLElement>("#map")!;
const board = new Board(tileDegrees, neighborhoodSize);

let currentBins: leaflet.Rectangle[] = [];

const map = leaflet.map(mapContainer, {
  center: NULLIsland,
  zoom: zoomLevel,
  minZoom: 0,
  maxZoom: zoomLevel,
  zoomControl: true,
  scrollWheelZoom: true,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: maxZoom,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// labels
leaflet
  .tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }
  )
  .addTo(map);

// ---------------------------------------------- Buttons --------------------------------------------------------------------------------------------
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  updatePosition()
    .then(() => {
      // create new empty polyline
      playerPaths.push([]);
      const currentPath = playerPaths[playerPaths.length - 1];
      currentPolyline = leaflet
        .polyline(currentPath, {
          color: "red",
        })
        .addTo(map);

      updateMap();
      map.setZoom(maxZoom);
    })
    .catch(() => {
      console.error();
    });
});

let buttonisDown: "north" | "south" | "west" | "east" | null = null;
const northButton = document.querySelector("#north")!;
northButton.addEventListener("mousedown", () => (buttonisDown = "north"));
northButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  buttonisDown = "north";
});
const southButton = document.querySelector("#south")!;
southButton.addEventListener("mousedown", () => (buttonisDown = "south"));
southButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  buttonisDown = "south";
});
const westButton = document.querySelector("#west")!;
westButton.addEventListener("mousedown", () => (buttonisDown = "west"));
westButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  buttonisDown = "west";
});
const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("mousedown", () => (buttonisDown = "east"));
eastButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  buttonisDown = "east";
});
document.addEventListener("touchend", () => (buttonisDown = null));
document.addEventListener("mouseup", () => {
  buttonisDown = null;
});
document.addEventListener("mouseleave", () => {
  buttonisDown = null;
});
const resetButton = document.querySelector("#reset")!;

resetButton.addEventListener("click", () => {
  if (!window.confirm("Are you sure you want to erase all progress?")) return; //confirm with user before reset
  localStorage.clear();

  // not using MERILL_CLASSROOM here to avoid bug of playerPos not being set to correct coords
  playerPos = leaflet.latLng({
    lat: 36.9995,
    lng: -122.0533,
  });

  polylines.forEach((line) => line.remove());
  playerPaths = [[]];
  currentPolyline = leaflet.polyline(playerPaths, { color: "red" }).addTo(map);
  polylines = [currentPolyline];

  pointsDisplay.innerText = "No points yet...";
  messages.innerText = "";
  playerCoins = [];
  momentos.clear();

  updateMap();
});

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
const pointsDisplay: HTMLDivElement = document.createElement("div");
pointsDisplay.id = "pointsDisplay";
pointsDisplay.innerText = "No points yet...";
const messages: HTMLDivElement = document.createElement("div");
messages.id = "messages";
statusPanel.append(pointsDisplay, messages);

// ---------------------------------------------- helper functions --------------------------------------------------------------------------------------------
function updatePosition(): Promise<string> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.watchPosition(
      (position) => {
        playerPos.lat = position.coords.latitude;
        playerPos.lng = position.coords.longitude;
        resolve("success");
      },
      (error) => {
        reject(error);
      }
    );
  });
}

function addPointToPlayerPath(pos: leaflet.LatLng) {
  playerPaths[playerPaths.length - 1].push(leaflet.latLng(pos.lat, pos.lng));
  currentPolyline.addLatLng(leaflet.latLng(playerPos.lat, playerPos.lng));

  // save playerPos and playerPaths to local storage
  localStorage.setItem("playerPos", JSON.stringify(playerPos));
  localStorage.setItem("playerPaths", JSON.stringify(playerPaths));
}

function updatePlayerMarker() {
  playerMarker.remove();
  playerMarker = leaflet.marker(playerPos);
  playerMarker.bindTooltip("You are here");
  playerMarker.addTo(map);
}

// Given a point, remove all bins from map and spawn bins around point
function refreshBins(point: leaflet.LatLng) {
  currentBins.forEach((bin) => {
    bin.remove();
  });
  currentBins = [];
  const nearbyCells = board.getCellsNearPoint(point);
  nearbyCells.forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < binFrequency) {
      makeBin(cell);
    }
  });
}

// updates map based on playerPos and playerPath
function updateMap() {
  addPointToPlayerPath(playerPos);
  updatePlayerMarker();
  map.setView(playerMarker.getLatLng());
  refreshBins(playerPos); // respawn bins around player
}

// update color of bin based on number of coins
function updateBinColor(bin: leaflet.Rectangle, geocache: Geocache) {
  const minMid = 5;
  const maxMid = 10;
  const numCoins = geocache.getNumCoins();
  if (numCoins <= 0) bin.setStyle({ color: "red" });
  if (numCoins > 0 && numCoins < minMid) bin.setStyle({ color: "blue" });
  if (numCoins >= minMid && numCoins < maxMid) bin.setStyle({ color: "lime" });
  if (numCoins >= maxMid) bin.setStyle({ color: "cyan" });

  bin.setTooltipContent(`${numCoins} coins`);
}

function updateUI(container: HTMLDivElement, cell: Cell, geocache: Geocache) {
  container.querySelector<HTMLSpanElement>("#numCoins")!.innerText = `${geocache
    .getNumCoins()
    .toString()} coins`;
  if (playerCoins.length == 0) {
    pointsDisplay.innerText = `no coins ;w;`;
  } else {
    pointsDisplay.innerText = `${playerCoins.length} points accumulated`;
  }

  //cache new bin state
  momentos.set(cell, geocache.toMomento());

  // save map state to local storage
  localStorage.setItem("momentos", JSON.stringify(Array.from(momentos)));
  // save player coins to local storage
  localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
}

//creates a single button for a coin
function createButton(
  coinName: string,
  container: HTMLDivElement,
  cell: Cell,
  bin: leaflet.Rectangle,
  geocache: Geocache
) {
  const button = document.createElement("button");
  button.innerText = coinName;
  button.addEventListener("click", () => {
    const popped = geocache.removeCoin(coinName);
    if (popped !== undefined) {
      playerCoins.push(popped);
      messages.innerText = `Collected coin: ${popped.toString()}`;
      button.hidden = true;
      updateUI(container, cell, geocache);
      updateBinColor(bin, geocache);
    }
  });
  return button;
}

function createPopUp(cell: Cell, bin: leaflet.Rectangle, geocache: Geocache) {
  {
    const container = document.createElement("div");
    container.id = "pop-up-container";

    const title = document.createElement("span");
    title.id = "pop-up-title";
    title.innerHTML = `Bin: <span id="cellCoords">${cell.i}, ${
      cell.j
    }</span> contains <span id="numCoins">${geocache.getNumCoins()} coins</span>`;

    const buttonsContainer = document.createElement("div");
    buttonsContainer.id = "button-container";

    const depositButton = document.createElement("button");
    depositButton.id = "deposit-button";
    depositButton.innerText = "Deposit";

    depositButton.addEventListener("click", () => {
      const popped = playerCoins.pop();
      if (popped !== undefined) {
        geocache.addCoin(popped);
        messages.innerText = `Deposited coin: ${popped.toString()}`;
        const button = createButton(
          popped.toString(),
          container,
          cell,
          bin,
          geocache
        );
        buttonsContainer.prepend(button);
      }
      updateUI(container, cell, geocache);
      updateBinColor(bin, geocache);
    });

    // create button for each coin
    geocache
      .getCoinNames()
      .reverse()
      .forEach((coinName) => {
        const button = createButton(coinName, container, cell, bin, geocache);
        buttonsContainer.append(button);
      });

    container.append(title, depositButton, buttonsContainer);
    return container;
  }
}

function makeBin(cell: Cell) {
  const geocache: Geocache = new Geocache(cell, board);

  // recover state of geocache if its been cached
  if (momentos.has(cell)) {
    geocache.fromMomento(momentos.get(cell)!);
  }

  // create a virtual bin using leaflet rectangle
  const bin = leaflet.rectangle(board.getCellBounds(cell), { opacity: 1 });
  currentBins.push(bin);

  updateBinColor(bin, geocache);

  // pop up for user to interact with the bin
  bin.bindPopup(() => createPopUp(cell, bin, geocache));

  bin.addTo(map);
}

// ---------------------------------------------- update loop --------------------------------------------------------------------------------------------
function update() {
  // player movement
  if (buttonisDown !== null) {
    switch (buttonisDown) {
      case "north":
        playerPos.lat += tileDegrees;
        updateMap();
        break;
      case "south":
        playerPos.lat -= tileDegrees;
        updateMap();
        break;
      case "west":
        playerPos.lng -= tileDegrees;
        updateMap();
        break;
      case "east":
        playerPos.lng += tileDegrees;
        updateMap();
        break;
    }
  }
  requestAnimationFrame(update);
}

// ---------------------------------------------- main body --------------------------------------------------------------------------------------------

// recover map state from localstorage if available
const momentos = new Map<Cell, string>();
const dataString = localStorage.getItem("momentos");
if (dataString != null) {
  const serializedMomentos = JSON.parse(localStorage.getItem("momentos")!) as [
    Cell,
    string
  ][];
  serializedMomentos.forEach((pair: [Cell, string]) => {
    momentos.set(board.getCanonicalCell(pair[0]), pair[1]);
  });
}

let playerCoins: Coin[] = [];
let playerPos: leaflet.LatLng;

let playerPaths: leaflet.LatLng[][] = [[]];
let polylines: leaflet.Polyline[] = [];
let currentPolyline: leaflet.Polyline = leaflet.polyline([]);

//recover player state from localstorage if available
const cachedPlayerCoins = localStorage.getItem("playerCoins");
const cachedPlayerPos = localStorage.getItem("playerPos");
const cachedplayerPaths = localStorage.getItem("playerPaths");
if (cachedPlayerCoins != null) {
  const parsedCoins = JSON.parse(cachedPlayerCoins) as Coin[];
  playerCoins = parsedCoins.map(
    (coinData) => new Coin(coinData.cell, coinData.serial)
  );
  pointsDisplay.innerText = `${playerCoins.length} points accumulated`;
}
if (cachedPlayerPos != null) {
  playerPos = JSON.parse(cachedPlayerPos) as LatLng;
} else {
  playerPos = merrillClass;
}
if (cachedplayerPaths != null) {
  playerPaths = JSON.parse(cachedplayerPaths) as LatLng[][];

  //draw all paths from playerPaths
  playerPaths.forEach((path) => {
    polylines.push(
      leaflet
        .polyline(path, {
          color: "red",
        })
        .addTo(map)
    );
  });
  currentPolyline = polylines[polylines.length - 1];
}

let playerMarker = leaflet.marker(playerPos);

updatePlayerMarker();
map.setView(playerMarker.getLatLng());
refreshBins(playerPos);

update();
