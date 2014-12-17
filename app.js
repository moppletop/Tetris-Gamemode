var HTMLUtil = (function () {
    function HTMLUtil() {
    }
    HTMLUtil.getAnimationFrame = function () {
        return window.requestAnimationFrame;
    };

    HTMLUtil.getEl = function (id) {
        return document.getElementById(id);
    };

    HTMLUtil.getElsByClass = function (className) {
        return document.getElementsByClassName(className);
    };

    HTMLUtil.setText = function (id, text) {
        var el = this.getEl(id);
        if (el) {
            el.innerText = text;
        }
    };

    HTMLUtil.setHtml = function (id, html) {
        var el = this.getEl(id);
        if (el) {
            el.innerHTML = html;
        }
    };

    HTMLUtil.createEl = function (elemenName) {
        return document.createElement("audio");
    };
    return HTMLUtil;
})();

var App = (function () {
    function App() {
    }
    App.setTitle = function (title) {
        var elements = HTMLUtil.getElsByClass("appTitle");
        for (var i in elements) {
            elements[i].innerText = title;
        }
    };
    return App;
})();

var Coords = (function () {
    function Coords(x, y) {
        this.x = x;
        this.y = y;
    }
    return Coords;
})();

var Block = (function () {
    function Block(coordinates) {
        this.coordinates = coordinates;
        this.occupied = false;
    }
    return Block;
})();

var BoardLayout;
(function (BoardLayout) {
    BoardLayout[BoardLayout["BlockSize"] = 33] = "BlockSize";
    BoardLayout[BoardLayout["NumCols"] = 10] = "NumCols";
    BoardLayout[BoardLayout["NumRows"] = 20] = "NumRows";
})(BoardLayout || (BoardLayout = {}));

var PreviewLayout;
(function (PreviewLayout) {
    PreviewLayout[PreviewLayout["BlockSize"] = 20] = "BlockSize";
    PreviewLayout[PreviewLayout["NumCols"] = 4] = "NumCols";
    PreviewLayout[PreviewLayout["NumRows"] = 4] = "NumRows";
})(PreviewLayout || (PreviewLayout = {}));

var ScoreBoard = (function () {
    function ScoreBoard() {
        this.hiScore = 0;
        this.levelUpAfterRows = 3;
        this.reset();
    }
    ScoreBoard.prototype.getRowScore = function (rows) {
        if (rows <= 0)
            return 0;

        var baseScore = 10;
        return ((rows * 2) - 1) * baseScore;
    };

    ScoreBoard.prototype.reset = function () {
        this.currentScore = 0;
        this.currentRows = 0;
        this.currentLevel = 1;
    };

    ScoreBoard.prototype.update = function (rows) {
        this.currentRows += rows;
        this.currentScore += this.getRowScore(rows);
        if (this.currentScore > this.hiScore) {
            this.hiScore = this.currentScore;
        }
        var levelBefore = this.currentLevel;
        this.currentLevel = Math.floor(this.currentRows / this.levelUpAfterRows) + 1;
        if (levelBefore != this.currentLevel) {
            AudioManager.playLevelUp();
            AudioManager.playLevelUp();
        }
    };

    ScoreBoard.prototype.draw = function () {
        HTMLUtil.setText("hiScore", this.hiScore.toString());
        HTMLUtil.setText("score", this.currentScore.toString());
        HTMLUtil.setText("rows", this.currentRows.toString());
        HTMLUtil.setText("level", this.currentLevel.toString());
    };
    return ScoreBoard;
})();

var PreviewBoard = (function () {
    function PreviewBoard(canvas, blockSize, numCols, numRows) {
        this.canvas = canvas;
        this.canvas.width = blockSize * numCols;
        this.canvas.height = blockSize * numRows;
        this.blockSize = blockSize;
    }
    PreviewBoard.prototype.update = function (nextPiece) {
        this.nextPiece = nextPiece;
    };

    PreviewBoard.prototype.draw = function () {
        var context = this.canvas.getContext('2d');
        var currentRotation = this.nextPiece.shape.rotations[this.nextPiece.rotationDirection];

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (var i = 0; i < 4; i++) {
            var x = currentRotation.coords[i].x;
            var y = currentRotation.coords[i].y;

            context.beginPath();
            context.rect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
            context.setLineDash([0]);
            context.lineWidth = 2;
            context.fillStyle = this.nextPiece.shape.colour;
            context.fill();
            context.strokeStyle = 'black';
            context.stroke();
        }
    };
    return PreviewBoard;
})();

