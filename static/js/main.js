const
    bgmAudio = document.getElementById("bgmAudio"),
    canvas = document.getElementById("canvas"),
    context = canvas.getContext("2d"),
    options = document.getElementById("options"),
    diamondInput = document.getElementById("diamondInput"),
    useIconCheckBox = document.getElementById("useIconCheckBox"),
    transferCheckBox = document.getElementById("transferCheckBox"),
    transferInput = document.getElementById("transferInput"),
    convertCheckBox = document.getElementById("convertCheckBox"),
    convertInput = document.getElementById("convertInput"),
    nightCheckBox = document.getElementById("nightCheckBox"),
    nightInput = document.getElementById("nightInput"),
    monsterCheckBox = document.getElementById("monsterCheckBox"),
    monsterInput = document.getElementById("monsterInput"),
    extendCheckBox = document.getElementById("extendCheckBox"),
    extendInput = document.getElementById("extendInput");

const INFO = {
    MASK: -1,
    WALL: 0,
    ROAD: 1,
    TRANSFER: 2,
    EXIT: 3,
    MONSTER: 4,
    PLAYER: 5,
    TIPS: 6
}

const MESSAGE = {
    VICTORY: "恭喜通关！",
    FAIL: "你被丧尸感染，游戏结束！",
    NEW_GAME: "\n是否继续以当前设置开始新的迷宫？"
}

const DIR = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1]
}

let maze = null;

// 因为迷宫越大生成越久，“变换莫测”和“地图扩展”同时选上会导致异常卡顿，所以需要设置互斥事件
convertCheckBox.onclick = function () {
    extendCheckBox.checked = false;
}

extendCheckBox.onclick = function () {
    convertCheckBox.checked = false;
}

function setBGM() {
    let filename = "default.mp3";

    switch (true) {
        case extendCheckBox.checked:
            filename = "extend.mp3";
            break;
        case monsterCheckBox.checked:
            filename = "monster.mp3";
            break;
        case nightCheckBox.checked:
            filename = "night.mp3";
            break;
        case convertCheckBox.checked:
            filename = "convert.mp3";
            break;
        case transferCheckBox.checked:
            filename = "transfer.mp3";
            break;
    }

    bgmAudio.src = `static/audio/${filename}`;
}

function startGame() {
    let legend = {};
    for (let key in INFO) {
        legend[INFO[key]] = document.getElementById("color" + INFO[key]).value;
    }

    let icon = {};
    for (let key in INFO) {
        icon[INFO[key]] = document.getElementById("icon" + INFO[key]);
    }

    let size = parseInt(diamondInput.value);
    // 迷宫生成算法需要行列均为奇数
    let row = Math.floor((window.innerHeight - size * 2) / size);
    row = row % 2 ? row : row - 1;
    let col = Math.floor((window.innerWidth - size * 2) / size);
    col = col % 2 ? col : col - 1;

    canvas.style.border = `white ${size}px solid`;
    canvas.width = col * size;
    canvas.height = row * size;

    let useIcon = !!useIconCheckBox.checked;
    let multiple = extendCheckBox.checked ? parseInt(extendInput.value) : 1;
    let interval = convertCheckBox.checked ? parseInt(convertInput.value) : 0;
    let transferCount = transferCheckBox.checked ? limit(row, col, parseInt(transferInput.value)) : 0;
    let viewGrid = nightCheckBox.checked ? limit(row, col, parseInt(nightInput.value)) : 0;
    let monsters = monsterCheckBox.checked ? limit(row, col, parseInt(monsterInput.value)) : 0;

    if (maze) maze.stop();
    maze = new Maze(canvas, context, row, col, size, legend, icon, transferCount, interval, viewGrid, monsters, multiple, useIcon);
    maze.start();

    options.style.display = "none";
    canvas.style.display = "block";

    setBGM();

    return false;
}

class Maze {
    constructor(canvas, context, row, col, size, legend, icon, transferCount, interval, viewGrid, monsters, multiple, useIcon) {
        this.canvas = canvas;
        this.context = context;
        this.y = row;
        this.x = col;
        this.row = row;
        this.col = col;
        this.size = size;
        this.legend = legend;
        this.icon = icon;
        this.transferCount = transferCount;
        this.interval = interval;
        this.viewGrid = viewGrid;
        this.monsters = monsters;
        this.multiple = multiple;
        this.useIcon = useIcon;

        this.now = [0, 0];
        this.end = [col - 1, row - 1];
        this.map = [];
        this.monsterQueue = [];
        this.timer = null;
        this.autoMoveTimer = null;
    }

