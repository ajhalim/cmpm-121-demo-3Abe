import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Cell, Board } from "./board";
import { Coin, Geocache } from "./geocache";

// ---------------------------------------------- Global Vars --------------------------------------------------------------------------------------------
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 1e-2;
const BIN_SPAWN_PROBABILITY = 0.01;
const MAX_ZOOM = 19;
const NULL_ISLAND = leaflet.latLng({
  lat: 0,
  lng: 0,
});
const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const mapContainer = document.querySelector<HTMLElement>("#map")!;
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

let currentBins: leaflet.Rectangle[] = [];

const map = leaflet.map(mapContainer, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: 0,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  scrollWheelZoom: true,
});

//base map
/*
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: MAX_ZOOM,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

 */

// sattelite map
leaflet
  .tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      minZoom: 0,
      maxZoom: MAX_ZOOM,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }
  )
  .addTo(map);

// ---------------------------------------------- Buttons --------------------------------------------------------------------------------------------
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  updatePosition()
    .then(() => {
      // create new polyline at new location
      playerPaths.push([]);
      const currentPath = playerPaths[playerPaths.length - 1];
      currentPolyline = leaflet
        .polyline(currentPath, {
          color: "red",
        })
        .addTo(map);

      updateMap();
      map.setZoom(MAX_ZOOM);
    })
    .catch(() => {
      console.error();
    });
});

let buttonisDown: "north" | "south" | "west" | "east" | null = null;
const northButton = document.querySelector("#north")!;
northButton.addEventListener("mousedown", () => {
  buttonisDown = "north";
});
const southButton = document.querySelector("#south")!;
southButton.addEventListener("mousedown", () => {
  buttonisDown = "south";
});
const westButton = document.querySelector("#west")!;
westButton.addEventListener("mousedown", () => {
  buttonisDown = "west";
});
const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("mousedown", () => {
  buttonisDown = "east";
});
document.addEventListener("mouseup", () => {
  buttonisDown = null;
});
document.addEventListener("mouseleave", () => {
  buttonisDown = null;
});
const resetButton = document.querySelector("#reset")!;

//modify this later to prompt user if they are sure
resetButton.addEventListener("click", () => {
  if (!window.confirm("Are you sure you want to erase all progress?")) return; //confirm with user before reset
  localStorage.clear();
  // reset player position and remove path history
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
  // add point to player path
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
    if (luck([cell.i, cell.j].toString()) < BIN_SPAWN_PROBABILITY) {
      makeBin(cell);
    }
  });
}

function makeBin(cell: Cell) {
  const geocache: Geocache = new Geocache(cell, board);

  // recover state of cell if its been cached
  if (momentos.has(cell)) {
    geocache.fromMomento(momentos.get(cell)!);
  }

  // create a virtual bin using leaflet rectangle
  const bin = leaflet.rectangle(board.getCellBounds(cell), { opacity: 1 });
  currentBins.push(bin);

  // update color of bin based on number of coins
  function updateBinColor() {
    const minMid = 10;
    const maxMid = 30;
    const numCoins = geocache.getNumCoins();
    if (numCoins <= 0) bin.setStyle({ color: "grey" });
    if (numCoins > 0 && numCoins < minMid) bin.setStyle({ color: "red" });
    if (numCoins >= minMid && numCoins < maxMid)
      bin.setStyle({ color: "yellow" });
    if (numCoins >= maxMid) bin.setStyle({ color: "blue" });

    bin.setTooltipContent(`${numCoins} coins`);
  }

  updateBinColor();

  // pop up for user to interact with the bin
  bin.bindPopup(() => {
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
        const button = createButton(popped.toString());
        buttonsContainer.append(button);
      }
      updateUI();
    });

    function updateUI() {
      container.querySelector<HTMLSpanElement>(
        "#numCoins"
      )!.innerText = `${geocache.getNumCoins().toString()} coins`;
      pointsDisplay.innerText = `${playerCoins.length} points accumulated`;
      updateBinColor();

      //cache new bin state
      momentos.set(cell, geocache.toMomento());

      // save map state to local storage
      localStorage.setItem("momentos", JSON.stringify(Array.from(momentos)));
      // save player coins to local storage
      localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
    }

    //creates a single button for a coin
    function createButton(coinName: string) {
      const button = document.createElement("button");
      button.innerText = coinName;
      button.addEventListener("click", () => {
        const popped = geocache.removeCoin(coinName);
        if (popped !== undefined) {
          playerCoins.push(popped);
          messages.innerText = `Collected coin: ${popped.toString()}`;
          button.hidden = true;
          updateUI();
        }
      });
      return button;
    }
    // create button for each coin
    geocache.getCoinNames().forEach((coinName) => {
      const button = createButton(coinName);
      buttonsContainer.append(button);
    });

    container.append(title, depositButton, buttonsContainer);
    return container;
  });

  bin.addTo(map);
}

// updates map based on playerPos and playerPath
function updateMap() {
  // this always adds playerPos to the path, maybe should only do this if newest point in path != playerPos
  // as a result, every page refresh calls this function and adds the same playerPos to the playerPaths array
  addPointToPlayerPath(playerPos);

  updatePlayerMarker();

  map.setView(playerMarker.getLatLng());
  refreshBins(playerPos); // respawn bins around player
}

// ---------------------------------------------- update loop --------------------------------------------------------------------------------------------
function update() {
  // player movement
  if (buttonisDown !== null) {
    switch (buttonisDown) {
      case "north":
        playerPos.lat += TILE_DEGREES;
        updateMap();
        break;
      case "south":
        playerPos.lat -= TILE_DEGREES;
        updateMap();
        break;
      case "west":
        playerPos.lng -= TILE_DEGREES;
        updateMap();
        break;
      case "east":
        playerPos.lng += TILE_DEGREES;
        updateMap();
        break;
    }
  }
  requestAnimationFrame(update);
}

// ---------------------------------------------- main body --------------------------------------------------------------------------------------------
// recover map state from localstorage if available
//localStorage.clear();
console.log("start MERILL: ", MERRILL_CLASSROOM);

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
  playerCoins = JSON.parse(cachedPlayerCoins) as Coin[];
  pointsDisplay.innerText = `${playerCoins.length} points accumulated`;
  console.log("cached playerCoins: ", playerCoins);
}
if (cachedPlayerPos != null) {
  playerPos = JSON.parse(cachedPlayerPos) as LatLng;
  console.log("cached playerPos: ", playerPos);
} else {
  playerPos = MERRILL_CLASSROOM;
}
if (cachedplayerPaths != null) {
  playerPaths = JSON.parse(cachedplayerPaths) as LatLng[][];

  console.log("cached playerPaths: ", playerPaths);

  //draw all paths from playerPaths
  playerPaths.forEach((path) => {
    polylines.push(
      leaflet
        .polyline(path, {
          color: "red",
        })
        .addTo(map)
    );
    console.log("added polyline to polylines: ", path);
  });
  //newest polyline is stored in currentPolyline
  currentPolyline = polylines[polylines.length - 1];
}

let playerMarker = leaflet.marker(playerPos);

console.log("on start, path: ", playerPaths);

updateMap();
update();
