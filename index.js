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

class WallBlock extends Block {
	constructor() {
		super("black");
		this.solid = true;
	}
}

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
	}
}

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

	setTile(x, y, newTile) {
		if (!this.valid(x, y)) {
			return false;
		};

		newTile.x = x;
		newTile.y = y;
		newTile.above = this.map[y][x];

		this.map[y][x] = newTile;
		update();

		return true;
	}

	rand() {
		return [rand(0, this.size - 1), rand(0, this.size - 1)]
	}
}
const map = new Map(30);

function update() {
	io.emit("size", map.size)
	io.emit("update", map.getColorMap());
}

const io = require("socket.io")(server);
io.on("connection", socket => {
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