    resetMap() {
        if (this.multiple > 1) {
            let extendRow = this.row * this.multiple;
            let extendCol = this.col * this.multiple;

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
        // 设置“随机传送”，放置在围墙的位置，且有道路相连
        if (!this.transferCount) return;

        let count = 0;
        while (count !== this.transferCount) {
            let transferXY = this.randomXY();

            if (this.getMap(transferXY) === INFO.WALL) {
                for (let curDir in DIR) {
                    let diamond = this.turnTo(transferXY, DIR[curDir]);

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
        // 设置丧尸，放置在道路的位置
        if (!this.monsters) return;

        let i = 0;
        while (i !== this.monsters) {
            let monsterXY = this.randomXY();

            if (this.getMap(monsterXY) === INFO.ROAD) {
                this.setMap(monsterXY, INFO.MONSTER);
                this.monsterQueue[i] = setTimeout(((who, monsterXY) => this.monsterMove(who, monsterXY)), 1000, i, monsterXY);
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
        for (let curDir in DIR) {
            let wall = this.turnTo(this.now, DIR[curDir]);

            if (this.isSecurityScope(wall)) {
                stack.push(wall);
            }
        }
        this.setMap(this.now, INFO.ROAD);

        while (stack.length > 0) {
            let curWall = stack.splice(this.random(0, stack.length - 1), 1)[0];

            let check = [];
            for (let curDir in DIR) {
                let road = this.turnTo(curWall, DIR[curDir]);

                if (this.isSecurityScope(road) && this.getMap(road)) {
                    check.push([DIR[curDir][0] * -1, DIR[curDir][1] * -1]);
                }
            }

            if (check.length === 1) {
                let revDir = check.pop();
                let newRoad = this.turnTo(curWall, revDir);

                this.setMap(curWall, INFO.ROAD);
                this.setMap(newRoad, INFO.ROAD);

                for (let curDir in DIR) {
                    let newWall = this.turnTo(newRoad, DIR[curDir]);

                    if (this.isSecurityScope(newWall) && !this.getMap(newWall)) {
                        stack.push(newWall);
                    }
                }
            }
        }
        return this.map;
    }

    dfsHelper(curPos, dest2source) {
        for (let curDir in DIR) {
            let nextPos = this.turnTo(curPos, DIR[curDir]);

            if (this.isSecurityScope(nextPos)) {
                switch (this.getMap(nextPos)) {
                    case INFO.EXIT:
                        dest2source[nextPos] = [curPos, curDir];
                        return dest2source;
                    case INFO.ROAD:
                    case INFO.MONSTER:
                        if (!(nextPos in dest2source)) {
                            dest2source[nextPos] = [curPos, curDir];

                            if (this.dfsHelper(nextPos, dest2source)) {
                                return dest2source;
                            }
                        }
                        break;
                }
            }
        }
    }

    dfs() {
        let dest2source = this.dfsHelper(this.now, {});
        let posPath = [];
        let dirPath = [];
        let curPos = this.end;

        while (curPos in dest2source) {
            let [parentPos, parentDir] = dest2source[curPos];

            posPath.push(parentPos);
            dirPath.push(parentDir);

            curPos = parentPos;
        }

        posPath.reverse();
        dirPath.reverse();

        return [posPath, dirPath];
    }

    tips() {
        let mapBak = JSON.parse(JSON.stringify(this.map));

        let [posPath, dirPath] = this.dfs();

        posPath.shift();
        for (let pos of posPath) {
            this.setMap(pos, INFO.TIPS);
        }

        this.draw();
        this.map = mapBak;
    }

    authMoveHelper(dirPath) {
        this.playerMove(DIR[dirPath.shift()]);

        if (dirPath.length > 0) {
            let speed = this.random(100, 250);
            this.autoMoveTimer = setTimeout(() => this.authMoveHelper(dirPath), speed);
        }
    }

    autoMove() {
        let [posPath, dirPath] = this.dfs();
        this.authMoveHelper(dirPath);
    }

    playerMove(dir) {
        let nextPos = this.turnTo(this.now, dir);

        if (this.isSecurityScope(nextPos) && this.getMap(nextPos)) {
            switch (this.getMap(nextPos)) {
                case INFO.TRANSFER:
                    while (true) {
                        nextPos = this.randomXY();
                        if (this.getMap(nextPos) === INFO.ROAD) break;
                    }
                    break;
                case INFO.EXIT:
                    this.gameOver(MESSAGE.VICTORY);
                    return;
                case INFO.MONSTER:
                    this.gameOver(MESSAGE.FAIL);
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

        if (monsterXY[0] === this.now[0]) {
            playerDir = monsterXY[1] > this.now[1] ? DIR.up : DIR.down;
        } else if (monsterXY[1] === this.now[1]) {
            playerDir = monsterXY[0] > this.now[0] ? DIR.left : DIR.right;
        }

        let nextPos = monsterXY;
        while (playerDir) {
            nextPos = this.turnTo(nextPos, playerDir);

            if (!this.isSecurityScope(nextPos)) break;

            switch (this.getMap(nextPos)) {
                case INFO.PLAYER:
                    this.monsterQueue[who] = setTimeout(() => this.monsterChase(who, monsterXY, playerDir), 100);
                    return;
                case INFO.WALL:
                case INFO.TRANSFER:
                case INFO.EXIT:
                    playerDir = null;
                    break;
            }
        }

        let dirs = [DIR.left, DIR.right, DIR.up, DIR.down];
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
                    this.gameOver(MESSAGE.FAIL);
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
                    this.monsterQueue[who] = setTimeout(() => this.monsterChase(who, nextPos, playerDir), 100);
                    return;
                case INFO.PLAYER:
                    this.gameOver(MESSAGE.FAIL);
                    return;
            }
        }
        this.monsterQueue[who] = setTimeout(() => this.monsterMove(who, monsterXY), 100);
    }

    draw() {
        if (this.useIcon) context.clearRect(0, 0, this.col * this.size, this.row * this.size);

        let viewX, viewY, iconObj;
        let halfCol = Math.ceil(this.col / 2);
        let halfRow = Math.ceil(this.row / 2);
        let blankAreaColor = "white";

        this.canvas.style.borderColor = this.multiple === 1 ? this.legend[INFO.WALL] : blankAreaColor;

        if (this.now[0] < halfCol) {
            viewX = 0;
            this.canvas.style.borderLeftColor = this.legend[INFO.WALL];
        } else if (this.now[0] > this.x - halfCol) {
            viewX = this.x - this.col;
            this.canvas.style.borderRightColor = this.legend[INFO.WALL];
        } else {
            viewX = this.now[0] - halfCol;
            this.canvas.style.borderRightColor = blankAreaColor;
            this.canvas.style.borderLeftColor = blankAreaColor;
        }

        if (this.now[1] < halfRow) {
            viewY = 0;
            this.canvas.style.borderTopColor = this.legend[INFO.WALL];
        } else if (this.now[1] > this.y - halfRow) {
            viewY = this.y - this.row;
            this.canvas.style.borderBottomColor = this.legend[INFO.WALL];
        } else {
            viewY = this.now[1] - halfRow;
            this.canvas.style.borderTopColor = blankAreaColor;
            this.canvas.style.borderBottomColor = blankAreaColor;
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
                    this.context.fillStyle = this.legend[INFO.MASK];
                    iconObj = this.icon[INFO.MASK];
                } else {
                    let mapValue = this.getMap([mapX, mapY]);
                    this.context.fillStyle = this.legend[mapValue];
                    iconObj = this.icon[mapValue];
                }

                if (this.useIcon) {
                    this.context.drawImage(iconObj, x * this.size, y * this.size, this.size, this.size);
                } else {
                    this.context.fillRect(x * this.size, y * this.size, this.size, this.size);
                }
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

    stopAutoMove() {
        clearTimeout(this.autoMoveTimer);
        this.autoMoveTimer = null;
    }

    stopConvert() {
        clearTimeout(this.timer);
        this.timer = null;
    }

    stopMonsterMove() {
        for (let who = 0; who < this.monsterQueue.length; who++) {
            clearTimeout(this.monsterQueue[who]);
        }
        this.monsterQueue = [];
    }

    stop() {
        window.removeEventListener("keydown", keyDown, true);

        this.stopAutoMove();
        this.stopConvert();
        this.stopMonsterMove();
    }

    gameOver(msg) {
        this.stop();
        if (confirm(msg + MESSAGE.NEW_GAME)) {
            this.start();
        } else {
            options.style.display = "block";
        }
    }
}

function limit(row, col, num) {
    // 限制数量确保合理
    let max = Math.floor(row / 2) * Math.floor(col / 2);
    return Math.min(max, num);
}

function keyDown(event) {
    if (event.defaultPrevented) return; // Do nothing if event already handled
    if (!maze) return;

    if (maze.autoMoveTimer) maze.stopAutoMove();

    switch (event.code) {
        case "KeyS":
        case "ArrowDown":
            // Handle "back"
            maze.playerMove(DIR.down);
            break;
        case "KeyW":
        case "ArrowUp":
            // Handle "forward"
            maze.playerMove(DIR.up);
            break;
        case "KeyA":
        case "ArrowLeft":
            // Handle "turn left"
            maze.playerMove(DIR.left);
            break;
        case "KeyD":
        case "ArrowRight":
            // Handle "turn right"
            maze.playerMove(DIR.right);
            break;
        case "NumpadSubtract":
        case "Minus":
            maze.tips();
            break;
        case "NumpadAdd":
        case "Equal":
            maze.autoMove();
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