var GameBoard = (function () {
    function GameBoard(canvas, blockSize, numCols, numRows) {
        this.blocks = new Array();
        this.canvas = canvas;
        this.canvas.width = blockSize * numCols;
        this.canvas.height = blockSize * numRows;
        this.blockSize = blockSize;
        this.numCols = numCols;
        this.numRows = numRows;

        this.reset();
    }
    GameBoard.prototype.reset = function () {
        this.blocks = new Array();
        var index = 0;
        for (var x = 0; x < this.numCols; x++) {
            for (var y = 0; y < this.numRows; y++) {
                this.blocks[index] = new Block(new Coords(x, y));
                index += 1;
            }
        }
    };

    GameBoard.prototype.syncGhostPiece = function (currentPiece, ghostPiece) {
        ghostPiece.rotationDirection = currentPiece.rotationDirection;
        ghostPiece.topLeft.x = currentPiece.topLeft.x;
        ghostPiece.topLeft.y = currentPiece.topLeft.y;

        while (this.advanceGhostPiece(ghostPiece)) {
        }
    };

    GameBoard.prototype.rotateCurrentPiece = function (currentPiece, ghostPiece) {
        var canRotate = true;

        var nextRotation = currentPiece.shape.rotations[currentPiece.nextDirection()];
        for (var i = 0; i < 4; i++) {
            var x = nextRotation.coords[i].x + currentPiece.topLeft.x;
            var y = nextRotation.coords[i].y + currentPiece.topLeft.y;
            canRotate = canRotate && !this.occupied(x, y) && !this.outsideBoundaries(x, y);
        }

        if (canRotate) {
            currentPiece.rotate();
            this.syncGhostPiece(currentPiece, ghostPiece);
        }
    };

    GameBoard.prototype.moveCurrentPiece = function (direction, currentPiece, ghostPiece) {
        var canMove = true;
        var targetXOffset = 0;
        var targetYOffset = 0;

        if (direction == 3 /* Left */) {
            targetXOffset = -1;
        } else if (direction == 1 /* Right */) {
            targetXOffset = 1;
        } else if (direction == 2 /* Down */) {
            targetYOffset = 1;
        }

        var currentRotation = currentPiece.shape.rotations[currentPiece.rotationDirection];
        for (var i = 0; i < 4; i++) {
            var x = currentRotation.coords[i].x + currentPiece.topLeft.x;
            var y = currentRotation.coords[i].y + currentPiece.topLeft.y;
            canMove = canMove && !this.occupied(x + targetXOffset, y + targetYOffset) && !this.outsideBoundaries(x + targetXOffset, y + targetYOffset);
        }

        if (canMove) {
            currentPiece.move(direction);
            this.syncGhostPiece(currentPiece, ghostPiece);
        }
    };

    GameBoard.prototype.currentPieceIsEntirelyOnBoard = function (currentPiece) {
        var currentRotation = currentPiece.shape.rotations[currentPiece.rotationDirection];
        for (var i = 0; i < 4; i++) {
            var y = currentRotation.coords[i].y + currentPiece.topLeft.y;
            if (y < 0) {
                return false;
            }
        }
        return true;
    };

    GameBoard.prototype.advanceCurrentPiece = function (currentPiece) {
        var advanced = this.advancePiece(currentPiece, true);
        if (!advanced) {
            AudioManager.playLandPiece();
        }
        return advanced;
    };

    GameBoard.prototype.advanceGhostPiece = function (ghostPiece) {
        return this.advancePiece(ghostPiece, false);
    };

    GameBoard.prototype.advancePiece = function (piece, setOccupied) {
        var canAdvance = true;
        var currentRotation = piece.shape.rotations[piece.rotationDirection];
        for (var i = 0; i < 4; i++) {
            var x = currentRotation.coords[i].x + piece.topLeft.x;
            var y = currentRotation.coords[i].y + piece.topLeft.y;
            canAdvance = canAdvance && !this.occupied(x, y + 1) && !this.outsideYBoundary(y + 1);
        }

        if (canAdvance) {
            piece.advance();
        } else {
            for (i = 0; i < 4; i++) {
                x = currentRotation.coords[i].x + piece.topLeft.x;
                y = currentRotation.coords[i].y + piece.topLeft.y;
                var blockIndex = this.getBlockIndex(x, y);
                if (this.blocks[blockIndex]) {
                    this.blocks[blockIndex].colour = piece.shape.colour;
                    if (setOccupied) {
                        this.blocks[blockIndex].occupied = true;
                    }
                }
            }
        }

        return canAdvance;
    };

    GameBoard.prototype.removeCompletedRows = function () {
        var removedRows = 0;

        for (var y = this.numRows - 1; y >= 0; y--) {
            if (this.rowCompleted(y)) {
                this.removeRow(y);
                y = y + 1; /*need to recheck the row above in case it also full*/
                removedRows += 1;
            }
        }

        return removedRows;
    };

    GameBoard.prototype.rowCompleted = function (targetY) {
        for (var x = this.numCols - 1; x >= 0; x--) {
            var index = this.getBlockIndex(x, targetY);
            var block = this.blocks[index];
            if (block && !block.occupied) {
                return false;
            }
        }
        return true;
    };

    GameBoard.prototype.removeRow = function (targetY) {
        for (var y = targetY; y >= 0; y--) {
            for (var x = 0; x < this.numCols; x++) {
                var thisIndex = this.getBlockIndex(x, y);
                var thisBlock = this.blocks[thisIndex];
                if (y > 0) {
                    var aboveIndex = this.getBlockIndex(x, y - 1);
                    var aboveBlock = this.blocks[aboveIndex];
                    thisBlock.colour = aboveBlock.colour;
                    thisBlock.occupied = aboveBlock.occupied;
                } else {
                    thisBlock.colour = "";
                    thisBlock.occupied = false;
                }
            }
        }
    };

    GameBoard.prototype.getBlockIndex = function (x, y) {
        return (this.numCols * y) + x;
    };

    GameBoard.prototype.occupied = function (targetX, targetY) {
        var blockIndex = this.getBlockIndex(targetX, targetY);
        return (this.blocks[blockIndex] && this.blocks[blockIndex].occupied);
    };

    GameBoard.prototype.outsideBoundaries = function (targetX, targetY) {
        return this.outsideXBoundaries(targetX) || this.outsideYBoundary(targetY);
    };

    GameBoard.prototype.outsideXBoundaries = function (targetX) {
        return targetX < 0 || targetX >= this.numCols;
    };

    GameBoard.prototype.outsideYBoundary = function (targetY) {
        return targetY >= this.numRows;
    };

    GameBoard.prototype.drawBlocks = function () {
        var context = this.canvas.getContext('2d');

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var index = 0;

        for (var y = 0; y < this.numRows; y++) {
            for (var x = 0; x < this.numCols; x++) {
                var block = this.blocks[index];

                context.beginPath();
                context.rect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
                if (block.occupied) {
                    context.setLineDash([0]);
                    context.lineWidth = 3;
                    context.fillStyle = block.colour;
                    context.fill();
                } else {
                    context.setLineDash([1, 2]);
                    context.lineWidth = 1;
                }
                context.strokeStyle = 'black';
                context.stroke();
                index += 1;
            }
        }
    };

    GameBoard.prototype.drawCurrentPiece = function (currentPiece) {
        this.drawPiece(currentPiece, 1);
    };

    GameBoard.prototype.drawGhostPiece = function (ghostPiece) {
        this.drawPiece(ghostPiece, 0.33);
    };

    GameBoard.prototype.drawPiece = function (piece, opacity) {
        var context = this.canvas.getContext('2d');
        var currentRotation = piece.shape.rotations[piece.rotationDirection];
        context.globalAlpha = opacity;

        for (var i = 0; i < 4; i++) {
            var x = currentRotation.coords[i].x + piece.topLeft.x;
            var y = currentRotation.coords[i].y + piece.topLeft.y;

            context.beginPath();
            context.rect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
            context.setLineDash([0]);
            context.lineWidth = 3;
            context.fillStyle = piece.shape.colour;
            context.fill();
            context.strokeStyle = 'black';
            context.stroke();
        }

        context.globalAlpha = 1.0;
    };

    GameBoard.prototype.drawMessage = function (message) {
        var context = this.canvas.getContext('2d');
        var textString = message;
        var textWidth = context.measureText(textString).width;
        var textHeight = 50;
        context.font = textHeight + 'px sans-serif';
        var x = (this.canvas.width / 2) - (textWidth / 2);
        var y = (this.canvas.height / 2) + (textHeight / 2);
        context.lineWidth = 3;
        context.setLineDash([0]);
        context.strokeStyle = 'black';
        context.strokeText(textString, x, y);
        context.fillStyle = "red";
        context.fillText(textString, x, y);
    };
    return GameBoard;
})();

