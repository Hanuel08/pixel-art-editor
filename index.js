class Picture {
  constructor(width, height, pixels) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
  }
  static empty(width, height, color) {
    let pixels = new Array(width * height).fill(color);
    return new Picture(width, height, pixels);
  }
  pixel(x, y) {
    return this.pixels[x + y * this.width];
  }
  draw(pixels) {
    let copy = this.pixels.slice();
    for (let { x, y, color } of pixels) {
      copy[x + y * this.width] = color;
    }
    return new Picture(this.width, this.height, copy);
  }
}

const updateState = (state, action) => {
  return { ...state, ...action };
};

/* Este lo que hace es establecer propiedades (cuyo valor no se representa con texto) en vez de atributos */
const elt = (type, props, ...children) => {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    /* Le introduce un elemento o un texto */
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
};

const scale = 10;

function drawPicture2(picture, canvas, scale) {
  canvas.width = picture.width * scale;
  canvas.height = picture.height * scale;
  let cx = canvas.getContext("2d");

  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      //console.log('picture.pixel', picture.pixel(x, y))

      cx.fillStyle = picture.pixel(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function drawPicture(pictures, canvas, scale) {
  const { newPicture, oldPicture } = pictures;
  let cx = canvas.getContext("2d");
  for (let y = 0; y < newPicture.height; y++) {
    for (let x = 0; x < newPicture.width; x++) {
      if (!oldPicture || newPicture.pixel(x, y) != oldPicture.pixel(x, y)) {
        cx.fillStyle = newPicture.pixel(x, y);
        cx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}

class PictureCanvas {
  constructor(picture, pointerDown) {
    this.dom = this.createDOM(picture, pointerDown);

    this.syncState(picture);
  }

  createDOM(picture, pointerDown) {
    const canvas = elt("canvas", {
      onmousedown: (event) => this.mouse(event, pointerDown),
      ontouchstart: (event) => this.touch(event, pointerDown),
    });

    canvas.width = picture.width * scale;
    canvas.height = picture.height * scale;

    return canvas;
  }

  syncState(picture) {
    if (this.picture == picture) return;
    //this.picture = picture;
    //drawPicture(this.picture, this.dom, scale);
    drawPicture(
      { newPicture: picture, oldPicture: this.picture },
      this.dom,
      scale
    );
    this.picture = picture;
  }
}

PictureCanvas.prototype.mouse = function (downEvent, onDown) {
  if (downEvent.button != 0) return;
  let pos = pointerPosition(downEvent, this.dom);
  let onMove = onDown(pos);
  if (!onMove) return;
  let move = (moveEvent) => {
    if (moveEvent.buttons == 0) {
      this.dom.removeEventListener("mousemove", move);
    } else {
      let newPos = pointerPosition(moveEvent, this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    }
  };
  this.dom.addEventListener("mousemove", move);
};

function pointerPosition(pos, domNode) {
  let rect = domNode.getBoundingClientRect();
  return {
    x: Math.floor((pos.clientX - rect.left) / scale),
    y: Math.floor((pos.clientY - rect.top) / scale),
  };
}

PictureCanvas.prototype.touch = function (startEvent, onDown) {
  let pos = pointerPosition(startEvent.touches[0], this.dom);
  let onMove = onDown(pos);
  startEvent.preventDefault();
  if (!onMove) return;
  let move = (moveEvent) => {
    let newPos = pointerPosition(moveEvent.touches[0], this.dom);
    if (newPos.x == pos.x && newPos.y == pos.y) return;
    pos = newPos;
    onMove(newPos);
  };
  let end = () => {
    this.dom.removeEventListener("touchmove", move);
    this.dom.removeEventListener("touchend", end);
  };
  this.dom.addEventListener("touchmove", move);
  this.dom.addEventListener("touchend", end);
};

class PixelEditor {
  constructor(state, config) {
    let { tools, controls, dispatch } = config;
    this.state = state;
    //console.log("tools", tools);
    //console.log("state", state);
    //console.log("config", config);

    this.canvas = new PictureCanvas(state.picture, (pos) => {
      let tool = tools[this.state.tool];
      //console.log('tool', tool);
      let onMove = tool(pos, this.state, dispatch);
      if (onMove) return (pos) => onMove(pos, this.state);
    });
    this.controls = controls.map((Control) => new Control(state, config));

    this.dom = elt(
      "div",
      {
        tabIndex: 0,
        onkeydown: (e) => {
          if (e.code == "KeyD") {
            this.state.tool = "draw";
          } else if (e.code == "KeyF") {
            this.state.tool = "fill";
          } else if (e.code == "KeyP") {
            this.state.tool = "pick";
          } else if (e.code == "KeyR") {
            this.state.tool = "rectangle";
          } else if (e.code == "KeyZ" && e.ctrlKey) {
            /* Es el btn de volver atras */
            this.controls[4].dom.click();
          }
          this.syncState(this.state);
        },
        ///////
      },
      this.canvas.dom,
      elt("br"),
      ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
    );
    //console.log("this.dom", this.dom);

    ///constructor end
  }
  syncState(state) {
    this.state = state;
    this.canvas.syncState(state.picture);
    for (let ctrl of this.controls) ctrl.syncState(state);
  }
}

class ToolSelect {
  constructor(state, { tools, dispatch }) {
    this.select = elt(
      "select",
      {
        onchange: () => dispatch({ tool: this.select.value }),
      },
      ...Object.keys(tools).map((name) =>
        elt(
          "option",
          {
            selected: name == state.tool,
          },
          name
        )
      )
    );
    this.dom = elt("label", null, "🖌 Tool: ", this.select);
  }
  syncState(state) {
    this.select.value = state.tool;
  }
}

class ColorSelect {
  constructor(state, { dispatch }) {
    this.input = elt("input", {
      type: "color",
      value: state.color,
      onchange: () => dispatch({ color: this.input.value }),
    });
    this.dom = elt("label", null, "🎨 Color: ", this.input);
  }
  syncState(state) {
    this.input.value = state.color;
  }
}

/* function draw(pos, state, dispatch) {
    function drawPixel({x, y}, state) {
      let drawn = {x, y, color: state.color};
      dispatch({picture: state.picture.draw([drawn])});
    }
    drawPixel(pos, state);
    return drawPixel;
} */

const fillInWithNums = (start, end) => {
  const array = [];
  if (start <= end) {
    for (let i = start; i <= end; i++) {
      array.push(i);
    }
  } else {
    for (let i = start; i >= end; i--) {
      array.push(i);
    }
  }
  return array;
};

const cutArray = (array, from, to = array.length) => {
  const newArray = array;
  const cutPart = [...newArray.slice(from, to)];
  newArray.splice(from, to);
  return {
    afterCutting: newArray,
    cutPart,
  };
};

const separateCoordinates = (smallerArrayLength, largestArray, determinant) => {
  const separatePoints = [];
  const spareElements = (determinant * smallerArrayLength) - largestArray.length;
  const indexOfspareElements = smallerArrayLength - spareElements;

  for (let i = 0; i < smallerArrayLength; i++) {
    let arraysObject;
    if (i >= indexOfspareElements) {
      largestArray[determinant - 1] != "undefined"
        ? (arraysObject = cutArray(largestArray, 0, determinant - 1))
        : (arraysObject = cutArray(largestArray, 0));
    } else {
      largestArray[determinant] != "undefined"
        ? (arraysObject = cutArray(largestArray, 0, determinant))
        : (arraysObject = cutArray(largestArray, 0));
    }
    separatePoints.push(arraysObject.cutPart);
    largestArray = arraysObject.afterCutting;
  }
  return separatePoints;
};

const createPoints = (matrix, array, info) => {
  let { direction, state, drawn } = info;
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      let drawObject = { color: state.color };
      if (direction == "x") {
        drawObject.x = matrix[i][j];
        drawObject.y = array[i];
      } else if (direction == "y") {
        drawObject.x = array[i];
        drawObject.y = matrix[i][j];
      }
      drawn.push(drawObject);
    }
  }
  return drawn;
};



const drawLine = (start, end, state) => {
  let xStart = start.x;
  let yStart = start.y;
  let xEnd = end.x;
  let yEnd = end.y;
  let drawn = [];

  let xPoints = fillInWithNums(xStart, xEnd);
  let yPoints = fillInWithNums(yStart, yEnd);
  let xLength = xPoints.length;
  let yLength = yPoints.length;

  const verification = {
    largestX: xLength > yLength,
    largestY: yLength > xLength,
    equal: xLength === yLength,
  };

  const determinant = Math.ceil(
    Math.max(xLength, yLength) / Math.min(xLength, yLength)
  );

  if (verification.largestX) {
    drawn = createPoints(
      separateCoordinates(yLength, xPoints, determinant),
      yPoints,
      { direction: "x", state, drawn }
    );
  } else if (verification.largestY) {
    drawn = createPoints(
      separateCoordinates(xLength, yPoints, determinant),
      xPoints,
      { direction: "y", state, drawn }
    );
  } else if (verification.equal) {
    for (let i = 0; i < xLength; i++) {
      drawn.push({ x: xPoints[i], y: yPoints[i], color: state.color });
    }
  }
  return drawn;
};

function draw(start, state, dispatch) {
  function drawPixel(pos, state) {
    dispatch({ picture: state.picture.draw(drawLine(start, pos, state)) });
    start = pos;
  }
  drawPixel(start, state);
  return drawPixel;
}

function rectangle(start, state, dispatch) {
  function drawRectangle(pos) {
    let xStart = Math.min(start.x, pos.x);
    let yStart = Math.min(start.y, pos.y);
    let xEnd = Math.max(start.x, pos.x);
    let yEnd = Math.max(start.y, pos.y);
    let drawn = [];
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        drawn.push({ x, y, color: state.color });
      }
    }
    dispatch({ picture: state.picture.draw(drawn) });
  }
  drawRectangle(start);
  return drawRectangle;
}

const around = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
];

function fill({ x, y }, state, dispatch) {
  let targetColor = state.picture.pixel(x, y);
  let drawn = [{ x, y, color: state.color }];
  for (let done = 0; done < drawn.length; done++) {
    for (let { dx, dy } of around) {
      let x = drawn[done].x + dx,
        y = drawn[done].y + dy;
      if (
        x >= 0 &&
        x < state.picture.width &&
        y >= 0 &&
        y < state.picture.height &&
        state.picture.pixel(x, y) == targetColor &&
        !drawn.some((p) => p.x == x && p.y == y)
      ) {
        drawn.push({ x, y, color: state.color });
      }
    }
  }
  dispatch({ picture: state.picture.draw(drawn) });
}

function pick(pos, state, dispatch) {
  dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}

function circle(start, state, dispatch) {
  function drawCircle(pos) {
    let xStart = Math.min(start.x, pos.x);
    let yStart = Math.min(start.y, pos.y);
    let xEnd = Math.max(start.x, pos.x);
    let yEnd = Math.max(start.y, pos.y);
    let drawn = [];

    const findModule = (a, b) =>
      !isNaN(a) && !isNaN(b) ? Math.sqrt(a ** 2 + b ** 2) : NaN;
    let currentModule = findModule(xEnd - xStart, yEnd - yStart);
    for (let y = yStart - (yEnd - yStart); y <= yEnd; y++) {
      for (let x = xStart - (xEnd - xStart); x <= xEnd; x++) {
        if (findModule(xStart - x, yStart - y) * 2 < currentModule * 1.5) {
          drawn.push({ x, y, color: state.color });
        }
      }
    }
    dispatch({ picture: state.picture.draw(drawn) });
  }
  drawCircle(start);
  return drawCircle;
}

function line(start, state, dispatch) {
  function drawPixel(end) {
    dispatch({ picture: state.picture.draw(drawLine(start, end, state)) });
  }
  drawPixel(start);
  return drawPixel;
}

let state = {
  tool: "draw",
  color: "#000000",
  picture: Picture.empty(60, 30, "#f0f0f0"),
};

let app = new PixelEditor(state, {
  tools: { draw, fill, rectangle, pick },
  controls: [ToolSelect, ColorSelect],
  dispatch(action) {
    state = updateState(state, action);
    app.syncState(state);
  },
});

class SaveButton {
  constructor(state) {
    this.picture = state.picture;
    this.dom = elt(
      "button",
      {
        onclick: () => this.save(),
      },
      "💾 Save"
    );
  }
  save() {
    let canvas = elt("canvas");
    drawPicture(this.picture, canvas, 1);
    let link = elt("a", {
      /* Esto crea una URL que inicia con data: (en vez de http: y https:) que contiene el toda la imagen, en este caso del lienzo */
      href: canvas.toDataURL(),
      download: "pixelart.png",
    });
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  syncState(state) {
    this.picture = state.picture;
  }
}

function startLoad(dispatch) {
  let input = elt("input", {
    type: "file",
    onchange: () => finishLoad(input.files[0], dispatch),
  });
  document.body.appendChild(input);
  input.click();
  input.remove();
}

class LoadButton {
  constructor(_, { dispatch }) {
    this.dom = elt(
      "button",
      {
        onclick: () => startLoad(dispatch),
      },
      "📁 Load"
    );
  }
  syncState() {}
}

function finishLoad(file, dispatch) {
  if (file == null) return;
  let reader = new FileReader();

  reader.addEventListener("load", () => {
    let image = elt("img", {
      onload: () =>
        dispatch({
          picture: pictureFromImage(image),
        }),
      src: reader.result,
    });
  });
  reader.readAsDataURL(file);
}

function pictureFromImage(image) {
  let width = Math.min(100, image.width);
  let height = Math.min(100, image.height);
  let canvas = elt("canvas", { width, height });
  let cx = canvas.getContext("2d");
  cx.drawImage(image, 0, 0);
  let pixels = [];

  /* La propiedad data del getImageData contiene los componentes de color de una matriz. Cada pixel esta compuesto por 4 valores: rojo, verde, azul y alfa (la opacidad) */
  let { data } = cx.getImageData(0, 0, width, height);

  function hex(n) {
    /* Cadaa 2 digitos de la notacion hexadecimal de colores representa 256 numeros diferentes, lo que es igual a 16^2 = 256. Es decir, estan en base 16. A toString() se le puede pasar como argumento una base para que representa en una cadena en la base 16. Para asegurarnos de que cada numero ocupe 2 digitos, usamos un padStar para rellenar con 0 por si acaso  */
    return n.toString(16).padStart(2, "0");
  }
  for (let i = 0; i < data.length; i += 4) {
    let [r, g, b] = data.slice(i, i + 3);
    pixels.push("#" + hex(r) + hex(g) + hex(b));
  }
  return new Picture(width, height, pixels);
}

function historyUpdateState(state, action) {
  //console.log("action.undo", action.undo);
  if (action.undo == true) {
    if (state.done.length == 0) return state;
    //console.log("state.done", state.done);
    return Object.assign({}, state, {
      picture: state.done[0],
      done: state.done.slice(1),
      doneAt: 0,
    });
  } else if (action.picture && state.doneAt < Date.now() - 1000) {
    return Object.assign({}, state, action, {
      done: [state.picture, ...state.done],
      doneAt: Date.now(),
    });
  } else {
    return Object.assign({}, state, action);
  }
}

class UndoButton {
  constructor(state, { dispatch }) {
    this.dom = elt(
      "button",
      {
        onclick: () => dispatch({ undo: true }),
        disabled: state.done.length == 0,
      },
      "⮪ Undo"
    );
  }
  syncState(state) {
    this.dom.disabled = state.done.length == 0;
  }
}

const startState = {
  tool: "draw",
  color: "#000000",
  picture: Picture.empty(60, 30, "#f0f0f0"),
  done: [],
  doneAt: 0,
};

const baseTools = { draw, line, fill, rectangle, pick, circle };

const baseControls = [
  ToolSelect,
  ColorSelect,
  SaveButton,
  LoadButton,
  UndoButton,
];

function startPixelEditor({
  state = startState,
  tools = baseTools,
  controls = baseControls,
}) {
  let app = new PixelEditor(state, {
    tools,
    controls,
    dispatch(action) {
      state = historyUpdateState(state, action);
      app.syncState(state);
    },
  });
  return app.dom;
}

//export { startPixelEditor };


document.querySelector(".draw").appendChild(startPixelEditor({}));

//document.querySelector("div").appendChild(app.dom);
//document.querySelector(".draw").appendChild(startPixelEditor({}));
  
  

/* let xStart = start.x;
    let yStart = start.y;
    let xEnd = pos.x;
    let yEnd = pos.y;
    let drawn = [];

    console.log("start", start);
    console.log("pos", pos);
    console.log("state", state);

    

    let xPoints = fillInWithNums(xStart, xEnd);
    let yPoints = fillInWithNums(yStart, yEnd);
    let xLength = xPoints.length;
    let yLength = yPoints.length;

    const verification = {
      largestX: false,
      largestY: false,
      equal: false,
    };

    if (xLength === yLength) {
      verification.equal = true;
    } else if (xLength > yLength) {
      verification.largestX = true;
    } else if (yLength > xLength) {
      verification.largestY = true;
    }

    console.log(`xStart: ${xStart}, yStart: ${yStart}`);
    console.log(`xEnd: ${xEnd}, yEnd: ${yEnd}`);

    console.log("xPoints", xPoints);
    console.log("yPoints", yPoints);

    let determinant = Math.ceil(
      Math.max(xLength, yLength) / Math.min(xLength, yLength)
    );

    console.log("determinant", determinant);
    

    

    const createPoints = (matrix, array, matrixDirection = "x") => {
      //console.log('Draw Object antes de iniciar', drawObject)

      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          let drawObject = { color: state.color };

          if (matrixDirection == "x") {
            drawObject.x = matrix[i][j];
            drawObject.y = array[i];
            //drawn.push(drawObject);
          } else {
            drawObject.x = array[i];
            drawObject.y = matrix[i][j];
            // drawn.push(drawObject);
          }
          //console.log(drawObject);
          drawn.push(drawObject);
          //console.log(`i: ${i}, j: ${j}`, drawn);
        }
      }
    };

    if (verification.largestX) {
      createPoints(separateCoordinates(yLength, xPoints, determinant), yPoints);
    } else if (verification.largestY) {
      createPoints(
        separateCoordinates(xLength, yPoints, determinant),
        xPoints,
        "y"
      );
    } else if (verification.equal) {
      for (let i = 0; i < xLength; i++) {
        drawn.push({ x: xPoints[i], y: yPoints[i], color: state.color });
      }
    }

    console.log("xPoints", xPoints);
    console.log("yPoints", yPoints);
    console.log("Drawn", drawn);

    start = pos;
    dispatch({ picture: state.picture.draw(drawn) });
  } */
