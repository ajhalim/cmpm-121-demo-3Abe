import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Cell, Board } from "./board";

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 1e-2;
const PIT_SPAWN_PROBABILITY = 0.01;
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

const map = leaflet.map(mapContainer, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: 0,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  scrollWheelZoom: true,
});

//base map

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: MAX_ZOOM,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerPos = leaflet.latLng(MERRILL_CLASSROOM);
let playerMarker = leaflet.marker(playerPos);

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
function updatePlayerMarker() {
  playerMarker.remove();
  playerMarker = leaflet.marker(playerPos);
  playerMarker.bindTooltip("That's you!");
  playerMarker.addTo(map);
}

// update player marker, set map view to player marker, spawn pits around player position
function updateMap() {
  updatePlayerMarker();
  map.setView(playerMarker.getLatLng());
  spawnPits(playerPos);
}

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  updatePosition()
    .then(() => {
      playerMarker.setLatLng(leaflet.latLng(playerPos.lat, playerPos.lng));
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

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
const pointsDisplay: HTMLDivElement = document.createElement("div");
pointsDisplay.id = "pointsDisplay";
pointsDisplay.innerHTML = "No points yet...";
const messages: HTMLDivElement = document.createElement("div");
messages.id = "messages";
statusPanel.append(pointsDisplay, messages);

let points = 0;
const coins: string[] = [];

function makePit(cell: Cell) {
  const { i, j } = cell;
  const bounds = board.getCellBounds(cell);
  //console.log("bounds: ", bounds);
  const localCoins: string[] = [];
  let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  for (let k = 0; k < value; k++) {
    localCoins.push(`${i}${j}#${k}`);
  }
  /*const imageUrl =
    "https://maps.lib.utexas.edu/maps/historical/newark_nj_1922.jpg";
  leaflet.imageOverlay(imageUrl, bounds, { opacity: 0.7 }).addTo(map); */

  function updatePitColor(pit: leaflet.Rectangle) {
    const minMid = 10,
      maxMid = 30;
    if (value <= 0) pit.setStyle({ color: "grey" });
    if (value > 0 && value < minMid) pit.setStyle({ color: "red" });
    if (value >= minMid && value < maxMid) pit.setStyle({ color: "yellow" });
    if (value >= maxMid) pit.setStyle({ color: "blue" });

    pit.setTooltipContent(`${value} coins`);
  }

  const pit = leaflet.rectangle(bounds, { opacity: 1 });
  pit.bindTooltip(`${value} coins`);
  updatePitColor(pit);
  pit.bindPopup(() => {
    const container = document.createElement("div");
    container.innerHTML = `
                <div>There is a pit here at "${i},${j}". It has value <span id="value">${value}</span>.</div>
                <button id="collect">collect</button>
                <button id="deposit">deposit</button>`;
    const collect = container.querySelector<HTMLButtonElement>("#collect")!;
    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;

    function updateCoins(isCollection: boolean) {
      if (isCollection && value > 0) {
        value--;
        points++;
        const popped = localCoins.pop()!;
        coins.push(popped);
        messages.innerText = `Collected coin: ${popped}`;
      }
      if (!isCollection && points > 0) {
        value++;
        points--;
        const depo = coins.pop()!;
        localCoins.push(depo);
        messages.innerHTML = `Depositted coin: ${depo}`;
      }
      // update UI
      container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
        value.toString();
      pointsDisplay.innerText = `${points} points accumulated`;

      updatePitColor(pit);
    }

    collect.addEventListener("click", () => updateCoins(true));
    deposit.addEventListener("click", () => updateCoins(false));

    return container;
  });
  pit.addTo(map);
}

function spawnPits(pos: leaflet.LatLng) {
  for (
    let i = pos.lat - NEIGHBORHOOD_SIZE;
    i < pos.lat + NEIGHBORHOOD_SIZE;
    i += TILE_DEGREES
  ) {
    for (
      let j = pos.lng - NEIGHBORHOOD_SIZE;
      j < pos.lng + NEIGHBORHOOD_SIZE;
      j += TILE_DEGREES
    ) {
      const cell = board.getCellforPoint(leaflet.latLng(i, j));
      if (containsPit(cell)) makePit(cell);
    }
  }
}

function containsPit(cell: Cell) {
  return luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY;
}

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

updateMap();
update();
