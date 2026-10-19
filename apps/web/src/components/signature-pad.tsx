"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Stroke = Point[];

/**
 * Professional drawn-signature pad: pointer + touch, high-DPI backing store,
 * stroke history with undo, baseline guide, and a live ink preview.
 * Exports a transparent PNG data URL via onChange (null when empty).
 */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [hasInk, setHasInk] = useState(false);
  const strokesRef = useRef<Stroke[]>([]);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  function redraw(all: Stroke[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#e8f6ff";
    for (const stroke of all) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      stroke.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          const prev = stroke[i - 1]!;
          const midX = (prev.x + pt.x) / 2;
          const midY = (prev.y + pt.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
      });
      ctx.lineWidth = 2.4;
      ctx.shadowColor = "rgba(200,245,66,0.25)";
      ctx.shadowBlur = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      redraw(strokesRef.current);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  function emit(next: Stroke[]) {
    setStrokes(next);
    redraw(next);
    const ink = next.some((s) => s.length > 1);
    setHasInk(ink);
    if (!ink) return onChange(null);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function point(e: React.PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-[#0e1420]",
          hasInk ? "border-primary/50" : "border-border",
        )}
      >
        <canvas
          ref={canvasRef}
          data-testid="signature-pad"
          aria-label="Draw your signature"
          className="block h-44 w-full cursor-crosshair touch-none sm:h-52"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = [point(e)];
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            drawing.current.push(point(e));
            redraw([...strokes, drawing.current]);
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            const finished = drawing.current;
            drawing.current = null;
            if (finished.length > 1) emit([...strokes, finished]);
          }}
          onPointerCancel={() => {
            drawing.current = null;
            redraw(strokes);
          }}
        />
        {/* baseline + placeholder */}
        <div className="pointer-events-none absolute inset-x-4 bottom-10 border-t border-dashed border-border/80" aria-hidden />
        {!hasInk ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <PenLine className="size-4" aria-hidden /> Sign here with mouse, pen, or finger
          </p>
        ) : null}
        <span className="pointer-events-none absolute right-3 bottom-2 text-[10px] tracking-wide text-muted-foreground uppercase">
          {hasInk ? "Signature captured" : "×"}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={strokes.length === 0}
          onClick={() => emit(strokes.slice(0, -1))}
        >
          <Undo2 className="mr-1 size-4" aria-hidden /> Undo
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={strokes.length === 0} onClick={() => emit([])}>
          <Eraser className="mr-1 size-4" aria-hidden /> Clear
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {strokes.length} stroke{strokes.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