var Direction;
(function (Direction) {
    Direction[Direction["Up"] = 0] = "Up";
    Direction[Direction["Right"] = 1] = "Right";
    Direction[Direction["Down"] = 2] = "Down";
    Direction[Direction["Left"] = 3] = "Left";
    Direction[Direction["Preview"] = 4] = "Preview";
})(Direction || (Direction = {}));

var Rotation = (function () {
    function Rotation(direction, coord1, coord2, coord3, coord4) {
        this.coords = new Array();
        this.direction = direction;
        this.coords[0] = coord1;
        this.coords[1] = coord2;
        this.coords[2] = coord3;
        this.coords[3] = coord4;
    }
    return Rotation;
})();

var Colours = (function () {
    function Colours() {
    }
    Colours.Cyan = "cyan";
    Colours.Blue = "blue";
    Colours.Orange = "orange";
    Colours.Yellow = "yellow";
    Colours.Green = "green";
    Colours.Purple = "purple";
    Colours.Red = "red";
		Colours.Lime = "lime";
    return Colours;
})();

var Keys;
(function (Keys) {
    Keys[Keys["RETURN"] = 13] = "RETURN";
    Keys[Keys["ESC"] = 27] = "ESC";
    Keys[Keys["SPACE"] = 32] = "SPACE";
    Keys[Keys["LEFT"] = 37] = "LEFT";
    Keys[Keys["UP"] = 38] = "UP";
    Keys[Keys["RIGHT"] = 39] = "RIGHT";
    Keys[Keys["DOWN"] = 40] = "DOWN";
})(Keys || (Keys = {}));

