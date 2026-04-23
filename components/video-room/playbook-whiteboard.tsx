"use client";

import { Eraser, Move, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  color: string;
  points: Point[];
  width: number;
};

type SpotlightElement = {
  color: string;
  center: Point;
  radius: number;
  type: "spotlight";
};

type LinearElement = {
  color: string;
  end: Point;
  start: Point;
  type: "arrow";
  width: number;
};

type RouteEndCap = "none" | "arrow" | "block" | "dropback";

type RouteElement = {
  color: string;
  endCap: RouteEndCap;
  points: Point[];
  type: "route";
  width: number;
};

type TokenElement = {
  center: Point;
  color: string;
  label: string;
  type: "token";
  variant: "defense" | "offense";
};

type BoardElement = SpotlightElement | LinearElement | RouteElement | TokenElement;

type Tool = "select" | "draw" | "erase" | "spotlight" | "arrow" | "route" | "token";

type DragState = {
  index: number;
  lastPoint: Point;
};

type RouteDraft = {
  points: Point[];
};

type RouteTapState = {
  point: Point;
  time: number;
};

type BoardState = {
  elements: BoardElement[];
  strokes: Stroke[];
};

export type PlaybookWhiteboardState = BoardState;

type PlaybookWhiteboardProps = {
  boardId: string;
  baseImageUrl?: string | null;
  initialState?: PlaybookWhiteboardState | null;
  title: string;
};

export type PlaybookWhiteboardHandle = {
  clear: () => void;
  exportToPng: () => Promise<{ blob: Blob; dataUrl: string } | null>;
  exportState: () => PlaybookWhiteboardState;
};

const STORAGE_PREFIX = "ff-playbook-whiteboard";
const COLORS = ["#e8602d", "#17324d", "#2f8f5b", "#ca9632"] as const;
const WIDTHS = [4, 8, 12] as const;
const OFFENSE_TOKENS = ["C", "QB", "RB", "TE", "WR"] as const;
const DEFENSE_TOKENS = ["SF", "CB", "LB"] as const;
const MIN_LINEAR_DISTANCE = 0.025;
const TOKEN_RADIUS = 0.045;

function toSvgPoints(points: Point[], width: number, height: number) {
  return points.map((point) => `${point.x * width},${point.y * height}`).join(" ");
}

function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return distanceBetween(point, start);
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / ((dx * dx) + (dy * dy));
  const clampedT = Math.max(0, Math.min(1, t));
  const projection = {
    x: start.x + (dx * clampedT),
    y: start.y + (dy * clampedT),
  };

  return distanceBetween(point, projection);
}

function isStrokeNearPoint(stroke: Stroke, point: Point) {
  const threshold = Math.max(0.018, stroke.width / 220);
  return stroke.points.some((strokePoint) => {
    const distanceX = strokePoint.x - point.x;
    const distanceY = strokePoint.y - point.y;
    return Math.hypot(distanceX, distanceY) <= threshold;
  });
}

function isElementNearPoint(element: BoardElement, point: Point) {
  if (element.type === "spotlight") {
    return distanceBetween(element.center, point) <= element.radius;
  }

  if (element.type === "token") {
    return distanceBetween(element.center, point) <= TOKEN_RADIUS;
  }

  if (element.type === "route") {
    const threshold = Math.max(0.02, element.width / 180);
    for (let index = 1; index < element.points.length; index += 1) {
      if (distanceToSegment(point, element.points[index - 1], element.points[index]) <= threshold) {
        return true;
      }
    }
    return false;
  }

  return distanceToSegment(point, element.start, element.end) <= Math.max(0.02, element.width / 180);
}

function findTopmostElementIndex(elements: BoardElement[], point: Point) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    if (isElementNearPoint(elements[index], point)) {
      return index;
    }
  }

  return -1;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("背景画像の読み込みに失敗しました。");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("背景画像の読み込みに失敗しました。"));
    };
    image.src = objectUrl;
  });
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const imageAspect = image.naturalWidth / image.naturalHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > canvasAspect) {
    drawHeight = canvasWidth / imageAspect;
    offsetY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imageAspect;
    offsetX = (canvasWidth - drawWidth) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawArrowHead(context: CanvasRenderingContext2D, start: Point, end: Point, size: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const spread = Math.PI / 7;

  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - (size * Math.cos(angle - spread)), end.y - (size * Math.sin(angle - spread)));
  context.lineTo(end.x - (size * Math.cos(angle + spread)), end.y - (size * Math.sin(angle + spread)));
  context.closePath();
  context.fill();
}

