import { useState, useRef, useCallback, useEffect } from 'react';

export interface ViewBox { x: number; y: number; w: number; h: number }

/**
 * Manages SVG pan / zoom state, with optional touch (pinch-zoom) support.
 *
 * Usage:
 *   const vp = useSvgViewport(initialView, { enableTouch: true });
 *   // call vp.startPan(e) on background mousedown, vp.updatePan(e) on mousemove,
 *   // vp.endPan() on mouseup. Spread vp.touchHandlers onto the <svg> when using touch.
 */
export function useSvgViewport(initial: ViewBox, options: { enableTouch?: boolean } = {}) {
  const { enableTouch = false } = options;

  const [view, setView] = useState<ViewBox>(initial);
  const viewRef = useRef<ViewBox>(initial);
  viewRef.current = view;

  const svgRef = useRef<SVGSVGElement>(null);
  const panRef  = useRef<{ startCX: number; startCY: number; startVX: number; startVY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // Prevent passive touchmove from blocking e.preventDefault()
  useEffect(() => {
    if (!enableTouch) return;
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: TouchEvent) => { e.preventDefault(); };
    svg.addEventListener('touchmove', handler, { passive: false });
    return () => svg.removeEventListener('touchmove', handler);
  }, [enableTouch]);

  const clientToSvg = useCallback((e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: v.x + (e.clientX - rect.left) * (v.w / rect.width),
      y: v.y + (e.clientY - rect.top)  * (v.h / rect.height),
    };
  }, []);

  const startPan = useCallback((e: { clientX: number; clientY: number }) => {
    panRef.current = {
      startCX: e.clientX, startCY: e.clientY,
      startVX: viewRef.current.x, startVY: viewRef.current.y,
    };
  }, []);

  const updatePan = useCallback((e: { clientX: number; clientY: number }) => {
    const pan = panRef.current;
    if (!pan || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const dx = (e.clientX - pan.startCX) * (v.w / rect.width);
    const dy = (e.clientY - pan.startCY) * (v.h / rect.height);
    setView(v => ({ ...v, x: pan.startVX - dx, y: pan.startVY - dy }));
  }, []);

  const endPan = useCallback(() => { panRef.current = null; }, []);
  const isPanning = () => panRef.current !== null;

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const mx = v.x + (e.clientX - rect.left) * (v.w / rect.width);
    const my = v.y + (e.clientY - rect.top)  * (v.h / rect.height);
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    setView(v => ({
      x: mx - (mx - v.x) * factor,
      y: my - (my - v.y) * factor,
      w: v.w * factor,
      h: v.h * factor,
    }));
  }, []);

  // ── Touch handlers (only wired when enableTouch=true) ──────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      panRef.current = { startCX: t.clientX, startCY: t.clientY, startVX: viewRef.current.x, startVY: viewRef.current.y };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      panRef.current = null;
      const t1 = e.touches[0], t2 = e.touches[1];
      pinchRef.current = {
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        cx: (t1.clientX + t2.clientX) / 2,
        cy: (t1.clientY + t2.clientY) / 2,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const vb = viewRef.current;
    if (e.touches.length === 1 && panRef.current) {
      const pan = panRef.current;
      const t = e.touches[0];
      const dx = (t.clientX - pan.startCX) * (vb.w / rect.width);
      const dy = (t.clientY - pan.startCY) * (vb.h / rect.height);
      setView(v => ({ ...v, x: pan.startVX - dx, y: pan.startVY - dy }));
    } else if (e.touches.length === 2 && pinchRef.current) {
      const t1 = e.touches[0], t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = pinchRef.current.dist / (newDist || 1);
      const { cx, cy } = pinchRef.current;
      const mx = vb.x + (cx - rect.left) * (vb.w / rect.width);
      const my = vb.y + (cy - rect.top)  * (vb.h / rect.height);
      setView(v => ({ x: mx - (mx - v.x) * factor, y: my - (my - v.y) * factor, w: v.w * factor, h: v.h * factor }));
      pinchRef.current = { dist: newDist, cx, cy };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 0) { panRef.current = null; pinchRef.current = null; }
  }, []);

  return {
    view,
    setView,
    viewRef,
    svgRef,
    viewBoxStr: `${view.x} ${view.y} ${view.w} ${view.h}`,
    clientToSvg,
    startPan,
    updatePan,
    endPan,
    isPanning,
    handleWheel,
    touchHandlers: enableTouch
      ? { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd }
      : undefined,
  };
}