var ShapeType;
(function (ShapeType) {
    ShapeType[ShapeType["L"] = 0] = "L";
    ShapeType[ShapeType["J"] = 1] = "J";
    ShapeType[ShapeType["T"] = 2] = "T";
    ShapeType[ShapeType["Z"] = 3] = "Z";
    ShapeType[ShapeType["S"] = 4] = "S";
    ShapeType[ShapeType["O"] = 5] = "O";
    ShapeType[ShapeType["I"] = 6] = "I";
})(ShapeType || (ShapeType = {}));

var Shape = (function () {
    function Shape(type, colour, rotation1, rotation2, rotation3, rotation4, rotation5) {
        this.rotations = new Array();
        this.type = type;
        this.colour = colour;
        this.rotations[0] = rotation1;
        this.rotations[1] = rotation2;
        this.rotations[2] = rotation3;
        this.rotations[3] = rotation4;
        this.rotations[4] = rotation5;
    }
    return Shape;
})();

var GameShapes = (function () {
    function GameShapes() {
        this.shapes = new Array();
        this.shapeBag = new Array();
        this.shapes[6 /* I */] = new Shape(6 /* I */, Colours.Cyan, new Rotation(0 /* Up */, new Coords(1, 0), new Coords(1, 1), new Coords(1, 2), new Coords(1, 3)), new Rotation(1 /* Right */, new Coords(0, 2), new Coords(1, 2), new Coords(2, 2), new Coords(3, 2)), new Rotation(2 /* Down */, new Coords(2, 0), new Coords(2, 1), new Coords(2, 2), new Coords(2, 3)), new Rotation(3 /* Left */, new Coords(0, 1), new Coords(1, 1), new Coords(2, 1), new Coords(3, 1)), new Rotation(4 /* Preview */, new Coords(1.5, 0), new Coords(1.5, 1), new Coords(1.5, 2), new Coords(1.5, 3)));

        this.shapes[1 /* J */] = new Shape(1 /* J */, Colours.Blue, new Rotation(0 /* Up */, new Coords(1, 0), new Coords(1, 1), new Coords(0, 2), new Coords(1, 2)), new Rotation(1 /* Right */, new Coords(0, 0), new Coords(0, 1), new Coords(1, 1), new Coords(2, 1)), new Rotation(2 /* Down */, new Coords(1, 0), new Coords(2, 0), new Coords(1, 1), new Coords(1, 2)), new Rotation(3 /* Left */, new Coords(0, 1), new Coords(1, 1), new Coords(2, 1), new Coords(2, 2)), new Rotation(4 /* Preview */, new Coords(2, 0.5), new Coords(2, 1.5), new Coords(1, 2.5), new Coords(2, 2.5)));

        this.shapes[0 /* L */] = new Shape(0 /* L */, Colours.Orange, new Rotation(0 /* Up */, new Coords(1, 0), new Coords(1, 1), new Coords(1, 2), new Coords(2, 2)), new Rotation(1 /* Right */, new Coords(0, 1), new Coords(1, 1), new Coords(2, 1), new Coords(0, 2)), new Rotation(2 /* Down */, new Coords(0, 0), new Coords(1, 0), new Coords(1, 1), new Coords(1, 2)), new Rotation(3 /* Left */, new Coords(2, 0), new Coords(0, 1), new Coords(1, 1), new Coords(2, 1)), new Rotation(4 /* Preview */, new Coords(1, 0.5), new Coords(1, 1.5), new Coords(1, 2.5), new Coords(2, 2.5)));

        this.shapes[5 /* O */] = new Shape(5 /* O */, Colours.Yellow, new Rotation(0 /* Up */, new Coords(1, 1), new Coords(2, 1), new Coords(1, 2), new Coords(2, 2)), new Rotation(1 /* Right */, new Coords(1, 1), new Coords(2, 1), new Coords(1, 2), new Coords(2, 2)), new Rotation(2 /* Down */, new Coords(1, 1), new Coords(2, 1), new Coords(1, 2), new Coords(2, 2)), new Rotation(3 /* Left */, new Coords(1, 1), new Coords(2, 1), new Coords(1, 2), new Coords(2, 2)), new Rotation(4 /* Preview */, new Coords(1, 1), new Coords(2, 1), new Coords(1, 2), new Coords(2, 2)));

        this.shapes[4 /* S */] = new Shape(4 /* S */, Colours.Green, new Rotation(0 /* Up */, new Coords(1, 1), new Coords(2, 1), new Coords(0, 2), new Coords(1, 2)), new Rotation(1 /* Right */, new Coords(0, 0), new Coords(0, 1), new Coords(1, 1), new Coords(1, 2)), new Rotation(2 /* Down */, new Coords(1, 0), new Coords(2, 0), new Coords(0, 1), new Coords(1, 1)), new Rotation(3 /* Left */, new Coords(1, 0), new Coords(1, 1), new Coords(2, 1), new Coords(2, 2)), new Rotation(4 /* Preview */, new Coords(1.5, 1), new Coords(2.5, 1), new Coords(0.5, 2), new Coords(1.5, 2)));

        this.shapes[2 /* T */] = new Shape(2 /* T */, Colours.Purple, new Rotation(0 /* Up */, new Coords(1, 1), new Coords(0, 2), new Coords(1, 2), new Coords(2, 2)), new Rotation(1 /* Right */, new Coords(0, 0), new Coords(0, 1), new Coords(1, 1), new Coords(0, 2)), new Rotation(2 /* Down */, new Coords(0, 0), new Coords(1, 0), new Coords(2, 0), new Coords(1, 1)), new Rotation(3 /* Left */, new Coords(2, 0), new Coords(1, 1), new Coords(2, 1), new Coords(2, 2)), new Rotation(4 /* Preview */, new Coords(1.5, 1), new Coords(0.5, 2), new Coords(1.5, 2), new Coords(2.5, 2)));

        this.shapes[3 /* Z */] = new Shape(3 /* Z */, Colours.Red, new Rotation(0 /* Up */, new Coords(0, 1), new Coords(1, 1), new Coords(1, 2), new Coords(2, 2)), new Rotation(1 /* Right */, new Coords(1, 0), new Coords(0, 1), new Coords(1, 1), new Coords(0, 2)), new Rotation(2 /* Down */, new Coords(0, 0), new Coords(1, 0), new Coords(1, 1), new Coords(2, 1)), new Rotation(3 /* Left */, new Coords(2, 0), new Coords(1, 1), new Coords(2, 1), new Coords(1, 2)), new Rotation(4 /* Preview */, new Coords(0.5, 1), new Coords(1.5, 1), new Coords(1.5, 2), new Coords(2.5, 2)));

    }
    GameShapes.prototype.ensureShapeBag = function () {
        if (this.shapeBag.length == 0) {
            this.resetShapeBag();
        }
    };

    GameShapes.prototype.addShapeTypeToBag = function (type) {
        for (var i = 0; i < 4; i++) {
            this.shapeBag[this.shapeBagIndex] = this.shapes[type];
            this.shapeBagIndex += 1;
        }
    };

    GameShapes.prototype.takeShapeFromBag = function () {
        this.ensureShapeBag();

        var min = 0;
        var max = this.shapeBag.length - 1;
        var random = (min + (Math.random() * (max - min)));

        return this.shapeBag.splice(random, 1)[0];
    };

    GameShapes.prototype.resetShapeBag = function () {
        this.shapeBag = new Array();
        this.shapeBagIndex = 0;
        this.addShapeTypeToBag(6 /* I */);
        this.addShapeTypeToBag(1 /* J */);
        this.addShapeTypeToBag(0 /* L */);
        this.addShapeTypeToBag(5 /* O */);
        this.addShapeTypeToBag(4 /* S */);
        this.addShapeTypeToBag(2 /* T */);
        this.addShapeTypeToBag(3 /* Z */);
    };
    return GameShapes;
})();

