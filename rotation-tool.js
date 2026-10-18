(() => {
  const root = document.getElementById("rotation-tool");
  if (!root) return;

  const svg = root.querySelector(".rotation-canvas");
  const grid = root.querySelector('[data-role="grid"]');
  const axes = root.querySelector('[data-role="axes"]');
  const shapes = root.querySelector('[data-role="shapes"]');
  const guides = root.querySelector('[data-role="guides"]');
  const angleSlider = root.querySelector("#rotation-angle");
  const angleValue = root.querySelector("#rotation-angle-value");
  const xInput = root.querySelector("#vertex-x");
  const yInput = root.querySelector("#vertex-y");
  const addButton = root.querySelector("#add-vertex");
  const undoButton = root.querySelector("#undo-vertex");
  const clearButton = root.querySelector("#clear-vertices");
  const centerXInput = root.querySelector("#center-x");
  const centerYInput = root.querySelector("#center-y");
  const setCenterButton = root.querySelector("#set-center");
  const chooseCenterButton = root.querySelector("#choose-center");
  const centerValue = root.querySelector("#rotation-center-value");
  const status = root.querySelector("#rotation-status");
  const coordinateList = root.querySelector("#rotation-coordinates");
  const distanceToggle = root.querySelector("#show-axis-distances");
  const distancePanel = root.querySelector("#rotation-distance-panel");
  const distanceValues = root.querySelector("#rotation-distance-values");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SIZE = 640;
  const ORIGIN = SIZE / 2;
  let UNIT = 22;
  let GRID_EXTENT = 12;
  const INPUT_LIMIT = 8;
  const vertices = [];
  let center = { x: 0, y: 0 };
  let pickingCenter = false;

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function screenPoint(point) {
    return {
      x: ORIGIN + point.x * UNIT,
      y: ORIGIN - point.y * UNIT
    };
  }

  function pointName(index) {
    const letter = String.fromCharCode(65 + (index % 26));
    const cycle = Math.floor(index / 26);
    return cycle === 0 ? letter : `${letter}${cycle + 1}`;
  }

  function formatNumber(value) {
    const rounded = Number(value.toFixed(2));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  }

  function rotatedPoint(point, angleDegrees, about) {
    const radians = (angleDegrees * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return {
      x: about.x + (point.x - about.x) * cosine - (point.y - about.y) * sine,
      y: about.y + (point.x - about.x) * sine + (point.y - about.y) * cosine
    };
  }

  function drawGrid() {
    grid.replaceChildren();
    axes.replaceChildren();
    const tickStep = GRID_EXTENT > 12 ? 4 : 2;
    for (let value = -GRID_EXTENT; value <= GRID_EXTENT; value += 1) {
      const position = ORIGIN + value * UNIT;
      if (value !== 0) {
        const lineClass = value % 2 === 0 ? "rotation-grid-line major" : "rotation-grid-line";
        grid.append(
          svgElement("line", {
            x1: position,
            y1: ORIGIN - GRID_EXTENT * UNIT,
            x2: position,
            y2: ORIGIN + GRID_EXTENT * UNIT,
            class: lineClass
          }),
          svgElement("line", {
            x1: ORIGIN - GRID_EXTENT * UNIT,
            y1: position,
            x2: ORIGIN + GRID_EXTENT * UNIT,
            y2: position,
            class: lineClass
          })
        );
      }

      if (value !== 0 && value % tickStep === 0) {
        const xLabel = svgElement("text", {
          x: position,
          y: ORIGIN + GRID_EXTENT * UNIT + 24,
          class: "rotation-grid-label",
          "text-anchor": "middle"
        });
        xLabel.textContent = String(value);
        axes.append(xLabel);

        const yLabel = svgElement("text", {
          x: ORIGIN - GRID_EXTENT * UNIT - 12,
          y: ORIGIN - value * UNIT + 4,
          class: "rotation-grid-label",
          "text-anchor": "end"
        });
        yLabel.textContent = String(value);
        axes.append(yLabel);
      }
    }

    axes.append(
      svgElement("line", {
        x1: ORIGIN - GRID_EXTENT * UNIT,
        y1: ORIGIN,
        x2: ORIGIN + GRID_EXTENT * UNIT,
        y2: ORIGIN,
        class: "rotation-axis"
      }),
      svgElement("line", {
        x1: ORIGIN,
        y1: ORIGIN - GRID_EXTENT * UNIT,
        x2: ORIGIN,
        y2: ORIGIN + GRID_EXTENT * UNIT,
        class: "rotation-axis"
      })
    );

    const originLabel = svgElement("text", {
      x: ORIGIN + 7,
      y: ORIGIN + 17,
      class: "rotation-grid-label",
      "text-anchor": "start"
    });
    originLabel.textContent = "0";
    axes.append(originLabel);

    const xAxisLabel = svgElement("text", {
      x: ORIGIN + GRID_EXTENT * UNIT + 12,
      y: ORIGIN + 5,
      class: "rotation-axis-label"
    });
    xAxisLabel.textContent = "x";
    axes.append(xAxisLabel);

    const yAxisLabel = svgElement("text", {
      x: ORIGIN + 6,
      y: ORIGIN - GRID_EXTENT * UNIT - 10,
      class: "rotation-axis-label"
    });
    yAxisLabel.textContent = "y";
    axes.append(yAxisLabel);
  }

  function updateLabelScale() {
    const renderedWidth = svg.getBoundingClientRect().width;
    if (renderedWidth > 0) {
      svg.style.setProperty("--rotation-text-scale", String(SIZE / renderedWidth));
    }
  }

  function drawShape(points, className, closed) {
    if (points.length === 0) return;
    if (points.length === 1) return;

    const coordinates = points.map((point) => {
      const screen = screenPoint(point);
      return `${screen.x},${screen.y}`;
    });
    const shape = svgElement(closed ? "polygon" : "polyline", {
      points: coordinates.join(" "),
      class: className
    });
    shapes.append(shape);
  }

  function drawMarkers(points, className, labelSuffix = "") {
    points.forEach((point, index) => {
      const screen = screenPoint(point);
      shapes.append(
        svgElement("circle", {
          cx: screen.x,
          cy: screen.y,
          r: 5,
          class: `${className}-marker`
        })
      );

      const label = svgElement("text", {
        x: screen.x + 8,
        y: screen.y - 8,
        class: `${className}-label`
      });
      label.textContent = `${pointName(index)}${labelSuffix}`;
      shapes.append(label);
    });
  }

  function drawDistanceGuides(points, className) {
    points.forEach((point) => {
      const screen = screenPoint(point);
      const yAxisFoot = screenPoint({ x: 0, y: point.y });
      const xAxisFoot = screenPoint({ x: point.x, y: 0 });
      guides.append(
        svgElement("line", {
          x1: screen.x, y1: screen.y, x2: yAxisFoot.x, y2: yAxisFoot.y,
          class: `rotation-distance-guide ${className}-distance-guide`
        }),
        svgElement("line", {
          x1: screen.x, y1: screen.y, x2: xAxisFoot.x, y2: xAxisFoot.y,
          class: `rotation-distance-guide ${className}-distance-guide`
        })
      );
    });
  }

  function render() {
    const angle = Number(angleSlider.value);
    const rotated = vertices.map((point) => rotatedPoint(point, angle, center));
    const extentValues = [...vertices, ...rotated, center].flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]);
    GRID_EXTENT = Math.max(12, Math.ceil((Math.max(0, ...extentValues) + 1) / 4) * 4);
    UNIT = (ORIGIN - 56) / GRID_EXTENT;
    drawGrid();
    angleValue.value = `${angle}°`;
    angleValue.textContent = `${angle}°`;
    shapes.replaceChildren();
    guides.replaceChildren();

    distancePanel.hidden = !distanceToggle.checked;
    distanceValues.replaceChildren();
    if (distanceToggle.checked) {
      drawDistanceGuides(vertices, "original");
      drawDistanceGuides(rotated, "rotated");
    }

    const closed = vertices.length >= 3;
    drawShape(vertices, "rotation-original-shape", closed);
    drawShape(rotated, "rotation-rotated-shape", closed);
    drawMarkers(rotated, "rotation-rotated", "′");
    drawMarkers(vertices, "rotation-original");
    const centerScreen = screenPoint(center);
    shapes.append(
      svgElement("circle", { cx: centerScreen.x, cy: centerScreen.y, r: 8, class: "rotation-center-marker" }),
      svgElement("line", { x1: centerScreen.x - 12, y1: centerScreen.y, x2: centerScreen.x + 12, y2: centerScreen.y, class: "rotation-center-crosshair" }),
      svgElement("line", { x1: centerScreen.x, y1: centerScreen.y - 12, x2: centerScreen.x, y2: centerScreen.y + 12, class: "rotation-center-crosshair" })
    );
    const centerLabel = svgElement("text", { x: centerScreen.x + 11, y: centerScreen.y - 10, class: "rotation-center-label" });
    centerLabel.textContent = "C";
    shapes.append(centerLabel);
    centerValue.textContent = `(${center.x}, ${center.y})`;

    coordinateList.replaceChildren();
    vertices.forEach((point, index) => {
      const image = rotated[index];
      const item = document.createElement("li");
      item.textContent = `${pointName(index)} (${point.x}, ${point.y}) → ${pointName(index)}′ (${formatNumber(image.x)}, ${formatNumber(image.y)})`;
      coordinateList.append(item);

      const row = document.createElement("tr");
      [
        pointName(index),
        formatNumber(Math.abs(point.x)),
        formatNumber(Math.abs(point.y)),
        formatNumber(Math.abs(image.x)),
        formatNumber(Math.abs(image.y))
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      distanceValues.append(row);
    });

    undoButton.disabled = vertices.length === 0;
    clearButton.disabled = vertices.length === 0;
  }

  function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function segmentsIntersect(a, b, c, d) {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    return abC * abD < 0 && cdA * cdB < 0;
  }

  function isStrictlyConvex(points) {
    if (points.length < 3) return true;
    let turnDirection = 0;
    for (let i = 0; i < points.length; i += 1) {
      const turn = cross(points[i], points[(i + 1) % points.length], points[(i + 2) % points.length]);
      if (turn === 0) return false;
      const direction = Math.sign(turn);
      if (turnDirection !== 0 && direction !== turnDirection) return false;
      turnDirection = direction;
    }
    for (let i = 0; i < points.length; i += 1) {
      const iNext = (i + 1) % points.length;
      for (let j = i + 1; j < points.length; j += 1) {
        const jNext = (j + 1) % points.length;
        if (i === j || iNext === j || jNext === i) continue;
        if (segmentsIntersect(points[i], points[iNext], points[j], points[jNext])) return false;
      }
    }
    return true;
  }

  function setCenter(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > INPUT_LIMIT || Math.abs(y) > INPUT_LIMIT) {
      status.textContent = "Choose an integer center from −8 to 8 on each axis.";
      return false;
    }
    center = { x, y };
    centerXInput.value = String(x);
    centerYInput.value = String(y);
    render();
    status.textContent = `Center of rotation set to (${x}, ${y}).`;
    return true;
  }

  function addVertex(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > INPUT_LIMIT || Math.abs(y) > INPUT_LIMIT) {
      status.textContent = "Choose integer coordinates from −8 to 8 on each axis.";
      return;
    }

    const candidate = [...vertices, { x, y }];
    if (candidate.length >= 3 && !isStrictlyConvex(candidate)) {
      status.textContent = "That point would make the polygon concave, collinear, or self-crossing. Add vertices in order around its boundary.";
      return;
    }
    vertices.push({ x, y });
    render();
    const name = pointName(vertices.length - 1);
    status.textContent = vertices.length >= 3
      ? `${name} added at (${x}, ${y}). The ${vertices.length}-vertex convex polygon is ready to rotate about (${center.x}, ${center.y}).`
      : `${name} added at (${x}, ${y}). Add ${3 - vertices.length} more point${vertices.length === 1 ? "s" : ""} to create a polygon.`;
  }

  function addFromInputs() {
    const x = Number(xInput.value);
    const y = Number(yInput.value);
    if (xInput.value.trim() === "" || yInput.value.trim() === "") {
      status.textContent = "Enter an integer x-coordinate and y-coordinate first.";
      return;
    }
    addVertex(x, y);
  }

  svg.addEventListener("click", (event) => {
    const bounds = svg.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * SIZE;
    const svgY = ((event.clientY - bounds.top) / bounds.height) * SIZE;
    const xValue = (svgX - ORIGIN) / UNIT;
    const yValue = (ORIGIN - svgY) / UNIT;

    if (Math.abs(xValue) > GRID_EXTENT || Math.abs(yValue) > GRID_EXTENT) {
      status.textContent = "Choose a point on the visible coordinate grid.";
      return;
    }

    const x = Math.round(xValue);
    const y = Math.round(yValue);
    if (pickingCenter) {
      if (setCenter(x, y)) {
        pickingCenter = false;
        root.classList.remove("is-picking-center");
        chooseCenterButton.setAttribute("aria-pressed", "false");
      }
      return;
    }
    if (Math.abs(x) > INPUT_LIMIT || Math.abs(y) > INPUT_LIMIT) {
      status.textContent = "Place original vertices from −8 to 8 on each axis.";
      return;
    }
    xInput.value = String(x);
    yInput.value = String(y);
    addVertex(x, y);
  });

  angleSlider.addEventListener("input", render);
  distanceToggle.addEventListener("change", render);
  addButton.addEventListener("click", addFromInputs);
  setCenterButton.addEventListener("click", () => {
    if (centerXInput.value.trim() === "" || centerYInput.value.trim() === "") {
      status.textContent = "Enter integer coordinates for the center first.";
      return;
    }
    setCenter(Number(centerXInput.value), Number(centerYInput.value));
  });
  chooseCenterButton.addEventListener("click", () => {
    pickingCenter = !pickingCenter;
    root.classList.toggle("is-picking-center", pickingCenter);
    chooseCenterButton.setAttribute("aria-pressed", String(pickingCenter));
    status.textContent = pickingCenter ? "Click a grid point to place the center of rotation." : "Center selection canceled.";
  });
  undoButton.addEventListener("click", () => {
    vertices.pop();
    render();
    status.textContent = vertices.length === 0
      ? "All points removed. Add at least three vertices to create a polygon."
      : `Last point removed. ${vertices.length} point${vertices.length === 1 ? "" : "s"} remain.`;
  });
  clearButton.addEventListener("click", () => {
    vertices.length = 0;
    angleSlider.value = "0";
    render();
    status.textContent = "Shape cleared. Add at least three vertices to create a polygon.";
  });

  updateLabelScale();
  render();

  if ("ResizeObserver" in window) {
    new ResizeObserver(updateLabelScale).observe(svg);
  } else {
    window.addEventListener("resize", updateLabelScale);
  }
})();
