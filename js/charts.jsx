// ============================================================
// Spacio AM — Owner Dashboard · Charts (SVG, responsive, soft)
// Copiado de mi-spacioam/charts.jsx. Tres cambios acotados:
// · los hooks se toman de React aquí mismo y se exporta con module.exports,
//   para poder montarlo fuera del bundle del Dashboard;
// · LineChart acepta un piso de eje opcional (yMin). Sin la prop se mantiene
//   el cero como base — las gráficas de dinero del Dashboard no cambian.
// ============================================================
const { useRef, useState, useEffect } = window.React;

// measure container width
function useMeasure() {
  const ref = useRef(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Catmull-Rom → cubic bezier (soft tension)
function smoothPath(pts, t = 0.16) {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
  }
  return d;
}

// ---- Smooth multi-line area chart with hover ----
const LineChart = ({ series, labels, height = 240, formatY, formatTip, yTicks = 4, area = true, yMin }) => {
  const [ref, w] = useMeasure();
  const [hi, setHi] = useState(null);
  const padL = 8, padR = 8, padT = 16, padB = 28;
  const innerW = Math.max(40, w - padL - padR);
  const innerH = height - padT - padB;

  const all = series.flatMap(s => s.values).filter(v => v != null);
  // yMin: para escalas que no nacen en cero (una calificación vive entre 3 y 5,
  // y con base cero la serie se aplasta contra el borde superior).
  let max = Math.max(...all), min = yMin != null ? yMin : Math.min(...all, 0);
  const range = max - min || 1; max += range * 0.12;
  const nx = labels.length;
  const X = i => padL + (nx === 1 ? innerW / 2 : (i / (nx - 1)) * innerW);
  const Y = v => padT + innerH - ((v - min) / (max - min)) * innerH;

  const ticks = [];
  for (let i = 0; i <= yTicks; i++) ticks.push(min + ((max - min) / yTicks) * i);

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const idx = Math.max(0, Math.min(nx - 1, Math.round(((mx - padL) / innerW) * (nx - 1))));
    setHi(idx);
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={s.fill != null ? s.fill : 0.14} />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {/* gridlines */}
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={Y(tk)} y2={Y(tk)} stroke="var(--warm-grey)" strokeOpacity={i === 0 ? 0.9 : 0.4} strokeWidth="1" />
            <text x={padL} y={Y(tk) - 6} fontFamily="var(--sans)" fontSize="10" letterSpacing="0.06em" fill="var(--fg-muted)">{formatY ? formatY(tk) : Math.round(tk)}</text>
          </g>
        ))}
        {/* areas + lines */}
        {series.map((s) => {
          const pts = s.values.map((v, i) => v == null ? null : ({ x: X(i), y: Y(v) })).filter(Boolean);
          if (!pts.length) return null;
          const line = smoothPath(pts);
          const lastX = pts[pts.length - 1].x, firstX = pts[0].x;
          return (
            <g key={s.key}>
              {area && s.area !== false && <path d={`${line} L${lastX},${padT + innerH} L${firstX},${padT + innerH} Z`} fill={`url(#grad-${s.key})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash || "none"} strokeLinecap="round" strokeOpacity={s.opacity != null ? s.opacity : 1} />
              {s.dots && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={s.color} />)}
            </g>
          );
        })}
        {/* x labels */}
        {labels.map((l, i) => (
          (nx <= 8 || i % Math.ceil(nx / 8) === 0) &&
          <text key={i} x={X(i)} y={height - 8} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5" letterSpacing="0.06em" fill="var(--fg-muted)">{l}</text>
        ))}
        {/* hover */}
        {hi != null && (
          <g>
            <line x1={X(hi)} x2={X(hi)} y1={padT} y2={padT + innerH} stroke="var(--ink)" strokeOpacity="0.18" strokeWidth="1" />
            {series.map(s => s.values[hi] == null ? null : (
              <circle key={s.key} cx={X(hi)} cy={Y(s.values[hi])} r="4.5" fill="var(--alabaster)" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        )}
        <rect x="0" y="0" width={w} height={height} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHi(null)} style={{ cursor: "crosshair" }} />
      </svg>
      {hi != null && (
        <div style={{
          position: "absolute", top: 4,
          left: Math.min(Math.max(X(hi) - 70, 0), Math.max(0, w - 150)),
          width: 150, pointerEvents: "none",
          background: "var(--alabaster)", border: "1px solid var(--ink-08)", borderRadius: 12,
          boxShadow: "var(--shadow-md)", padding: "10px 12px", animation: "sa-fade .14s var(--ease)",
        }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 8 }}>{labels[hi]}</div>
          {series.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--sans)", fontSize: 11, color: "var(--fg-muted)", letterSpacing: "0.04em" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: s.opacity != null ? s.opacity : 1 }} />{s.name}
              </span>
              <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.02em" }}>{s.values[hi] == null ? "—" : (formatTip ? formatTip(s.values[hi]) : s.values[hi])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Legend ----
const Legend = ({ items }) => (
  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
    {items.map(it => (
      <span key={it.name} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 11, letterSpacing: "0.08em", color: "var(--fg-muted)" }}>
        <span style={{ width: 14, height: it.dash ? 0 : 8, borderTop: it.dash ? `2px dashed ${it.color}` : "none", borderRadius: 2, background: it.dash ? "none" : it.color, display: "inline-block" }} />
        {it.name}
      </span>
    ))}
  </div>
);

// ---- Occupancy bars (sold vs blocked, monthly) ----
const OccBars = ({ data, height = 220, formatTip }) => {
  const [ref, w] = useMeasure();
  const [hi, setHi] = useState(null);
  const padT = 12, padB = 26;
  const innerH = height - padT - padB;
  const n = data.length;
  const gap = 10;
  const bw = Math.max(8, (w - gap * (n - 1)) / n);
  const max = 1; // occupancy fraction up to 100%
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        {[0, 0.5, 1].map((g, i) => (
          <line key={i} x1="0" x2={w} y1={padT + innerH - g * innerH} y2={padT + innerH - g * innerH} stroke="var(--warm-grey)" strokeOpacity={g === 0 ? 0.9 : 0.4} />
        ))}
        {data.map((d, i) => {
          const x = i * (bw + gap);
          const soldH = (d.sold / max) * innerH;
          const active = hi === i;
          return (
            <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor: "pointer" }}>
              <rect x={x} y={padT} width={bw} height={innerH} fill="transparent" />
              <rect x={x} y={padT + innerH - innerH} width={bw} height={innerH} rx={Math.min(7, bw / 2)} fill="var(--beige-soft)" />
              <rect x={x} y={padT + innerH - soldH} width={bw} height={soldH} rx={Math.min(7, bw / 2)}
                fill={active ? "var(--peach)" : "var(--ink)"} style={{ transition: "fill .18s var(--ease)" }} />
              <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5" letterSpacing="0.04em" fill="var(--fg-muted)">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hi != null && (
        <div style={{
          position: "absolute", top: 0, left: Math.min(hi * (bw + gap), Math.max(0, w - 140)),
          width: 132, pointerEvents: "none", background: "var(--alabaster)", border: "1px solid var(--ink-08)",
          borderRadius: 12, boxShadow: "var(--shadow-md)", padding: "10px 12px",
        }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 6 }}>{data[hi].label}</div>
          {formatTip(data[hi])}
        </div>
      )}
    </div>
  );
};

// ---- Donut ----
const Donut = ({ segments, size = 200, thickness = 26, centerLabel, centerSub, onHover }) => {
  const [hi, setHi] = useState(null);
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circ;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
              strokeWidth={hi === i ? thickness + 4 : thickness}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc * circ}
              strokeLinecap="butt" style={{ transition: "stroke-width .18s var(--ease)", cursor: "pointer", opacity: hi == null || hi === i ? 1 : 0.45 }}
              onMouseEnter={() => { setHi(i); onHover && onHover(i); }} onMouseLeave={() => { setHi(null); onHover && onHover(null); }} />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none" }}>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: hi != null ? 22 : 26, letterSpacing: "-0.02em", color: hi != null ? segments[hi].color : "var(--ink)", transition: "all .18s var(--ease)" }}>
          {hi != null ? segments[hi].pretty : centerLabel}
        </span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)", marginTop: 4 }}>
          {hi != null ? segments[hi].label : centerSub}
        </span>
      </div>
    </div>
  );
};

// ---- Sparkline ----
const Sparkline = ({ values, color = "var(--ink)", width = 120, height = 34 }) => {
  const max = Math.max(...values), min = Math.min(...values);
  const rng = max - min || 1;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * width, y: height - 4 - ((v - min) / rng) * (height - 8) }));
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <path d={`${smoothPath(pts)} L${width},${height} L0,${height} Z`} fill={color} fillOpacity="0.08" />
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
    </svg>
  );
};

// ---- Semicircle gauge (occupancy; can exceed 100%) ----
const Gauge = ({ value, size = 220, label, sub }) => {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const semi = Math.PI * r; // half-circle arc length
  const frac = Math.max(0, Math.min(1, value)); // visual cap at 100% of the arc
  const over = value > 1;
  const dash = frac * semi;
  const arc = (cxr) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div style={{ position: "relative", width: size, height: size / 2 + 28 }}>
      <svg width={size} height={size / 2 + 28} style={{ display: "block", overflow: "visible" }}>
        <path d={arc()} fill="none" stroke="var(--beige-soft)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arc()} fill="none" stroke={over ? "var(--peach)" : "var(--ink)"} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${semi}`} style={{ transition: "stroke-dasharray .6s var(--ease)" }} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: size / 2 - 34, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 38, letterSpacing: "-0.02em", color: over ? "var(--peach)" : "var(--ink)", lineHeight: 1 }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--sans)", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)", marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  );
};

// ---- Occupancy column chart with % labels + 100% reference ----
const OccColumns = ({ data, height = 230, lang }) => {
  const [ref, w] = useMeasure();
  const [hi, setHi] = useState(null);
  const padT = 26, padB = 26;
  const innerH = height - padT - padB;
  const n = data.length;
  const gap = Math.max(8, w * 0.018);
  const bw = Math.max(10, (w - gap * (n - 1)) / n);
  const maxVal = Math.max(1.05, ...data.map(d => d.occ));
  const Y = v => padT + innerH - (v / maxVal) * innerH;
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        {/* 100% reference line */}
        <line x1="0" x2={w} y1={Y(1)} y2={Y(1)} stroke="var(--warm-grey)" strokeDasharray="3 4" />
        <text x={w} y={Y(1) - 6} textAnchor="end" fontFamily="var(--sans)" fontSize="9.5" letterSpacing="0.1em" fill="var(--fg-muted)">100%</text>
        <line x1="0" x2={w} y1={padT + innerH} y2={padT + innerH} stroke="var(--warm-grey)" />
        {data.map((d, i) => {
          const x = i * (bw + gap);
          const h = Math.max(2, (d.occ / maxVal) * innerH);
          const active = hi === i;
          const over = d.occ > 1;
          return (
            <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor: "default" }}>
              <rect x={x} y={padT + innerH - h} width={bw} height={h} rx={Math.min(7, bw / 3)}
                fill={over ? "var(--peach)" : active ? "var(--ink)" : "rgba(62,63,63,0.82)"} style={{ transition: "fill .18s var(--ease)" }} />
              <text x={x + bw / 2} y={padT + innerH - h - 8} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5" fontWeight="600" letterSpacing="0.02em" fill={over ? "var(--peach)" : "var(--ink)"}>{Math.round(d.occ * 100)}%</text>
              <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5" letterSpacing="0.04em" fill="var(--fg-muted)">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

Object.assign(window, { LineChart, Legend, OccBars, OccColumns, Gauge, Donut, Sparkline, smoothPath });

module.exports = { LineChart, Legend, OccBars, OccColumns, Gauge, Donut, Sparkline, smoothPath };
