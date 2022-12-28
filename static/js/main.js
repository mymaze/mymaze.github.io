const
    canvas = document.getElementById("canvas"),
    canvasContext = canvas.getContext("2d");

const
    options = document.getElementById("options"),
    diamondSize = document.getElementById("diamondSize"),
    randomTransferCheckBox = document.getElementById("randomTransferCheckBox"),
    randomTransferCount = document.getElementById("randomTransferCount"),
    convertCheckBox = document.getElementById("convertCheckBox"),
    convertSecond = document.getElementById("convertSecond"),
    nightCheckBox = document.getElementById("nightCheckBox"),
    nightGrid = document.getElementById("nightGrid"),
    monsterCheckBox = document.getElementById("monsterCheckBox"),
    monsterCount = document.getElementById("monsterCount"),
    extendCheckBox = document.getElementById("extendCheckBox"),
    extendMultiple = document.getElementById("extendMultiple");

const INFO = {
    MASK: -1,
    WALL: 0,
    ROAD: 1,
    TRANSFER: 2,
    EXIT: 3,
    MONSTER: 4,
    PLAYER: 5
}

let maze = null;

convertCheckBox.onclick = function () {
    extendCheckBox.checked = false;
}

extendCheckBox.onclick = function () {
    convertCheckBox.checked = false;
}

function startGame() {
    let legend = {};
    for (let key in INFO) {
        legend[INFO[key]] = document.getElementById("color" + INFO[key]).value;
    }

    let space = parseInt(diamondSize.value);

    let row = Math.floor((window.innerHeight - space * 2) / space);
    row = row % 2 ? row : row - 1;
    let col = Math.floor((window.innerWidth - space * 2) / space);
    col = col % 2 ? col : col - 1;

    canvas.style.border = `white ${space}px solid`;
    canvas.width = col * space;
    canvas.height = row * space;

    let multiple = extendCheckBox.checked ? parseInt(extendMultiple.value) : 1;
    let interval = convertCheckBox.checked ? parseInt(convertSecond.value) : 0;
    let transferCount = randomTransferCheckBox.checked ? limit(row, col, parseInt(randomTransferCount.value)) : 0;
    let viewGrid = nightCheckBox.checked ? limit(row, col, parseInt(nightGrid.value)) : 0;
    let monsters = monsterCheckBox.checked ? limit(row, col, parseInt(monsterCount.value)) : 0;

    if (maze) maze.stop();
    maze = new Maze(canvas, canvasContext, row, col, space, legend, transferCount, interval, viewGrid, monsters, multiple);
    maze.start();

    options.style.display = "none";
    canvas.style.display = "block";

    return false;
}

class Maze {
    constructor(mapCanvas, mapContext, row, col, space, legend, transferCount, interval, viewGrid, monsters, multiple) {
        this.mapCanvas = mapCanvas;
        this.mapContext = mapContext;
        this.y = row;
        this.x = col;
        this.row = row;
        this.col = col;
        this.space = space;
        this.legend = legend;
        this.transferCount = transferCount;
        this.interval = interval;
        this.viewGrid = viewGrid;
        this.monsters = monsters;
        this.multiple = multiple;

        this.dir = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        this.now = [0, 0];
        this.end = [col - 1, row - 1];
        this.map = [];
        this.monsterQueue = [];
        this.timer = null;
    }