var Piece = (function () {
    function Piece(shape, rotationDirection, topLeft) {
        this.shape = shape;
        this.rotationDirection = rotationDirection;
        this.topLeft = topLeft;
    }
    Piece.prototype.rotate = function () {
        this.rotationDirection = this.nextDirection();
    };

    Piece.prototype.rotationMinY = function () {
        var currentRotation = this.shape.rotations[this.rotationDirection];
        var minY = 3;
        for (var i = 0; i < 4; i++) {
            if (currentRotation.coords[i].y < minY) {
                minY = currentRotation.coords[i].y;
            }
        }

        return minY;
    };

    Piece.prototype.rotationMaxY = function () {
        var currentRotation = this.shape.rotations[this.rotationDirection];
        var maxY = 0;
        for (var i = 0; i < 4; i++) {
            if (currentRotation.coords[i].y > maxY) {
                maxY = currentRotation.coords[i].y;
            }
        }

        return maxY;
    };

    Piece.prototype.rotationHeight = function () {
        return this.rotationMaxY() - this.rotationMinY() + 1;
    };

    Piece.prototype.rotationMinX = function () {
        var currentRotation = this.shape.rotations[this.rotationDirection];
        var minX = 3;
        for (var i = 0; i < 4; i++) {
            if (currentRotation.coords[i].x < minX) {
                minX = currentRotation.coords[i].x;
            }
        }

        return minX;
    };

    Piece.prototype.rotationMaxX = function () {
        var currentRotation = this.shape.rotations[this.rotationDirection];
        var maxX = 0;
        for (var i = 0; i < 4; i++) {
            if (currentRotation.coords[i].x > maxX) {
                maxX = currentRotation.coords[i].x;
            }
        }

        return maxX;
    };

    Piece.prototype.rotationWidth = function () {
        return this.rotationMaxX() - this.rotationMinX() + 1;
    };

    Piece.prototype.nextDirection = function () {
        switch (this.rotationDirection) {
            case 0 /* Up */:
                return 1 /* Right */;
            case 1 /* Right */:
                return 2 /* Down */;
            case 2 /* Down */:
                return 3 /* Left */;
            case 3 /* Left */:
                return 0 /* Up */;
            default:
                return 0 /* Up */;
        }
    };

    Piece.prototype.move = function (direction) {
        switch (direction) {
            case 1 /* Right */:
                this.topLeft.x += 1;
                break;
            case 2 /* Down */:
                this.topLeft.y += 1;
                break;
            case 3 /* Left */:
                this.topLeft.x -= 1;
                break;
        }
    };

    Piece.prototype.advance = function () {
        this.move(2 /* Down */);
    };
    return Piece;
})();

