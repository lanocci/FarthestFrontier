"use client";

import { Eraser, Pencil, RotateCcw, Trash2 } from "lucide-react";
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

type Tool = "draw" | "erase";

type PlaybookWhiteboardProps = {
  boardId: string;
  baseImageUrl?: string | null;
  title: string;
};

export type PlaybookWhiteboardHandle = {
  clear: () => void;
  exportToPng: () => Promise<{ blob: Blob; dataUrl: string } | null>;
};

const STORAGE_PREFIX = "ff-playbook-whiteboard";
const COLORS = ["#e8602d", "#17324d", "#2f8f5b", "#ca9632"] as const;
const WIDTHS = [4, 8, 12] as const;
const VIEWBOX_SIZE = 1000;

function toSvgPoints(points: Point[]) {
  return points.map((point) => `${point.x * VIEWBOX_SIZE},${point.y * VIEWBOX_SIZE}`).join(" ");
}

function isStrokeNearPoint(stroke: Stroke, point: Point) {
  const threshold = Math.max(0.018, stroke.width / 220);
  return stroke.points.some((strokePoint) => {
    const distanceX = strokePoint.x - point.x;
    const distanceY = strokePoint.y - point.y;
    return Math.hypot(distanceX, distanceY) <= threshold;
  });
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

export const PlaybookWhiteboard = forwardRef<PlaybookWhiteboardHandle, PlaybookWhiteboardProps>(function PlaybookWhiteboard(
  { boardId, baseImageUrl, title },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState<(typeof COLORS)[number]>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[1]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);

  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${boardId}`, [boardId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const saved = window.localStorage.getItem(storageKey);
      setStrokes(saved ? (JSON.parse(saved) as Stroke[]) : []);
    } catch {
      setStrokes([]);
    }

    setDraftStroke(null);
    activeStrokeRef.current = null;
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(strokes));
  }, [storageKey, strokes]);

  useImperativeHandle(ref, () => ({
    clear() {
      setStrokes([]);
      setDraftStroke(null);
      activeStrokeRef.current = null;
    },
    async exportToPng() {
      const bounds = surfaceRef.current?.getBoundingClientRect();
      const width = Math.max(1200, Math.round(bounds?.width ?? 1280));
      const height = Math.max(675, Math.round(bounds?.height ?? 720));
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
        context.drawImage(image, 0, 0, width, height);
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
  }), [baseImageUrl, strokes]);

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
    const currentStroke = activeStrokeRef.current;
    if (currentStroke) {
      setStrokes((current) => [...current, currentStroke]);
    }
    activeStrokeRef.current = null;
    setDraftStroke(null);
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
          cx={point.x * VIEWBOX_SIZE}
          cy={point.y * VIEWBOX_SIZE}
          fill={stroke.color}
          r={stroke.width * 1.2}
        />
      );
    }

    return (
      <polyline
        key={key}
        fill="none"
        points={toSvgPoints(stroke.points)}
        stroke={stroke.color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={stroke.width}
      />
    );
  }

  return (
    <div className="playbook-board">
      <div className="playbook-board-toolbar">
        <div className="playbook-board-tools">
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
        </div>

        <div className="playbook-board-tools">
          {COLORS.map((candidate) => (
            <button
              key={candidate}
              className={`playbook-swatch ${color === candidate ? "is-selected" : ""}`}
              type="button"
              onClick={() => {
                setColor(candidate);
                setTool("draw");
              }}
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
          <button
            className="button secondary button-compact"
            type="button"
            onClick={() => setStrokes((current) => current.slice(0, -1))}
            disabled={!strokes.length}
          >
            <RotateCcw aria-hidden="true" />
            ひとつ戻す
          </button>
          <button
            className="button secondary button-compact"
            type="button"
            onClick={() => setStrokes([])}
            disabled={!strokes.length}
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
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {strokes.map((stroke, index) => renderStroke(stroke, `stroke-${index}`))}
          {draftStroke ? renderStroke(draftStroke, "draft") : null}
        </svg>
      </div>
    </div>
  );
});
