const http = require("http");

const express = require("express");
const app = express();

app.use(express.static(__dirname + "/static"));

const browserify = require("browserify-middleware");
app.use(browserify(__dirname + "/client"));

const server = http.Server(app);

const rand = require("rand-int");

function movePos(x, y, dir) {
	switch (dir) {
		case 1:
			return [x, y - 1];
			break;
		case 2:
			return [x, y + 1];
			break;
		case 3:
			return [x + 1, y];
			break;
		case 4:
			return [x - 1, y];
			break;
	}
}

class Block {
	constructor(color = "white") {
		this.color = color;
		this.above = null;

		this.type = this.constructor.name;

		this.solid = false;

		this.x = this.y = 0;
	}
	serialize() {
		return this.color;
	}
	revert() {
		return map.setTile(this.x, this.y, this.above);
	}

	collidable() {
		return !this.solid;
	}
}
Block.clientInfo = [
	"Empty",
	"Nothing!",
	"#ffffff",
];

class WallBlock extends Block {
	constructor() {
		super("black");
		this.solid = true;
	}
}
WallBlock.clientInfo = [
	"Wall",
	"A simple block that players cannot get through.",
	"#000000",
];

class PlayerBlock extends Block {
	constructor(socket) {
		super("brown");
		this.id = socket.id;
		this.solid = true;

		socket.on("move", dir => {
			const old = this.above;
			const newPos = movePos(this.x, this.y, dir);
			if (map.valid(...newPos) && map.get(...newPos).collidable()) {
				map.setTile(...newPos, this);
				map.setTile(old.x, old.y, old);
			}
		});

		socket.on("place", data => {
			if (!placeNames.includes(data.type)) return;

			const dist = map.distanceBetween(this.x, this.y, data.x, data.y);
			if (dist > 12) return;

			const currTile = map.get(data.x, data.y);
			if (!placeNames.includes(currTile.type)) return;

			const placedTile = new (placeables[data.type])();
			map.setTile(data.x, data.y, placedTile, false);
		});
	}
}

function makeColorTile(color, name) {
	const colorTile = class extends Block {
		constructor() {
			super(color);
			this.solid = true;
			this.type = "ColorBlock_" + (name || color).replace(/ /g, "_");
		}
	}

	let displayName = (name || color) + " Wall";
	displayName = displayName.split(" ").map(part => {
		return part[0].toUpperCase() + part.slice(1);
	}).join(" ");

	colorTile.clientInfo = [
		displayName,
		`A wall that has been colored ${name || color}. Useful for pixel art.`,
		color,
	];

	return colorTile;
}

const placeables = {
	Block,
	WallBlock,
	ColorBlock_pink: makeColorTile("#e91e63", "pink"),
	ColorBlock_red: makeColorTile("#f44336", "red"),
	ColorBlock_orange: makeColorTile("#ff9800", "orange"),
	ColorBlock_yellow: makeColorTile("#ffeb3b", "yellow"),
	ColorBlock_green: makeColorTile("#4caf50", "green"),
	ColorBlock_blue: makeColorTile("#2196f3", "blue"),
	ColorBlock_indigo: makeColorTile("#3f51b5", "indigo"),
	ColorBlock_purple: makeColorTile("#9c27b0", "purple"),
};
const placeData = Object.entries(placeables).map(entry => [
	entry[0],
	...entry[1].clientInfo,
]);
const placeNames = Object.keys(placeables);

function getBlock() {
	if (Math.random() > 0.9) {
		return new WallBlock();
	} else {
		return new Block();
	}
}

class Map {
	constructor(size) {
		this.size = size;

		const mapNoBlocks = Array(size).fill(Array(size).fill(0));
		this.map = mapNoBlocks.map((row, row2) => {
			return row.map((__, col) => {
				const block = getBlock();

				block.y = row2;
				block.x = col;

				return block;
			});
		});
	}

	getColorMap() {
		return this.map.map(row => {
			return row.map(block => block.serialize());
		});
	}

	get(x, y) {
		return this.map[y][x];
	}

	tiles() {
		return this.map.reduce((acc, row) => {
			return acc.concat(row);
		}, []);
	}

	find(key, value) {
		return this.tiles().find(block => {
			return block[key] === value;
		});
	}

	valid(x, y) {
		return !(x < 0 || x >= this.size || y < 0 || y >= this.size);
	}

	setTile(x, y, newTile, old = true) {
		if (!this.valid(x, y)) {
			return false;
		};

		newTile.x = x;
		newTile.y = y;
		if (old) {
			newTile.above = this.map[y][x];
		}

		this.map[y][x] = newTile;
		update();

		return true;
	}

	rand() {
		return [rand(0, this.size - 1), rand(0, this.size - 1)]
	}

	distanceBetween(x1, y1, x2, y2) {
		// Praise ES6
		return Math.hypot(x2 - x1, y2 - y1);
	}
}
const map = new Map(30);

function update() {
	io.emit("size", map.size)
	io.emit("update", map.getColorMap());
}

const io = require("socket.io")(server);
io.on("connection", socket => {
	socket.emit("placedata", placeData);

	const pos = map.rand();
	map.setTile(pos[0], pos[1], new PlayerBlock(socket));

	socket.on("disconnect", () => {
		const playerTile = map.find("id", socket.id);
		if (playerTile) {
			playerTile.revert();
		}
	});
});

server.listen(8000);