function drawBlockCap(context: CanvasRenderingContext2D, start: Point, end: Point, size: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const perpendicularAngle = angle + Math.PI / 2;
  const offsetX = Math.cos(perpendicularAngle) * size * 0.7;
  const offsetY = Math.sin(perpendicularAngle) * size * 0.7;

  context.beginPath();
  context.moveTo(end.x - offsetX, end.y - offsetY);
  context.lineTo(end.x + offsetX, end.y + offsetY);
  context.stroke();
}

function drawDropbackCap(context: CanvasRenderingContext2D, end: Point, size: number) {
  context.beginPath();
  context.arc(end.x, end.y, size * 0.38, 0, Math.PI * 2);
  context.fill();
}

function renderLinearEnding(
  context: CanvasRenderingContext2D,
  endCap: Exclude<RouteEndCap, "none">,
  start: Point,
  end: Point,
  size: number,
) {
  if (endCap === "arrow") {
    drawArrowHead(context, start, end, size);
    return;
  }

  if (endCap === "block") {
    drawBlockCap(context, start, end, size);
    return;
  }

  drawDropbackCap(context, end, size);
}

function getLinearHeadSize(element: LinearElement, scale: number) {
  return Math.max(22, element.width * scale * 2.6);
}

function trimLineEnd(start: Point, end: Point, offset: number) {
  const distance = distanceBetween(start, end);
  if (distance <= offset || distance === 0) {
    return end;
  }

  const ratio = (distance - offset) / distance;
  return {
    x: start.x + ((end.x - start.x) * ratio),
    y: start.y + ((end.y - start.y) * ratio),
  };
}

function trimLineStart(start: Point, end: Point, offset: number) {
  const distance = distanceBetween(start, end);
  if (distance <= offset || distance === 0) {
    return start;
  }

  const ratio = offset / distance;
  return {
    x: start.x + ((end.x - start.x) * ratio),
    y: start.y + ((end.y - start.y) * ratio),
  };
}

function drawOffenseToken(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  label: string,
) {
  context.fillStyle = "#ffffff";
  context.strokeStyle = color;
  context.lineWidth = Math.max(4, radius * 0.14);
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font = `700 ${Math.max(18, radius * 0.95)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, centerX, centerY);
}

function moveElement(element: BoardElement, deltaX: number, deltaY: number): BoardElement {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));

  if (element.type === "token") {
    return {
      ...element,
      center: {
        x: clamp(element.center.x + deltaX),
        y: clamp(element.center.y + deltaY),
      },
    };
  }

  if (element.type === "spotlight") {
    return {
      ...element,
      center: {
        x: clamp(element.center.x + deltaX),
        y: clamp(element.center.y + deltaY),
      },
    };
  }

  if (element.type === "route") {
    return {
      ...element,
      points: element.points.map((point) => ({
        x: clamp(point.x + deltaX),
        y: clamp(point.y + deltaY),
      })),
    };
  }

  return {
    ...element,
    start: {
      x: clamp(element.start.x + deltaX),
      y: clamp(element.start.y + deltaY),
    },
    end: {
      x: clamp(element.end.x + deltaX),
      y: clamp(element.end.y + deltaY),
    },
  };
}

function drawDefenseToken(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  label: string,
) {
  const top = { x: centerX, y: centerY + radius * 1.1 };
  const left = { x: centerX - radius, y: centerY - radius * 0.9 };
  const right = { x: centerX + radius, y: centerY - radius * 0.9 };

  context.fillStyle = "#ffffff";
  context.strokeStyle = color;
  context.lineWidth = Math.max(4, radius * 0.14);
  context.beginPath();
  context.moveTo(top.x, top.y);
  context.lineTo(left.x, left.y);
  context.lineTo(right.x, right.y);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font = `700 ${Math.max(18, radius * 0.68)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, centerX, centerY - radius * 0.05);
}

function findTopmostToken(elements: BoardElement[], point: Point) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (element.type === "token" && distanceBetween(element.center, point) <= TOKEN_RADIUS) {
      return element;
    }
  }

  return null;
}

