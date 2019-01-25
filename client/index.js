const can = document.getElementById("e");
const ctx = can.getContext("2d");

const test = document.getElementById("test");
test.remove();

const io = require("socket.io-client");
const socket = io();

socket.on("connect", () => {
	can.style.opacity = 1;
	hud.style.opacity = 1;
});

socket.on("size", size => {
	can.width = size;
	can.height = size;
});

let selected = "WallBlock";
function setSelected(value) {
	selected = value;
	Array.from(hud.children).forEach(child => {
		if (child.dataset.type === value) {
			child.style.borderColor = "#18a9ff";
		} else {
			child.style.borderColor = "white";
		}
	})
}

socket.on("placedata", placeData => {
	if (!Array.isArray(placeData)) return;

	hud.innerText = "";
	placeData.forEach(placeable => {
		const elem = document.createElement("div");

		elem.dataset.type = placeable[0];
		elem.innerText = placeable[1];
		elem.title = placeable[2];
		elem.style.background = placeable[3];

		elem.addEventListener("click", () => {
			setSelected(placeable[0]);
		});

		hud.appendChild(elem);
	});

	setSelected("WallBlock");
});

function minMax(val, max, min = 0) {
	return Math.max(min, Math.min(max, val));
}

can.addEventListener("click", event => {
	const bound = can.getBoundingClientRect();

	const xMult = bound.width / can.width;
	const yMult = bound.height / can.height;

	const clickX = minMax(Math.floor(event.offsetX / xMult), can.width);
	const clickY = minMax(Math.floor(event.offsetY / yMult), can.height);

	socket.emit("place", {
		type: selected,
		x: clickX,
		y: clickY,
	});
});

let blocks = [];
socket.on("update", newBlocks => {
	blocks = newBlocks;
});

window.addEventListener("keydown", event => {
	switch (event.code) {
		case "KeyW":
		case "ArrowUp":
			socket.emit("move", 1);
			break;
		case "KeyS":
		case "ArrowDown":
			socket.emit("move", 2);
			break;
		case "KeyD":
		case "ArrowRight":
			socket.emit("move", 3);
			break;
		case "KeyA":
		case "ArrowLeft":
			socket.emit("move", 4);
			break;
	}
});

function render() {
	blocks.forEach((row, rowID) => {
		row.forEach((block, col) => {
			ctx.fillStyle = block;
			ctx.fillRect(col, rowID, 1, 1);
		})
	});

	window.requestAnimationFrame(render);
}
render();