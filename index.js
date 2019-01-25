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
	"linear-gradient(to bottom, white, gray)",
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
	"black",
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
			console.log("cool")

			const dist = map.distanceBetween(this.x, this.y, data.x, data.y);
			if (dist > 5) return;
			console.log("cool2")

			const currTile = map.get(data.x, data.y);
			if (!placeNames.includes(currTile.constructor.name)) return;
			console.log("cool3", data)

			const placedTile = new (placeables[data.type])();
			map.setTile(data.x, data.y, placedTile, false);
		});
	}
}

const placeables = {
	Block,
	WallBlock,
};
const placeData = Object.values(placeables).map(placeable => [
	placeable.name,
	...placeable.clientInfo,
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