export const PlaybookWhiteboard = forwardRef<PlaybookWhiteboardHandle, PlaybookWhiteboardProps>(function PlaybookWhiteboard(
  { boardId, baseImageUrl, initialState, title },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activeLinearRef = useRef<LinearElement | null>(null);
  const activeDragRef = useRef<DragState | null>(null);
  const lastRouteTapRef = useRef<RouteTapState | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState<(typeof COLORS)[number]>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[1]);
  const [routeEndCap, setRouteEndCap] = useState<RouteEndCap>("arrow");
  const [selectedTokenLabel, setSelectedTokenLabel] = useState<string>(OFFENSE_TOKENS[0]);
  const [selectedTokenVariant, setSelectedTokenVariant] = useState<"defense" | "offense">("offense");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
  const [draftElement, setDraftElement] = useState<LinearElement | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [routePreviewPoint, setRoutePreviewPoint] = useState<Point | null>(null);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ height: 1000, width: 1000 });

  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${boardId}`, [boardId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (initialState) {
        setStrokes(initialState.strokes ?? []);
        setElements(initialState.elements ?? []);
      } else if (!saved) {
        setStrokes([]);
        setElements([]);
      } else {
        const parsed = JSON.parse(saved) as Stroke[] | BoardState;
        if (Array.isArray(parsed)) {
          setStrokes(parsed);
          setElements([]);
        } else {
          setStrokes(parsed.strokes ?? []);
          setElements(parsed.elements ?? []);
        }
      }
    } catch {
      setStrokes([]);
      setElements([]);
    }

    setDraftStroke(null);
    setDraftElement(null);
    setRouteDraft(null);
    setRoutePreviewPoint(null);
    activeStrokeRef.current = null;
    activeLinearRef.current = null;
    activeDragRef.current = null;
    lastRouteTapRef.current = null;
    setSelectedElementIndex(null);
  }, [initialState, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify({ strokes, elements }));
  }, [elements, storageKey, strokes]);

  useEffect(() => {
    setSelectedElementIndex((current) => {
      if (current == null) {
        return current;
      }

      return current < elements.length ? current : null;
    });
  }, [elements.length]);

  useEffect(() => {
    const node = surfaceRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSize = () => {
      const bounds = node.getBoundingClientRect();
      setSurfaceSize({
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    clear() {
      setStrokes([]);
      setElements([]);
      setDraftStroke(null);
      setDraftElement(null);
      setRouteDraft(null);
      setRoutePreviewPoint(null);
      activeStrokeRef.current = null;
      activeLinearRef.current = null;
      activeDragRef.current = null;
      lastRouteTapRef.current = null;
      setSelectedElementIndex(null);
    },
    exportState() {
      return {
        strokes,
        elements,
      };
    },
    async exportToPng() {
      const bounds = surfaceRef.current?.getBoundingClientRect();
      const baseWidth = Math.max(1, Math.round(bounds?.width ?? 1280));
      const baseHeight = Math.max(1, Math.round(bounds?.height ?? 720));
      const aspectRatio = baseWidth / baseHeight;
      const width = Math.max(1200, baseWidth);
      const height = Math.max(1, Math.round(width / aspectRatio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      if (baseImageUrl) {
        const image = await loadImage(baseImageUrl);
        drawContainedImage(context, image, width, height);
      }

      for (const stroke of strokes) {
        context.strokeStyle = stroke.color;
        context.fillStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.lineCap = "round";
        context.lineJoin = "round";

        if (stroke.points.length === 1) {
          const point = stroke.points[0];
          context.beginPath();
          context.arc(point.x * width, point.y * height, stroke.width * 1.2, 0, Math.PI * 2);
          context.fill();
          continue;
        }

        context.beginPath();
        stroke.points.forEach((point, index) => {
          const x = point.x * width;
          const y = point.y * height;
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.stroke();
      }

      for (const element of elements) {
        if (element.type === "spotlight") {
          context.fillStyle = `${element.color}33`;
          context.strokeStyle = element.color;
          context.lineWidth = 6;
          context.beginPath();
          context.arc(
            element.center.x * width,
            element.center.y * height,
            element.radius * Math.min(width, height),
            0,
            Math.PI * 2,
          );
          context.fill();
          context.stroke();
          continue;
        }

        if (element.type === "token") {
          const radius = TOKEN_RADIUS * Math.min(width, height);
          const centerX = element.center.x * width;
          const centerY = element.center.y * height;
          if (element.variant === "offense") {
            drawOffenseToken(context, centerX, centerY, radius, element.color, element.label);
          } else {
            drawDefenseToken(context, centerX, centerY, radius, element.color, element.label);
          }
          continue;
        }

        if (element.type === "route") {
          const points = element.points.map((point) => ({ x: point.x * width, y: point.y * height }));
          if (points.length < 2) {
            continue;
          }

          const tokenRadius = TOKEN_RADIUS * Math.min(width, height);
          const trimmedStart = trimLineStart(points[0], points[1], tokenRadius + 6);
          const end = points[points.length - 1];
          const previous = points[points.length - 2];
          const headSize = Math.max(22, element.width * 2.6);
          const trimmedEnd = trimLineEnd(
            previous,
            end,
            element.endCap === "arrow" ? headSize * 0.72 : element.endCap === "dropback" ? headSize * 0.42 : 0,
          );
          const drawablePoints = [trimmedStart, ...points.slice(1, -1), trimmedEnd];

          context.strokeStyle = element.color;
          context.fillStyle = element.color;
          context.lineWidth = Math.max(4, element.width);
          context.lineCap = "round";
          context.lineJoin = "round";
          context.beginPath();
          drawablePoints.forEach((point, index) => {
            if (index === 0) {
              context.moveTo(point.x, point.y);
            } else {
              context.lineTo(point.x, point.y);
            }
          });
          context.stroke();

          if (element.endCap !== "none") {
            renderLinearEnding(context, element.endCap, previous, end, headSize);
          }
          continue;
        }

        const start = { x: element.start.x * width, y: element.start.y * height };
        const end = { x: element.end.x * width, y: element.end.y * height };
        context.strokeStyle = element.color;
        context.fillStyle = element.color;
        context.lineWidth = Math.max(4, element.width);
        context.lineCap = "round";
        context.lineJoin = "round";

        const headSize = getLinearHeadSize(element, 1);
        const trimmedEnd = trimLineEnd(
          start,
          end,
          headSize * 0.72,
        );
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(trimmedEnd.x, trimmedEnd.y);
        context.stroke();
        renderLinearEnding(context, "arrow", start, end, headSize);
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png");
      });

      if (!blob) {
        return null;
      }

      return {
        blob,
        dataUrl: canvas.toDataURL("image/png"),
      };
    },
  }), [baseImageUrl, elements, strokes]);

  function getPointFromEvent(event: React.PointerEvent<HTMLDivElement>): Point | null {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) {
      return null;
    }

    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }

  function eraseAtPoint(point: Point) {
    setStrokes((current) => current.filter((stroke) => !isStrokeNearPoint(stroke, point)));
    setElements((current) => current.filter((element) => !isElementNearPoint(element, point)));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === "erase") {
      eraseAtPoint(point);
      return;
    }

    if (tool === "select") {
      const hitIndex = findTopmostElementIndex(elements, point);
      setSelectedElementIndex(hitIndex >= 0 ? hitIndex : null);
      if (hitIndex >= 0) {
        activeDragRef.current = {
          index: hitIndex,
          lastPoint: point,
        };
      } else {
        activeDragRef.current = null;
      }
      return;
    }

    if (tool === "spotlight") {
      setElements((current) => [
        ...current,
        {
          type: "spotlight",
          color,
          center: point,
          radius: Math.max(0.06, strokeWidth / 60),
        },
      ]);
      return;
    }

    if (tool === "token") {
      setElements((current) => [
        ...current,
        {
          type: "token",
          center: point,
          color,
          label: selectedTokenLabel,
          variant: selectedTokenVariant,
        },
      ]);
      return;
    }

    if (tool === "route") {
      if (!routeDraft) {
        const anchorToken = findTopmostToken(elements, point);
        if (!anchorToken) {
          return;
        }

        const nextDraft = { points: [anchorToken.center] };
        setRouteDraft(nextDraft);
        setRoutePreviewPoint(anchorToken.center);
        lastRouteTapRef.current = null;
        return;
      }

      const lastTap = lastRouteTapRef.current;
      const isDoubleTap = Boolean(
        lastTap &&
        Date.now() - lastTap.time < 320 &&
        distanceBetween(lastTap.point, point) < 0.03,
      );

      if (isDoubleTap) {
        setRoutePreviewPoint(point);
        handleCommitRoute(point);
        lastRouteTapRef.current = null;
        return;
      }

      const lastPoint = routeDraft.points[routeDraft.points.length - 1];
      if (distanceBetween(lastPoint, point) < MIN_LINEAR_DISTANCE) {
        return;
      }

      setRouteDraft({
        points: [...routeDraft.points, point],
      });
      setRoutePreviewPoint(point);
      lastRouteTapRef.current = {
        point,
        time: Date.now(),
      };
      return;
    }

    if (tool === "arrow") {
      const nextElement: LinearElement = {
        type: "arrow",
        color,
        start: point,
        end: point,
        width: strokeWidth,
      };
      activeLinearRef.current = nextElement;
      setDraftElement(nextElement);
      return;
    }

    const nextStroke: Stroke = {
      color,
      width: strokeWidth,
      points: [point],
    };
    activeStrokeRef.current = nextStroke;
    setDraftStroke(nextStroke);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }

    if (tool === "erase" && event.buttons === 1) {
      eraseAtPoint(point);
      return;
    }

    const currentDrag = activeDragRef.current;
    if (currentDrag) {
      const deltaX = point.x - currentDrag.lastPoint.x;
      const deltaY = point.y - currentDrag.lastPoint.y;
      activeDragRef.current = {
        ...currentDrag,
        lastPoint: point,
      };
      setElements((current) =>
        current.map((element, index) =>
          index === currentDrag.index ? moveElement(element, deltaX, deltaY) : element,
        ),
      );
      return;
    }

    const currentLinear = activeLinearRef.current;
    if (currentLinear) {
      const nextLinear = {
        ...currentLinear,
        end: point,
      };
      activeLinearRef.current = nextLinear;
      setDraftElement(nextLinear);
      return;
    }

    if (routeDraft) {
      setRoutePreviewPoint(point);
      return;
    }

    const currentStroke = activeStrokeRef.current;
    if (!currentStroke) {
      return;
    }

    const nextStroke = {
      ...currentStroke,
      points: [...currentStroke.points, point],
    };
    activeStrokeRef.current = nextStroke;
    setDraftStroke(nextStroke);
  }

  function handlePointerUp() {
    activeDragRef.current = null;

    const currentLinear = activeLinearRef.current;
    if (currentLinear) {
      if (distanceBetween(currentLinear.start, currentLinear.end) >= MIN_LINEAR_DISTANCE) {
        setElements((current) => [...current, currentLinear]);
        setSelectedElementIndex(elements.length);
      }
      activeLinearRef.current = null;
      setDraftElement(null);
    }

    const currentStroke = activeStrokeRef.current;
    if (currentStroke) {
      setStrokes((current) => [...current, currentStroke]);
    }
    activeStrokeRef.current = null;
    setDraftStroke(null);
  }

  function handleCommitRoute(finalPoint?: Point) {
    if (!routeDraft) {
      return;
    }

    const candidatePoint = finalPoint ?? routePreviewPoint;
    const lastCommittedPoint = routeDraft.points[routeDraft.points.length - 1];
    const committedPoints = candidatePoint && distanceBetween(lastCommittedPoint, candidatePoint) >= MIN_LINEAR_DISTANCE
      ? [...routeDraft.points, candidatePoint]
      : routeDraft.points;

    if (committedPoints.length < 2) {
      return;
    }

    setElements((current) => [
      ...current,
      {
        type: "route",
        color,
        endCap: routeEndCap,
        points: committedPoints,
        width: strokeWidth,
      },
    ]);
    setSelectedElementIndex(null);
    setRouteDraft(null);
    setRoutePreviewPoint(null);
    lastRouteTapRef.current = null;
  }

  function handleCancelRoute() {
    setRouteDraft(null);
    setRoutePreviewPoint(null);
    lastRouteTapRef.current = null;
  }

  function renderStroke(stroke: Stroke, key: string) {
    if (!stroke.points.length) {
      return null;
    }

    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      return (
        <circle
          key={key}
          cx={point.x * surfaceSize.width}
          cy={point.y * surfaceSize.height}
          fill={stroke.color}
          r={stroke.width * 1.2}
        />
      );
    }

    return (
      <polyline
        key={key}
        fill="none"
        points={toSvgPoints(stroke.points, surfaceSize.width, surfaceSize.height)}
        stroke={stroke.color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={stroke.width}
      />
    );
  }

  function renderLinearElement(element: LinearElement, key: string) {
    const startX = element.start.x * surfaceSize.width;
    const startY = element.start.y * surfaceSize.height;
    const endX = element.end.x * surfaceSize.width;
    const endY = element.end.y * surfaceSize.height;
    const angle = Math.atan2(endY - startY, endX - startX);
    const headSize = getLinearHeadSize(element, 1);
    const trimmedEnd = trimLineEnd(
      { x: startX, y: startY },
      { x: endX, y: endY },
      headSize * 0.72,
    );
    const arrowLeftX = endX - (headSize * Math.cos(angle - Math.PI / 7));
    const arrowLeftY = endY - (headSize * Math.sin(angle - Math.PI / 7));
    const arrowRightX = endX - (headSize * Math.cos(angle + Math.PI / 7));
    const arrowRightY = endY - (headSize * Math.sin(angle + Math.PI / 7));

    return (
      <g key={key}>
        <line
          stroke={element.color}
          strokeLinecap="round"
          strokeWidth={element.width}
          x1={startX}
          x2={trimmedEnd.x}
          y1={startY}
          y2={trimmedEnd.y}
        />
        <polygon
          fill={element.color}
          points={`${endX},${endY} ${arrowLeftX},${arrowLeftY} ${arrowRightX},${arrowRightY}`}
        />
      </g>
    );
  }

  function renderRouteElement(element: RouteElement, key: string) {
    const points = element.points.map((point) => ({
      x: point.x * surfaceSize.width,
      y: point.y * surfaceSize.height,
    }));

    if (points.length < 2) {
      return null;
    }

    const tokenRadius = TOKEN_RADIUS * Math.min(surfaceSize.width, surfaceSize.height);
    const trimmedStart = trimLineStart(points[0], points[1], tokenRadius + 6);
    const end = points[points.length - 1];
    const previous = points[points.length - 2];
    const headSize = Math.max(22, element.width * 2.6);
    const trimmedEnd = trimLineEnd(
      previous,
      end,
      element.endCap === "arrow" ? headSize * 0.72 : element.endCap === "dropback" ? headSize * 0.42 : 0,
    );
    const drawablePoints = [trimmedStart, ...points.slice(1, -1), trimmedEnd];

    return (
      <g key={key}>
        <polyline
          fill="none"
          points={drawablePoints.map((point) => `${point.x},${point.y}`).join(" ")}
          stroke={element.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={element.width}
        />
        {element.endCap === "arrow" ? (
          <polygon
            fill={element.color}
            points={`${end.x},${end.y} ${end.x - (headSize * Math.cos(Math.atan2(end.y - previous.y, end.x - previous.x) - Math.PI / 7))},${end.y - (headSize * Math.sin(Math.atan2(end.y - previous.y, end.x - previous.x) - Math.PI / 7))} ${end.x - (headSize * Math.cos(Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 7))},${end.y - (headSize * Math.sin(Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 7))}`}
          />
        ) : null}
        {element.endCap === "block" ? (
          <line
            stroke={element.color}
            strokeLinecap="round"
            strokeWidth={element.width}
            x1={end.x - (Math.cos(Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 2) * headSize * 0.7)}
            x2={end.x + (Math.cos(Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 2) * headSize * 0.7)}
            y1={end.y - (Math.sin(Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 2) * headSize * 0.7)}
            y2={end.y + (Math.sin(Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 2) * headSize * 0.7)}
          />
        ) : null}
        {element.endCap === "dropback" ? (
          <circle
            cx={end.x}
            cy={end.y}
            fill={element.color}
            r={headSize * 0.38}
          />
        ) : null}
      </g>
    );
  }

  function renderTokenElement(element: TokenElement, key: string) {
    const centerX = element.center.x * surfaceSize.width;
    const centerY = element.center.y * surfaceSize.height;
    const radius = TOKEN_RADIUS * Math.min(surfaceSize.width, surfaceSize.height);

    if (element.variant === "offense") {
      return (
        <g key={key}>
          <circle
            cx={centerX}
            cy={centerY}
            fill="#ffffff"
            r={radius}
            stroke={element.color}
            strokeWidth={8}
          />
          <text
            dominantBaseline="middle"
            fill={element.color}
            fontSize={radius * 0.95}
            fontWeight="700"
            textAnchor="middle"
            x={centerX}
            y={centerY}
          >
            {element.label}
          </text>
        </g>
      );
    }

    return (
      <g key={key}>
        <path
          d={`M ${centerX},${centerY + radius * 1.1} L ${centerX - radius},${centerY - radius * 0.9} L ${centerX + radius},${centerY - radius * 0.9} Z`}
          fill="#ffffff"
          stroke={element.color}
          strokeWidth={8}
        />
        <text
          dominantBaseline="middle"
          fill={element.color}
          fontSize={radius * 0.68}
          fontWeight="700"
          textAnchor="middle"
          x={centerX}
          y={centerY - radius * 0.05}
        >
          {element.label}
        </text>
      </g>
    );
  }

  function renderElement(element: BoardElement, key: string, isSelected = false) {
    if (element.type === "spotlight") {
      return (
        <g key={key}>
          <circle
            cx={element.center.x * surfaceSize.width}
            cy={element.center.y * surfaceSize.height}
            fill={`${element.color}33`}
            r={element.radius * Math.min(surfaceSize.width, surfaceSize.height)}
          />
          <circle
            cx={element.center.x * surfaceSize.width}
            cy={element.center.y * surfaceSize.height}
            fill="none"
            r={element.radius * Math.min(surfaceSize.width, surfaceSize.height)}
            stroke={element.color}
            strokeWidth={8}
          />
          {isSelected ? (
            <circle
              cx={element.center.x * surfaceSize.width}
              cy={element.center.y * surfaceSize.height}
              fill="none"
              r={(element.radius * Math.min(surfaceSize.width, surfaceSize.height)) + 10}
              stroke="rgba(232, 96, 45, 0.45)"
              strokeDasharray="14 10"
              strokeWidth={4}
            />
          ) : null}
        </g>
      );
    }

    if (element.type === "token") {
      return (
        <g key={key}>
          {renderTokenElement(element, `${key}-token`)}
          {isSelected ? (
            <circle
              cx={element.center.x * surfaceSize.width}
              cy={element.center.y * surfaceSize.height}
              fill="none"
              r={(TOKEN_RADIUS * Math.min(surfaceSize.width, surfaceSize.height)) + 10}
              stroke="rgba(232, 96, 45, 0.45)"
              strokeDasharray="14 10"
              strokeWidth={4}
            />
          ) : null}
        </g>
      );
    }

    if (element.type === "route") {
      return (
        <g key={key}>
          {renderRouteElement(element, `${key}-route`)}
          {isSelected ? (
            <g>
              {element.points.map((point, index) => (
                <circle
                  key={`${key}-point-${index}`}
                  cx={point.x * surfaceSize.width}
                  cy={point.y * surfaceSize.height}
                  fill="#ffffff"
                  r={8}
                  stroke="rgba(232, 96, 45, 0.7)"
                  strokeWidth={4}
                />
              ))}
            </g>
          ) : null}
        </g>
      );
    }

    return (
      <g key={key}>
        {renderLinearElement(element, `${key}-linear`)}
        {isSelected ? (
          <g>
            <circle
              cx={element.start.x * surfaceSize.width}
              cy={element.start.y * surfaceSize.height}
              fill="#ffffff"
              r={8}
              stroke="rgba(232, 96, 45, 0.7)"
              strokeWidth={4}
            />
            <circle
              cx={element.end.x * surfaceSize.width}
              cy={element.end.y * surfaceSize.height}
              fill="#ffffff"
              r={8}
              stroke="rgba(232, 96, 45, 0.7)"
              strokeWidth={4}
            />
          </g>
        ) : null}
      </g>
    );
  }

  return (
    <div className="playbook-board">
      <div className="playbook-board-toolbar">
        <div className="playbook-board-tools">
          <button
            className={`button secondary button-compact ${tool === "select" ? "is-selected" : ""}`}
            type="button"
            onClick={() => setTool("select")}
          >
            <Move aria-hidden="true" />
            移動
          </button>
          <button
            className={`button secondary button-compact ${tool === "draw" ? "is-selected" : ""}`}
            type="button"
            onClick={() => setTool("draw")}
          >
            <Pencil aria-hidden="true" />
            ペン
          </button>
          <button
            className={`button secondary button-compact ${tool === "erase" ? "is-selected" : ""}`}
            type="button"
            onClick={() => setTool("erase")}
          >
            <Eraser aria-hidden="true" />
            消しゴム
          </button>
          <button
            className={`button secondary button-compact ${tool === "spotlight" ? "is-selected" : ""}`}
            type="button"
            onClick={() => setTool("spotlight")}
          >
            スポット
          </button>
          <button
            className={`button secondary button-compact ${tool === "arrow" ? "is-selected" : ""}`}
            type="button"
            onClick={() => setTool("arrow")}
          >
            矢印
          </button>
          <button
            className={`button secondary button-compact ${tool === "route" ? "is-selected" : ""}`}
            type="button"
            onClick={() => setTool("route")}
          >
            ルート
          </button>
        </div>

        <div className="playbook-board-tools">
          {COLORS.map((candidate) => (
            <button
              key={candidate}
              className={`playbook-swatch ${color === candidate ? "is-selected" : ""}`}
              type="button"
              onClick={() => setColor(candidate)}
              style={{ backgroundColor: candidate }}
              aria-label={`色を選択: ${candidate}`}
              title="色を選択"
            />
          ))}
        </div>

        <div className="playbook-board-tools">
          {WIDTHS.map((candidate) => (
            <button
              key={candidate}
              className={`button secondary button-compact ${strokeWidth === candidate ? "is-selected" : ""}`}
              type="button"
              onClick={() => setStrokeWidth(candidate)}
            >
              太さ {candidate}
            </button>
          ))}
        </div>

        {tool === "route" || routeDraft ? (
          <div className="playbook-board-tools">
            <span className="playbook-board-label">ルート先端</span>
            {(["none", "arrow", "block", "dropback"] as const).map((candidate) => (
              <button
                key={candidate}
                className={`button secondary button-compact ${routeEndCap === candidate ? "is-selected" : ""}`}
                type="button"
                onClick={() => setRouteEndCap(candidate)}
              >
                {candidate === "none" ? "なし" : candidate === "arrow" ? "矢印" : candidate === "block" ? "T字" : "丸"}
              </button>
            ))}
            {routeDraft ? (
              <>
                <button className="button secondary button-compact" type="button" onClick={() => handleCommitRoute()}>
                  ルート確定
                </button>
                <button className="button secondary button-compact" type="button" onClick={handleCancelRoute}>
                  キャンセル
                </button>
              </>
            ) : null}
          </div>
        ) : null}

          <div className="playbook-board-tools">
          <span className="playbook-board-label">O</span>
          {OFFENSE_TOKENS.map((candidate) => (
            <button
              key={candidate}
              className={`button secondary button-compact ${tool === "token" && selectedTokenVariant === "offense" && selectedTokenLabel === candidate ? "is-selected" : ""}`}
              type="button"
              onClick={() => {
                setSelectedTokenVariant("offense");
                setSelectedTokenLabel(candidate);
                setTool("token");
              }}
            >
              {candidate}
            </button>
          ))}
        </div>

        <div className="playbook-board-tools">
          <span className="playbook-board-label">D</span>
          {DEFENSE_TOKENS.map((candidate) => (
            <button
              key={candidate}
              className={`button secondary button-compact ${tool === "token" && selectedTokenVariant === "defense" && selectedTokenLabel === candidate ? "is-selected" : ""}`}
              type="button"
              onClick={() => {
                setSelectedTokenVariant("defense");
                setSelectedTokenLabel(candidate);
                setTool("token");
              }}
            >
              {candidate}
            </button>
          ))}
        </div>

        <div className="playbook-board-tools">
          <button
            className="button secondary button-compact"
            type="button"
            onClick={() => {
              if (elements.length) {
                setElements((current) => current.slice(0, -1));
                return;
              }
              setStrokes((current) => current.slice(0, -1));
            }}
            disabled={!strokes.length && !elements.length}
          >
            <RotateCcw aria-hidden="true" />
            ひとつ戻す
          </button>
          <button
            className="button secondary button-compact"
            type="button"
            onClick={() => {
              setStrokes([]);
              setElements([]);
            }}
            disabled={!strokes.length && !elements.length}
          >
            <Trash2 aria-hidden="true" />
            全消し
          </button>
        </div>
      </div>

      <div
        ref={surfaceRef}
        className={`playbook-board-surface ${tool === "erase" ? "is-erasing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {baseImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="film-playbook-image" src={baseImageUrl} alt={`${title} のプレーブック`} />
        ) : (
          <div className="playbook-board-blank" aria-label={`${title} の白紙ボード`} />
        )}
        <svg
          className="playbook-board-overlay"
          viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`}
          aria-hidden="true"
        >
          {elements.map((element, index) => renderElement(element, `element-${index}`, index === selectedElementIndex))}
          {strokes.map((stroke, index) => renderStroke(stroke, `stroke-${index}`))}
          {draftElement ? renderElement(draftElement, "draft-element") : null}
          {routeDraft ? renderElement({
            type: "route",
            color,
            endCap: routeEndCap,
            width: strokeWidth,
            points: routePreviewPoint ? [...routeDraft.points, routePreviewPoint] : routeDraft.points,
          }, "draft-route") : null}
          {draftStroke ? renderStroke(draftStroke, "draft-stroke") : null}
        </svg>
      </div>
    </div>
  );
});
