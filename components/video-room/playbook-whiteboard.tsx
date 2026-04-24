"use client";

import { ChevronDown, ChevronUp, Eraser, Move, Pause, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
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
  dashed?: boolean;
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

type PaletteKey = "functions" | "styles";

type PaletteSection = "freehand" | "history" | "objects" | "route";

type PaletteDragState = {
  key: PaletteKey;
  originX: number;
  originY: number;
  startClientX: number;
  startClientY: number;
};

type RouteDraft = {
  anchorIndex: number;
  points: Point[];
};

type AnimatedRouteBinding = {
  route: RouteElement;
  routeIndex: number;
  token: TokenElement;
  tokenIndex: number;
};

type BoardState = {
  elements: BoardElement[];
  strokes: Stroke[];
};

export type PlaybookWhiteboardState = BoardState;

type PlaybookWhiteboardProps = {
  boardId: string;
  baseImageUrl?: string | null;
  fullscreenMode?: boolean;
  initialState?: PlaybookWhiteboardState | null;
  onRequestClose?: () => void;
  onRequestSave?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  title: string;
};

export type PlaybookWhiteboardHandle = {
  clear: () => void;
  exportToPng: () => Promise<{ blob: Blob; dataUrl: string } | null>;
  exportState: () => PlaybookWhiteboardState;
};

const STORAGE_PREFIX = "ff-playbook-whiteboard";
const COLORS = ["#111111", "#e8602d", "#17324d", "#2f8f5b", "#ca9632"] as const;
const WIDTHS = [4, 8, 12] as const;
const OFFENSE_TOKENS = ["C", "QB", "RB", "TE", "WR"] as const;
const DEFENSE_TOKENS = ["SF", "CB", "LB"] as const;
const MIN_LINEAR_DISTANCE = 0.025;
const TOKEN_RADIUS = 0.044;
const ROUTE_PLAYBACK_SPEED = 0.00035;
const FIELD_LINE_WIDTH = 1;
const FIELD_LINE_X_START = 0.04;
const FIELD_LINE_X_END = 0.96;
const LOS_Y = 0.5;
const FIVE_YARDS_Y = 0.3;
const TEN_YARDS_Y = 0.1;
const MINUS_FIVE_YARDS_Y = 0.7;
const MINUS_TEN_YARDS_Y = 0.9;

function getRouteDashPattern(width: number) {
  return [Math.max(4, width * 1.0), Math.max(8, width * 2.4)];
}

function safelySetPointerCapture(target: EventTarget & HTMLDivElement, pointerId: number) {
  if (typeof target.setPointerCapture !== "function") {
    return;
  }

  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Safari can reject pointer capture in some fullscreen/touch flows.
  }
}

function safelyReleasePointerCapture(target: EventTarget & HTMLDivElement, pointerId: number) {
  if (typeof target.releasePointerCapture !== "function") {
    return;
  }

  try {
    target.releasePointerCapture(pointerId);
  } catch {
    // No-op when capture was never acquired.
  }
}

function toSvgPoints(points: Point[], width: number, height: number) {
  return points.map((point) => `${point.x * width},${point.y * height}`).join(" ");
}

function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getPolylineLength(points: Point[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]);
  }
  return total;
}

