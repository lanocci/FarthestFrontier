"use client";

import { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { X, Upload, Play, Pause, Loader2 } from "lucide-react";

// YOLOv8 COCO classes (first few for sports/people context)
const YOLO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
  "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
  "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

// Configure ORT to use WASM
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

type AISandboxProps = {
  onClose: () => void;
};

export function AISandbox({ onClose }: AISandboxProps) {
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number>(0);
  const isProcessing = useRef(false);

  // Initialize ONNX Session
  useEffect(() => {
    async function loadModel() {
      try {
        setIsLoading(true);
        // Load the YOLOv8n ONNX model from the public directory
        const mySession = await ort.InferenceSession.create("/models/yolov8n.onnx", {
          executionProviders: ["wasm"],
        });
        setSession(mySession);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load ONNX model:", err);
        setLoadError("モデルのロードに失敗しました。public/models/yolov8n.onnx が存在するか確認してください。");
        setIsLoading(false);
      }
    }
    loadModel();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Processing loop
  useEffect(() => {
    if (!session || !videoUrl) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen canvas for resizing to YOLO's expected 640x640 input
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = 640;
    offscreenCanvas.height = 640;
    const offCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });

    async function processFrame() {
      if (!video || !canvas || !offCtx || !ctx || !session) return;
      if (video.paused || video.ended) {
        animationFrameId.current = requestAnimationFrame(processFrame);
        return;
      }

      if (isProcessing.current) {
        // Skip frame if still processing the previous one
        animationFrameId.current = requestAnimationFrame(processFrame);
        return;
      }

      isProcessing.current = true;
      const startTime = performance.now();

      // Ensure display canvas matches video dimensions
      if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (vw > 0 && vh > 0) {
        // 1. Draw current video frame to display canvas
        ctx.drawImage(video, 0, 0, vw, vh);

        // 2. Prepare input tensor (resize and normalize to 640x640)
        // Calculate scale to keep aspect ratio and pad with gray
        const scale = Math.min(640 / vw, 640 / vh);
        const nw = Math.round(vw * scale);
        const nh = Math.round(vh * scale);
        const padX = (640 - nw) / 2;
        const padY = (640 - nh) / 2;

        offCtx.fillStyle = "#7f7f7f"; // Gray padding
        offCtx.fillRect(0, 0, 640, 640);
        offCtx.drawImage(video, padX, padY, nw, nh);

        const imgData = offCtx.getImageData(0, 0, 640, 640);
        const pixels = imgData.data;

        // Convert [H, W, C] to [1, C, H, W] Float32Array (normalized 0-1)
        const inputData = new Float32Array(1 * 3 * 640 * 640);
        for (let i = 0; i < 640 * 640; i++) {
          inputData[i] = pixels[i * 4] / 255.0; // R
          inputData[640 * 640 + i] = pixels[i * 4 + 1] / 255.0; // G
          inputData[2 * 640 * 640 + i] = pixels[i * 4 + 2] / 255.0; // B
        }

        const tensor = new ort.Tensor("float32", inputData, [1, 3, 640, 640]);

        try {
          // 3. Run Inference
          const results = await session.run({ images: tensor });
          const output = results.output0; // Shape [1, 84, 8400]
          
          // 4. Parse output and apply NMS
          // YOLOv8 output is [1, 84, 8400] -> [batch, features, anchors]
          const data = output.data as Float32Array;
          const numAnchors = 8400;
          const numClasses = 80;

          const boxes: { x: number, y: number, w: number, h: number, prob: number, classId: number }[] = [];

          for (let i = 0; i < numAnchors; i++) {
            let maxProb = 0;
            let classId = -1;

            // Find class with highest probability
            for (let c = 0; c < numClasses; c++) {
              const prob = data[(4 + c) * numAnchors + i];
              if (prob > maxProb) {
                maxProb = prob;
                classId = c;
              }
            }

            // Confidence threshold
            if (maxProb > 0.4) {
              const cx = data[0 * numAnchors + i];
              const cy = data[1 * numAnchors + i];
              const w = data[2 * numAnchors + i];
              const h = data[3 * numAnchors + i];

              // Convert back to original video scale
              // Remove padding and reverse scaling
              const origX = (cx - padX) / scale;
              const origY = (cy - padY) / scale;
              const origW = w / scale;
              const origH = h / scale;

              boxes.push({
                x: origX - origW / 2,
                y: origY - origH / 2,
                w: origW,
                h: origH,
                prob: maxProb,
                classId
              });
            }
          }

          // Simple NMS (Non-Maximum Suppression)
          boxes.sort((a, b) => b.prob - a.prob);
          const finalBoxes = [];
          const iouThreshold = 0.45;

          for (const box of boxes) {
            let keep = true;
            for (const fBox of finalBoxes) {
              if (box.classId !== fBox.classId) continue;
              
              // Calculate IoU
              const x1 = Math.max(box.x, fBox.x);
              const y1 = Math.max(box.y, fBox.y);
              const x2 = Math.min(box.x + box.w, fBox.x + fBox.w);
              const y2 = Math.min(box.y + box.h, fBox.y + fBox.h);
              const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
              const boxArea = box.w * box.h;
              const fBoxArea = fBox.w * fBox.h;
              const iou = interArea / (boxArea + fBoxArea - interArea);

              if (iou > iouThreshold) {
                keep = false;
                break;
              }
            }
            if (keep) {
              finalBoxes.push(box);
            }
          }

          // 5. Draw Bounding Boxes on Display Canvas
          ctx.lineWidth = 3;
          ctx.font = "16px sans-serif";
          ctx.textBaseline = "top";

          for (const box of finalBoxes) {
            const label = YOLO_CLASSES[box.classId] || `Class ${box.classId}`;
            // Different colors for different classes (e.g., person vs sports ball)
            const color = box.classId === 0 ? "#00ff00" : box.classId === 32 ? "#ff9900" : "#00ccff";
            
            ctx.strokeStyle = color;
            ctx.strokeRect(box.x, box.y, box.w, box.h);

            // Label background
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.fillRect(box.x, box.y - 20, textWidth + 8, 20);
            
            // Label text
            ctx.fillStyle = "#000000";
            ctx.fillText(label, box.x + 4, box.y - 18);
          }
        } catch (err) {
          console.error("Inference error:", err);
        }
      }

      const endTime = performance.now();
      setFps(Math.round(1000 / (endTime - startTime)));
      
      isProcessing.current = false;
      animationFrameId.current = requestAnimationFrame(processFrame);
    }

    if (isPlaying) {
      animationFrameId.current = requestAnimationFrame(processFrame);
    }

    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [isPlaying, session, videoUrl]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        {videoUrl && (
          <div className="bg-white/10 text-white px-3 py-1 rounded-md text-sm font-mono">
            {fps} FPS
          </div>
        )}
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="w-full max-w-5xl bg-zinc-900 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            AI Sandbox (ONNX YOLOv8)
          </h2>
          {isLoading && (
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              モデルを読み込み中...
            </div>
          )}
          {loadError && (
            <div className="text-red-400 text-sm">
              {loadError}
            </div>
          )}
        </div>

        <div className="relative flex-1 min-h-[60vh] bg-black flex items-center justify-center p-4">
          {!videoUrl ? (
            <div className="text-center">
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 inline-flex">
                <Upload className="w-5 h-5" />
                動画ファイルを選択 (.mp4)
                <input 
                  type="file" 
                  accept="video/*" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
              </label>
              <p className="text-zinc-500 mt-4 text-sm">
                ※動画はサーバーにアップロードされません。すべてブラウザ内で処理されます。
              </p>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef} 
                src={videoUrl} 
                className="hidden" 
                loop 
                playsInline 
                crossOrigin="anonymous"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-full object-contain shadow-lg bg-black"
              />
            </div>
          )}
        </div>

        {videoUrl && (
          <div className="p-4 bg-zinc-950 flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              className="bg-white text-black p-3 rounded-full hover:bg-zinc-200 transition-colors"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" />
              別の動画を選択
              <input 
                type="file" 
                accept="video/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