var AudioManager = (function () {
    function AudioManager() {
    }
    AudioManager.preLoadAll = function () {
        this.explosion1 = this.loadAudio("explosion1");
        this.explosion2 = this.loadAudio("explosion2");
        this.explosion3 = this.loadAudio("explosion3");
        this.explosion4 = this.loadAudio("explosion4");
        this.landpiece = this.loadAudio("landpiece");
        this.levelup = this.loadAudio("levelup");
    };

    AudioManager.loadAudio = function (fileName) {
        var audio = HTMLUtil.createEl("audio");

        if (audio != null && audio.canPlayType) {
            var routeName = "audio/" + fileName;

            if (audio.canPlayType("audio/wav") != "") {
                audio.src = routeName + ".wav";
            } else if (audio.canPlayType("audio/mp3") != "") {
                audio.src = routeName + ".mp3";
            }
        }

        return audio;
    };

    AudioManager.playAudio = function (audio) {
        if (audio != null && audio.src != "") {
            audio.play();
        }
    };

    AudioManager.playExplosion = function (removedRows) {
        if (removedRows < 0) {
            removedRows = 1;
        }
        if (removedRows > 4) {
            removedRows = 4;
        }

        switch (removedRows) {
            case 1:
                this.playAudio(this.explosion1);
                break;
            case 2:
                this.playAudio(this.explosion2);
                break;
            case 3:
                this.playAudio(this.explosion2);
                break;
            case 4:
                this.playAudio(this.explosion4);
                break;
        }
    };

    AudioManager.playLevelUp = function () {
        this.playAudio(this.levelup);
    };

    AudioManager.playLandPiece = function () {
        this.playAudio(this.landpiece);
    };
    return AudioManager;
})();

var GameState;
(function (GameState) {
    /*Game states Mutually exclusive so it's an incremental, not a binary index */
    GameState[GameState["Stopped"] = 0] = "Stopped";
    GameState[GameState["Playing"] = 1] = "Playing";
    GameState[GameState["Paused"] = 2] = "Paused";
})(GameState || (GameState = {}));
;