    resetMap() {
        if (this.multiple > 1) {
            let extendRow = this.y * this.multiple;
            let extendCol = this.x * this.multiple;
            this.y = extendRow % 2 ? extendRow : extendRow - 1;
            this.x = extendCol % 2 ? extendCol : extendCol - 1;
        }
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

    randomXY() {
        return [this.random(0, this.x - 1), this.random(0, this.y - 1)];
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
            let transferXY = this.randomXY();
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

    setMonsters() {
        if (!this.monsters) return;

        let i = 0;
        while (i !== this.monsters) {
            let monsterXY = this.randomXY();
            if (this.getMap(monsterXY) === INFO.ROAD) {
                this.setMap(monsterXY, INFO.MONSTER);
                this.monsterQueue[i] = setTimeout(((who) => this.monsterMove(who, monsterXY))(i), 1000);
                i++;
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

    playerMove(dir) {
        let nextPos = [this.now[0] + dir[0], this.now[1] + dir[1]];
        if (this.isSecurityScope(nextPos) && this.getMap(nextPos)) {
            switch (this.getMap(nextPos)) {
                case INFO.TRANSFER:
                    while (true) {
                        nextPos = this.randomXY();
                        if (this.getMap(nextPos) === INFO.ROAD) break;
                    }
                    break;
                case INFO.EXIT:
                    this.gameOver("恭喜通关！");
                    return;
                case INFO.MONSTER:
                    this.gameOver("你被丧尸感染，游戏结束！");
                    return;
            }

            this.setMap(this.now, INFO.ROAD);
            this.setMap(nextPos, INFO.PLAYER);
            this.now = nextPos;

            this.draw();
        }
    }

    monsterMove(who, monsterXY) {
        let playerDir = null;

        for (let curDir of this.dir) {
            let nextPos = monsterXY;
            let flag = true;

            while (flag) {
                nextPos = this.turnTo(nextPos, curDir);

                if (!this.isSecurityScope(nextPos)) break;

                switch (this.getMap(nextPos)) {
                    case INFO.PLAYER:
                        playerDir = curDir;
                        flag = false;
                        break;
                    case INFO.WALL:
                    case INFO.TRANSFER:
                    case INFO.EXIT:
                        flag = false;
                        break;
                }
            }

            if (playerDir) {
                this.monsterQueue[who] = setTimeout(() => this.monsterChase(who, monsterXY, playerDir), 200);
                return;
            }
        }

        let dirs = [...this.dir];
        while (dirs.length > 0) {
            let curDir = dirs.splice(this.random(0, dirs.length - 1), 1)[0];
            let nextPos = this.turnTo(monsterXY, curDir);

            if (!this.isSecurityScope(nextPos)) continue;

            switch (this.getMap(nextPos)) {
                case INFO.ROAD:
                case INFO.MONSTER:
                    this.setMap(monsterXY, INFO.ROAD);
                    this.setMap(nextPos, INFO.MONSTER);
                    this.draw();
                    this.monsterQueue[who] = setTimeout(() => this.monsterMove(who, nextPos), 1000);
                    return;
                case INFO.PLAYER:
                    this.gameOver("你被丧尸感染，游戏结束！");
                    return;
            }
        }
    }

    monsterChase(who, monsterXY, playerDir) {
        let nextPos = this.turnTo(monsterXY, playerDir);
        if (this.isSecurityScope(nextPos)) {
            switch (this.getMap(nextPos)) {
                case INFO.ROAD:
                case INFO.MONSTER:
                    this.setMap(monsterXY, INFO.ROAD);
                    this.setMap(nextPos, INFO.MONSTER);
                    this.draw();
                    this.monsterQueue[who] = setTimeout(() => this.monsterChase(who, nextPos, playerDir), 200);
                    return;
                case INFO.PLAYER:
                    this.gameOver("你被丧尸感染，游戏结束！");
                    return;
            }
        }
        this.monsterQueue[who] = setTimeout(() => this.monsterMove(who, monsterXY), 200);
    }

    draw() {
        let viewX, viewY;
        let halfCol = Math.ceil(this.col / 2);
        let halfRow = Math.ceil(this.row / 2);

        if (this.now[0] < halfCol) {
            viewX = 0;
            this.mapCanvas.style.borderLeftColor = this.legend[INFO.WALL];
        } else if (this.now[0] > this.x - halfCol) {
            viewX = this.x - this.col;
            this.mapCanvas.style.borderRightColor = this.legend[INFO.WALL];
        } else {
            viewX = this.now[0] - halfCol;
            this.mapCanvas.style.borderRightColor = "white";
            this.mapCanvas.style.borderLeftColor = "white";
        }

        if (this.now[1] < halfRow) {
            viewY = 0;
            this.mapCanvas.style.borderTopColor = this.legend[INFO.WALL];
        } else if (this.now[1] > this.y - halfRow) {
            viewY = this.y - this.row;
            this.mapCanvas.style.borderBottomColor = this.legend[INFO.WALL];
        } else {
            viewY = this.now[1] - halfRow;
            this.mapCanvas.style.borderTopColor = "white";
            this.mapCanvas.style.borderBottomColor = "white";
        }

        for (let y = 0; y < this.row; y++) {
            for (let x = 0; x < this.col; x++) {
                let mapX = x + viewX;
                let mapY = y + viewY;
                if (
                    this.viewGrid
                    && (mapX < (this.now[0] - this.viewGrid)
                        || mapX > (this.now[0] + this.viewGrid)
                        || mapY < (this.now[1] - this.viewGrid)
                        || mapY > (this.now[1] + this.viewGrid)
                    )) {
                    this.mapContext.fillStyle = this.legend[INFO.MASK];
                } else {
                    this.mapContext.fillStyle = this.legend[this.getMap([mapX, mapY])];
                }
                this.mapContext.fillRect(x * this.space, y * this.space, this.space, this.space);
            }
        }
    }

    start() {
        this.resetMap();
        this.prim();
        this.setStartAndEnd();
        this.setRandomTransfer();
        this.setMonsters();
        this.draw();

        window.addEventListener("keydown", keyDown, true);

        if (this.interval) {
            this.timer = setTimeout(() => this.start(), this.interval * 1000);
        }
    }

    stop() {
        window.removeEventListener("keydown", keyDown, true);

        clearTimeout(this.timer);
        this.timer = null;

        for (let who = 0; who < this.monsterQueue.length; who++) {
            clearTimeout(this.monsterQueue[who]);
        }
        this.monsterQueue = [];
    }

    gameOver(msg) {
        this.stop();
        if (confirm(msg + "\n是否继续以当前设置开始新的迷宫？")) {
            this.start();
        } else {
            options.style.display = "block";
        }
    }
}

function limit(row, col, num) {
    let max = Math.floor(row / 2) * Math.floor(col / 2);
    return Math.min(max, num);
}

function keyDown(event) {
    if (event.defaultPrevented) return; // Do nothing if event already handled
    if (!maze) return;

    switch (event.code) {
        case "KeyS":
        case "ArrowDown":
            // Handle "back"
            maze.playerMove([0, 1]);
            break;
        case "KeyW":
        case "ArrowUp":
            // Handle "forward"
            maze.playerMove([0, -1]);
            break;
        case "KeyA":
        case "ArrowLeft":
            // Handle "turn left"
            maze.playerMove([-1, 0]);
            break;
        case "KeyD":
        case "ArrowRight":
            // Handle "turn right"
            maze.playerMove([1, 0]);
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
}