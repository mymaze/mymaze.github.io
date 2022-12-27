const
    canvas = document.getElementById("canvas"),
    context = canvas.getContext("2d");

const
    diamondSize = document.getElementById("diamondSize"),
    randomTransferCheckBox = document.getElementById("randomTransferCheckBox"),
    randomTransferCount = document.getElementById("randomTransferCount");

const
    WALL = 0,
    ROAD = 1,
    TRANSFER = 2,
    EXIT = 3,
    PLAYER = 5;

let maze = null;


function startGame() {
    let space = parseInt(diamondSize.value);

    let transferCount = 0;
    if (randomTransferCheckBox.checked) {
        transferCount = parseInt(randomTransferCount.value);
    }

    let side = Math.floor((window.innerHeight - space * 2) / space);
    side = side % 2 ? side : side - 1;

    canvas.style.borderWidth = space + "px";
    canvas.width = side * space;
    canvas.height = side * space;

    maze = new Maze(context, side, side, space, transferCount);
    maze.start();

    return false;
}

class Maze {
    constructor(context, row, col, space, transferCount) {
        this.context = context;
        this.y = row;
        this.x = col;
        this.space = space;
        this.transferCount = transferCount;

        this.dir = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        this.now = [];
        this.end = [];
        this.map = [];
        this.legend = {
            [WALL]: "black",
            [ROAD]: "white",
            [TRANSFER]: "yellow",
            [EXIT]: "green",
            [PLAYER]: "blue"
        }
    }

    resetMap() {
        this.map = Array(this.y).fill().map(() => Array(this.x).fill(WALL));
    }

    getMap(xy) {
        return this.map[xy[1]][xy[0]];
    }

    setMap(xy, value) {
        this.map[xy[1]][xy[0]] = value;
    }

    turnTo(xy, dir) {
        return [xy[0] + dir[0], xy[1] + dir[1]];
    }

    random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    isSecurityScope(xy) {
        return xy[0] >= 0 && xy[0] < this.x && xy[1] >= 0 && xy[1] < this.y;
    }

    setStartAndEnd() {
        let corner = [[0, 0], [this.x - 1, 0], [0, this.y - 1], [this.x - 1, this.y - 1]];

        this.now = corner.splice(this.random(0, corner.length - 1), 1)[0];
        this.end = corner.splice(this.random(0, corner.length - 1), 1)[0];

        this.setMap(this.now, PLAYER);
        this.setMap(this.end, EXIT);
    }

    setRandomTransfer() {
        if (!this.transferCount) return;

        let count = 0;
        while (count !== this.transferCount) {
            let transferXY = [this.random(0, this.x - 1), this.random(0, this.y - 1)];
            if (this.getMap(transferXY) === WALL) {
                for (let curDir of this.dir) {
                    let diamond = this.turnTo(transferXY, curDir);
                    if (this.isSecurityScope(diamond) && this.getMap(diamond) === ROAD) {
                        this.setMap(transferXY, TRANSFER);
                        count++;
                        break;
                    }
                }
            }
        }
    }

    prim() {
        let stack = [[0, 1], [1, 0]];
        this.setMap([0, 0], ROAD);

        while (stack.length > 0) {
            let curWall = stack.splice(this.random(0, stack.length - 1), 1)[0];

            let check = [];
            for (let curDir of this.dir) {
                let road = this.turnTo(curWall, curDir);
                if (this.isSecurityScope(road) && this.getMap(road)) {
                    check.push([curDir[0] * -1, curDir[1] * -1]);
                }
            }

            if (check.length === 1) {
                let revDir = check.pop();
                let newRoad = this.turnTo(curWall, revDir);

                this.setMap(curWall, ROAD);
                this.setMap(newRoad, ROAD);

                for (let curDir of this.dir) {
                    let newWall = this.turnTo(newRoad, curDir);
                    if (this.isSecurityScope(newWall) && !this.getMap(newWall)) {
                        stack.push(newWall);
                    }
                }
            }
        }
        return this.map;
    }

    move(dir) {
        let nextPos = [this.now[0] + dir[0], this.now[1] + dir[1]];
        if (this.isSecurityScope(nextPos) && this.getMap(nextPos)) {
            switch (this.getMap(nextPos)) {
                case 2:
                    while (true) {
                        nextPos = [this.random(0, this.x - 1), this.random(0, this.y - 1)];
                        if (this.getMap(nextPos) === ROAD) break;
                    }
                    break;
                case 3:
                    if (confirm("恭喜通关！\n是否继续以当前设置开始新的迷宫？")) {
                        this.start();
                    }
                    return;
            }

            this.setMap(this.now, ROAD);
            this.setMap(nextPos, PLAYER);
            this.now = nextPos;

            this.draw();
        }
    }

    draw() {
        for (let y = 0; y < this.map.length; y++) {
            for (let x = 0; x < this.map[y].length; x++) {
                this.context.fillStyle = this.legend[this.getMap([x, y])];
                this.context.fillRect(x * this.space, y * this.space, this.space, this.space);
            }
        }
    }

    start() {
        this.resetMap();
        this.prim();
        this.setStartAndEnd();
        this.setRandomTransfer();
        this.draw();
    }
}

window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return; // Do nothing if event already handled
    if (!maze) return;

    switch (event.code) {
        case "KeyS":
        case "ArrowDown":
            // Handle "back"
            maze.move([0, 1]);
            break;
        case "KeyW":
        case "ArrowUp":
            // Handle "forward"
            maze.move([0, -1]);
            break;
        case "KeyA":
        case "ArrowLeft":
            // Handle "turn left"
            maze.move([-1, 0]);
            break;
        case "KeyD":
        case "ArrowRight":
            // Handle "turn right"
            maze.move([1, 0]);
            break;
    }

    if (event.code !== "Tab") {
        // Consume the event so it doesn't get handled twice,
        // as long as the user isn't trying to move focus away
        // event.preventDefault();
    }
}, true);