var GameAction;
(function (GameAction) {
    GameAction[GameAction["handled"] = -1] = "handled";
    GameAction[GameAction["rotatePiece"] = 0] = "rotatePiece";
    GameAction[GameAction["movePieceLeft"] = 1] = "movePieceLeft";
    GameAction[GameAction["movePieceRight"] = 2] = "movePieceRight";
    GameAction[GameAction["movePieceDown"] = 3] = "movePieceDown";
    GameAction[GameAction["startGame"] = 4] = "startGame";
    GameAction[GameAction["stopGame"] = 5] = "stopGame";
    GameAction[GameAction["toggleGamePause"] = 6] = "toggleGamePause";
})(GameAction || (GameAction = {}));

var currentAction;

var GameZone = (function () {
    function GameZone(gameZone) {
        this.gameZone = gameZone;
    }
    GameZone.prototype.shake = function (removedRows) {
        var _this = this;
        var shakeSize = removedRows * 3;
        var duration = removedRows * 1000;
        var easing = 1;
        var animate = HTMLUtil.getAnimationFrame();
        var start = new Date().getTime();

        var shakeZone = function () {
            var now = new Date().getTime();
            var elapsed = now - start;

            if (elapsed < duration) {
                _this.gameZone.style.position = "relative";
                _this.gameZone.style.left = ((Math.round(Math.random() * shakeSize) - ((shakeSize + 1) / 2)) * easing) + 'px';
                _this.gameZone.style.top = ((Math.round(Math.random() * shakeSize) - ((shakeSize + 1) / 2)) * easing) + 'px';

                easing = 1 - (elapsed / duration);
                animate(shakeZone);
            } else {
                _this.gameZone.style.position = "static";
                _this.gameZone.style.left = '0px';
                _this.gameZone.style.top = '0px';
            }
        };

        animate(shakeZone);
    };
    return GameZone;
})();

