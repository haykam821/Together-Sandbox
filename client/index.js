const can = document.getElementById("e");
const ctx = can.getContext("2d");

const test = document.getElementById("test");
test.remove();

const io = require("socket.io-client");
const socket = io();

socket.on("size", size => {
	can.width = size;
	can.height = size;
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