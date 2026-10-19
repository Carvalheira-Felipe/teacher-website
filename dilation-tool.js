(() => {
  const root = document.getElementById("dilation-tool");
  if (!root) return;

  const svg = root.querySelector(".rotation-canvas");
  const grid = root.querySelector('[data-role="grid"]');
  const axes = root.querySelector('[data-role="axes"]');
  const localAxes = root.querySelector('[data-role="local-axes"]');
  const guides = root.querySelector('[data-role="guides"]');
  const localGuides = root.querySelector('[data-role="local-guides"]');
  const shapes = root.querySelector('[data-role="shapes"]');
  const scaleSlider = root.querySelector("#dilation-scale");
  const scaleValue = root.querySelector("#dilation-scale-value");
  const xInput = root.querySelector("#dilation-vertex-x");
  const yInput = root.querySelector("#dilation-vertex-y");
  const addButton = root.querySelector("#dilation-add-vertex");
  const undoButton = root.querySelector("#dilation-undo-vertex");
  const clearButton = root.querySelector("#dilation-clear-vertices");
  const centerXInput = root.querySelector("#dilation-center-x");
  const centerYInput = root.querySelector("#dilation-center-y");
  const setCenterButton = root.querySelector("#dilation-set-center");
  const chooseCenterButton = root.querySelector("#dilation-choose-center");
  const centerValue = root.querySelector("#dilation-center-value");
  const status = root.querySelector("#dilation-status");
  const coordinateList = root.querySelector("#dilation-coordinates");
  const axisDistancesToggle = root.querySelector("#dilation-show-axis-distances");
  const axisDistancePanel = root.querySelector("#dilation-distance-panel");
  const axisDistanceValues = root.querySelector("#dilation-distance-values");
  const localAxesToggle = root.querySelector("#dilation-show-local-axes");
  const localDistancesToggle = root.querySelector("#dilation-show-local-distances");
  const localDistancePanel = root.querySelector("#dilation-local-distance-panel");
  const localDistanceValues = root.querySelector("#dilation-local-distance-values");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SIZE = 640;
  const ORIGIN = SIZE / 2;
  const INPUT_LIMIT = 8;
  const vertices = [];
  let UNIT = 22;
  let GRID_EXTENT = 12;
  let center = { x: 0, y: 0 };
  let choosingCenter = false;

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function screenPoint(point) {
    return { x: ORIGIN + point.x * UNIT, y: ORIGIN - point.y * UNIT };
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

  function dilatedPoint(point, coefficient) {
    return {
      x: center.x + coefficient * (point.x - center.x),
      y: center.y + coefficient * (point.y - center.y),
      name: point.name
    };
  }

  function drawGrid() {
    grid.replaceChildren();
    axes.replaceChildren();
    const tickStep = GRID_EXTENT > 32 ? Math.ceil(GRID_EXTENT / 12) : GRID_EXTENT > 12 ? 4 : 2;

    for (let value = -GRID_EXTENT; value <= GRID_EXTENT; value += 1) {
      const position = ORIGIN + value * UNIT;
      if (value !== 0) {
        const lineClass = value % 2 === 0 ? "rotation-grid-line major" : "rotation-grid-line";
        grid.append(
          svgElement("line", { x1: position, y1: ORIGIN - GRID_EXTENT * UNIT, x2: position, y2: ORIGIN + GRID_EXTENT * UNIT, class: lineClass }),
          svgElement("line", { x1: ORIGIN - GRID_EXTENT * UNIT, y1: position, x2: ORIGIN + GRID_EXTENT * UNIT, y2: position, class: lineClass })
        );
      }

      if (value !== 0 && value % tickStep === 0) {
        const xLabel = svgElement("text", { x: position, y: ORIGIN + GRID_EXTENT * UNIT + 24, class: "rotation-grid-label", "text-anchor": "middle" });
        xLabel.textContent = String(value);
        axes.append(xLabel);
        const yLabel = svgElement("text", { x: ORIGIN - GRID_EXTENT * UNIT - 12, y: ORIGIN - value * UNIT + 4, class: "rotation-grid-label", "text-anchor": "end" });
        yLabel.textContent = String(value);
        axes.append(yLabel);
      }
    }

    axes.append(
      svgElement("line", { x1: ORIGIN - GRID_EXTENT * UNIT, y1: ORIGIN, x2: ORIGIN + GRID_EXTENT * UNIT, y2: ORIGIN, class: "rotation-axis" }),
      svgElement("line", { x1: ORIGIN, y1: ORIGIN - GRID_EXTENT * UNIT, x2: ORIGIN, y2: ORIGIN + GRID_EXTENT * UNIT, class: "rotation-axis" })
    );
    const originLabel = svgElement("text", { x: ORIGIN + 7, y: ORIGIN + 17, class: "rotation-grid-label", "text-anchor": "start" });
    originLabel.textContent = "0";
    axes.append(originLabel);
    const xAxisLabel = svgElement("text", { x: ORIGIN + GRID_EXTENT * UNIT + 12, y: ORIGIN + 5, class: "rotation-axis-label" });
    xAxisLabel.textContent = "x";
    axes.append(xAxisLabel);
    const yAxisLabel = svgElement("text", { x: ORIGIN + 6, y: ORIGIN - GRID_EXTENT * UNIT - 10, class: "rotation-axis-label" });
    yAxisLabel.textContent = "y";
    axes.append(yAxisLabel);
  }

  function updateLabelScale() {
    const renderedWidth = svg.getBoundingClientRect().width;
    if (renderedWidth > 0) svg.style.setProperty("--rotation-text-scale", String(SIZE / renderedWidth));
  }

  function drawShape(points, className, closed) {
    if (points.length < 2) return;
    const coordinates = points.map((point) => {
      const screen = screenPoint(point);
      return `${screen.x},${screen.y}`;
    });
    shapes.append(svgElement(closed ? "polygon" : "polyline", { points: coordinates.join(" "), class: className }));
  }

  function drawMarkers(points, className, suffix = "", stackedAtCenter = false) {
    points.forEach((point, index) => {
      const screen = screenPoint(point);
      shapes.append(svgElement("circle", { cx: screen.x, cy: screen.y, r: stackedAtCenter ? 11 : 5, class: `${className}-marker` }));
      let labelX = screen.x + 8;
      let labelY = screen.y - 8;
      if (stackedAtCenter) {
        const direction = (2 * Math.PI * index) / Math.max(points.length, 1) - Math.PI / 2;
        labelX = screen.x + Math.cos(direction) * 28;
        labelY = screen.y + Math.sin(direction) * 28;
      } else if (suffix) {
        labelY += 14;
      }
      const label = svgElement("text", { x: labelX, y: labelY, class: `${className}-label` });
      label.textContent = `${point.name || pointName(index)}${suffix}`;
      shapes.append(label);
    });
  }

  function drawGuides(points, targetGroup, className, about) {
    points.forEach((point) => {
      const screen = screenPoint(point);
      const xAxisFoot = screenPoint({ x: point.x, y: about.y });
      const yAxisFoot = screenPoint({ x: about.x, y: point.y });
      targetGroup.append(
        svgElement("line", { x1: screen.x, y1: screen.y, x2: yAxisFoot.x, y2: yAxisFoot.y, class: `rotation-distance-guide ${className}-distance-guide` }),
        svgElement("line", { x1: screen.x, y1: screen.y, x2: xAxisFoot.x, y2: xAxisFoot.y, class: `rotation-distance-guide ${className}-distance-guide` })
      );
    });
  }

  function drawCenterAxes() {
    localAxes.replaceChildren();
    const left = screenPoint({ x: -GRID_EXTENT, y: center.y });
    const right = screenPoint({ x: GRID_EXTENT, y: center.y });
    const top = screenPoint({ x: center.x, y: GRID_EXTENT });
    const bottom = screenPoint({ x: center.x, y: -GRID_EXTENT });
    localAxes.append(
      svgElement("line", { x1: left.x, y1: left.y, x2: right.x, y2: right.y, class: "rotation-local-axis" }),
      svgElement("line", { x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y, class: "rotation-local-axis" })
    );
    const xLabel = svgElement("text", { x: right.x - 22, y: right.y + 20, class: "rotation-local-axis-label", "text-anchor": "end" });
    xLabel.textContent = "x̂";
    const yLabel = svgElement("text", { x: bottom.x + 10, y: bottom.y - 9, class: "rotation-local-axis-label" });
    yLabel.textContent = "ŷ";
    localAxes.append(xLabel, yLabel);
  }

  function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function boundaryOrder(points) {
    if (points.length < 3) return [...points];
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const lower = [];
    const upper = [];
    sorted.forEach((point) => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) < 0) lower.pop();
      lower.push(point);
    });
    [...sorted].reverse().forEach((point) => {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) < 0) upper.pop();
      upper.push(point);
    });
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    if (hull.length < 3) return [...points];
    const onSegment = (p, a, b) => cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
    if (!points.every((point) => hull.some((a, i) => onSegment(point, a, hull[(i + 1) % hull.length])))) return [...points];
    const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  }

  function pointSetIssue(points) {
    if (new Set(points.map((point) => `${point.x},${point.y}`)).size !== points.length) return "That point matches a vertex already on the graph. Choose a different grid point.";
    if (points.length < 3) return "";
    if (!points.slice(2).some((point) => cross(points[0], points[1], point) !== 0)) return "These points lie on one straight line. Add a point that creates a nonzero area.";
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const lower = [];
    const upper = [];
    sorted.forEach((point) => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
      lower.push(point);
    });
    [...sorted].reverse().forEach((point) => {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
      upper.push(point);
    });
    const corners = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    const onSegment = (p, a, b) => cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
    const onBoundary = (point) => corners.some((a, i) => onSegment(point, a, corners[(i + 1) % corners.length]));
    if (!points.every(onBoundary)) return !onBoundary(points[points.length - 1])
      ? "That point is inside the polygon boundary, so it cannot be a vertex of this convex shape. Choose a point on or outside the boundary."
      : "Adding this point would place an earlier point inside the convex boundary. Undo that earlier point, then continue adding the intended boundary vertices.";
    return "";
  }

  function appendTableRow(target, values) {
    const row = document.createElement("tr");
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    target.append(row);
  }

  function render() {
    const coefficient = Number(scaleSlider.value);
    const ordered = boundaryOrder(vertices);
    const image = ordered.map((point) => dilatedPoint(point, coefficient));
    const extents = [...ordered, ...image, center].flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]);
    GRID_EXTENT = Math.max(12, Math.ceil((Math.max(0, ...extents) + 1) / 4) * 4);
    UNIT = (ORIGIN - 56) / GRID_EXTENT;
    drawGrid();
    scaleValue.value = `k = ${formatNumber(coefficient)}`;
    scaleValue.textContent = `k = ${formatNumber(coefficient)}`;
    shapes.replaceChildren();
    guides.replaceChildren();
    localGuides.replaceChildren();

    axisDistancePanel.hidden = !axisDistancesToggle.checked;
    axisDistanceValues.replaceChildren();
    if (axisDistancesToggle.checked) {
      drawGuides(ordered, guides, "original", { x: 0, y: 0 });
      drawGuides(image, guides, "rotated", { x: 0, y: 0 });
    }

    localAxes.setAttribute("display", localAxesToggle.checked ? "inline" : "none");
    if (localAxesToggle.checked) drawCenterAxes();
    else localAxes.replaceChildren();
    localDistancePanel.hidden = !localDistancesToggle.checked;
    localDistanceValues.replaceChildren();
    if (localDistancesToggle.checked) {
      drawGuides(ordered, localGuides, "original", center);
      drawGuides(image, localGuides, "rotated", center);
    }

    const closed = ordered.length >= 3;
    const coincident = Math.abs(coefficient - 1) < 1e-9;
    drawShape(ordered, "rotation-original-shape", closed);
    drawShape(image, coincident ? "rotation-rotated-shape dilation-coincident-shape" : "rotation-rotated-shape", closed);
    if (coincident) {
      drawMarkers(ordered, "rotation-original");
      drawMarkers(image, "rotation-rotated", "′");
    } else {
      drawMarkers(image, "rotation-rotated", "′", Math.abs(coefficient) < 1e-9);
      drawMarkers(ordered, "rotation-original");
    }

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
    ordered.forEach((point, index) => {
      const name = point.name || pointName(index);
      const transformed = image[index];
      const item = document.createElement("li");
      item.textContent = `${name} (${formatNumber(point.x)}, ${formatNumber(point.y)}) → ${name}′ (${formatNumber(transformed.x)}, ${formatNumber(transformed.y)})`;
      coordinateList.append(item);
      appendTableRow(axisDistanceValues, [name, formatNumber(Math.abs(point.x)), formatNumber(Math.abs(point.y)), formatNumber(Math.abs(transformed.x)), formatNumber(Math.abs(transformed.y))]);
      appendTableRow(localDistanceValues, [name, formatNumber(point.x - center.x), formatNumber(point.y - center.y), formatNumber(transformed.x - center.x), formatNumber(transformed.y - center.y)]);
    });

    undoButton.disabled = vertices.length === 0;
    clearButton.disabled = vertices.length === 0;
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
    status.textContent = `Center of dilation set to (${x}, ${y}).`;
    return true;
  }

  function addVertex(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > INPUT_LIMIT || Math.abs(y) > INPUT_LIMIT) {
      status.textContent = "Choose integer coordinates from −8 to 8 on each axis.";
      return;
    }
    const candidate = [...vertices, { x, y, name: pointName(vertices.length) }];
    const issue = pointSetIssue(candidate);
    if (issue) {
      status.textContent = issue;
      return;
    }
    vertices.push(candidate[candidate.length - 1]);
    render();
    const name = pointName(vertices.length - 1);
    status.textContent = vertices.length >= 3
      ? `${name} added at (${x}, ${y}). The ${vertices.length}-vertex convex polygon is ready to dilate about (${center.x}, ${center.y}).`
      : `${name} added at (${x}, ${y}). Add ${3 - vertices.length} more point${vertices.length === 1 ? "s" : ""} to create a polygon.`;
  }

  function addFromInputs() {
    if (xInput.value.trim() === "" || yInput.value.trim() === "") {
      status.textContent = "Enter an integer x-coordinate and y-coordinate first.";
      return;
    }
    addVertex(Number(xInput.value), Number(yInput.value));
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
    if (choosingCenter) {
      if (setCenter(x, y)) {
        choosingCenter = false;
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

  scaleSlider.addEventListener("input", render);
  axisDistancesToggle.addEventListener("change", render);
  localAxesToggle.addEventListener("change", render);
  localDistancesToggle.addEventListener("change", render);
  addButton.addEventListener("click", addFromInputs);
  setCenterButton.addEventListener("click", () => {
    if (centerXInput.value.trim() === "" || centerYInput.value.trim() === "") {
      status.textContent = "Enter integer coordinates for the center first.";
      return;
    }
    setCenter(Number(centerXInput.value), Number(centerYInput.value));
  });
  chooseCenterButton.addEventListener("click", () => {
    choosingCenter = !choosingCenter;
    root.classList.toggle("is-picking-center", choosingCenter);
    chooseCenterButton.setAttribute("aria-pressed", String(choosingCenter));
    status.textContent = choosingCenter ? "Click a grid point to place the center of dilation." : "Center selection canceled.";
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
    scaleSlider.value = "2";
    render();
    status.textContent = "Shape cleared. Add at least three vertices to create a polygon.";
  });

  updateLabelScale();
  render();
  if ("ResizeObserver" in window) new ResizeObserver(updateLabelScale).observe(svg);
  else window.addEventListener("resize", updateLabelScale);
})();