var Game = (function () {
    function Game(gameZone, gameBoard, previewBoard) {
        this.gameZone = gameZone;
        this.gameBoard = gameBoard;
        this.previewBoard = previewBoard;
        this.gameShapes = new GameShapes();
        this.scoreBoard = new ScoreBoard();
        this.attachEventHandlers();
        AudioManager.preLoadAll();
    }
    Game.prototype.attachEventHandlers = function () {
        document.addEventListener('keydown', this.keydownHandler, false);
    };

    Game.prototype.keydownHandler = function (ev) {
        switch (ev.keyCode) {
            case 37 /* LEFT */:
                currentAction = 1 /* movePieceLeft */;
                break;

            case 39 /* RIGHT */:
                currentAction = 2 /* movePieceRight */;
                break;

            case 38 /* UP */:
                currentAction = 0 /* rotatePiece */;
                break;

            case 40 /* DOWN */:
                currentAction = 3 /* movePieceDown */;
                break;

            case 32 /* SPACE */:
                currentAction = 6 /* toggleGamePause */;
                break;

            case 27 /* ESC */:
                currentAction = 5 /* stopGame */;
                break;

            case 13 /* RETURN */:
                currentAction = 4 /* startGame */;
                break;
        }

        ev.preventDefault();
    };

    Game.prototype.run = function () {
        var _this = this;
        this.reset();
        this.gameState = 0 /* Stopped */;
        var animate = HTMLUtil.getAnimationFrame();
        var now = new Date().getTime();
        var last = now;

        var gameLoop = function () {
            now = new Date().getTime();
            var delta = Math.min(1, (now - last) / 500.0);
            _this.processInput();
            _this.update(delta);
            _this.draw();
            animate(gameLoop);
            last = now;
        };

        animate(gameLoop);
    };

    Game.prototype.reset = function () {
        this.elapsedTime = 0;
        this.gameBoard.reset();
        this.gameShapes.resetShapeBag();
        this.scoreBoard.reset();
        this.setNextPiece();
        this.setCurrentPiece();
        this.currentMessage = "Test";
    };

    Game.prototype.togglePause = function () {
        if (this.gameState == 1 /* Playing */) {
            this.gameState = 2 /* Paused */;
        } else if (this.gameState == 2 /* Paused */) {
            this.gameState = 1 /* Playing */;
        }
    };

    Game.prototype.start = function () {
        this.reset();
        this.gameState = 1 /* Playing */;
    };

    Game.prototype.stop = function () {
        this.gameState = 0 /* Stopped */;
    };

    Game.prototype.setNextPiece = function () {
        var shape = this.gameShapes.takeShapeFromBag();
        this.nextPiece = new Piece(shape, 0 /* Up */, new Coords(0, 0));
        var previewPiece = new Piece(shape, 4 /* Preview */, new Coords(0, 0));
        this.previewBoard.update(previewPiece);
    };

    Game.prototype.setCurrentPiece = function () {
        var pieceAtOrigin = this.nextPiece;
        var targetX = (this.gameBoard.numCols / 2) - 1;
        var targetY = -pieceAtOrigin.rotationMaxY() - 1;

        var newPiece = new Piece(this.nextPiece.shape, 0 /* Up */, new Coords(targetX, targetY));
        this.currentPiece = newPiece;

        this.ghostPiece = new Piece(this.nextPiece.shape, 0 /* Up */, new Coords(targetX, targetY));
        this.gameBoard.syncGhostPiece(this.currentPiece, this.ghostPiece);

        this.setNextPiece();
    };

    Game.prototype.processInput = function () {
        if (this.gameState == 1 /* Playing */) {
            switch (currentAction) {
                case 1 /* movePieceLeft */:
                    this.gameBoard.moveCurrentPiece(3 /* Left */, this.currentPiece, this.ghostPiece);
                    break;

                case 2 /* movePieceRight */:
                    this.gameBoard.moveCurrentPiece(1 /* Right */, this.currentPiece, this.ghostPiece);
                    break;

                case 0 /* rotatePiece */:
                    this.gameBoard.rotateCurrentPiece(this.currentPiece, this.ghostPiece);
                    break;

                case 3 /* movePieceDown */:
                    this.gameBoard.moveCurrentPiece(2 /* Down */, this.currentPiece, this.ghostPiece);
                    break;

                case 6 /* toggleGamePause */:
                    this.togglePause();
                    break;

                case 5 /* stopGame */:
                    this.stop();
                    break;
            }
        } else if (this.gameState == 2 /* Paused */) {
            switch (currentAction) {
                case 6 /* toggleGamePause */:
                    this.togglePause();
                    break;

                case 5 /* stopGame */:
                    this.stop();
                    break;
            }
        } else if (this.gameState == 0 /* Stopped */) {
            switch (currentAction) {
                case 4 /* startGame */:
                    this.start();
                    break;
            }
        }
        currentAction = -1 /* handled */;
    };

    Game.prototype.update = function (timeDelta) {
        this.currentMessage = "";

        if (this.gameState == 1 /* Playing */) {
            var step = 0.6 - ((this.scoreBoard.currentLevel - 1) * 0.05);
            this.elapsedTime = this.elapsedTime + timeDelta;
            if (this.elapsedTime > step) {
                this.elapsedTime = this.elapsedTime - step;
                if (!this.gameBoard.advanceCurrentPiece(this.currentPiece)) {
                    if (this.gameBoard.currentPieceIsEntirelyOnBoard(this.currentPiece)) {
                        var removedRows = this.gameBoard.removeCompletedRows();
                        if (removedRows > 0) {
                            AudioManager.playExplosion(removedRows);
                            this.scoreBoard.update(removedRows);
                            this.gameZone.shake(removedRows);
                        }
                        this.setCurrentPiece();
                    } else {
                        this.stop();
                    }
                }
            }
        } else if (this.gameState == 2 /* Paused */) {
            this.currentMessage = "PAUSED";
        } else if (this.gameState == 0 /* Stopped */) {
            this.currentMessage = "GAME OVER";
        }
    };

    Game.prototype.draw = function () {
        this.gameBoard.drawBlocks();

        if (this.gameState == 1 /* Playing */) {
            this.gameBoard.drawCurrentPiece(this.currentPiece);
            this.gameBoard.drawGhostPiece(this.ghostPiece);
        }

        this.scoreBoard.draw();
        this.previewBoard.draw();

        if (this.currentMessage != "") {
            this.gameBoard.drawMessage(this.currentMessage);
        }
    };
    return Game;
})();

window.onload = function () {
    App.setTitle("Tetris");

    var gameZoneElement = HTMLUtil.getEl("gameZone");
    var gameZone = new GameZone(gameZoneElement);

    var gameCanvas = HTMLUtil.getEl("gameBoard");
    var gameBoard = new GameBoard(gameCanvas, 33 /* BlockSize */, 10 /* NumCols */, 20 /* NumRows */);

    var previewCanvas = HTMLUtil.getEl("previewBoard");
    var previewBoard = new PreviewBoard(previewCanvas, 20 /* BlockSize */, 4 /* NumCols */, 4 /* NumRows */);

    var game = new Game(gameZone, gameBoard, previewBoard);
    game.run();
};
