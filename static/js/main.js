window.onload = function () {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    const diamondSize = document.getElementById("diamondSize");
    const startBtn = document.getElementById("startBtn");

    let maze = null;

    startBtn.onclick = function () {
        let space = parseInt(diamondSize.value);

        let side = Math.floor((window.innerHeight - space * 2) / space);
        side = side % 2 ? side : side - 1;

        canvas.style.borderWidth = space + "px";
        canvas.width = side * space;
        canvas.height = side * space;

        maze = new Maze(context, side, side, space);
        maze.start();
    }

    window.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) {
            return; // Do nothing if event already handled
        }

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

}

class Maze {
    constructor(context, row, col, space) {
        this.context = context;
        this.y = row;
        this.x = col;
        this.space = space;
        // 方向：左、上、右、下
        this.dir = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        this.now = [];
        this.end = [];
        this.map = [];
        // 图例
        this.legend = {
            0: "black", // 围墙
            1: "white", // 道路
            3: "green", // 出口
            5: "blue"   // 玩家
        }
    }

    resetMap() {
        this.map = Array(this.y).fill().map(() => Array(this.x).fill(0));
    }

    getMap(xy) {
        return this.map[xy[1]][xy[0]];
    }

    setMap(xy, value) {
        this.map[xy[1]][xy[0]] = value;
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

        this.setMap(this.now, 5);
        this.setMap(this.end, 3);
    }

    prim() {
        let stack = [[0, 1], [1, 0]];
        this.setMap([0, 0], 1);

        while (stack.length > 0) {
            let curWall = stack.splice(this.random(0, stack.length - 1), 1)[0];

            let check = [];
            for (let curDir of this.dir) {
                let road = [curWall[0] + curDir[0], curWall[1] + curDir[1]];
                if (this.isSecurityScope(road) && this.getMap(road)) {
                    check.push([curDir[0] * -1, curDir[1] * -1]);
                }
            }

            if (check.length === 1) {
                let revDir = check.pop();
                let newRoad = [curWall[0] + revDir[0], curWall[1] + revDir[1]];

                this.setMap(curWall, 1);
                this.setMap(newRoad, 1);

                for (let curDir of this.dir) {
                    let newWall = [newRoad[0] + curDir[0], newRoad[1] + curDir[1]];
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
            if (this.getMap(nextPos) === 3) {
                if (confirm("恭喜通关！\n是否继续以当前设置开始新的迷宫？")) {
                    this.start();
                }
                return;
            }

            this.setMap(this.now, 1);
            this.setMap(nextPos, 5);
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
        this.draw();
    }
}