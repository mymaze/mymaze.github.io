const
    canvas = document.getElementById("canvas"),
    canvasContext = canvas.getContext("2d"),
    mask = document.getElementById("mask"),
    maskContext = mask.getContext("2d");

const
    options = document.getElementById("options"),
    diamondSize = document.getElementById("diamondSize"),
    randomTransferCheckBox = document.getElementById("randomTransferCheckBox"),
    randomTransferCount = document.getElementById("randomTransferCount"),
    convertCheckBox = document.getElementById("convertCheckBox"),
    convertSecond = document.getElementById("convertSecond"),
    nightCheckBox = document.getElementById("nightCheckBox"),
    nightGrid = document.getElementById("nightGrid");

const INFO = {
    MASK: -1,
    WALL: 0,
    ROAD: 1,
    TRANSFER: 2,
    EXIT: 3,
    PLAYER: 5
}

let maze = null;


function startGame() {
    let space = parseInt(diamondSize.value);

    let transferCount = 0;
    if (randomTransferCheckBox.checked) {
        transferCount = parseInt(randomTransferCount.value);
    }

    let interval = 0;
    if (convertCheckBox.checked) {
        interval = parseInt(convertSecond.value);
    }

    let viewGrid = 0;
    if (nightCheckBox.checked) {
        viewGrid = parseInt(nightGrid.value);
    }

    let row = Math.floor((window.innerHeight - space * 2) / space);
    row = row % 2 ? row : row - 1;
    let col = Math.floor((window.innerWidth - space * 2) / space);
    col = col % 2 ? col : col - 1;

    canvas.style.borderWidth = space + "px";
    canvas.width = col * space;
    canvas.height = row * space;

    mask.style.borderWidth = space + "px";
    mask.width = col * space;
    mask.height = row * space;

    let legend = {};
    for (let key in INFO) {
        legend[INFO[key]] = document.getElementById("color" + INFO[key]).value;
    }

    if (maze) maze.stop();
    maze = new Maze(canvasContext, maskContext, row, col, space, legend, transferCount, interval, viewGrid);
    maze.start();

    options.style.display = "none";
    canvas.style.display = "block";
    mask.style.display = "block";

    return false;
}

class Maze {
    constructor(mapContext, maskContext, row, col, space, legend, transferCount, interval, viewGrid) {
        this.mapContext = mapContext;
        this.maskContext = maskContext;
        this.y = row;
        this.x = col;
        this.space = space;
        this.legend = legend;
        this.transferCount = transferCount;
        this.interval = interval;
        this.viewGrid = viewGrid;

        this.dir = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        this.now = [0, 0];
        this.end = [col - 1, row - 1];
        this.map = [];
        this.timer = null;
    }

    resetMap() {
        this.map = Array(this.y).fill().map(() => Array(this.x).fill(INFO.WALL));
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
        if (!this.timer) {
            let corner = [[0, 0], [this.x - 1, 0], [0, this.y - 1], [this.x - 1, this.y - 1]];

            this.now = corner.splice(this.random(0, corner.length - 1), 1)[0];
            this.end = corner.splice(this.random(0, corner.length - 1), 1)[0];
        }

        this.setMap(this.now, INFO.PLAYER);
        this.setMap(this.end, INFO.EXIT);
    }

    setRandomTransfer() {
        if (!this.transferCount) return;

        let count = 0;
        while (count !== this.transferCount) {
            let transferXY = [this.random(0, this.x - 1), this.random(0, this.y - 1)];
            if (this.getMap(transferXY) === INFO.WALL) {
                for (let curDir of this.dir) {
                    let diamond = this.turnTo(transferXY, curDir);
                    if (this.isSecurityScope(diamond) && this.getMap(diamond) === INFO.ROAD) {
                        this.setMap(transferXY, INFO.TRANSFER);
                        count++;
                        break;
                    }
                }
            }
        }
    }

    prim() {
        let [nowX, nowY] = this.now;
        if (nowX % 2 === 1) nowX--;
        if (nowY % 2 === 1) nowY--;
        this.now = [nowX, nowY];

        let stack = [];
        for (let curDir of this.dir) {
            let wall = this.turnTo(this.now, curDir);
            if (this.isSecurityScope(wall)) {
                stack.push(wall);
            }
        }
        this.setMap(this.now, INFO.ROAD);

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

                this.setMap(curWall, INFO.ROAD);
                this.setMap(newRoad, INFO.ROAD);

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
                        if (this.getMap(nextPos) === INFO.ROAD) break;
                    }
                    break;
                case 3:
                    this.stop();
                    if (confirm("恭喜通关！\n是否继续以当前设置开始新的迷宫？")) {
                        this.stop();
                        this.start();
                    } else {
                        options.style.display = "block";
                    }
                    return;
            }

            this.setMap(this.now, INFO.ROAD);
            this.setMap(nextPos, INFO.PLAYER);
            this.now = nextPos;

            this.draw();
        }
    }

    draw() {
        for (let y = 0; y < this.map.length; y++) {
            for (let x = 0; x < this.map[y].length; x++) {
                this.mapContext.fillStyle = this.legend[this.getMap([x, y])];
                this.mapContext.fillRect(x * this.space, y * this.space, this.space, this.space);
            }
        }

        if (this.viewGrid) {
            let viewX = this.now[0] - this.viewGrid;
            let viewY = this.now[1] - this.viewGrid;

            this.maskContext.fillStyle = this.legend[INFO.MASK];
            this.maskContext.fillRect(0, 0, this.x * this.space, this.y * this.space);
            this.maskContext.clearRect(viewX * this.space, viewY * this.space, (this.viewGrid * 2 + 1) * this.space, (this.viewGrid * 2 + 1) * this.space);
        }
    }

    start() {
        this.resetMap();
        this.prim();
        this.setStartAndEnd();
        this.setRandomTransfer();
        this.draw();

        if (this.interval) {
            this.timer = setTimeout(() => this.start(), this.interval * 1000);
        }
    }

    stop() {
        clearTimeout(this.timer);
        this.timer = null;
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
        case "Tab":
        case "Escape":
            options.style.display = options.style.display === "none" ? "block" : "none";
            break;
    }

    if (event.code !== "Tab") {
        // Consume the event so it doesn't get handled twice,
        // as long as the user isn't trying to move focus away
        // event.preventDefault();
    }
}, true);