function getPointAtProgress(points: Point[], progress: number) {
  if (points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    return points[0];
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const totalLength = getPolylineLength(points);
  if (totalLength === 0) {
    return points[points.length - 1];
  }

  const targetDistance = totalLength * clamped;
  let traversed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distanceBetween(start, end);
    if (traversed + segmentLength >= targetDistance) {
      const ratio = segmentLength === 0 ? 0 : (targetDistance - traversed) / segmentLength;
      return {
        x: start.x + ((end.x - start.x) * ratio),
        y: start.y + ((end.y - start.y) * ratio),
      };
    }
    traversed += segmentLength;
  }

  return points[points.length - 1];
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
  const borderWidth = Math.max(2, radius * 0.11);
  context.fillStyle = "#ffffff";
  context.strokeStyle = color;
  context.lineWidth = borderWidth;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font = `700 ${Math.max(10, Math.min(radius * 0.62, radius - borderWidth - 6))}px sans-serif`;
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
  const top = { x: centerX, y: centerY + radius * 1.16 };
  const left = { x: centerX - radius * 1.18, y: centerY - radius * 0.98 };
  const right = { x: centerX + radius * 1.18, y: centerY - radius * 0.98 };

  const borderWidth = Math.max(2, radius * 0.11);
  context.fillStyle = "#ffffff";
  context.strokeStyle = color;
  context.lineWidth = borderWidth;
  context.beginPath();
  context.moveTo(top.x, top.y);
  context.lineTo(left.x, left.y);
  context.lineTo(right.x, right.y);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font = `700 ${Math.max(9, Math.min(radius * 0.5, radius - borderWidth - 8))}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, centerX, centerY - radius * 0.1);
}

function findTopmostToken(elements: BoardElement[], point: Point) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (element.type === "token" && distanceBetween(element.center, point) <= TOKEN_RADIUS) {
      return {
        element,
        index,
      };
    }
  }

  return null;
}

export const PlaybookWhiteboard = forwardRef<PlaybookWhiteboardHandle, PlaybookWhiteboardProps>(function PlaybookWhiteboard(
  {
    boardId,
    baseImageUrl,
    fullscreenMode = false,
    initialState,
    onRequestClose,
    onRequestSave,
    saveDisabled = false,
    saveLabel = "このボードを保存",
    title,
  },
  ref,
) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activeLinearRef = useRef<LinearElement | null>(null);
  const activeDragRef = useRef<DragState | null>(null);
  const activePaletteDragRef = useRef<PaletteDragState | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<(typeof COLORS)[number]>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]);
  const [routeEndCap, setRouteEndCap] = useState<RouteEndCap>("arrow");
  const [routeDashed, setRouteDashed] = useState(false);
  const [selectedTokenLabel, setSelectedTokenLabel] = useState<string>(OFFENSE_TOKENS[0]);
  const [selectedTokenVariant, setSelectedTokenVariant] = useState<"defense" | "offense">("offense");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
  const [draftElement, setDraftElement] = useState<LinearElement | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [isRoutePlaybackActive, setIsRoutePlaybackActive] = useState(false);
  const [routePlaybackElapsedMs, setRoutePlaybackElapsedMs] = useState(0);
  const [surfaceSize, setSurfaceSize] = useState({ height: 1000, width: 1000 });
  const [activePaletteSection, setActivePaletteSection] = useState<PaletteSection>("objects");
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(true);
  const [palettePositions, setPalettePositions] = useState<Record<PaletteKey, Point>>({
    functions: { x: 16, y: 16 },
    styles: { x: 16, y: 228 },
  });

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
    activeStrokeRef.current = null;
    activeLinearRef.current = null;
    activeDragRef.current = null;
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
    if (!isRoutePlaybackActive) {
      return;
    }

    let frameId = 0;
    const startedAt = performance.now() - routePlaybackElapsedMs;

    const tick = (now: number) => {
      const nextElapsedMs = now - startedAt;
      setRoutePlaybackElapsedMs(nextElapsedMs);

      const hasRemainingRoute = elements.some((element) => {
        if (element.type !== "route") {
          return false;
        }
        const routeLength = getPolylineLength(element.points);
        if (routeLength === 0) {
          return false;
        }
        return (nextElapsedMs * ROUTE_PLAYBACK_SPEED) < routeLength;
      });

      if (!hasRemainingRoute) {
        setIsRoutePlaybackActive(false);
        return;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [elements, isRoutePlaybackActive, routePlaybackElapsedMs]);

  const animatedRouteBindings = useMemo<AnimatedRouteBinding[]>(() => {
    const tokens = elements
      .map((element, index) => (element.type === "token" ? { element, index } : null))
      .filter((value): value is { element: TokenElement; index: number } => Boolean(value));

    return elements.flatMap((element, routeIndex) => {
      if (element.type !== "route" || element.points.length < 2) {
        return [];
      }

      let bestMatch: { element: TokenElement; index: number } | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const token of tokens) {
        const nextDistance = distanceBetween(token.element.center, element.points[0]);
        if (nextDistance < bestDistance) {
          bestDistance = nextDistance;
          bestMatch = token;
        }
      }

      if (!bestMatch || bestDistance > TOKEN_RADIUS * 1.5) {
        return [];
      }

      return [{
        route: element,
        routeIndex,
        token: bestMatch.element,
        tokenIndex: bestMatch.index,
      }];
    });
  }, [elements]);

  const animatedTokenIndexes = useMemo(
    () => new Set(animatedRouteBindings.map((binding) => binding.tokenIndex)),
    [animatedRouteBindings],
  );
  const selectedElement = selectedElementIndex == null ? null : elements[selectedElementIndex] ?? null;

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

  useEffect(() => {
    if (!fullscreenMode || typeof window === "undefined") {
      return;
    }

    setPalettePositions({
      functions: { x: 12, y: 12 },
      styles: { x: 12, y: 12 },
    });
  }, [fullscreenMode]);

  useEffect(() => {
    if (tool === "token" || tool === "select") {
      setActivePaletteSection("objects");
      return;
    }

    if (tool === "route") {
      setActivePaletteSection("route");
      return;
    }

    if (tool === "draw" || tool === "erase" || tool === "arrow" || tool === "spotlight") {
      setActivePaletteSection("freehand");
    }
  }, [tool]);

  useImperativeHandle(ref, () => ({
    clear() {
      setStrokes([]);
      setElements([]);
      setDraftStroke(null);
      setDraftElement(null);
      setRouteDraft(null);
      activeStrokeRef.current = null;
      activeLinearRef.current = null;
      activeDragRef.current = null;
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
          context.setLineDash(element.dashed ? getRouteDashPattern(element.width) : []);
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
            context.setLineDash([]);
            renderLinearEnding(context, element.endCap, previous, end, headSize);
          }
          context.setLineDash([]);
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

  function updatePalettePosition(key: PaletteKey, clientX: number, clientY: number) {
    const drag = activePaletteDragRef.current;
    const boardBounds = boardRef.current?.getBoundingClientRect();
    if (!drag || drag.key !== key || !boardBounds) {
      return;
    }

    const nextX = drag.originX + (clientX - drag.startClientX);
    const nextY = drag.originY + (clientY - drag.startClientY);

    setPalettePositions((current) => ({
      ...current,
      [key]: {
        x: Math.max(8, Math.min(boardBounds.width - 148, nextX)),
        y: Math.max(8, Math.min(boardBounds.height - 84, nextY)),
      },
    }));
  }

  function handlePalettePointerDown(key: PaletteKey, event: React.PointerEvent<HTMLDivElement>) {
    if (!fullscreenMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    safelySetPointerCapture(event.currentTarget, event.pointerId);
    activePaletteDragRef.current = {
      key,
      originX: palettePositions[key].x,
      originY: palettePositions[key].y,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
  }

  function handlePalettePointerMove(key: PaletteKey, event: React.PointerEvent<HTMLDivElement>) {
    if (!activePaletteDragRef.current || activePaletteDragRef.current.key !== key) {
      return;
    }

    updatePalettePosition(key, event.clientX, event.clientY);
  }

  function handlePalettePointerUp(key: PaletteKey, event: React.PointerEvent<HTMLDivElement>) {
    if (!activePaletteDragRef.current || activePaletteDragRef.current.key !== key) {
      return;
    }

    event.stopPropagation();
    activePaletteDragRef.current = null;
    safelyReleasePointerCapture(event.currentTarget, event.pointerId);
  }

  function eraseAtPoint(point: Point) {
    setStrokes((current) => current.filter((stroke) => !isStrokeNearPoint(stroke, point)));
    setElements((current) => current.filter((element) => !isElementNearPoint(element, point)));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isRoutePlaybackActive) {
      return;
    }

    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }

    safelySetPointerCapture(event.currentTarget, event.pointerId);

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

        const nextDraft = { anchorIndex: anchorToken.index, points: [anchorToken.element.center] };
        setSelectedElementIndex(anchorToken.index);
        setRouteDraft(nextDraft);
        return;
      }

      const lastPoint = routeDraft.points[routeDraft.points.length - 1];
      if (distanceBetween(lastPoint, point) < MIN_LINEAR_DISTANCE) {
        return;
      }

      setRouteDraft({
        anchorIndex: routeDraft.anchorIndex,
        points: [...routeDraft.points, point],
      });
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
    if (isRoutePlaybackActive) {
      return;
    }

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
    if (isRoutePlaybackActive) {
      return;
    }

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

  function handleCommitRoute() {
    if (!routeDraft) {
      return;
    }

    if (routeDraft.points.length < 2) {
      return;
    }

    setElements((current) => [
      ...current,
      {
        type: "route",
        color,
        dashed: routeDashed,
        endCap: routeEndCap,
        points: routeDraft.points,
        width: strokeWidth,
      },
    ]);
    setSelectedElementIndex(null);
    setRouteDraft(null);
  }

  function handleCancelRoute() {
    setRouteDraft(null);
    setSelectedElementIndex(null);
  }

  function handleToggleRoutePlayback() {
    if (!animatedRouteBindings.length) {
      return;
    }

    setRouteDraft(null);
    activeDragRef.current = null;
    activeLinearRef.current = null;
    activeStrokeRef.current = null;
    setDraftElement(null);
    setDraftStroke(null);
    setSelectedElementIndex(null);
    setIsRoutePlaybackActive((current) => {
      if (!current) {
        const hasRemainingRoute = animatedRouteBindings.some((binding) => {
          const routeLength = getPolylineLength(binding.route.points);
          return routeLength > 0 && (routePlaybackElapsedMs * ROUTE_PLAYBACK_SPEED) < routeLength;
        });

        if (!hasRemainingRoute) {
          setRoutePlaybackElapsedMs(0);
        }
      }
      return !current;
    });
  }

  function handleResetRoutePlayback() {
    setIsRoutePlaybackActive(false);
    setRoutePlaybackElapsedMs(0);
  }

  function handleAddFieldLines() {
    const lineColor = "#AAAAAA";
    const nextLines: Stroke[] = [
      LOS_Y,
      FIVE_YARDS_Y,
      TEN_YARDS_Y,
      MINUS_FIVE_YARDS_Y,
      MINUS_TEN_YARDS_Y,
    ].map((y) => ({
      color: lineColor,
      width: FIELD_LINE_WIDTH,
      points: [
        { x: FIELD_LINE_X_START, y },
        { x: FIELD_LINE_X_END, y },
      ],
    }));

    setStrokes((current) => [...current, ...nextLines]);
  }

  function handleDeleteFieldLines() {
    const targetYs = [LOS_Y, FIVE_YARDS_Y, TEN_YARDS_Y, MINUS_FIVE_YARDS_Y, MINUS_TEN_YARDS_Y];

    setStrokes((current) =>
      current.filter((stroke) => {
        if (stroke.width !== FIELD_LINE_WIDTH || stroke.points.length !== 2) {
          return true;
        }

        const [start, end] = stroke.points;
        const isHorizontal = Math.abs(start.y - end.y) < 0.0001;
        const matchesRange =
          Math.abs(start.x - FIELD_LINE_X_START) < 0.0001 &&
          Math.abs(end.x - FIELD_LINE_X_END) < 0.0001;
        const matchesY = targetYs.some((targetY) => Math.abs(start.y - targetY) < 0.0001);

        return !(isHorizontal && matchesRange && matchesY);
      }),
    );
  }

  function updateSelectedElement(updater: (element: BoardElement) => BoardElement) {
    if (selectedElementIndex == null) {
      return;
    }

    setElements((current) =>
      current.map((element, index) => (index === selectedElementIndex ? updater(element) : element)),
    );
  }

  function handleDeleteRoutesFromSelectedToken() {
    if (!selectedElement || selectedElement.type !== "token") {
      return;
    }

    setElements((current) =>
      current.filter((element, index) => {
        if (index === selectedElementIndex) {
          return true;
        }

        if (element.type !== "route" || element.points.length < 2) {
          return true;
        }

        return distanceBetween(element.points[0], selectedElement.center) > TOKEN_RADIUS * 1.5;
      }),
    );
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
          strokeDasharray={element.dashed ? getRouteDashPattern(element.width).join(" ") : undefined}
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
    const borderWidth = Math.max(2, radius * 0.11);
    const offenseFontSize = Math.max(10, Math.min(radius * 0.62, radius - borderWidth - 6));
    const defenseFontSize = Math.max(9, Math.min(radius * 0.5, radius - borderWidth - 8));

    if (element.variant === "offense") {
      return (
        <g key={key}>
          <circle
            cx={centerX}
            cy={centerY}
            fill="#ffffff"
            r={radius}
            stroke={element.color}
            strokeWidth={borderWidth}
          />
          <text
            dominantBaseline="middle"
            fill={element.color}
            fontSize={offenseFontSize}
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
          d={`M ${centerX},${centerY + radius * 1.16} L ${centerX - radius * 1.18},${centerY - radius * 0.98} L ${centerX + radius * 1.18},${centerY - radius * 0.98} Z`}
          fill="#ffffff"
          stroke={element.color}
          strokeWidth={borderWidth}
        />
        <text
          dominantBaseline="middle"
          fill={element.color}
          fontSize={defenseFontSize}
          fontWeight="700"
          textAnchor="middle"
          x={centerX}
          y={centerY - radius * 0.1}
        >
          {element.label}
        </text>
      </g>
    );
  }

  function renderAnimatedToken(binding: AnimatedRouteBinding) {
    const routeLength = getPolylineLength(binding.route.points);
    const progress = routeLength === 0
      ? 1
      : Math.min(1, (routePlaybackElapsedMs * ROUTE_PLAYBACK_SPEED) / routeLength);
    const point = getPointAtProgress(binding.route.points, progress);
    if (!point) {
      return null;
    }

    return renderTokenElement(
      {
        ...binding.token,
        center: point,
      },
      `animated-token-${binding.routeIndex}-${binding.tokenIndex}`,
    );
  }

  function renderElement(element: BoardElement, key: string, isSelected = false, elementIndex?: number) {
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
          {!isRoutePlaybackActive || elementIndex == null || !animatedTokenIndexes.has(elementIndex)
            ? renderTokenElement(element, `${key}-token`)
            : null}
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

  const activeDashSetting = selectedElement?.type === "route" ? Boolean(selectedElement.dashed) : routeDashed;

  const colorSwatches = (
    <div className="playbook-board-tools">
      <span className="playbook-board-label">色</span>
      {COLORS.map((candidate) => (
        <button
          key={candidate}
          className={`playbook-swatch ${color === candidate ? "is-selected" : ""}`}
          type="button"
          onClick={() => {
            setColor(candidate);
            if (selectedElementIndex != null) {
              updateSelectedElement((element) => ({ ...element, color: candidate }));
            }
          }}
          style={{ backgroundColor: candidate }}
          aria-label={`色を選択: ${candidate}`}
          title="色を選択"
        />
      ))}
    </div>
  );

  const widthControls = (
    <div className="playbook-board-tools">
      <span className="playbook-board-label">太さ</span>
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
  );

  const animationPanel = animatedRouteBindings.length ? (
    <div className="playbook-board-tools">
      <span className="playbook-board-label">アニメーション</span>
      <button className={`button secondary button-compact ${isRoutePlaybackActive ? "is-selected" : ""}`} type="button" onClick={handleToggleRoutePlayback}>
        {isRoutePlaybackActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        {isRoutePlaybackActive ? "停止" : "再生"}
      </button>
      <button className="button secondary button-compact" type="button" onClick={handleResetRoutePlayback} disabled={!routePlaybackElapsedMs && !isRoutePlaybackActive}>
        <RotateCcw aria-hidden="true" />
        戻す
      </button>
    </div>
  ) : null;

  const paletteTabs = (
    <div
      className="playbook-floating-palette-tabs"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <button className={`button secondary button-compact ${activePaletteSection === "objects" ? "is-selected" : ""}`} type="button" onClick={() => setActivePaletteSection("objects")}>
        オブジェクト
      </button>
      <button className={`button secondary button-compact ${activePaletteSection === "route" ? "is-selected" : ""}`} type="button" onClick={() => {
        setActivePaletteSection("route");
        setTool("route");
      }}>
        ルート
      </button>
      <button className={`button secondary button-compact ${activePaletteSection === "freehand" ? "is-selected" : ""}`} type="button" onClick={() => {
        setActivePaletteSection("freehand");
        if (!["draw", "erase", "arrow", "spotlight"].includes(tool)) {
          setTool("draw");
        }
      }}>
        フリーハンド
      </button>
      <button className={`button secondary button-compact ${activePaletteSection === "history" ? "is-selected" : ""}`} type="button" onClick={() => setActivePaletteSection("history")}>
        戻す・消す
      </button>
    </div>
  );

  const paletteBody = (
    <div
      className="playbook-floating-palette-body"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {activePaletteSection === "objects" ? (
        <>
          <div className="playbook-board-tools">
            <button className={`button secondary button-compact ${tool === "select" ? "is-selected" : ""}`} type="button" onClick={() => setTool("select")}>
              <Move aria-hidden="true" />
              移動
            </button>
          </div>
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
          {colorSwatches}
          <div className="playbook-board-tools">
            <span className="playbook-board-label">フィールド</span>
            <button className="button secondary button-compact" type="button" onClick={handleAddFieldLines}>線を追加</button>
            <button className="button secondary button-compact" type="button" onClick={handleDeleteFieldLines}>線を削除</button>
          </div>
          {selectedElement?.type === "token" ? (
            <div className="playbook-board-tools">
              <button className="button secondary button-compact" type="button" onClick={handleDeleteRoutesFromSelectedToken}>
                この選手のルートを削除
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {activePaletteSection === "route" ? (
        <>
          <div className="playbook-board-tools">
            <span className="playbook-board-label">先端</span>
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
          </div>
          {colorSwatches}
          {widthControls}
          <div className="playbook-board-tools">
            <span className="playbook-board-label">線種</span>
            <button
              className={`button secondary button-compact ${!activeDashSetting ? "is-selected" : ""}`}
              type="button"
              onClick={() => {
                if (selectedElement?.type === "route") {
                  updateSelectedElement((element) => (element.type === "route" ? { ...element, dashed: false } : element));
                  return;
                }
                setRouteDashed(false);
              }}
            >
              実線
            </button>
            <button
              className={`button secondary button-compact ${activeDashSetting ? "is-selected" : ""}`}
              type="button"
              onClick={() => {
                if (selectedElement?.type === "route") {
                  updateSelectedElement((element) => (element.type === "route" ? { ...element, dashed: true } : element));
                  return;
                }
                setRouteDashed(true);
              }}
            >
              点線
            </button>
          </div>
          {animationPanel}
        </>
      ) : null}

      {activePaletteSection === "freehand" ? (
        <>
          <div className="playbook-board-tools">
            <button className={`button secondary button-compact ${tool === "draw" ? "is-selected" : ""}`} type="button" onClick={() => setTool("draw")}>
              <Pencil aria-hidden="true" />
              ペン
            </button>
            <button className={`button secondary button-compact ${tool === "erase" ? "is-selected" : ""}`} type="button" onClick={() => setTool("erase")}>
              <Eraser aria-hidden="true" />
              消しゴム
            </button>
            <button className={`button secondary button-compact ${tool === "arrow" ? "is-selected" : ""}`} type="button" onClick={() => setTool("arrow")}>
              矢印
            </button>
            <button className={`button secondary button-compact ${tool === "spotlight" ? "is-selected" : ""}`} type="button" onClick={() => setTool("spotlight")}>
              スポット
            </button>
          </div>
          {colorSwatches}
          {widthControls}
        </>
      ) : null}

      {activePaletteSection === "history" ? (
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
      ) : null}
    </div>
  );

  const fullscreenPalette = fullscreenMode ? (
    <div
      className="playbook-floating-palette playbook-floating-palette-main"
      style={{ left: palettePositions.functions.x, top: palettePositions.functions.y }}
    >
      <div
        className="playbook-floating-palette-handle"
        onPointerDown={(event) => handlePalettePointerDown("functions", event)}
        onPointerMove={(event) => handlePalettePointerMove("functions", event)}
        onPointerUp={(event) => handlePalettePointerUp("functions", event)}
        onPointerCancel={(event) => handlePalettePointerUp("functions", event)}
      >
        <span>ツール</span>
        <button
          className="button ghost button-compact"
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setIsPaletteExpanded((current) => !current)}
          aria-label={isPaletteExpanded ? "ツールを折りたたむ" : "ツールを展開する"}
          style={{ padding: "0 4px", minWidth: 0, height: "24px" }}
        >
          {isPaletteExpanded ? <ChevronUp aria-hidden="true" style={{ width: 16, height: 16 }} /> : <ChevronDown aria-hidden="true" style={{ width: 16, height: 16 }} />}
        </button>
      </div>
      {isPaletteExpanded ? (
        <>
          {paletteTabs}
          {paletteBody}
        </>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={boardRef} className={`playbook-board ${fullscreenMode ? "is-fullscreen-mode" : ""}`}>
      {!fullscreenMode ? (
        <div className="playbook-board-toolbar playbook-board-toolbar-organized">
          {paletteTabs}
          {paletteBody}
        </div>
      ) : null}

      <div
        ref={surfaceRef}
        className={`playbook-board-surface ${tool === "erase" ? "is-erasing" : ""} ${fullscreenMode ? "is-fullscreen-surface" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {baseImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={`film-playbook-image ${fullscreenMode ? "is-fullscreen-playbook-image" : ""}`} src={baseImageUrl} alt={`${title} のプレーブック`} />
        ) : (
          <div className={`playbook-board-blank ${fullscreenMode ? "is-fullscreen-blank" : ""}`} aria-label={`${title} の白紙ボード`} />
        )}
        <svg className="playbook-board-overlay" viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`} aria-hidden="true">
          {elements.map((element, index) => renderElement(element, `element-${index}`, index === selectedElementIndex, index))}
          {isRoutePlaybackActive ? animatedRouteBindings.map((binding) => renderAnimatedToken(binding)) : null}
          {strokes.map((stroke, index) => renderStroke(stroke, `stroke-${index}`))}
          {draftElement ? renderElement(draftElement, "draft-element") : null}
          {routeDraft ? renderElement({ type: "route", color, endCap: routeEndCap, width: strokeWidth, points: routeDraft.points }, "draft-route") : null}
          {draftStroke ? renderStroke(draftStroke, "draft-stroke") : null}
        </svg>
        {routeDraft ? (
          <div className="playbook-route-actions">
            <button className="button secondary button-compact" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={handleCancelRoute}>
              キャンセル
            </button>
            <button className="button button-compact" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={handleCommitRoute} disabled={routeDraft.points.length < 2}>
              ルート確定
            </button>
          </div>
        ) : null}
        {fullscreenMode ? fullscreenPalette : null}
        {fullscreenMode ? (
          <div
            className="playbook-floating-actions"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {onRequestClose ? (
              <button className="button secondary button-compact" type="button" onClick={onRequestClose}>
                閉じる
              </button>
            ) : null}
            {onRequestSave ? (
              <button className="button button-compact" type="button" onClick={onRequestSave} disabled={saveDisabled}>
                {saveLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});
