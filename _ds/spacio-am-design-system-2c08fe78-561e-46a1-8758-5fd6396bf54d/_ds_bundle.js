/* @ds-bundle: {"format":4,"namespace":"SpacioAMDesignSystem_2c08fe","components":[{"name":"Brushstroke","sourcePath":"components/brand/Brushstroke.jsx"},{"name":"ICON_PATHS","sourcePath":"components/brand/Icon.jsx"},{"name":"Icon","sourcePath":"components/brand/Icon.jsx"},{"name":"Wordmark","sourcePath":"components/brand/Wordmark.jsx"},{"name":"Sparkle","sourcePath":"components/brand/Wordmark.jsx"},{"name":"Amount","sourcePath":"components/core/Amount.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardMedia","sourcePath":"components/core/Card.jsx"},{"name":"DOMAIN_CATEGORIES","sourcePath":"components/core/DomainBadge.jsx"},{"name":"DomainBadge","sourcePath":"components/core/DomainBadge.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"SectionHead","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Farol","sourcePath":"components/core/Farol.jsx"},{"name":"JobCard","sourcePath":"components/core/JobCard.jsx"},{"name":"PropertyCard","sourcePath":"components/core/PropertyCard.jsx"},{"name":"Calendar","sourcePath":"components/data/Calendar.jsx"},{"name":"Donut","sourcePath":"components/data/Donut.jsx"},{"name":"KpiCard","sourcePath":"components/data/KpiCard.jsx"},{"name":"Trend","sourcePath":"components/data/KpiCard.jsx"},{"name":"SERIES","sourcePath":"components/data/LineChart.jsx"},{"name":"LineChart","sourcePath":"components/data/LineChart.jsx"},{"name":"Gauge","sourcePath":"components/data/LineChart.jsx"},{"name":"BarChart","sourcePath":"components/data/LineChart.jsx"},{"name":"SummaryTable","sourcePath":"components/data/SummaryTable.jsx"},{"name":"EMAIL_HEX","sourcePath":"components/email/EmailLayout.jsx"},{"name":"EmailLayout","sourcePath":"components/email/EmailLayout.jsx"},{"name":"LoadingScreen","sourcePath":"components/feedback/LoadingScreen.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/LoadingScreen.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Toggle.jsx"},{"name":"Bento","sourcePath":"components/navigation/Bento.jsx"},{"name":"BentoTile","sourcePath":"components/navigation/Bento.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"},{"name":"Collapsible","sourcePath":"components/navigation/Collapsible.jsx"},{"name":"Segmented","sourcePath":"components/navigation/Segmented.jsx"},{"name":"TabNav","sourcePath":"components/navigation/TabNav.jsx"},{"name":"PillTabs","sourcePath":"components/navigation/TabNav.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"PillNav","sourcePath":"components/navigation/TopBar.jsx"}],"sourceHashes":{"components/brand/Brushstroke.jsx":"3613db97fd08","components/brand/Icon.jsx":"486bdada2f4c","components/brand/Wordmark.jsx":"8774fa735912","components/core/Amount.jsx":"5064e9e9661b","components/core/Button.jsx":"2e6df3ed160d","components/core/Card.jsx":"634d09ba4f0b","components/core/DomainBadge.jsx":"41e08a668ef7","components/core/Eyebrow.jsx":"8645a86b8495","components/core/Farol.jsx":"956985602b3b","components/core/JobCard.jsx":"f8aa76a48dc8","components/core/PropertyCard.jsx":"f23f40d9436f","components/data/Calendar.jsx":"d148bc48f7c8","components/data/Donut.jsx":"91ca006504e8","components/data/KpiCard.jsx":"7a44fe7ac729","components/data/LineChart.jsx":"3e996109c6e1","components/data/SummaryTable.jsx":"c97908e11185","components/email/EmailLayout.jsx":"0f914e2cf456","components/feedback/LoadingScreen.jsx":"6733442c517b","components/feedback/Modal.jsx":"048f128723e2","components/forms/Input.jsx":"68f276abc314","components/forms/Select.jsx":"a525e465b3d8","components/forms/Toggle.jsx":"a1facaff703a","components/navigation/Bento.jsx":"f9a8f56127ff","components/navigation/BottomNav.jsx":"36d30cddf205","components/navigation/Collapsible.jsx":"25897c06acea","components/navigation/Segmented.jsx":"73999511d440","components/navigation/TabNav.jsx":"fee754abf91c","components/navigation/TopBar.jsx":"2cd13af7c947","ui_kits/epi-app/Adelantos.jsx":"0d77a2486fc8","ui_kits/epi-app/Agenda.jsx":"f4dc72d0ecbb","ui_kits/epi-app/Calidad.jsx":"b3d9309e75d3","ui_kits/epi-app/Dashboard.jsx":"8fc133964285","ui_kits/epi-app/EpiApp.jsx":"f9e768b14234","ui_kits/epi-app/Formulario.jsx":"2676a995feac","ui_kits/epi-app/JobDetail.jsx":"bc8785c5f77c","ui_kits/epi-app/data.js":"98cfdbec7148","ui_kits/guest-app/Checkin.jsx":"d584c0653403","ui_kits/guest-app/GuestApp.jsx":"47d160a09378","ui_kits/guest-app/Guide.jsx":"9c6fc8a20009","ui_kits/guest-app/Home.jsx":"8b74abe43a10","ui_kits/owner-dashboard/DashboardApp.jsx":"d55f6445ea09","ui_kits/owner-dashboard/Login.jsx":"47cb3d12ef86","ui_kits/owner-dashboard/Sections.jsx":"b1e041aa2c44","ui_kits/owner-dashboard/Summary.jsx":"de69884574e4","ui_kits/owner-dashboard/data.js":"3b20930d0ad1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SpacioAMDesignSystem_2c08fe = window.SpacioAMDesignSystem_2c08fe || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Brushstroke.jsx
try { (() => {
/* Tratamiento canónico de imagen: el ribbon 3D teje por DETRÁS y reemerge por DELANTE.
   Regla del sistema: toda imagen editorial/destacada >= ~160px lo lleva.
   Miniaturas, avatares e íconos de foto quedan exentos. */
function Brushstroke({
  src,
  alt = "",
  height = 240,
  radius = "var(--r-card-top)",
  base = "",
  frontMask = "radial-gradient(120% 90% at 24% 92%, #000 0 38%, transparent 60%)",
  overlay,
  children,
  style
}) {
  const stroke = (base ? base.replace(/\/$/, "") + "/" : "") + "assets/brushstroke.svg";
  const layer = {
    position: "absolute",
    inset: "-26px -16px -22px",
    pointerEvents: "none"
  };
  const img = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.3
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...layer,
      zIndex: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: stroke,
    alt: "",
    "aria-hidden": "true",
    style: img
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      height,
      borderRadius: radius,
      overflow: "hidden",
      boxShadow: "var(--shadow-sm)",
      background: "var(--bg-alt)"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : null, overlay, children), /*#__PURE__*/React.createElement("div", {
    style: {
      ...layer,
      zIndex: 2,
      WebkitMaskImage: frontMask,
      maskImage: frontMask,
      filter: "drop-shadow(0 6px 14px rgba(62,63,63,.10))"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: stroke,
    alt: "",
    "aria-hidden": "true",
    style: img
  })));
}
Object.assign(__ds_scope, { Brushstroke });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Brushstroke.jsx", error: String((e && e.message) || e) }); }

// components/brand/Icon.jsx
try { (() => {
/* Set Lucide curado, inline. Grosor único 1.5, tamaños 20/24.
   Los paths vienen del set inline de las apps de Spacio AM. */
const ICON_PATHS = {
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronUp: "M6 15l6-6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowUpRight: "M7 17L17 7M8 7h9v9",
  calendar: "M8 2v4M16 2v4M3.5 9h17M5 5h14a1.5 1.5 0 011.5 1.5v12A1.5 1.5 0 0119 20H5a1.5 1.5 0 01-1.5-1.5v-12A1.5 1.5 0 015 5z",
  copy: "M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  alert: "M12 3.2L2.4 19.6a1 1 0 00.87 1.5h17.46a1 1 0 00.87-1.5L12 3.2zM12 9v5M12 17.2v.05",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  trash: "M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13",
  pencil: "M4 20h4L18.5 9.5a2 2 0 00-2.8-2.8L5 17.2V20zM14.5 6.5l3 3",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  logout: "M9 21H5a1.5 1.5 0 01-1.5-1.5v-15A1.5 1.5 0 015 3h4M16 17l5-5-5-5M21 12H9",
  home: "M3.5 11L12 4l8.5 7M5.5 9.5V20h13V9.5",
  info: "M12 16v-5M12 8h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  menu: "M4 7h16M4 12h16M4 17h16",
  trendUp: "M3 17l6-6 4 4 8-8M15 7h6v6",
  trendDown: "M3 7l6 6 4-4 8 8M15 17h6v-6",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  key: "M15 7a4 4 0 11-3.9 5H7v2H5v2H2v-3l5.1-5.1A4 4 0 1115 7zM16 7h.01",
  lock: "M7 11V8a5 5 0 0110 0v3M5.5 11h13a1 1 0 011 1v8a1 1 0 01-1 1h-13a1 1 0 01-1-1v-8a1 1 0 011-1z",
  pin: "M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  bed: "M3 18v-7m0 0a2 2 0 012-2h11a3 3 0 013 3v6M3 11h18M3 18h18M6.5 9V8a1 1 0 011-1h2a1 1 0 011 1v1",
  guests: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 11a3.5 3.5 0 000-7M17 14.5a6.5 6.5 0 014.5 5.5",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  star: "M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6L12 16.8 6.6 19.6l1.2-6L3.3 9.4l6.1-.8L12 3z",
  link: "M9 15l6-6M10 6l1-1a4 4 0 015.7 5.7l-1 1M14 18l-1 1A4 4 0 017.3 13.3l1-1",
  paperclip: "M21.2 11.1l-8.9 8.9a5.5 5.5 0 01-7.8-7.8l8.9-8.9a3.7 3.7 0 015.2 5.2l-8.9 8.9a1.85 1.85 0 01-2.6-2.6l8.2-8.2",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  eyeOff: "M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M9.4 5.7A9.5 9.5 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.6 3.3M6.2 6.3A16 16 0 002.5 12S6 18.5 12 18.5a9 9 0 003.6-.7",
  check: "M5 12.5l4.5 4.5L19 7",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.5 12h17M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z",
  coins: "M9 8.5a4.5 2.5 0 109 0 4.5 2.5 0 10-9 0zM4.5 15.5a4.5 2.5 0 109 0M4.5 11.5a4.5 2.5 0 109 0M4.5 11.5v8c0 1.4 2 2.5 4.5 2.5s4.5-1.1 4.5-2.5M18 8.5v8",
  wrench: "M14.5 6.5a3.5 3.5 0 01-4.6 4.6L5 16l3 3 4.9-4.9a3.5 3.5 0 004.6-4.6l-2.1 2.1-2-.5-.5-2 2.1-2.1z",
  sofa: "M5 11V8.5A2.5 2.5 0 017.5 6h9A2.5 2.5 0 0119 8.5V11M3 12.5A1.5 1.5 0 014.5 11h0A1.5 1.5 0 016 12.5V16h12v-3.5A1.5 1.5 0 0119.5 11h0a1.5 1.5 0 011.5 1.5V18H3v-5.5zM6 18v2M18 18v2",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  mail: "M3.5 6.5h17v11h-17zM3.5 7l8.5 6 8.5-6",
  bank: "M3 9.5L12 4l9 5.5M4 9.5h16M5.5 10v8M9.5 10v8M14.5 10v8M18.5 10v8M3.5 18.5h17M3 21h18",
  wifi: "M2 8.5C5.5 5.5 18.5 5.5 22 8.5M5 12c3-2.5 11-2.5 14 0M8 15.5c2-1.5 6-1.5 8 0M12 19h.01",
  camera: "M4 8a2 2 0 012-2h1.5l1-2h5l1 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2zM12 16.4a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z",
  refresh: "M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
};
function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.5,
  style,
  title
}) {
  const d = ICON_PATHS[name] || "";
  /* El stroke va por `style`, no por atributo: un atributo de presentación SVG
     no resuelve var(--token), y el ícono terminaría pintado del color por defecto. */
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
    style: {
      display: "block",
      flexShrink: 0,
      stroke: color,
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("title", null, title) : null, d.split("M").filter(Boolean).map((seg, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: "M" + seg
  })));
}
Object.assign(__ds_scope, { ICON_PATHS, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Icon.jsx", error: String((e && e.message) || e) }); }

// components/brand/Wordmark.jsx
try { (() => {
const SRC = {
  primary: {
    light: "assets/brand/logo-primary-transparent.png",
    white: "assets/brand/logo-primary-white.png"
  },
  stacked: {
    light: "assets/brand/logo-stacked.png",
    white: "assets/brand/logo-stacked-white.png"
  },
  monogram: {
    light: "assets/brand/logo-monogram.png",
    white: "assets/brand/logo-monogram-white.png"
  },
  stamp: {
    light: "assets/brand/logo-stamp-transparent.png",
    white: "assets/brand/logo-stamp-white.png"
  }
};

/* Marca oficial: SIEMPRE archivo, nunca tipografía recompuesta.
   El nombre es "Spacio AM", nunca "Espacio AM". */
function Wordmark({
  variant = "primary",
  height = 56,
  onDark = false,
  base = "",
  alt = "Spacio AM",
  style
}) {
  const set = SRC[variant] || SRC.primary;
  const src = (base ? base.replace(/\/$/, "") + "/" : "") + (onDark ? set.white : set.light);
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      height,
      width: "auto",
      display: "block",
      ...style
    }
  });
}

/* Sparkle: sigilo de 4 puntas de la marca. Acento gráfico, nunca contenedor de texto. */
function Sparkle({
  size = 14,
  color = "var(--accent)",
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 100 100",
    width: size,
    height: size,
    fill: color,
    "aria-hidden": "true",
    style: {
      display: "inline-block",
      verticalAlign: "middle",
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M50 4 C 52 32, 58 42, 96 50 C 58 58, 52 68, 50 96 C 48 68, 42 58, 4 50 C 42 42, 48 32, 50 4 Z"
  }));
}
Object.assign(__ds_scope, { Wordmark, Sparkle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/core/Amount.jsx
try { (() => {
/* Monto editorial: símbolo + enteros con peso, decimales atenuados.
   Los números SIEMPRE en Montserrat tabular. */
function Amount({
  value = 0,
  currency = "GTQ",
  size = 34,
  decimals = true,
  weight = 600,
  color = "var(--fg)",
  style
}) {
  const sym = currency === "USD" ? "$" : currency === "GTQ" ? "Q" : currency;
  const neg = value < 0;
  const abs = Math.abs(Number(value) || 0);
  const int = Math.floor(abs).toLocaleString("es-GT");
  const dec = Math.round((abs - Math.floor(abs)) * 100).toString().padStart(2, "0");
  return /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: weight,
      fontSize: size,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      color,
      whiteSpace: "nowrap",
      ...style
    }
  }, (neg ? "−" : "") + sym + (currency === "GTQ" ? "" : "") + int, decimals ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-subtle)",
      fontSize: "0.62em"
    }
  }, ".", dec) : null);
}
Object.assign(__ds_scope, { Amount });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Amount.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
const VARIANTS = {
  primary: {
    background: "var(--fg)",
    color: "var(--accent-contrast)",
    boxShadow: "none"
  },
  accent: {
    background: "var(--accent-tint)",
    color: "var(--fg)",
    boxShadow: "inset 0 0 0 1px var(--accent)"
  },
  secondary: {
    background: "transparent",
    color: "var(--fg)",
    boxShadow: "inset 0 0 0 1px var(--fg)"
  },
  text: {
    background: "transparent",
    color: "var(--fg)",
    boxShadow: "none",
    borderBottom: "1px solid var(--fg)",
    borderRadius: 0,
    padding: "8px 0"
  },
  danger: {
    background: "var(--color-error)",
    color: "var(--accent-contrast)",
    boxShadow: "none"
  }
};
const SIZES = {
  sm: {
    padding: "10px 20px",
    fontSize: 10.5
  },
  md: {
    padding: "14px 28px",
    fontSize: 11.5
  },
  lg: {
    padding: "17px 34px",
    fontSize: 12
  }
};

/* Píldora siempre. El peach NUNCA carga texto (blanco 2.56:1, ink 3.96:1 — ambos fallan):
   el CTA cálido es tinte peach + borde peach + texto ink. Máximo un primario por vista. */
function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  uppercase = true,
  disabled = false,
  loading = false,
  full = false,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const off = disabled || loading;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--s-2)",
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    letterSpacing: "var(--tr-wide)",
    textTransform: uppercase ? "uppercase" : "none",
    border: "none",
    borderRadius: "var(--r-pill)",
    cursor: off ? "not-allowed" : "pointer",
    width: full ? "100%" : "auto",
    whiteSpace: "nowrap",
    transition: "background var(--d-fast) var(--ease), box-shadow var(--d-fast) var(--ease), transform var(--d-fast) var(--ease)",
    transform: press && !off ? "scale(0.98)" : "none"
  };
  const v = VARIANTS[variant] || VARIANTS.primary;
  const offStyle = off ? {
    background: "var(--divider)",
    color: "var(--fg-subtle)",
    boxShadow: "none"
  } : null;
  const hoverStyle = hover && !off && variant !== "text" ? {
    boxShadow: "var(--shadow-sm)" + (v.boxShadow !== "none" ? ", " + v.boxShadow : ""),
    filter: "brightness(0.94)"
  } : null;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: off,
    onClick: off ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      ...base,
      ...SIZES[size],
      ...v,
      ...offStyle,
      ...hoverStyle,
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 13,
      height: 13,
      borderRadius: "50%",
      border: "1.75px solid color-mix(in oklab, currentColor 26%, transparent)",
      borderTopColor: "var(--color-peach-neon)",
      animation: "sa-spin 720ms linear infinite"
    }
  }) : icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : null, children, iconRight && !loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: 16
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/* La card es la unidad de información por defecto, sobre todo en móvil. */
function Card({
  children,
  variant = "elevated",
  size = "md",
  pad,
  onClick,
  href,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const interactive = variant === "interactive" || !!onClick || !!href;
  const radius = size === "lg" ? "var(--r-xl)" : "var(--r-md)";
  const flat = variant === "flat";
  const base = {
    background: "var(--surface)",
    borderRadius: radius,
    padding: pad != null ? pad : "var(--s-4)",
    boxShadow: flat ? "inset 0 0 0 1px var(--color-ink-08)" : hover && interactive ? "var(--shadow-md)" : "var(--shadow-sm)",
    transform: hover && interactive ? "translateY(-3px)" : "none",
    transition: "box-shadow var(--d-med) var(--ease), transform var(--d-med) var(--ease)",
    cursor: interactive ? "pointer" : "default",
    boxSizing: "border-box",
    textDecoration: "none",
    color: "var(--fg)",
    display: "block"
  };
  const Tag = href ? "a" : "div";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href,
    onClick: onClick,
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false),
    style: {
      ...base,
      ...style
    }
  }, rest), children);
}

/* Media superior con esquinas top-rounded + bloque de contenido. */
function CardMedia({
  src,
  alt = "",
  height = 200,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--r-card-top)",
      overflow: "hidden",
      height,
      background: "var(--bg-alt)",
      position: "relative",
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Card, CardMedia });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/DomainBadge.jsx
try { (() => {
const DOMAIN_CATEGORIES = ["limpieza-tradicional", "limpieza-profunda", "mantenimiento", "nuevo-producto", "ajuste", "danos", "supervision", "cancelacion", "wifi"];
const LABELS = {
  "limpieza-tradicional": "Limpieza tradicional",
  "limpieza-profunda": "Limpieza profunda",
  "mantenimiento": "Mantenimiento",
  "nuevo-producto": "Nuevo producto",
  "ajuste": "Ajuste",
  "danos": "Daños",
  "supervision": "Supervisión",
  "cancelacion": "Cancelación",
  "wifi": "Wi-Fi"
};

/* CAPA DE DOMINIO de la EPI App: hereda forma y tipo del core, pero sus colores
   viven en tokens/domain.css. Guest y Dashboard NO cargan esta capa. */
function DomainBadge({
  category,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)",
      padding: "4px 10px",
      borderRadius: "var(--r-pill)",
      background: "var(--dom-" + category + "-bg)",
      color: "var(--dom-" + category + "-fg)",
      whiteSpace: "nowrap",
      ...style
    }
  }, children || LABELS[category] || category);
}
Object.assign(__ds_scope, { DOMAIN_CATEGORIES, DomainBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/DomainBadge.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Label en mayúsculas, tracking 0.32em. El susurro sobre el titular. */
function Eyebrow({
  children,
  as = "div",
  color = "var(--fg-muted)",
  style,
  ...rest
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color,
      ...style
    }
  }, rest), children);
}

/* Cabecera de sección editorial: eyebrow + titular serif + subtítulo. */
function SectionHead({
  eyebrow,
  title,
  sub,
  right,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: "var(--s-4)",
      flexWrap: "wrap",
      marginBottom: "var(--s-4)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, eyebrow ? /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: "var(--s-2)"
    }
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: "clamp(24px,3.2vw,34px)",
      lineHeight: "var(--lh-heading)",
      letterSpacing: "var(--tr-tight)",
      color: "var(--fg)",
      margin: 0,
      textWrap: "balance"
    }
  }, title), sub ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      lineHeight: "var(--lh-body)",
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg-muted)",
      margin: "10px 0 0",
      maxWidth: 520,
      textWrap: "pretty"
    }
  }, sub) : null), right);
}
Object.assign(__ds_scope, { Eyebrow, SectionHead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Farol.jsx
try { (() => {
const SCALE = {
  success: {
    fg: "var(--color-success)",
    bg: "var(--color-success-tint)"
  },
  attention: {
    fg: "var(--attention-text)",
    bg: "var(--attention-tint)",
    dot: "var(--attention)"
  },
  warning: {
    fg: "var(--color-warning)",
    bg: "var(--color-warning-tint)"
  },
  error: {
    fg: "var(--color-error)",
    bg: "var(--color-error-tint)"
  },
  info: {
    fg: "var(--color-info)",
    bg: "var(--color-info-tint)"
  },
  pending: {
    fg: "var(--color-pending)",
    bg: "var(--color-pending-tint)"
  }
};

/* Escala única de estados de las 3 apps.
   El peach vive aquí como "attention" — algo que merece la mirada, no una falla.
   El rojo queda para la excepción que exige acción. */
function Farol({
  state = "pending",
  children,
  dotOnly = false,
  label,
  style
}) {
  const c = SCALE[state] || SCALE.pending;
  const dot = /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: c.dot || "currentColor",
      flexShrink: 0
    }
  });
  if (dotOnly) {
    return /*#__PURE__*/React.createElement("span", {
      role: "img",
      "aria-label": label || state,
      title: label || state,
      style: {
        display: "inline-flex",
        color: c.fg,
        ...style
      }
    }, dot);
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--s-2)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-small)",
      fontWeight: 600,
      letterSpacing: "var(--tr-wide)",
      padding: "var(--s-1) var(--s-3)",
      borderRadius: "var(--r-pill)",
      color: c.fg,
      background: c.bg,
      whiteSpace: "nowrap",
      ...style
    }
  }, dot, children);
}
Object.assign(__ds_scope, { Farol });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Farol.jsx", error: String((e && e.message) || e) }); }

// components/core/JobCard.jsx
try { (() => {
const EDGE = {
  success: "var(--color-success)",
  attention: "var(--attention)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
  pending: "var(--color-pending)"
};

/* Card de trabajo de la EPI App: filete de estado a la izquierda, badge de categoría,
   propiedad en serif, descripción, técnico, total y farol de pago. Es la presentación
   móvil de la tabla de trabajos (regla de densidad: cards en teléfono). */
function JobCard({
  property,
  category,
  description,
  date,
  technician,
  amount,
  currency = "GTQ",
  state = "pending",
  statusLabel,
  payer,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    variant: onClick ? "interactive" : "elevated",
    pad: "var(--s-3)",
    onClick: onClick,
    style: {
      borderLeft: "3px solid " + (EDGE[state] || EDGE.pending),
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--s-3)",
      flexWrap: "wrap"
    }
  }, category ? /*#__PURE__*/React.createElement(__ds_scope.DomainBadge, {
    category: category
  }) : null, date ? /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)"
    }
  }, date) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 500,
      fontSize: 20,
      lineHeight: 1.2,
      color: "var(--fg)",
      marginTop: 10
    }
  }, property), description ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      lineHeight: 1.6,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)",
      margin: "6px 0 0"
    }
  }, description) : null, /*#__PURE__*/React.createElement("hr", {
    style: {
      border: 0,
      borderTop: "1px solid var(--divider)",
      margin: "14px 0 12px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "var(--s-3)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, technician ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9.5,
      fontWeight: 600,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, "T\xE9cnico"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg)",
      marginTop: 4
    }
  }, technician)) : null, payer ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      marginTop: 10,
      fontFamily: "var(--font-sans)",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)",
      padding: "4px 10px",
      borderRadius: "var(--r-pill)",
      background: "var(--dom-mantenimiento-bg)",
      color: "var(--dom-mantenimiento-fg)"
    }
  }, payer) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8
    }
  }, amount != null ? /*#__PURE__*/React.createElement(__ds_scope.Amount, {
    value: amount,
    currency: currency,
    size: 22,
    decimals: false
  }) : null, statusLabel ? /*#__PURE__*/React.createElement(__ds_scope.Farol, {
    state: state
  }, statusLabel) : null)));
}
Object.assign(__ds_scope, { JobCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/JobCard.jsx", error: String((e && e.message) || e) }); }

// components/core/PropertyCard.jsx
try { (() => {
/* Card de propiedad: media con brushstroke + bloque editorial. */
function PropertyCard({
  image,
  location,
  name,
  meta,
  status,
  state = "success",
  base = "",
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    variant: onClick ? "interactive" : "elevated",
    pad: 0,
    onClick: onClick,
    style: {
      overflow: "visible",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Brushstroke, {
    base: base,
    src: image,
    alt: name,
    height: 190
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 20px 20px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, null, location), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: 22,
      lineHeight: 1.15,
      letterSpacing: "var(--tr-tight)",
      color: "var(--fg)",
      margin: "8px 0 0"
    }
  }, name), /*#__PURE__*/React.createElement("hr", {
    style: {
      border: 0,
      borderTop: "1px solid var(--divider)",
      margin: "14px 0 12px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg-muted)"
    }
  }, meta), status ? /*#__PURE__*/React.createElement(__ds_scope.Farol, {
    state: state
  }, status) : null)));
}
Object.assign(__ds_scope, { PropertyCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/PropertyCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Calendar.jsx
try { (() => {
const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const STATE = {
  success: "var(--color-success)",
  attention: "var(--attention)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
  pending: "var(--color-pending)"
};

/* Calendario mensual de EPI: celdas radio --r-sm, día en tabular,
   estado del día por farol (punto), hoy = borde --accent, seleccionado = fondo --fg. */
function Calendar({
  year,
  month,
  days = {},
  selected,
  today,
  onSelect,
  style
}) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(d);
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      gap: 4,
      marginBottom: 6
    }
  }, DOW.map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      textAlign: "center",
      fontFamily: "var(--font-sans)",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "var(--tr-eyebrow)",
      color: "var(--fg-muted)"
    }
  }, d))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      gap: 4
    }
  }, cells.map((d, i) => {
    if (d == null) return /*#__PURE__*/React.createElement("span", {
      key: i
    });
    const st = days[d];
    const isSel = selected === d;
    const isToday = today === d;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      onClick: () => onSelect && onSelect(d),
      style: {
        aspectRatio: "1",
        borderRadius: "var(--r-sm)",
        cursor: onSelect ? "pointer" : "default",
        border: isToday ? "1.5px solid var(--accent)" : "1px solid transparent",
        background: isSel ? "var(--fg)" : "var(--bg-alt)",
        color: isSel ? "var(--fg-inverse)" : "var(--fg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        transition: "background var(--d-fast) var(--ease)",
        padding: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "t-num",
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: isSel ? 600 : 500
      }
    }, d), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: st ? STATE[st] : "transparent"
      }
    }));
  })));
}
Object.assign(__ds_scope, { Calendar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Calendar.jsx", error: String((e && e.message) || e) }); }

// components/data/Donut.jsx
try { (() => {
/* Ink para la rebanada base, peach para LA que importa, neutros cálidos para el resto. */
const PALETTE = ["var(--series-1)", "var(--series-accent)", "var(--series-6)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

/* Distribución en anillo + filas de leyenda con % y monto ("¿A dónde fue el dinero?"). */
function Donut({
  data = [],
  size = 220,
  total,
  totalLabel,
  legend = true,
  style
}) {
  const sum = data.reduce((a, d) => a + (d.value || 0), 0) || 1;
  const r = size / 2 - 16,
    c = 2 * Math.PI * r;
  let acc = 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--s-5)",
      flexWrap: "wrap",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    role: "img"
  }, data.map((d, i) => {
    const frac = (d.value || 0) / sum;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: size / 2,
      cy: size / 2,
      r: r,
      fill: "none",
      stroke: d.color || PALETTE[i % PALETTE.length],
      strokeWidth: "26",
      strokeDasharray: c * frac + " " + c * (1 - frac),
      strokeDashoffset: -c * acc,
      transform: "rotate(-90 " + size / 2 + " " + size / 2 + ")",
      style: {
        transition: "stroke-dasharray var(--d-slow) var(--ease)"
      }
    });
    acc += frac;
    return el;
  })), total != null ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: size * 0.13,
      letterSpacing: "-0.02em",
      color: "var(--fg)"
    }
  }, total), totalLabel ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, totalLabel) : null) : null), legend ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--s-3)",
      padding: "12px 0",
      borderTop: i ? "1px solid var(--color-ink-08)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: "50%",
      background: d.color || PALETTE[i % PALETTE.length],
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg)"
    }
  }, d.label), /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)"
    }
  }, Math.round((d.value || 0) / sum * 100), "% del total"), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 96,
      textAlign: "right"
    }
  }, d.amount)))) : null);
}
Object.assign(__ds_scope, { Donut });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Donut.jsx", error: String((e && e.message) || e) }); }

// components/data/KpiCard.jsx
try { (() => {
/* KPI editorial: el número manda, el contexto susurra.
   Números SIEMPRE en Montserrat tabular (.t-num). */
function KpiCard({
  label,
  value,
  help,
  trend,
  invert = false,
  accent = false,
  big = false,
  footer,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    variant: "elevated",
    pad: big ? 26 : 20,
    style: {
      display: "flex",
      flexDirection: "column",
      minHeight: big ? 150 : 120,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--s-2)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    style: {
      letterSpacing: "0.2em"
    }
  }, label), accent ? /*#__PURE__*/React.createElement(__ds_scope.Sparkle, {
    size: 12
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--s-2)",
      marginTop: big ? 16 : 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: big ? 42 : 30,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      color: "var(--fg)"
    }
  }, value), trend != null ? /*#__PURE__*/React.createElement(Trend, {
    value: trend,
    invert: invert
  }) : null), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--s-3)"
    }
  }, footer) : null, help ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11.5,
      letterSpacing: "var(--tr-normal)",
      lineHeight: 1.5,
      color: "var(--fg-muted)",
      margin: "auto 0 0",
      paddingTop: "var(--s-3)",
      textWrap: "pretty"
    }
  }, help) : null);
}

/* Chip de variación. Mejora = verde · deterioro = ATENCIÓN (peach), no rojo:
   un mes a la baja es información, no una falla. `critical` sube a rojo cuando
   la caída sí exige acción. La flecha va en peach neón y el número en el tono
   accesible, para que el chip se lea peach de un vistazo sin perder AA. */
function Trend({
  value = 0,
  suffix = "%",
  invert = false,
  muted = false,
  critical = false
}) {
  const up = value >= 0;
  const good = invert ? !up : up;
  const bad = critical ? "var(--color-error)" : "var(--attention-text)";
  const color = muted ? "var(--fg-muted)" : good ? "var(--color-success)" : bad;
  const glyph = muted || good || critical ? color : "var(--attention)";
  return /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "var(--font-sans)",
      fontSize: 11.5,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)",
      color
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: up ? "trendUp" : "trendDown",
    size: 13,
    color: glyph
  }), (up ? "+" : "−") + Math.abs(value).toLocaleString("es-GT", {
    maximumFractionDigits: 1
  }) + suffix);
}
Object.assign(__ds_scope, { KpiCard, Trend });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KpiCard.jsx", error: String((e && e.message) || e) }); }

// components/data/LineChart.jsx
try { (() => {
const {
  useState
} = React;
/* Jerarquía, no paleta categórica: la serie base va en ink y UNA serie va en peach.
   El peach dice "mira esto". El resto son neutros cálidos. */
const SERIES = ["var(--series-1)", "var(--series-accent)", "var(--series-2)", "var(--series-3)", "var(--series-6)", "var(--series-4)"];

/* Curva Catmull-Rom → Bézier: las líneas de Spacio AM son suaves, nunca quebradas. */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = "M" + pts[0][0] + " " + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] || p2;
    const t = 0.22;
    d += " C" + (p1[0] + (p2[0] - p0[0]) * t) + " " + (p1[1] + (p2[1] - p0[1]) * t) + " " + (p2[0] - (p3[0] - p1[0]) * t) + " " + (p2[1] - (p3[1] - p1[1]) * t) + " " + p2[0] + " " + p2[1];
  }
  return d;
}
function LineChart({
  series = [],
  labels = [],
  height = 260,
  formatY = v => v,
  formatTip,
  style
}) {
  const [hover, setHover] = useState(null);
  const all = series.flatMap(s => s.values || []);
  const max = Math.max(1, ...all) * 1.08,
    min = 0;
  const W = 680,
    H = height,
    padL = 52,
    padB = 30,
    padT = 14,
    padR = 14;
  const n = Math.max(1, ...series.map(s => (s.values || []).length));
  const x = i => padL + i * (W - padL - padR) / Math.max(1, n - 1);
  const y = v => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + t * (max - min));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 " + W + " " + H,
    width: "100%",
    height: height,
    role: "img",
    onMouseLeave: () => setHover(null),
    onMouseMove: e => {
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * W;
      const i = Math.round((px - padL) / (W - padL - padR) * (n - 1));
      setHover(i >= 0 && i < n ? i : null);
    },
    style: {
      display: "block",
      overflow: "visible"
    }
  }, /*#__PURE__*/React.createElement("defs", null, series.map((s, si) => {
    const color = s.color || SERIES[si % SERIES.length];
    return /*#__PURE__*/React.createElement("linearGradient", {
      key: si,
      id: "sa-g" + si,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: color,
      stopOpacity: s.accent ? 0.20 : 0.10
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: color,
      stopOpacity: "0"
    }));
  })), ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: W - padR,
    y1: y(t),
    y2: y(t),
    stroke: "var(--divider)",
    strokeWidth: "1",
    opacity: i ? 0.5 : 1
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 12,
    y: y(t) + 4,
    textAnchor: "end",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 10,
      letterSpacing: "0.06em",
      fill: "var(--fg-muted)"
    }
  }, formatY(t)))), series.map((s, si) => {
    const vals = s.values || [];
    const color = s.color || SERIES[si % SERIES.length];
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const d = smoothPath(pts);
    const area = d + " L" + x(vals.length - 1) + " " + y(min) + " L" + x(0) + " " + y(min) + " Z";
    return /*#__PURE__*/React.createElement("g", {
      key: si
    }, s.fill !== false ? /*#__PURE__*/React.createElement("path", {
      d: area,
      fill: "url(#sa-g" + si + ")"
    }) : null, /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: color,
      strokeWidth: s.accent ? 2.6 : 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }));
  }), hover != null ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: x(hover),
    x2: x(hover),
    y1: padT,
    y2: H - padB,
    stroke: "var(--divider)",
    strokeWidth: "1"
  }), series.map((s, si) => {
    const v = (s.values || [])[hover];
    if (v == null) return null;
    const color = s.color || SERIES[si % SERIES.length];
    return /*#__PURE__*/React.createElement("circle", {
      key: si,
      cx: x(hover),
      cy: y(v),
      r: "5",
      fill: "var(--surface)",
      stroke: color,
      strokeWidth: "2.5"
    });
  })) : null, labels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: x(i),
    y: H - 8,
    textAnchor: "middle",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 10,
      letterSpacing: "var(--tr-wide)",
      fill: hover === i ? "var(--fg)" : "var(--fg-muted)"
    }
  }, l))), hover != null ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "calc(" + x(hover) / W * 100 + "% + 14px)",
      top: 18,
      background: "var(--surface)",
      borderRadius: "var(--r-md)",
      boxShadow: "var(--shadow-md)",
      padding: "12px 14px",
      pointerEvents: "none",
      minWidth: 150,
      zIndex: 5,
      transform: hover > n / 2 ? "translateX(calc(-100% - 28px))" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
      marginBottom: 9
    }
  }, labels[hover]), series.map((s, si) => {
    const v = (s.values || [])[hover];
    if (v == null) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: si,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        marginTop: si ? 7 : 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: s.color || SERIES[si % SERIES.length],
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        letterSpacing: "var(--tr-normal)",
        color: "var(--fg-muted)",
        flex: 1
      }
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "t-num",
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--fg)"
      }
    }, formatTip ? formatTip(v) : formatY(v)));
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--s-4)",
      flexWrap: "wrap",
      marginTop: "var(--s-3)"
    }
  }, series.map((s, si) => /*#__PURE__*/React.createElement("span", {
    key: si,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 4,
      borderRadius: 2,
      background: s.color || SERIES[si % SERIES.length]
    }
  }), s.name))));
}

/* Anillo de porcentaje. accent lo pinta en peach cuando el dato ES el protagonista. */
function Gauge({
  value = 0,
  size = 200,
  label,
  sub,
  accent = false,
  style
}) {
  const r = size / 2 - 12,
    c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size,
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    role: "img",
    "aria-label": pct + "%"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--bg-alt)",
    strokeWidth: "12"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: accent ? "var(--accent)" : "var(--fg)",
    strokeWidth: "12",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - pct / 100),
    transform: "rotate(-90 " + size / 2 + " " + size / 2 + ")",
    style: {
      transition: "stroke-dashoffset var(--d-slow) var(--ease)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: size * 0.2,
      letterSpacing: "-0.02em",
      color: "var(--fg)",
      lineHeight: 1
    }
  }, label != null ? label : pct + "%"), sub ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9.5,
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, sub) : null));
}

/* Columnas. La barra destacada va en peach: es el "mira esto" del gráfico. */
function BarChart({
  data = [],
  height = 200,
  suffix = "%",
  style
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: "var(--s-2)",
      height,
      ...style
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      height: "100%",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 10.5,
      fontWeight: 600,
      color: d.highlight ? "var(--fg)" : "var(--fg-muted)"
    }
  }, Math.round(d.value) + suffix), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 34,
      height: d.value / max * (height - 52),
      background: d.highlight ? "var(--accent)" : "var(--bg-alt)",
      borderRadius: "var(--r-sm) var(--r-sm) 0 0",
      boxShadow: d.highlight ? "none" : "inset 0 0 0 1px var(--color-ink-08)",
      transition: "height var(--d-slow) var(--ease)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, d.label))));
}
Object.assign(__ds_scope, { SERIES, LineChart, Gauge, BarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/LineChart.jsx", error: String((e && e.message) || e) }); }

// components/data/SummaryTable.jsx
try { (() => {
/* Tabla-resumen: SOLO escritorio denso (admin, configuración).
   Colapsa a cards por debajo de --bp-md — pásale collapse para renderizar la vista de cards. */
function SummaryTable({
  columns = [],
  rows = [],
  collapse = false,
  empty = "Sin datos para este periodo.",
  style
}) {
  if (collapse) {
    if (!rows.length) return /*#__PURE__*/React.createElement("p", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        color: "var(--fg-muted)"
      }
    }, empty);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        ...style
      }
    }, rows.map((r, i) => /*#__PURE__*/React.createElement(__ds_scope.Card, {
      key: i,
      variant: "flat",
      pad: "var(--s-3)"
    }, columns.map((c, j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--s-3)",
        padding: "5px 0"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: "var(--t-eyebrow)",
        letterSpacing: "var(--tr-eyebrow)",
        textTransform: "uppercase",
        color: "var(--fg-muted)"
      }
    }, c.header), /*#__PURE__*/React.createElement("span", {
      className: c.num ? "t-num" : undefined,
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        fontWeight: j === 0 ? 600 : 400,
        color: "var(--fg)"
      }
    }, r[c.key]))))));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, j) => /*#__PURE__*/React.createElement("th", {
    key: j,
    style: {
      position: "sticky",
      top: 0,
      background: "var(--bg-alt)",
      textAlign: c.num ? "right" : "left",
      fontSize: "var(--t-eyebrow)",
      fontWeight: 600,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
      padding: "12px 14px",
      whiteSpace: "nowrap"
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.length ? rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, columns.map((c, j) => /*#__PURE__*/React.createElement("td", {
    key: j,
    className: c.num ? "t-num" : undefined,
    style: {
      borderTop: "1px solid var(--color-ink-08)",
      padding: "13px 14px",
      fontSize: 12.5,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg)",
      textAlign: c.num ? "right" : "left",
      fontWeight: j === 0 ? 500 : 400
    }
  }, r[c.key])))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    style: {
      borderTop: "1px solid var(--color-ink-08)",
      padding: "22px 14px",
      fontSize: 12.5,
      color: "var(--fg-muted)",
      textAlign: "center"
    }
  }, empty)))));
}
Object.assign(__ds_scope, { SummaryTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SummaryTable.jsx", error: String((e && e.message) || e) }); }

// components/email/EmailLayout.jsx
try { (() => {
/* Sistema de correo basado en el template de EPI. Los tokens NO viven como var() en email:
   se compilan a hex. Esta es la paleta compilada — misma marca, estilos inline. */
const EMAIL_HEX = {
  ink: "#3E3F3F",
  alabaster: "#FAFAFA",
  beige: "#F5F3F0",
  graphite: "#6F6867",
  warmGrey: "#D8D4CE",
  peach: "#E9826A",
  peachNeon: "#F2755A",
  white: "#FFFFFF"
};

/* Cabecera con logo, cuerpo Montserrat, botón primario ink, acentos peach gráficos, pie en graphite. */
function EmailLayout({
  preheader,
  logo,
  band,
  eyebrow,
  title,
  children,
  cta,
  ctaHref = "#",
  footer,
  width = 600
}) {
  const H = EMAIL_HEX;
  const cell = {
    fontFamily: "Montserrat, Helvetica, Arial, sans-serif",
    letterSpacing: "0.06em"
  };
  return /*#__PURE__*/React.createElement("table", {
    role: "presentation",
    cellPadding: "0",
    cellSpacing: "0",
    style: {
      width: "100%",
      background: H.beige,
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    align: "center",
    style: {
      padding: "28px 16px"
    }
  }, preheader ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "none",
      fontSize: 1,
      color: H.beige
    }
  }, preheader) : null, /*#__PURE__*/React.createElement("table", {
    role: "presentation",
    cellPadding: "0",
    cellSpacing: "0",
    style: {
      width: width,
      maxWidth: "100%",
      background: H.white,
      borderCollapse: "collapse",
      borderRadius: 14,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    align: "center",
    style: {
      padding: "26px 32px 18px",
      borderBottom: "1px solid " + H.warmGrey
    }
  }, logo ? /*#__PURE__*/React.createElement("img", {
    src: logo,
    alt: "Spacio AM",
    width: "150",
    style: {
      display: "block",
      border: 0
    }
  }) : null)), band ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("img", {
    src: band,
    alt: "",
    width: width,
    style: {
      display: "block",
      width: "100%",
      height: "auto",
      border: 0
    }
  }))) : null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "30px 32px 8px"
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...cell,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      color: H.graphite,
      marginBottom: 12
    }
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontWeight: 400,
      fontSize: 28,
      lineHeight: 1.15,
      color: H.ink,
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 2,
      background: H.peach,
      margin: "18px 0 0"
    }
  }))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      ...cell,
      padding: "16px 32px 6px",
      fontSize: 14,
      lineHeight: 1.75,
      color: H.graphite
    }
  }, children)), cta ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "22px 32px 30px"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: ctaHref,
    style: {
      ...cell,
      display: "inline-block",
      background: H.ink,
      color: H.alabaster,
      textDecoration: "none",
      padding: "14px 28px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.2em",
      textTransform: "uppercase"
    }
  }, cta))) : null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      ...cell,
      padding: "20px 32px 26px",
      borderTop: "1px solid " + H.warmGrey,
      fontSize: 10.5,
      lineHeight: 1.7,
      color: H.graphite,
      letterSpacing: "0.14em"
    }
  }, footer || "Spacio AM · Guatemala · hola@spacioam.com"))))))));
}
Object.assign(__ds_scope, { EMAIL_HEX, EmailLayout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/email/EmailLayout.jsx", error: String((e && e.message) || e) }); }

// components/feedback/LoadingScreen.jsx
try { (() => {
/* Loader inicial canónico del sistema (del Dashboard). EPI y Guest se alinean a este.
   Respeta prefers-reduced-motion vía tokens/motion.css. */
function LoadingScreen({
  base = "",
  label,
  variant = "stamp",
  full = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: full ? "absolute" : "relative",
      inset: full ? 0 : undefined,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--s-4)",
      background: "var(--bg)",
      minHeight: full ? undefined : 240,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      animation: "sa-bounce 1.5s var(--ease) infinite"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    variant: variant,
    height: variant === "primary" ? 64 : 72,
    base: base
  })), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 46,
      height: 5,
      borderRadius: "var(--r-pill)",
      background: "var(--divider)",
      animation: "sa-shadow 1.5s var(--ease) infinite"
    }
  }), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, label) : null);
}

/* Skeleton localizado: nunca dejes un control vacío sin feedback. */
function Skeleton({
  height = 14,
  width = "100%",
  radius = "var(--r-sm)",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "block",
      height,
      width,
      borderRadius: radius,
      background: "var(--bg-alt)",
      ...style
    }
  });
}
Object.assign(__ds_scope, { LoadingScreen, Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/LoadingScreen.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
const {
  useEffect
} = React;
/* Template estándar de EPI: overlay ink 55% + blur 4, panel radio 28, sombra lg.
   Cierra con Esc y con click en el overlay. En móvil puede subir como hoja inferior. */
function Modal({
  open = true,
  title,
  children,
  actions,
  onClose,
  sheet = false,
  width = 480,
  sparkle = false
}) {
  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    },
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 500,
      background: "var(--overlay)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      display: "grid",
      placeItems: sheet ? "end center" : "center",
      padding: sheet ? 0 : "var(--s-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: sheet ? "100%" : "min(" + width + "px, 94%)",
      background: "var(--surface)",
      borderRadius: sheet ? "var(--r-card-top)" : "var(--r-xl)",
      padding: "var(--s-5)",
      boxShadow: "var(--shadow-lg)",
      position: "relative",
      maxHeight: "86%",
      overflowY: "auto",
      animation: "sa-rise var(--d-med) var(--ease) both"
    }
  }, onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Cerrar",
    style: {
      position: "absolute",
      top: 18,
      right: 18,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--fg-muted)",
      padding: 4,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  })) : null, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      marginBottom: "var(--s-3)",
      paddingRight: 28
    }
  }, sparkle ? /*#__PURE__*/React.createElement(__ds_scope.Sparkle, {
    size: 13
  }) : null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 500,
      fontSize: "var(--t-h3)",
      lineHeight: "var(--lh-heading)",
      color: "var(--fg)",
      margin: 0
    }
  }, title)) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      lineHeight: "var(--lh-body)",
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg-muted)"
    }
  }, children), actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "var(--s-2)",
      marginTop: "var(--s-5)",
      flexWrap: "wrap"
    }
  }, actions) : null));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
const DENSITY = {
  compact: "10px 14px",
  comfortable: "14px 16px"
};

/* Default = caja. La variante subrayada (editorial) se reserva a hero/marketing/onboarding. */
function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  helper,
  error,
  variant = "box",
  density = "comfortable",
  disabled = false,
  loading = false,
  icon,
  trailing,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const underline = variant === "underline";
  const borderColor = error ? "var(--color-error)" : focus ? "var(--fg)" : "var(--divider)";
  const field = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--t-body)",
    letterSpacing: "var(--tr-normal)",
    color: "var(--fg)",
    padding: underline ? "10px 0" : DENSITY[density],
    paddingLeft: icon && !underline ? 42 : undefined,
    background: disabled ? "var(--bg-alt)" : underline ? "transparent" : "var(--surface)",
    border: underline ? "none" : "1px solid " + borderColor,
    borderBottom: underline ? "1px solid " + (error ? "var(--color-error)" : "var(--fg)") : undefined,
    borderRadius: underline ? 0 : "var(--r-md)",
    outline: "none",
    boxShadow: focus ? "var(--focus-ring)" : "none",
    transition: "border-color var(--d-fast) var(--ease), box-shadow var(--d-fast) var(--ease)"
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--s-2)",
      width: "100%",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, icon && !underline ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 15,
      color: "var(--fg-muted)",
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18
  })) : null, loading ? /*#__PURE__*/React.createElement("span", {
    style: {
      ...field,
      height: 48,
      background: "var(--bg-alt)",
      animation: "sa-fade var(--d-med) var(--ease)"
    }
  }) : /*#__PURE__*/React.createElement("input", _extends({
    id: id,
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange ? e => onChange(e.target.value) : undefined,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: field
  }, rest)), trailing ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 12,
      display: "flex",
      color: "var(--fg-muted)"
    }
  }, trailing) : null), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      letterSpacing: "var(--tr-normal)",
      color: "var(--color-error)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "alert",
    size: 13
  }), error) : helper ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)"
    }
  }, helper) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState,
  useRef,
  useEffect
} = React;
/* Select editorial: disparador píldora + panel radio lg. Usado en el chrome del Dashboard. */
function Select({
  value,
  options = [],
  onChange,
  icon,
  label,
  align = "left",
  minWidth = 200,
  disabled = false,
  style
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find(o => o.value === value);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "relative",
      display: "inline-block",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
      marginBottom: "var(--s-2)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: () => setOpen(o => !o),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? "var(--bg-alt)" : "var(--bg)",
      border: "1px solid var(--color-ink-08)",
      borderRadius: "var(--r-pill)",
      padding: "10px 14px 10px 16px",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "var(--tr-normal)",
      color: disabled ? "var(--fg-subtle)" : "var(--fg)",
      boxShadow: "var(--shadow-xs)",
      minWidth
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15,
    color: "var(--fg-muted)"
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: "left"
    }
  }, cur ? cur.label : "—"), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevronDown",
    size: 14,
    color: "var(--fg-muted)",
    style: {
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform var(--d-fast) var(--ease)"
    }
  })), open ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "calc(100% + 8px)",
      [align]: 0,
      zIndex: 60,
      minWidth,
      background: "var(--bg)",
      border: "1px solid var(--color-ink-08)",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-md)",
      padding: 6,
      maxHeight: 320,
      overflowY: "auto",
      animation: "sa-fade var(--d-fast) var(--ease)"
    }
  }, options.map(o => {
    const active = o.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      type: "button",
      onClick: () => {
        onChange && onChange(o.value);
        setOpen(false);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        background: active ? "var(--bg-alt)" : "transparent",
        borderRadius: "var(--r-sm)",
        padding: "11px 12px",
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        letterSpacing: "var(--tr-normal)",
        color: "var(--fg)",
        fontWeight: active ? 500 : 400
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", null, o.label), o.sub ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: "var(--fg-muted)"
      }
    }, o.sub) : null), active ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 15,
      color: "var(--accent)"
    }) : null);
  })) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Toggle.jsx
try { (() => {
/* Pista 36x20 píldora: --fg encendido, --divider apagado. */
function Toggle({
  checked = false,
  onChange,
  label,
  disabled = false,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--s-3)",
      cursor: disabled ? "not-allowed" : "pointer",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": checked,
    tabIndex: disabled ? -1 : 0,
    onClick: () => !disabled && onChange && onChange(!checked),
    onKeyDown: e => {
      if ((e.key === " " || e.key === "Enter") && !disabled) {
        e.preventDefault();
        onChange && onChange(!checked);
      }
    },
    style: {
      width: 36,
      height: 20,
      borderRadius: "var(--r-pill)",
      flexShrink: 0,
      background: disabled ? "var(--bg-alt)" : checked ? "var(--fg)" : "var(--divider)",
      position: "relative",
      transition: "background var(--d-fast) var(--ease)",
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: checked ? 18 : 2,
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: "var(--surface)",
      boxShadow: "var(--shadow-xs)",
      transition: "left var(--d-fast) var(--ease)"
    }
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      letterSpacing: "var(--tr-wide)",
      color: disabled ? "var(--fg-subtle)" : "var(--fg)"
    }
  }, label) : null);
}

/* Checkbox: radio --r-sm, borde 1.5px, check con ícono 1.5. */
function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--s-3)",
      cursor: disabled ? "not-allowed" : "pointer",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "checkbox",
    "aria-checked": checked,
    tabIndex: disabled ? -1 : 0,
    onClick: () => !disabled && onChange && onChange(!checked),
    onKeyDown: e => {
      if ((e.key === " " || e.key === "Enter") && !disabled) {
        e.preventDefault();
        onChange && onChange(!checked);
      }
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: "var(--r-sm)",
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      border: "1.5px solid " + (disabled ? "var(--divider)" : checked ? "var(--fg)" : "var(--divider)"),
      background: disabled ? "var(--bg-alt)" : checked ? "var(--fg)" : "transparent",
      transition: "background var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease)"
    }
  }, checked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13,
    color: "var(--fg-inverse)"
  }) : null), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      letterSpacing: "var(--tr-wide)",
      color: disabled ? "var(--fg-subtle)" : "var(--fg)"
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Toggle, Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Bento.jsx
try { (() => {
/* Bento de la Guest App: pantalla de inicio / lanzador y cara visual de marca.
   2 columnas en móvil → 4 desde --bp-md. NO es la navegación permanente. */
function Bento({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2,1fr)",
      gridAutoRows: "minmax(120px, auto)",
      gap: "var(--s-3)",
      gridAutoFlow: "dense",
      maxWidth: "var(--container-standard)",
      margin: "0 auto",
      ...style
    }
  }, children);
}

/* Tile: imagen (con degradado de protección) o bloque de color con label. */
function BentoTile({
  image,
  label,
  tone = "solid",
  span = 1,
  rows = 1,
  icon,
  sparkle = false,
  onClick,
  style
}) {
  const TONES = {
    solid: {
      background: "var(--bg-alt)",
      color: "var(--fg)"
    },
    ink: {
      background: "var(--fg)",
      color: "var(--fg-inverse)"
    },
    peach: {
      background: "var(--accent-tint)",
      color: "var(--fg)"
    },
    image: {
      background: "var(--bg-alt)",
      color: "var(--color-white)"
    }
  };
  const t = TONES[image ? "image" : tone];
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    style: {
      gridColumn: "span " + span,
      gridRow: "span " + rows,
      position: "relative",
      overflow: "hidden",
      border: "none",
      cursor: onClick ? "pointer" : "default",
      textAlign: "left",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-sm)",
      padding: "var(--s-3)",
      display: "flex",
      alignItems: "flex-end",
      ...t,
      ...style
    }
  }, image ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg,transparent 45%,rgba(62,63,63,.55))"
    }
  })) : null, sparkle ? /*#__PURE__*/React.createElement(__ds_scope.Sparkle, {
    size: 16,
    style: {
      position: "absolute",
      top: 12,
      right: 12
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)"
    }
  }, icon, label));
}
Object.assign(__ds_scope, { Bento, BentoTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Bento.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
/* Navegación inferior móvil. Dos formas reales del sistema:
   - "bar": barra a ancho completo con FAB peach central e ícono de casita blanco (EPI App).
   - "pill": píldora flotante con blur (Dashboard de Propietarios).
   Alturas de toque mínimo 44px. */
function BottomNav({
  items = [],
  value,
  onChange,
  variant = "bar",
  fab,
  onFab,
  style
}) {
  const pill = variant === "pill";
  const shell = pill ? {
    left: "var(--s-3)",
    right: "var(--s-3)",
    bottom: "var(--s-3)",
    borderRadius: "var(--r-pill)",
    background: "rgba(250,250,250,0.9)",
    backdropFilter: "blur(20px) saturate(120%)",
    WebkitBackdropFilter: "blur(20px) saturate(120%)",
    boxShadow: "var(--shadow-md)",
    padding: "10px var(--s-3)"
  } : {
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(250,250,250,0.94)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderTop: "1px solid var(--color-ink-08)",
    padding: "8px var(--s-3)"
  };
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "sticky",
      zIndex: 45,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      gap: 4,
      ...shell,
      ...style
    }
  }, items.map((it, i) => {
    const active = it.value === value;
    const node = /*#__PURE__*/React.createElement("button", {
      key: it.value,
      type: "button",
      onClick: () => onChange && onChange(it.value),
      style: {
        flex: 1,
        minHeight: 44,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "4px 2px",
        color: active ? "var(--fg)" : "var(--fg-muted)"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 20
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "var(--tr-wide)",
        textTransform: "uppercase",
        lineHeight: 1.2,
        textAlign: "center"
      }
    }, it.label), active ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 4,
        height: 4,
        borderRadius: "50%",
        background: "var(--accent)"
      }
    }) : null);
    if (fab && i === Math.floor(items.length / 2)) {
      return /*#__PURE__*/React.createElement(React.Fragment, {
        key: "fab" + i
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: onFab,
        "aria-label": fab.label || "Inicio",
        style: {
          width: 58,
          height: 58,
          minWidth: 58,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "var(--accent)",
          color: "var(--color-white)",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--shadow-md)",
          marginTop: -26,
          flexShrink: 0
        }
      }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
        name: fab.icon || "home",
        size: 22,
        color: "var(--color-white)"
      })), node);
    }
    return node;
  }));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Collapsible.jsx
try { (() => {
const {
  useState
} = React;
/* Patrón de EPI: minimizar todo lo que no se está usando.
   En móvil, las secciones secundarias arrancan colapsadas; en escritorio, expandidas. */
function Collapsible({
  title,
  meta,
  children,
  defaultOpen = true,
  style
}) {
  const [open, setOpen] = useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--divider)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    "aria-expanded": open,
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "var(--s-3)",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: "16px 0",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 500,
      fontSize: 20,
      lineHeight: 1.2,
      color: "var(--fg)",
      flex: 1
    }
  }, title), meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--t-eyebrow)",
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      color: "var(--fg-muted)"
    }
  }, meta) : null, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevronDown",
    size: 18,
    color: "var(--fg-muted)",
    style: {
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform var(--d-med) var(--ease)"
    }
  })), open ? /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: "var(--s-4)",
      animation: "sa-fade var(--d-med) var(--ease)"
    }
  }, children) : null);
}
Object.assign(__ds_scope, { Collapsible });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Collapsible.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Segmented.jsx
try { (() => {
/* Display de filtros: control segmentado en píldora sobre --bg-alt. */
function Segmented({
  options = [],
  value,
  onChange,
  size = "md",
  style
}) {
  const pad = size === "sm" ? "7px 12px" : "9px 16px";
  const fs = size === "sm" ? 10.5 : 11;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      padding: 3,
      background: "var(--bg-alt)",
      borderRadius: "var(--r-pill)",
      gap: 2,
      ...style
    }
  }, options.map(o => {
    const active = o.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      type: "button",
      onClick: () => onChange && onChange(o.value),
      style: {
        border: "none",
        cursor: "pointer",
        padding: pad,
        borderRadius: "var(--r-pill)",
        fontFamily: "var(--font-sans)",
        fontSize: fs,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        background: active ? "var(--bg)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        boxShadow: active ? "var(--shadow-xs)" : "none",
        transition: "all var(--d-fast) var(--ease)"
      }
    }, o.label);
  }));
}
Object.assign(__ds_scope, { Segmented });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Segmented.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabNav.jsx
try { (() => {
/* Tabs de sección de las apps de producto: etiqueta eyebrow + ícono 1.5,
   activo subrayado en --accent (el peach como filete: uso gráfico correcto).
   Dashboard: RESUMEN · GASTOS E INVERSIONES · DETALLE DEL MES · … */
function TabNav({
  tabs = [],
  value,
  onChange,
  align = "left",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid var(--color-ink-08)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--s-5)",
      overflowX: "auto",
      justifyContent: align === "center" ? "center" : "flex-start",
      scrollbarWidth: "none"
    }
  }, tabs.map(t => {
    const active = t.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      type: "button",
      onClick: () => onChange && onChange(t.value),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--s-2)",
        flexShrink: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "14px 2px 12px",
        borderBottom: "2px solid " + (active ? "var(--accent)" : "transparent"),
        marginBottom: -1,
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "var(--tr-eyebrow)",
        textTransform: "uppercase",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        transition: "color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease)"
      }
    }, t.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: t.icon,
      size: 16
    }) : null, t.label);
  })));
}

/* Tabs en píldora (chrome secundario de EPI: Dashboard · Formulario · Programa · Calidad · Adelantos). */
function PillTabs({
  tabs = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      padding: 4,
      gap: 2,
      background: "var(--bg-alt)",
      borderRadius: "var(--r-pill)",
      maxWidth: "100%",
      overflowX: "auto",
      ...style
    }
  }, tabs.map(t => {
    const active = t.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      type: "button",
      onClick: () => onChange && onChange(t.value),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        flexShrink: 0,
        border: "none",
        cursor: "pointer",
        padding: "10px 18px",
        borderRadius: "var(--r-pill)",
        background: active ? "var(--fg)" : "transparent",
        color: active ? "var(--fg-inverse)" : "var(--fg-muted)",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "var(--tr-normal)",
        transition: "all var(--d-fast) var(--ease)"
      }
    }, t.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: t.icon,
      size: 15
    }) : null, t.label);
  }));
}
Object.assign(__ds_scope, { TabNav, PillTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
/* Chrome de navegación de las apps de producto (Dashboard, EPI):
   barra superior persistente · filtro global de mes arriba-izquierda ·
   moneda + idioma arriba-derecha. */
function TopBar({
  base = "",
  month,
  months = [],
  onMonth,
  scope,
  scopes,
  onScope,
  currency,
  onCurrency,
  lang,
  onLang,
  alert,
  onAlert,
  initials,
  onAvatar,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 40,
      background: "rgba(250,250,250,0.88)",
      backdropFilter: "blur(20px) saturate(120%)",
      WebkitBackdropFilter: "blur(20px) saturate(120%)",
      borderBottom: "1px solid var(--color-ink-08)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-standard)",
      margin: "0 auto",
      padding: "12px var(--s-4)",
      display: "flex",
      alignItems: "center",
      gap: "var(--s-3)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    variant: "stacked",
    height: 48,
    base: base,
    style: {
      marginRight: "var(--s-2)"
    }
  }), scopes ? /*#__PURE__*/React.createElement(__ds_scope.Select, {
    icon: "home",
    value: scope,
    onChange: onScope,
    options: scopes,
    minWidth: 200
  }) : null, months.length ? /*#__PURE__*/React.createElement(__ds_scope.Select, {
    icon: "calendar",
    value: month,
    onChange: onMonth,
    options: months,
    minWidth: 170
  }) : null, alert ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAlert,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      border: "none",
      cursor: "pointer",
      background: "var(--accent-tint)",
      color: "var(--fg)",
      boxShadow: "inset 0 0 0 1px var(--accent)",
      borderRadius: "var(--r-pill)",
      padding: "9px 15px",
      fontFamily: "var(--font-sans)",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "var(--tr-wide)",
      textTransform: "uppercase"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "alert",
    size: 14
  }), alert) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "var(--s-2)"
    }
  }, currency ? /*#__PURE__*/React.createElement(__ds_scope.Segmented, {
    size: "sm",
    value: currency,
    onChange: onCurrency,
    options: [{
      value: "USD",
      label: "USD"
    }, {
      value: "GTQ",
      label: "GTQ"
    }]
  }) : null, lang ? /*#__PURE__*/React.createElement(__ds_scope.Segmented, {
    size: "sm",
    value: lang,
    onChange: onLang,
    options: [{
      value: "es",
      label: "ES"
    }, {
      value: "en",
      label: "EN"
    }]
  }) : null, initials ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAvatar,
    "aria-label": "Mi cuenta",
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      border: "1px solid var(--color-ink-08)",
      background: "var(--bg-alt)",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg)"
    }
  }, initials) : null)));
}

/* Nav translúcida editorial (marketing / Guest): píldora flotante con blur.
   El logo principal va a escala completa: nunca más bajo que el resto de la píldora. */
function PillNav({
  links = [],
  active,
  onSelect,
  cta,
  base = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      padding: "var(--s-4) 0",
      ...style
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--s-5)",
      padding: "8px 24px 8px 14px",
      background: "rgba(250,250,250,0.72)",
      backdropFilter: "blur(20px) saturate(120%)",
      WebkitBackdropFilter: "blur(20px) saturate(120%)",
      borderRadius: "var(--r-pill)",
      boxShadow: "var(--shadow-sm)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    variant: "monogram",
    height: 44,
    base: base
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--s-4)",
      flexWrap: "wrap"
    }
  }, links.map(l => /*#__PURE__*/React.createElement("button", {
    key: l,
    type: "button",
    onClick: () => onSelect && onSelect(l),
    style: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 10.5,
      fontWeight: 500,
      letterSpacing: "var(--tr-eyebrow)",
      textTransform: "uppercase",
      borderBottom: "2px solid " + (l === active ? "var(--accent)" : "transparent"),
      paddingBottom: 3,
      color: "var(--fg)",
      opacity: l === active ? 1 : 0.55,
      transition: "opacity var(--d-fast) var(--ease)"
    }
  }, l))), cta));
}
Object.assign(__ds_scope, { TopBar, PillNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/Adelantos.jsx
try { (() => {
const {
  Card,
  Input,
  Button,
  Collapsible,
  Farol,
  SectionHead,
  Eyebrow,
  KpiCard,
  Select
} = window.SpacioAMDesignSystem_2c08fe;
function Adelantos() {
  const D = window.EPI_DATA;
  const [monto, setMonto] = React.useState("1,000");
  const [motivo, setMotivo] = React.useState("");
  const [prop, setProp] = React.useState("luz");
  const [sent, setSent] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "epi-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Pagos",
    title: "Solicitar un adelanto",
    sub: "Se descuenta del cierre del mes. Te avisamos por correo cuando quede autorizado."
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "epi-form"
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Monto (GTQ)",
    density: "compact",
    value: monto,
    onChange: setMonto,
    icon: "coins",
    helper: "M\xE1ximo Q 2,000 por quincena."
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Propiedad",
    value: prop,
    onChange: setProp,
    minWidth: 220,
    icon: "home",
    options: [{
      value: "luz",
      label: "Casa de la Luz Dorada"
    }, {
      value: "suite",
      label: "Suite Editorial nº 04"
    }, {
      value: "nook",
      label: "Nook Antigua"
    }]
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Motivo",
    density: "compact",
    value: motivo,
    onChange: setMotivo,
    placeholder: "Compra de insumos de limpieza",
    error: !motivo && sent ? "Cuéntanos para qué es el adelanto." : null
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: "var(--s-4)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    onClick: () => setSent(true)
  }, "Enviar solicitud"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => {
      setMotivo("");
      setSent(false);
    }
  }, "Limpiar"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--s-5)"
    }
  }, /*#__PURE__*/React.createElement(Collapsible, {
    title: "Hist\xF3rico de adelantos",
    meta: D.adelantos.length + " solicitudes"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, D.adelantos.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "epi-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      color: "var(--fg-muted)"
    }
  }, a.fecha), /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      color: "var(--fg)"
    }
  }, a.monto), /*#__PURE__*/React.createElement(Farol, {
    state: a.st
  }, a.stl))))), /*#__PURE__*/React.createElement(Collapsible, {
    title: "Documentos y comprobantes",
    defaultOpen: false,
    meta: "4 archivos"
  }))), /*#__PURE__*/React.createElement("aside", {
    className: "epi-aside"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    big: true,
    accent: true,
    label: "Disponible esta quincena",
    value: "Q 2,000",
    help: "Se reinicia el 16 de agosto."
  }), /*#__PURE__*/React.createElement(Card, {
    variant: "flat"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 10
    }
  }, "C\xF3mo funciona"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12.5,
      color: "var(--fg-muted)"
    }
  }, "Pides, revisamos el mismo d\xEDa y depositamos en tu cuenta. Queda registrado en tu cierre de mes."))));
}
Object.assign(window, {
  Adelantos
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/Adelantos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/Agenda.jsx
try { (() => {
const {
  Card,
  Calendar,
  Eyebrow,
  Farol,
  DomainBadge,
  Icon,
  Segmented,
  SectionHead,
  KpiCard
} = window.SpacioAMDesignSystem_2c08fe;
function Agenda({
  filter,
  setFilter,
  day,
  setDay,
  onOpen
}) {
  const D = window.EPI_DATA;
  const jobs = filter === "all" ? D.jobs : D.jobs.filter(j => j.st === filter);
  return /*#__PURE__*/React.createElement("div", {
    className: "epi-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Agosto 2026 · día " + day,
    title: "Tu agenda",
    right: /*#__PURE__*/React.createElement(Segmented, {
      size: "sm",
      value: filter,
      onChange: setFilter,
      options: [{
        value: "all",
        label: "Todo"
      }, {
        value: "pending",
        label: "Pend."
      }, {
        value: "error",
        label: "Vencido"
      }]
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "epi-jobs"
  }, jobs.map(j => /*#__PURE__*/React.createElement(Card, {
    key: j.id,
    variant: "interactive",
    pad: "var(--s-3)",
    onClick: () => onOpen(j)
  }, /*#__PURE__*/React.createElement("div", {
    className: "epi-job"
  }, /*#__PURE__*/React.createElement("div", {
    className: "epi-job-time"
  }, /*#__PURE__*/React.createElement(Farol, {
    state: j.st,
    dotOnly: true,
    label: j.stl
  }), /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--fg)"
    }
  }, j.hora)), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: 19,
      lineHeight: 1.2,
      color: "var(--fg)"
    }
  }, j.prop), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(DomainBadge, {
    category: j.cat
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg-muted)"
    }
  }, j.zona))), /*#__PURE__*/React.createElement("div", {
    className: "epi-job-right"
  }, /*#__PURE__*/React.createElement(Farol, {
    state: j.st
  }, j.stl), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronRight",
    size: 18,
    color: "var(--fg-muted)"
  }))))), !jobs.length ? /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      textAlign: "center",
      color: "var(--fg-muted)",
      fontFamily: "var(--font-sans)",
      fontSize: 12.5
    }
  }, "Nada por aqu\xED con ese filtro.") : null)), /*#__PURE__*/React.createElement("aside", {
    className: "epi-aside"
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 14
    }
  }, "Agosto 2026"), /*#__PURE__*/React.createElement(Calendar, {
    year: D.month.year,
    month: D.month.month,
    today: D.month.today,
    selected: day,
    days: D.dayStates,
    onSelect: setDay
  })), /*#__PURE__*/React.createElement("div", {
    className: "epi-mini-kpis"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Trabajos hoy",
    value: D.jobs.length
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Vencidos",
    value: D.jobs.filter(j => j.st === "error").length,
    invert: true,
    trend: -50
  }))));
}
Object.assign(window, {
  Agenda
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/Agenda.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/Calidad.jsx
try { (() => {
const {
  Card,
  KpiCard,
  Eyebrow,
  Icon,
  Select,
  SectionHead,
  Farol
} = window.SpacioAMDesignSystem_2c08fe;
function Calidad() {
  const D = window.EPI_DATA;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Calidad percibida",
    title: "Rating de limpieza de los hu\xE9spedes",
    sub: "Se genera una vez al mes: lee lo que los hu\xE9spedes escribieron y busca temas que se repiten por \xE1rea.",
    right: /*#__PURE__*/React.createElement(Select, {
      icon: "calendar",
      value: "all",
      onChange: () => {},
      minWidth: 150,
      options: [{
        value: "all",
        label: "Todo el período"
      }]
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "epi-kpirow",
    style: {
      marginBottom: "var(--s-5)"
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Promedio general",
    value: "4.75",
    help: "193 reviews"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Este mes",
    value: "4.41",
    trend: -2.4,
    help: "17 reviews"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Est\xE1ndar de marca",
    value: "4.70",
    help: "Cumplido"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Bajo est\xE1ndar",
    value: "19%",
    invert: true,
    trend: 3.1,
    help: "47/252 reviews"
  })), /*#__PURE__*/React.createElement("div", {
    className: "epi-jobs"
  }, D.tecnicos.map((t, i) => /*#__PURE__*/React.createElement(Card, {
    key: t.n,
    variant: "interactive",
    pad: "var(--s-3)",
    style: i === 0 ? {
      boxShadow: "inset 0 0 0 1px var(--color-success)"
    } : null
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: i === 0 ? "var(--fg)" : "var(--fg-muted)",
      minWidth: 18
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg)"
    }
  }, t.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11.5,
      color: "var(--fg-muted)",
      marginTop: 3
    }
  }, t.r, " reviews de hu\xE9spedes")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 22,
      fontWeight: 600,
      color: t.v >= 4.7 ? "var(--color-success)" : "var(--color-warning)"
    }
  }, t.v.toFixed(2)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2,
      justifyContent: "flex-end",
      marginTop: 4
    }
  }, [0, 1, 2, 3, 4].map(s => /*#__PURE__*/React.createElement(Icon, {
    key: s,
    name: "star",
    size: 11,
    color: s < Math.round(t.v) ? "var(--color-success)" : "var(--divider)"
  })))))))));
}
Object.assign(window, {
  Calidad
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/Calidad.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/Dashboard.jsx
try { (() => {
const {
  Card,
  KpiCard,
  Amount,
  JobCard,
  SummaryTable,
  Farol,
  DomainBadge,
  Select,
  Segmented,
  Eyebrow,
  Button,
  SectionHead,
  Icon
} = window.SpacioAMDesignSystem_2c08fe;
const {
  useState
} = React;
function EpiDashboard({
  narrow
}) {
  const D = window.EPI_DATA;
  const [view, setView] = useState("lista");
  const [pago, setPago] = useState("all");
  const jobs = pago === "all" ? D.jobs : D.jobs.filter(j => j.st !== "success");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "epi-alert"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert",
    size: 16,
    color: "var(--attention)"
  }), /*#__PURE__*/React.createElement("span", null, "3 trabajos con pago pendiente")), /*#__PURE__*/React.createElement("div", {
    className: "epi-deposit"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "A depositar \xB7 semanas anteriores"), /*#__PURE__*/React.createElement(Amount, {
    value: 0,
    currency: "GTQ",
    size: 44,
    decimals: false,
    color: "var(--color-success)",
    style: {
      display: "block",
      marginTop: 10
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "En curso"), /*#__PURE__*/React.createElement(Amount, {
    value: 3616,
    currency: "GTQ",
    size: 26,
    decimals: false,
    style: {
      display: "block",
      marginTop: 8
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      color: "var(--fg-muted)"
    }
  }, "43 trab. \xB7 a\xFAn no pagable"))), /*#__PURE__*/React.createElement("div", {
    className: "epi-kpirow"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Trabajos",
    value: "3",
    help: "Pendientes"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Facturado",
    value: /*#__PURE__*/React.createElement(Amount, {
      value: 238,
      currency: "GTQ",
      size: 30,
      decimals: false
    }),
    help: "Sin pagar"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Cobrado",
    value: /*#__PURE__*/React.createElement(Amount, {
      value: 76216,
      currency: "GTQ",
      size: 30,
      decimals: false,
      color: "var(--color-success)"
    })
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Adelanto / sem",
    value: /*#__PURE__*/React.createElement(Amount, {
      value: -625,
      currency: "GTQ",
      size: 30,
      decimals: false,
      color: "var(--attention-text)"
    }),
    help: "Descuento autom\xE1tico"
  })), /*#__PURE__*/React.createElement("div", {
    className: "epi-filters"
  }, [["Técnico", "tec"], ["Vínculo", "vin"], ["Tipo de trabajo", "tipo"], ["Estado de pago", "est"]].map(([l, k]) => /*#__PURE__*/React.createElement(Select, {
    key: k,
    label: l,
    value: "all",
    onChange: () => {},
    minWidth: 0,
    options: [{
      value: "all",
      label: "Todos"
    }],
    style: {
      width: "100%"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "epi-toolbar"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "text",
    uppercase: false,
    size: "sm"
  }, "Filtros avanzados"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginLeft: "auto",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    icon: "refresh",
    style: {
      padding: "9px 14px"
    }
  }), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: view,
    onChange: setView,
    options: [{
      value: "lista",
      label: "Lista"
    }, {
      value: "cal",
      label: "Cal"
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    className: "epi-bulk"
  }, /*#__PURE__*/React.createElement("span", null, "45 trabajos pendientes de pago"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: "check",
    onClick: () => setPago("pend")
  }, "Marcar todos como pagados")), narrow || view === "cal" ? /*#__PURE__*/React.createElement("div", {
    className: "epi-jobs"
  }, jobs.map(j => /*#__PURE__*/React.createElement(JobCard, {
    key: j.id,
    property: j.prop,
    category: j.cat,
    description: j.nota,
    date: "14 ago 2026",
    technician: j.tecnico,
    amount: j.monto,
    state: j.st,
    statusLabel: j.stl,
    payer: "Paga Spacio AM"
  }))) : /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    style: {
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(SummaryTable, {
    rows: jobs.map(j => ({
      prop: /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontWeight: 500
        }
      }, j.prop), /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-block",
          marginTop: 6
        }
      }, /*#__PURE__*/React.createElement(DomainBadge, {
        category: j.cat
      }))),
      fecha: "14 ago 2026",
      trabajo: j.nota,
      total: /*#__PURE__*/React.createElement(Amount, {
        value: j.monto,
        currency: "GTQ",
        size: 14,
        decimals: false
      }),
      estado: /*#__PURE__*/React.createElement(Farol, {
        state: j.st
      }, j.stl)
    })),
    columns: [{
      key: "prop",
      header: "Propiedad"
    }, {
      key: "fecha",
      header: "Fecha"
    }, {
      key: "trabajo",
      header: "Trabajo realizado"
    }, {
      key: "total",
      header: "Total",
      num: true
    }, {
      key: "estado",
      header: "Estado de pago"
    }]
  })));
}
Object.assign(window, {
  EpiDashboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/EpiApp.jsx
try { (() => {
const {
  useState,
  useEffect
} = React;
const {
  TopBar,
  PillTabs,
  BottomNav,
  Wordmark,
  Eyebrow,
  Button,
  Farol,
  Icon
} = window.SpacioAMDesignSystem_2c08fe;
const TABS = [{
  value: "dash",
  label: "Dashboard",
  icon: "grid"
}, {
  value: "form",
  label: "Formulario",
  icon: "pencil"
}, {
  value: "prog",
  label: "Programa",
  icon: "calendar"
}, {
  value: "cal",
  label: "Calidad",
  icon: "star"
}, {
  value: "adel",
  label: "Adelantos",
  icon: "coins"
}];
function EpiApp() {
  const D = window.EPI_DATA;
  const [tab, setTab] = useState("dash");
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState(14);
  const [job, setJob] = useState(null);
  const [month, setMonth] = useState("2026-08");
  const [lang, setLang] = useState("es");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 780);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TopBar, {
    base: "../..",
    month: month,
    onMonth: setMonth,
    months: [{
      value: "2026-08",
      label: "Agosto 2026"
    }, {
      value: "2026-07",
      label: "Julio 2026"
    }],
    lang: lang,
    onLang: setLang,
    initials: D.user.initials
  }), /*#__PURE__*/React.createElement("div", {
    className: "epi-tabs"
  }, !narrow ? /*#__PURE__*/React.createElement(PillTabs, {
    value: tab,
    onChange: setTab,
    tabs: TABS
  }) : /*#__PURE__*/React.createElement(Eyebrow, null, TABS.find(t => t.value === tab).label), /*#__PURE__*/React.createElement(Eyebrow, null, D.user.name, " \xB7 ", D.user.role)), /*#__PURE__*/React.createElement("main", {
    className: "epi-main"
  }, tab === "dash" ? /*#__PURE__*/React.createElement(EpiDashboard, {
    narrow: narrow
  }) : null, tab === "form" ? /*#__PURE__*/React.createElement(Formulario, null) : null, tab === "prog" ? /*#__PURE__*/React.createElement(Agenda, {
    filter: filter,
    setFilter: setFilter,
    day: day,
    setDay: setDay,
    onOpen: setJob
  }) : null, tab === "cal" ? /*#__PURE__*/React.createElement(Calidad, null) : null, tab === "adel" ? /*#__PURE__*/React.createElement(Adelantos, null) : null, /*#__PURE__*/React.createElement("footer", {
    className: "epi-footer"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "monogram",
    height: 24,
    base: "../.."
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "\xDAltima actualizaci\xF3n hace 2 min"), /*#__PURE__*/React.createElement(Button, {
    variant: "text",
    uppercase: false,
    icon: "refresh"
  }, "Actualizar"))), /*#__PURE__*/React.createElement(JobDetail, {
    job: job,
    onClose: () => setJob(null)
  }), narrow ? /*#__PURE__*/React.createElement(BottomNav, {
    variant: "bar",
    value: tab,
    onChange: setTab,
    style: {
      position: "fixed",
      bottom: 0
    },
    fab: {
      icon: "home",
      label: "Dashboard"
    },
    onFab: () => setTab("dash"),
    items: TABS.filter(t => t.value !== "dash")
  }) : null);
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(EpiApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/EpiApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/Formulario.jsx
try { (() => {
const {
  Card,
  Input,
  Select,
  Button,
  Eyebrow,
  Icon,
  Checkbox,
  SectionHead
} = window.SpacioAMDesignSystem_2c08fe;
const {
  useState
} = React;
const TIPOS = ["Limpieza tradicional", "Limpieza profunda", "Mantenimiento", "Nuevo Producto", "Ajuste", "Reporte de Daños"];
function Formulario() {
  const [tipo, setTipo] = useState("Limpieza tradicional");
  const [desc, setDesc] = useState("");
  const [sent, setSent] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "epi-form-screen"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Nuevo reporte"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: 34,
      lineHeight: 1.1,
      letterSpacing: "var(--tr-tight)",
      color: "var(--fg)",
      margin: "12px 0 var(--s-5)"
    }
  }, "\xBFQu\xE9 trabajo se realiz\xF3?"), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      marginBottom: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      paddingBottom: 14,
      borderBottom: "1px solid var(--divider)",
      display: "block",
      marginBottom: 16
    }
  }, "Tipo de trabajo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10
    }
  }, TIPOS.map(t => /*#__PURE__*/React.createElement(Button, {
    key: t,
    size: "sm",
    uppercase: false,
    variant: t === tipo ? "primary" : "secondary",
    onClick: () => setTipo(t)
  }, t)))), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      marginBottom: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      paddingBottom: 14,
      borderBottom: "1px solid var(--divider)",
      display: "block",
      marginBottom: 16
    }
  }, "Responsable"), /*#__PURE__*/React.createElement(Select, {
    label: "T\xE9cnico / proveedor",
    value: "all",
    onChange: () => {},
    minWidth: 0,
    style: {
      width: "100%"
    },
    options: [{
      value: "all",
      label: "Seleccionar…"
    }, {
      value: "j",
      label: "Jackeline Ruano"
    }, {
      value: "s",
      label: "Sucely Morales"
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      marginBottom: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      paddingBottom: 14,
      borderBottom: "1px solid var(--divider)",
      display: "block",
      marginBottom: 16
    }
  }, "Propiedad"), /*#__PURE__*/React.createElement("div", {
    className: "epi-form-two"
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Propiedad",
    value: "all",
    onChange: () => {},
    minWidth: 0,
    style: {
      width: "100%"
    },
    options: [{
      value: "all",
      label: "Seleccionar…"
    }, {
      value: "a",
      label: "Z1 - Centro Vivo - 1107"
    }]
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Fecha",
    density: "compact",
    value: "14 ago 2026",
    onChange: () => {},
    icon: "calendar"
  }))), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      marginBottom: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      paddingBottom: 14,
      borderBottom: "1px solid var(--divider)",
      display: "block",
      marginBottom: 16
    }
  }, "Descripci\xF3n"), /*#__PURE__*/React.createElement(Input, {
    label: "\xBFQu\xE9 se hizo?",
    value: desc,
    onChange: setDesc,
    placeholder: "Describe brevemente el trabajo realizado\u2026",
    error: sent && !desc ? "Cuéntanos qué se hizo antes de enviar." : null
  })), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      marginBottom: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      paddingBottom: 14,
      borderBottom: "1px solid var(--divider)",
      display: "block",
      marginBottom: 16
    }
  }, "Evidencia fotogr\xE1fica"), /*#__PURE__*/React.createElement("div", {
    className: "epi-form-two"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "var(--tr-wide)",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
      marginBottom: 10
    }
  }, "Fotos antes ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      textTransform: "none",
      letterSpacing: 0
    }
  }, "m\xE1x. 2")), /*#__PURE__*/React.createElement("button", {
    className: "epi-drop"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 18,
    color: "var(--fg-muted)"
  }), /*#__PURE__*/React.createElement("span", null, "Subir"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "var(--tr-wide)",
      textTransform: "uppercase",
      color: "var(--fg)",
      marginBottom: 10
    }
  }, "Fotos despu\xE9s ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      textTransform: "none",
      letterSpacing: 0,
      color: "var(--fg-muted)"
    }
  }, "m\xE1x. 3")), /*#__PURE__*/React.createElement("button", {
    className: "epi-drop epi-drop--req"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 18,
    color: "var(--fg)"
  }), /*#__PURE__*/React.createElement("span", null, "Subir"))))), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    style: {
      marginBottom: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      paddingBottom: 14,
      borderBottom: "1px solid var(--divider)",
      display: "block",
      marginBottom: 16
    }
  }, "Factura"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-alt)",
      borderRadius: "var(--r-md)",
      padding: "14px 16px",
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      lineHeight: 1.7,
      color: "var(--fg-muted)"
    }
  }, "Favor emitir su factura a nombre de ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--fg)"
    }
  }, "Spacio AM S.A."), /*#__PURE__*/React.createElement("br", null), "NIT: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--fg)"
    }
  }, "118287796")), /*#__PURE__*/React.createElement("button", {
    className: "epi-drop epi-drop--wide",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "paperclip",
    size: 16,
    color: "var(--fg-muted)"
  }), /*#__PURE__*/React.createElement("span", null, "Adjuntar factura (PDF o imagen)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setSent(true)
  }, "Enviar reporte"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => {
      setDesc("");
      setSent(false);
    }
  }, "Limpiar")));
}
Object.assign(window, {
  Formulario
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/Formulario.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/JobDetail.jsx
try { (() => {
const {
  Modal,
  Button,
  DomainBadge,
  Farol,
  Eyebrow,
  Brushstroke,
  Checkbox
} = window.SpacioAMDesignSystem_2c08fe;
function JobDetail({
  job,
  onClose
}) {
  const [done, setDone] = React.useState(false);
  if (!job) return null;
  return /*#__PURE__*/React.createElement(Modal, {
    title: job.prop,
    onClose: onClose,
    width: 520,
    sparkle: true,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: onClose
    }, "Cerrar"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      icon: "check",
      onClick: onClose
    }, "Marcar atendido"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(DomainBadge, {
    category: job.cat
  }), /*#__PURE__*/React.createElement(Farol, {
    state: job.st
  }, job.stl), /*#__PURE__*/React.createElement("span", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      color: "var(--fg-muted)"
    }
  }, job.hora, " \xB7 ", job.zona)), /*#__PURE__*/React.createElement(Brushstroke, {
    base: "../..",
    src: "../../assets/photos/kitchen.jpeg",
    alt: "",
    height: 150,
    radius: "var(--r-md)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "22px 0 0"
    }
  }, job.nota), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: "14px 16px",
      background: "var(--bg-alt)",
      borderRadius: "var(--r-md)"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 12
    }
  }, "Checklist"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: done,
    onChange: setDone,
    label: "Fotos de entrada y salida subidas"
  }), /*#__PURE__*/React.createElement(Checkbox, {
    checked: false,
    onChange: () => {},
    label: "Inventario verificado"
  }))));
}
Object.assign(window, {
  JobDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/JobDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/epi-app/data.js
try { (() => {
window.EPI_DATA = {
  user: {
    name: "Marvin Coc",
    role: "Supervisor · Antigua",
    initials: "MC"
  },
  month: {
    year: 2026,
    month: 7,
    today: 14
  },
  dayStates: {
    3: "success",
    5: "success",
    9: "warning",
    12: "attention",
    14: "info",
    17: "pending",
    18: "success",
    22: "error",
    26: "warning",
    29: "success"
  },
  jobs: [{
    id: 1,
    hora: "07:30",
    prop: "Z1 - Centro Vivo - 1107",
    zona: "Zona 1",
    cat: "limpieza-tradicional",
    tecnico: "Jackeline Ruano",
    monto: 75,
    st: "pending",
    stl: "Pendiente",
    nota: "Limpieza tradicional — Z1 - Centro Vivo - 1107"
  }, {
    id: 2,
    hora: "09:00",
    prop: "Z13 - Narama - 623",
    zona: "Zona 13",
    cat: "limpieza-tradicional",
    tecnico: "Joselyn Sian",
    monto: 75,
    st: "pending",
    stl: "Pendiente",
    nota: "Limpieza tradicional — Z13 - Narama - 623"
  }, {
    id: 3,
    hora: "10:15",
    prop: "Z2 - Baldone - 1103",
    zona: "Zona 2",
    cat: "cancelacion",
    tecnico: "Flor Samayoa",
    monto: 38,
    st: "attention",
    stl: "Cancelado",
    nota: "Limpieza cancelada por la administración a las 10:52 am — se paga media tarifa"
  }, {
    id: 4,
    hora: "12:00",
    prop: "Z2 - Baldone - 1010",
    zona: "Zona 2",
    cat: "limpieza-profunda",
    tecnico: "Sucely Morales",
    monto: 75,
    st: "info",
    stl: "En progreso",
    nota: "Limpieza profunda — Z2 - Baldone - 1010"
  }, {
    id: 5,
    hora: "14:30",
    prop: "Z2 - Baldone - 1010",
    zona: "Zona 2",
    cat: "ajuste",
    tecnico: "Helen Pineda",
    monto: 45,
    st: "warning",
    stl: "Por vencer",
    nota: "Tokens de lavado — Tokens de lavado y secado de ropa"
  }, {
    id: 6,
    hora: "16:00",
    prop: "Antigua - casco - 64A",
    zona: "Antigua",
    cat: "supervision",
    tecnico: "Iris Samayoa",
    monto: 60,
    st: "success",
    stl: "Pagado",
    nota: "Supervisión mensual de inventario"
  }],
  tecnicos: [{
    n: "Flor Samayoa",
    r: 10,
    v: 5.00
  }, {
    n: "Lilia Del Cid",
    r: 9,
    v: 5.00
  }, {
    n: "Joselyn Sian",
    r: 23,
    v: 4.87
  }, {
    n: "Helen Pineda",
    r: 14,
    v: 4.86
  }, {
    n: "Jackeline Ruano",
    r: 32,
    v: 4.84
  }, {
    n: "Mirla Chacon",
    r: 39,
    v: 4.74
  }, {
    n: "Sucely Morales",
    r: 30,
    v: 4.63
  }],
  adelantos: [{
    fecha: "28 jul 2026",
    monto: "Q 1,200",
    st: "success",
    stl: "Depositado"
  }, {
    fecha: "14 jul 2026",
    monto: "Q 800",
    st: "success",
    stl: "Depositado"
  }, {
    fecha: "30 jun 2026",
    monto: "Q 1,500",
    st: "error",
    stl: "Rechazado"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/epi-app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/guest-app/Checkin.jsx
try { (() => {
const {
  Card,
  Input,
  Button,
  Checkbox,
  Eyebrow,
  Icon,
  Wordmark,
  Farol,
  Skeleton,
  Sparkle
} = window.SpacioAMDesignSystem_2c08fe;
const STEPS = ["Reservante", "Documentos", "Contacto", "Reglas"];
function Steps({
  step
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "g-steps"
  }, STEPS.map((l, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    className: "g-step"
  }, /*#__PURE__*/React.createElement("div", {
    className: "g-step-dot",
    style: {
      background: i <= step ? "var(--fg)" : "transparent",
      border: "1px solid " + (i <= step ? "var(--fg)" : "var(--divider)")
    }
  }, i < step ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13,
    color: "var(--fg-inverse)"
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: i === step ? "var(--accent)" : "var(--fg-muted)",
      fontSize: 10,
      fontFamily: "var(--font-sans)",
      fontWeight: 600
    }
  }, i + 1)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 8.5,
      fontWeight: 500,
      letterSpacing: "var(--tr-wide)",
      textTransform: "uppercase",
      color: i <= step ? "var(--fg)" : "var(--fg-muted)"
    }
  }, l)), i < STEPS.length - 1 ? /*#__PURE__*/React.createElement("div", {
    className: "g-step-line",
    style: {
      background: i < step ? "var(--fg)" : "var(--divider)"
    }
  }) : null)));
}
function DocCapture() {
  const [state, setState] = React.useState("empty");
  return /*#__PURE__*/React.createElement(Card, {
    variant: "flat"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: 19,
      color: "var(--fg)"
    }
  }, "Reservante"), state === "done" ? /*#__PURE__*/React.createElement(Farol, {
    state: "success"
  }, "Le\xEDdo") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: "camera",
    onClick: () => {
      setState("reading");
      setTimeout(() => setState("done"), 1100);
    }
  }, "Tomar foto"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => {
      setState("reading");
      setTimeout(() => setState("done"), 1100);
    }
  }, "Elegir archivo"))), state === "reading" ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Leyendo tu documento\u2026"), /*#__PURE__*/React.createElement(Skeleton, {
    height: 46,
    radius: "var(--r-md)"
  }), /*#__PURE__*/React.createElement(Skeleton, {
    height: 46,
    radius: "var(--r-md)"
  })) : null, state === "done" ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: "var(--bg-alt)",
      borderRadius: "var(--r-md)",
      padding: "var(--s-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Sparkle, {
    size: 11
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "Prellenado desde tu documento")), /*#__PURE__*/React.createElement(Input, {
    label: "Nombre completo",
    value: "Sof\xEDa Elena Ram\xEDrez Cruz",
    onChange: () => {},
    density: "compact"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "N\xFAmero de identificaci\xF3n",
    value: "2451 88903 0101",
    onChange: () => {},
    density: "compact",
    helper: "Confirma que coincide con tu documento."
  }))) : null);
}
function Checkin({
  go
}) {
  const [step, setStep] = React.useState(1);
  const [ok, setOk] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "g-screen g-narrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "g-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "g-back",
    onClick: () => go("home")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrowLeft",
    size: 18,
    color: "var(--fg)"
  })), /*#__PURE__*/React.createElement(Wordmark, {
    variant: "monogram",
    height: 26,
    base: "../.."
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "Check-in")), /*#__PURE__*/React.createElement(Steps, {
    step: step
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: 34,
      lineHeight: 1.08,
      letterSpacing: "var(--tr-tight)",
      color: "var(--fg)",
      margin: "0 0 10px",
      textAlign: "center"
    }
  }, step === 1 ? "Tu documento" : step === 2 ? "Cómo te contactamos" : "Las reglas de la casa"), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: "center",
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      lineHeight: 1.65,
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg-muted)",
      margin: "0 auto var(--s-5)",
      maxWidth: 380
    }
  }, step === 1 ? "Toma una foto de tu DPI o pasaporte y llenamos los datos por ti." : step === 2 ? "Solo lo usamos para avisarte de tu llegada." : "Un espacio que se cuida se disfruta más."), step === 1 ? /*#__PURE__*/React.createElement(DocCapture, null) : null, step === 2 ? /*#__PURE__*/React.createElement(Card, {
    variant: "flat"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Correo",
    value: "sofia@correo.com",
    onChange: () => {},
    icon: "mail"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Tel\xE9fono",
    value: "+502 5555 1234",
    onChange: () => {},
    helper: "WhatsApp, de preferencia."
  }))) : null, step === 3 ? /*#__PURE__*/React.createElement(Card, {
    variant: "flat"
  }, /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      padding: 0,
      margin: "0 0 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, ["Sin fiestas ni eventos.", "No se permite fumar dentro de la casa.", "Silencio después de las 22:00.", "Máximo 4 huéspedes."].map(r => /*#__PURE__*/React.createElement("li", {
    key: r,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      letterSpacing: "var(--tr-wide)",
      color: "var(--fg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 7,
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: "var(--accent)",
      flexShrink: 0
    }
  }), r))), /*#__PURE__*/React.createElement(Checkbox, {
    checked: ok,
    onChange: setOk,
    label: "Acepto las reglas de la casa"
  })) : null, /*#__PURE__*/React.createElement("div", {
    className: "g-nav"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => step > 1 ? setStep(step - 1) : go("home")
  }, "Atr\xE1s"), /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    iconRight: "arrowRight",
    disabled: step === 3 && !ok,
    onClick: () => step < 3 ? setStep(step + 1) : go("home")
  }, step < 3 ? "Continuar" : "Terminar")));
}
Object.assign(window, {
  Checkin,
  Steps
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/guest-app/Checkin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/guest-app/GuestApp.jsx
try { (() => {
const {
  useState
} = React;
function GuestApp() {
  const [screen, setScreen] = useState("home");
  const go = s => setScreen(s);
  return /*#__PURE__*/React.createElement("div", {
    className: "g-shell"
  }, screen === "home" ? /*#__PURE__*/React.createElement(Home, {
    go: go
  }) : screen === "checkin" ? /*#__PURE__*/React.createElement(Checkin, {
    go: go
  }) : /*#__PURE__*/React.createElement(Guide, {
    go: go
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(GuestApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/guest-app/GuestApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/guest-app/Guide.jsx
try { (() => {
const {
  Card,
  Collapsible,
  Eyebrow,
  Icon,
  Button,
  Wordmark,
  Brushstroke,
  PropertyCard
} = window.SpacioAMDesignSystem_2c08fe;
function Guide({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "g-screen g-narrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "g-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "g-back",
    onClick: () => go("home")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrowLeft",
    size: 18,
    color: "var(--fg)"
  })), /*#__PURE__*/React.createElement(Wordmark, {
    variant: "monogram",
    height: 26,
    base: "../.."
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "La casa")), /*#__PURE__*/React.createElement(Brushstroke, {
    base: "../..",
    src: "../../assets/photos/kitchen.jpeg",
    alt: "Cocina",
    height: 200,
    radius: "var(--r-xl)"
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: 32,
      lineHeight: 1.1,
      letterSpacing: "var(--tr-tight)",
      margin: "var(--s-5) 0 var(--s-4)"
    }
  }, "Todo lo que necesitas saber"), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--s-3)",
      marginBottom: "var(--s-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "var(--color-peach-12)",
      display: "grid",
      placeItems: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "wifi",
    size: 20,
    color: "var(--fg)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Wi-Fi"), /*#__PURE__*/React.createElement("div", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg)",
      marginTop: 4
    }
  }, "SpacioAM_Luz \xB7 luzdorada2026")), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    icon: "copy",
    style: {
      marginLeft: "auto"
    }
  }, "Copiar")), /*#__PURE__*/React.createElement(Collapsible, {
    title: "C\xF3mo entrar",
    meta: "C\xF3digo"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: "var(--fg-muted)"
    }
  }, "La caja de llaves est\xE1 a la derecha del port\xF3n. C\xF3digo ", /*#__PURE__*/React.createElement("strong", {
    className: "t-num",
    style: {
      color: "var(--fg)"
    }
  }, "4 8 1 2"), ". Despu\xE9s de las 20:00 te abrimos nosotros.")), /*#__PURE__*/React.createElement(Collapsible, {
    title: "Electrodom\xE9sticos",
    defaultOpen: false,
    meta: "6 gu\xEDas"
  }), /*#__PURE__*/React.createElement(Collapsible, {
    title: "Emergencias",
    defaultOpen: false,
    meta: "24/7"
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      margin: "var(--s-6) 0 var(--s-3)"
    }
  }, "Cerca de ti"), /*#__PURE__*/React.createElement("div", {
    className: "g-near"
  }, /*#__PURE__*/React.createElement(PropertyCard, {
    base: "../..",
    image: "../../assets/photos/morning.jpeg",
    location: "A 4 min",
    name: "Caf\xE9 de la Merced",
    meta: "Desayunos \xB7 7:00\u201312:00"
  }), /*#__PURE__*/React.createElement(PropertyCard, {
    base: "../..",
    image: "../../assets/photos/selfcare.jpeg",
    location: "A 9 min",
    name: "Ba\xF1os de temazcal",
    meta: "Reserva con un d\xEDa"
  })), /*#__PURE__*/React.createElement("div", {
    className: "g-nav"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    full: true,
    onClick: () => go("home")
  }, "Volver al inicio")));
}
Object.assign(window, {
  Guide
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/guest-app/Guide.jsx", error: String((e && e.message) || e) }); }

// ui_kits/guest-app/Home.jsx
try { (() => {
const {
  Bento,
  BentoTile,
  Brushstroke,
  Wordmark,
  Eyebrow,
  Icon,
  Farol,
  Button,
  Sparkle
} = window.SpacioAMDesignSystem_2c08fe;
function Home({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "g-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "g-top"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "monogram",
    height: 28,
    base: "../.."
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "Antigua Guatemala")), /*#__PURE__*/React.createElement(Brushstroke, {
    base: "../..",
    src: "../../assets/photos/welcome-weave.jpeg",
    alt: "Tu estad\xEDa",
    height: 230,
    radius: "var(--r-xl)",
    overlay: /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        padding: "var(--s-4)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: "linear-gradient(180deg,transparent 38%,rgba(62,63,63,.6))"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: "rgba(250,250,250,.9)"
      }
    }, "14 \u2013 18 de agosto"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-serif)",
        fontWeight: 400,
        fontSize: 32,
        lineHeight: 1.1,
        color: "var(--fg-inverse)",
        marginTop: 8
      }
    }, "Casa de la Luz Dorada"))
  }), /*#__PURE__*/React.createElement("div", {
    className: "g-welcome"
  }, /*#__PURE__*/React.createElement(Sparkle, {
    size: 14
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "12px 0 0",
      fontFamily: "var(--font-serif)",
      fontWeight: 300,
      fontStyle: "italic",
      fontSize: 24,
      lineHeight: 1.25,
      color: "var(--fg)"
    }
  }, "Bienvenida, Sof\xEDa. Todo est\xE1 listo para que solo llegues."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginTop: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Farol, {
    state: "warning"
  }, "Check-in pendiente"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "accent",
    onClick: () => go("checkin")
  }, "Completar check-in"))), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      margin: "var(--s-5) 0 var(--s-3)"
    }
  }, "Tu estad\xEDa"), /*#__PURE__*/React.createElement(Bento, null, /*#__PURE__*/React.createElement(BentoTile, {
    image: "../../assets/photos/bedroom.jpeg",
    label: "La casa",
    span: 2,
    rows: 2,
    sparkle: true,
    onClick: () => go("guide")
  }), /*#__PURE__*/React.createElement(BentoTile, {
    label: "Check-in",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 16
    }),
    onClick: () => go("checkin")
  }), /*#__PURE__*/React.createElement(BentoTile, {
    label: "Wi-Fi",
    tone: "peach",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wifi",
      size: 16
    }),
    onClick: () => go("guide")
  }), /*#__PURE__*/React.createElement(BentoTile, {
    label: "Gu\xEDa",
    tone: "ink",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "file",
      size: 16
    }),
    onClick: () => go("guide")
  }), /*#__PURE__*/React.createElement(BentoTile, {
    image: "../../assets/photos/rooftop.jpeg",
    label: "Rooftop",
    onClick: () => go("guide")
  }), /*#__PURE__*/React.createElement(BentoTile, {
    image: "../../assets/photos/antigua.jpeg",
    label: "Cerca de ti",
    span: 2,
    onClick: () => go("guide")
  }), /*#__PURE__*/React.createElement(BentoTile, {
    label: "Facturaci\xF3n",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 16
    }),
    onClick: () => {}
  }), /*#__PURE__*/React.createElement(BentoTile, {
    label: "Escr\xEDbenos",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "mail",
      size: 16
    }),
    onClick: () => {}
  })));
}
Object.assign(window, {
  Home
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/guest-app/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owner-dashboard/DashboardApp.jsx
try { (() => {
const {
  useState,
  useEffect
} = React;
const {
  TopBar,
  TabNav,
  BottomNav,
  Wordmark,
  Eyebrow,
  Button,
  Icon,
  LoadingScreen
} = window.SpacioAMDesignSystem_2c08fe;
const TABS = [{
  value: "resumen",
  label: "Resumen",
  icon: "home"
}, {
  value: "gastos",
  label: "Gastos e inversiones",
  icon: "coins"
}, {
  value: "detalle",
  label: "Detalle del mes",
  icon: "file"
}, {
  value: "depositos",
  label: "Depósitos a socios",
  icon: "bank"
}, {
  value: "conta",
  label: "Contabilidad",
  icon: "bank"
}, {
  value: "setup",
  label: "Setup",
  icon: "settings"
}];
function DashboardApp() {
  const D = window.KIT_DATA;
  const [screen, setScreen] = useState("login");
  const [lang, setLang] = useState("es");
  const [month, setMonth] = useState("2026-08");
  const [prop, setProp] = useState("luz");
  const [currency, setCurrency] = useState("GTQ");
  const [narrow, setNarrow] = useState(false);
  const [tab, setTab] = useState("resumen");
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 780);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const rate = currency === "GTQ" ? 1 : 0.13;
  const sym = currency === "GTQ" ? "Q " : "$ ";
  const money = v => sym + Math.round(v * rate).toLocaleString("es-GT");
  const moneyShort = v => sym + Math.round(v * rate / 1000) + "k";
  const k = D.kpis[month];
  const periodText = D.months.find(m => m.value === month).label;
  const context = "Tu mejor agosto: " + money(k.neto) + " netos con " + k.occ + "% de ocupación ajustada.";
  if (screen === "login") return /*#__PURE__*/React.createElement(Login, {
    lang: lang,
    setLang: setLang,
    onLogin: () => setScreen("loading")
  });
  if (screen === "loading") {
    setTimeout(() => setScreen("app"), 900);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        minHeight: "100vh"
      }
    }, /*#__PURE__*/React.createElement(LoadingScreen, {
      base: "../..",
      label: "Cargando tu mes"
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TopBar, {
    base: "../..",
    month: month,
    months: D.months,
    onMonth: setMonth,
    scope: prop,
    scopes: D.props,
    onScope: setProp,
    currency: currency,
    onCurrency: setCurrency,
    lang: lang,
    onLang: setLang,
    initials: D.owner.initials,
    alert: "Factura pendiente",
    onAvatar: () => setScreen("login")
  }), !narrow ? /*#__PURE__*/React.createElement("div", {
    className: "kit-tabs"
  }, /*#__PURE__*/React.createElement(TabNav, {
    value: tab,
    onChange: setTab,
    tabs: TABS
  })) : null, /*#__PURE__*/React.createElement("main", {
    className: "kit-main"
  }, /*#__PURE__*/React.createElement(Hero, {
    prop: prop,
    periodText: periodText,
    context: context
  }), /*#__PURE__*/React.createElement(SummaryKPIs, {
    k: k,
    money: money,
    currency: currency
  }), /*#__PURE__*/React.createElement(Financial, {
    k: k,
    money: money,
    moneyShort: moneyShort
  }), /*#__PURE__*/React.createElement(Distribution, {
    k: k
  }), /*#__PURE__*/React.createElement(Occupancy, {
    k: k
  }), /*#__PURE__*/React.createElement(Admin, {
    money: money,
    narrow: narrow
  }), /*#__PURE__*/React.createElement("footer", {
    className: "kit-footer"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "monogram",
    height: 26,
    base: "../.."
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "Spacio AM \xB7 Guatemala \xB7 MMXXVI"), /*#__PURE__*/React.createElement(Button, {
    variant: "text",
    uppercase: false,
    onClick: () => setScreen("login")
  }, "Cerrar sesi\xF3n"))), narrow ? /*#__PURE__*/React.createElement(BottomNav, {
    variant: "pill",
    value: tab,
    onChange: setTab,
    style: {
      position: "fixed"
    },
    items: [{
      value: "resumen",
      label: "Resumen",
      icon: "home"
    }, {
      value: "gastos",
      label: "Gastos e inversiones",
      icon: "coins"
    }, {
      value: "detalle",
      label: "Detalle del mes",
      icon: "file"
    }, {
      value: "setup",
      label: "Más",
      icon: "plus"
    }]
  }) : null);
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(DashboardApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owner-dashboard/DashboardApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owner-dashboard/Login.jsx
try { (() => {
const {
  useState
} = React;
const {
  Wordmark,
  Sparkle,
  Eyebrow,
  Input,
  Button,
  Segmented,
  Icon
} = window.SpacioAMDesignSystem_2c08fe;
function Login({
  lang,
  setLang,
  onLogin
}) {
  const [user, setUser] = useState("ana@spacioam.com");
  const [pass, setPass] = useState("spacioam");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = e => {
    e.preventDefault();
    setBusy(true);
    setTimeout(onLogin, 520);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "kit-login"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "kit-login-aside"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/brushstroke.svg",
    alt: "",
    "aria-hidden": "true",
    className: "kit-login-brush"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "stamp",
    height: 64,
    base: "../.."
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 2,
      maxWidth: 460
    }
  }, /*#__PURE__*/React.createElement(Sparkle, {
    size: 22
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 300,
      fontStyle: "italic",
      fontSize: "clamp(28px,3.4vw,42px)",
      lineHeight: 1.18,
      letterSpacing: "var(--tr-tight)",
      color: "var(--fg)",
      margin: "20px 0 0",
      textWrap: "balance"
    }
  }, "\u201CHay espacios donde despertar se siente como un sue\xF1o.\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 1,
      background: "var(--fg)",
      margin: "26px 0 14px"
    }
  }), /*#__PURE__*/React.createElement(Eyebrow, null, "Spacio AM \xB7 ", lang === "es" ? "Portal de propietarios" : "Owner portal")), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      position: "relative",
      zIndex: 2
    }
  }, "Guatemala \xB7 ", lang === "es" ? "Ayuda" : "Help")), /*#__PURE__*/React.createElement("main", {
    className: "kit-login-main"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 20,
      right: 20
    }
  }, /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: lang,
    onChange: setLang,
    options: [{
      value: "es",
      label: "ES"
    }, {
      value: "en",
      label: "EN"
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "stacked",
    height: 92,
    base: "../..",
    style: {
      marginBottom: 30
    }
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 14
    }
  }, lang === "es" ? "Reportes de propietario" : "Owner reports"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: 38,
      letterSpacing: "var(--tr-tight)",
      lineHeight: 1.08,
      color: "var(--fg)",
      margin: 0
    }
  }, lang === "es" ? "Bienvenida de vuelta" : "Welcome back"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      letterSpacing: "var(--tr-wide)",
      lineHeight: 1.7,
      color: "var(--fg-muted)",
      margin: "12px 0 30px"
    }
  }, lang === "es" ? "Tus propiedades, tu mes y tus números — en una sola página." : "Your properties, your month and your numbers — on one page."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: lang === "es" ? "Usuario o correo" : "User or email",
    value: user,
    onChange: setUser,
    icon: "user"
  }), /*#__PURE__*/React.createElement(Input, {
    label: lang === "es" ? "Contraseña" : "Password",
    type: show ? "text" : "password",
    value: pass,
    onChange: setPass,
    trailing: /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setShow(s => !s),
      "aria-label": "ver",
      style: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--fg-muted)",
        display: "flex",
        padding: 4
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: show ? "eyeOff" : "eye",
      size: 18
    }))
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    full: true,
    loading: busy,
    icon: "lock"
  }, lang === "es" ? "Entrar" : "Enter")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 30,
      paddingTop: 22,
      borderTop: "1px solid var(--divider)",
      display: "flex",
      gap: 11,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      width: 34,
      height: 34,
      borderRadius: "50%",
      background: "var(--color-peach-12)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "key",
    size: 15,
    color: "var(--fg)"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      letterSpacing: "var(--tr-normal)",
      lineHeight: 1.65,
      color: "var(--fg-muted)",
      margin: 0
    }
  }, lang === "es" ? "Tu contraseña por defecto es " : "Your default password is ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--fg)",
      fontWeight: 600
    }
  }, "spacioam"), lang === "es" ? ". Puedes cambiarla en Mi cuenta." : ". You can change it under My account.")))));
}
Object.assign(window, {
  Login
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owner-dashboard/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owner-dashboard/Sections.jsx
try { (() => {
const {
  Card,
  SectionHead,
  Eyebrow,
  LineChart,
  Gauge,
  BarChart,
  Donut,
  SummaryTable,
  Farol,
  Select,
  Icon,
  Button,
  Trend,
  Amount
} = window.SpacioAMDesignSystem_2c08fe;
function Distribution({
  k
}) {
  const q = (v, size) => /*#__PURE__*/React.createElement(Amount, {
    value: v,
    currency: "GTQ",
    size: size || 15
  });
  const rows = [{
    label: "Ingreso neto",
    value: k.neto,
    amount: q(k.neto)
  }, {
    label: "Fee Spacio AM",
    value: k.fee,
    amount: q(k.fee)
  }, {
    label: "Insumos & gastos",
    value: Math.round(k.bruto * 0.11),
    amount: q(Math.round(k.bruto * 0.11))
  }, {
    label: "IVA",
    value: Math.round(k.bruto * 0.1),
    amount: q(Math.round(k.bruto * 0.1))
  }, {
    label: "Reparaciones",
    value: Math.round(k.bruto * 0.01),
    amount: q(Math.round(k.bruto * 0.01))
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "kit-section"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Distribuci\xF3n",
    title: "\xBFA d\xF3nde fue el dinero?",
    sub: "C\xF3mo se reparte tu operaci\xF3n entre lo que recibes y lo que cuesta."
  }), /*#__PURE__*/React.createElement(Card, {
    size: "lg"
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 200,
    total: q(k.bruto, 26),
    totalLabel: "Ingreso bruto",
    data: rows
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11.5,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)",
      margin: "var(--s-4) 0 0"
    }
  }, "El IVA mostrado corresponde al IVA total recaudado (due\xF1o + Spacio AM).")));
}
function Financial({
  k,
  money,
  moneyShort
}) {
  const D = window.KIT_DATA;
  return /*#__PURE__*/React.createElement("section", {
    className: "kit-section"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Financiero",
    title: "C\xF3mo se movi\xF3 el mes",
    sub: "Ingreso bruto contra neto, y qu\xE9 se qued\xF3 la comisi\xF3n."
  }), /*#__PURE__*/React.createElement("div", {
    className: "kit-fin"
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      letterSpacing: "0.2em"
    }
  }, "Neto"), /*#__PURE__*/React.createElement("div", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 28,
      letterSpacing: "-0.02em",
      color: "var(--fg)",
      marginTop: 6
    }
  }, money(k.neto))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      letterSpacing: "0.2em"
    }
  }, "Comisi\xF3n"), /*#__PURE__*/React.createElement("div", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 500,
      fontSize: 20,
      color: "var(--fg-muted)",
      marginTop: 6
    }
  }, money(k.fee)))), /*#__PURE__*/React.createElement(LineChart, {
    height: 230,
    labels: D.hist.labels,
    formatY: moneyShort,
    formatTip: v => money(v),
    series: [{
      name: "Ingreso bruto",
      values: D.hist.bruto
    }, {
      name: "Ingreso neto",
      values: D.hist.neto,
      accent: true
    }]
  })), /*#__PURE__*/React.createElement("div", {
    className: "kit-highlights"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Contexto"), [{
    i: "trendUp",
    t: "Temporada",
    b: "Agosto es tu mejor mes del semestre: +12% sobre julio y el bruto más alto del año."
  }, {
    i: "coins",
    t: "Comisión",
    b: "La comisión del mes fue " + money(k.fee) + ", un 15% del bruto según tu plan Full Management."
  }].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "kit-highlight"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kit-highlight-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: h.i,
    size: 17,
    color: "var(--fg)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "var(--tr-wide)",
      textTransform: "uppercase",
      color: "var(--fg)",
      marginBottom: 6
    }
  }, h.t), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      lineHeight: 1.65,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)",
      margin: 0
    }
  }, h.b)))))));
}
function Occupancy({
  k
}) {
  const D = window.KIT_DATA;
  return /*#__PURE__*/React.createElement("section", {
    className: "kit-section"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Ocupaci\xF3n",
    title: "Cu\xE1nto se vivi\xF3 tu espacio",
    sub: "Ajustada descuenta las noches que bloqueamos por mantenimiento."
  }), /*#__PURE__*/React.createElement("div", {
    className: "kit-occ"
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 26,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      alignSelf: "flex-start",
      letterSpacing: "0.2em"
    }
  }, "Ocupaci\xF3n ajustada"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "18px 0 6px"
    }
  }, /*#__PURE__*/React.createElement(Gauge, {
    value: k.occ,
    size: 210,
    sub: "Este mes"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 10,
      width: "100%",
      marginTop: 14
    }
  }, [["Ocupación total", k.occ + 4 + "%"], ["Noches vendidas", k.noches], ["Noches bloqueadas", 11]].map(([l, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: "center",
      padding: "12px 6px",
      background: "var(--bg-alt)",
      borderRadius: "var(--r-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-num",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 19,
      color: "var(--fg)"
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
      marginTop: 5,
      lineHeight: 1.3
    }
  }, l))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      letterSpacing: "0.2em"
    }
  }, "Ocupaci\xF3n ajustada \xB7 mensual"), /*#__PURE__*/React.createElement(BarChart, {
    height: 250,
    style: {
      marginTop: 18
    },
    data: D.hist.labels.map((l, i) => ({
      label: l,
      value: D.hist.occ[i],
      highlight: i === D.hist.labels.length - 1
    }))
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      lineHeight: 1.65,
      letterSpacing: "var(--tr-normal)",
      color: "var(--fg-muted)",
      margin: "14px 0 0"
    }
  }, "Bajaste 3 puntos contra julio, pero con una tarifa promedio 5% m\xE1s alta: menos noches, mejor pagadas."))));
}
function Admin({
  money,
  narrow
}) {
  const D = window.KIT_DATA;
  const [zona, setZona] = React.useState("all");
  const rows = (zona === "all" ? D.rows : D.rows.filter(r => r.z === zona)).map(r => ({
    p: r.p,
    z: r.z,
    neto: money(r.neto),
    occ: r.occ + "%",
    adr: money(r.adr),
    st: /*#__PURE__*/React.createElement(Farol, {
      state: r.st
    }, r.stl)
  }));
  return /*#__PURE__*/React.createElement("section", {
    className: "kit-section"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Administraci\xF3n",
    title: "Todas tus propiedades",
    sub: "La tabla-resumen es un lujo de escritorio: bajo 780px colapsa a cards.",
    right: /*#__PURE__*/React.createElement(Select, {
      icon: "pin",
      value: zona,
      onChange: setZona,
      minWidth: 160,
      options: [{
        value: "all",
        label: "Todas las zonas"
      }, {
        value: "Antigua",
        label: "Antigua"
      }, {
        value: "Ciudad",
        label: "Ciudad"
      }]
    })
  }), /*#__PURE__*/React.createElement(Card, {
    pad: narrow ? "var(--s-3)" : 0,
    style: {
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(SummaryTable, {
    collapse: narrow,
    rows: rows,
    columns: [{
      key: "p",
      header: "Propiedad"
    }, {
      key: "z",
      header: "Zona"
    }, {
      key: "neto",
      header: "Neto",
      num: true
    }, {
      key: "occ",
      header: "Ocupación",
      num: true
    }, {
      key: "adr",
      header: "ADR",
      num: true
    }, {
      key: "st",
      header: "Estado"
    }]
  })));
}
Object.assign(window, {
  Financial,
  Distribution,
  Occupancy,
  Admin
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owner-dashboard/Sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owner-dashboard/Summary.jsx
try { (() => {
const {
  Brushstroke,
  Wordmark,
  Eyebrow,
  KpiCard,
  Icon,
  Card,
  Amount
} = window.SpacioAMDesignSystem_2c08fe;
function Hero({
  prop,
  periodText,
  context
}) {
  const D = window.KIT_DATA;
  const isAll = prop === "all";
  const photo = D.photos[prop];
  return /*#__PURE__*/React.createElement("div", {
    className: "kit-hero"
  }, /*#__PURE__*/React.createElement("div", null, isAll ? /*#__PURE__*/React.createElement("div", {
    className: "kit-hero-all"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    variant: "stamp",
    height: 72,
    base: "../..",
    style: {
      opacity: .85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "clamp(22px,3vw,30px)",
      color: "var(--fg)",
      marginTop: 16,
      letterSpacing: "var(--tr-tight)"
    }
  }, "Todas las propiedades"), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginTop: 8
    }
  }, "3 propiedades")) : /*#__PURE__*/React.createElement(Brushstroke, {
    base: "../..",
    src: "../../assets/photos/" + photo,
    alt: "",
    height: 240,
    radius: "var(--r-xl)",
    overlay: /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "var(--s-4)",
        background: "linear-gradient(180deg,transparent 40%,rgba(62,63,63,.62))"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: "rgba(250,250,250,0.88)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 13,
      color: "var(--accent)"
    }), D.locations[prop]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-serif)",
        fontSize: "clamp(24px,3.2vw,34px)",
        color: "var(--fg-inverse)",
        letterSpacing: "var(--tr-tight)",
        lineHeight: 1.08,
        marginTop: 8
      }
    }, D.props.find(p => p.value === prop).label))
  })), /*#__PURE__*/React.createElement("div", {
    className: "kit-hero-ctx"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, periodText), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-serif)",
      fontWeight: 300,
      fontSize: "clamp(20px,2.5vw,27px)",
      lineHeight: 1.25,
      letterSpacing: "var(--tr-tight)",
      color: "var(--fg)",
      margin: "16px 0 0",
      textWrap: "pretty"
    }
  }, context), /*#__PURE__*/React.createElement("a", {
    className: "kit-listing",
    href: "#",
    onClick: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "link",
    size: 14,
    color: "var(--fg-muted)"
  }), " spacioam.com/casa-de-la-luz")));
}
function SummaryKPIs({
  k,
  money,
  currency
}) {
  const amt = (v, size) => /*#__PURE__*/React.createElement(Amount, {
    value: v,
    currency: currency,
    size: size
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "kit-kpis"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    big: true,
    accent: true,
    label: "Ingreso neto",
    value: amt(k.neto, 42),
    trend: k.d.neto,
    help: "Lo que recibes t\xFA, despu\xE9s de todo."
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Ingreso bruto",
    value: amt(k.bruto, 30),
    trend: k.d.bruto,
    help: "Ingresos antes de gastos y comisi\xF3n."
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Ocupaci\xF3n ajustada",
    value: k.occ + "%",
    trend: k.d.occ,
    help: "Sobre noches realmente disponibles."
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Precio por noche",
    value: amt(k.adr, 30),
    trend: k.d.adr,
    help: "Precio promedio por noche."
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Estad\xEDas",
    value: k.estadias,
    trend: k.d.estadias,
    help: "Reservas completadas."
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Noches reservadas",
    value: k.noches,
    trend: k.d.noches,
    help: "Total de noches vendidas."
  }));
}
Object.assign(window, {
  Hero,
  SummaryKPIs
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owner-dashboard/Summary.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owner-dashboard/data.js
try { (() => {
window.KIT_DATA = {
  owner: {
    name: "Ana Morales",
    email: "ana@spacioam.com",
    initials: "AM"
  },
  months: [{
    value: "2026-08",
    label: "Agosto 2026"
  }, {
    value: "2026-07",
    label: "Julio 2026"
  }, {
    value: "2026-06",
    label: "Junio 2026"
  }],
  props: [{
    value: "all",
    label: "Todas las propiedades",
    sub: "3 propiedades"
  }, {
    value: "luz",
    label: "Casa de la Luz Dorada",
    sub: "Antigua Guatemala"
  }, {
    value: "suite",
    label: "Suite Editorial nº 04",
    sub: "Ciudad de Guatemala"
  }, {
    value: "nook",
    label: "Nook Antigua",
    sub: "Antigua Guatemala"
  }],
  photos: {
    all: null,
    luz: "living.jpeg",
    suite: "bedroom.jpeg",
    nook: "nook.jpeg"
  },
  locations: {
    luz: "Antigua Guatemala",
    suite: "Ciudad de Guatemala",
    nook: "Antigua Guatemala"
  },
  kpis: {
    "2026-08": {
      neto: 48320,
      bruto: 61900,
      occ: 87,
      adr: 640,
      estadias: 19,
      noches: 232,
      fee: 9285,
      d: {
        neto: 12.4,
        bruto: 9.8,
        occ: -3.1,
        adr: 4.8,
        estadias: 5.6,
        noches: 2.2
      }
    },
    "2026-07": {
      neto: 43000,
      bruto: 56400,
      occ: 90,
      adr: 611,
      estadias: 18,
      noches: 227,
      fee: 8460,
      d: {
        neto: 7.2,
        bruto: 5.1,
        occ: 4.4,
        adr: -1.2,
        estadias: 0,
        noches: 3.1
      }
    },
    "2026-06": {
      neto: 39000,
      bruto: 52100,
      occ: 85,
      adr: 598,
      estadias: 18,
      noches: 220,
      fee: 7815,
      d: {
        neto: -1.8,
        bruto: 2.4,
        occ: -2.0,
        adr: 1.1,
        estadias: -5.2,
        noches: -1.4
      }
    }
  },
  hist: {
    labels: ["Mar", "Abr", "May", "Jun", "Jul", "Ago"],
    bruto: [48200, 51400, 49800, 52100, 56400, 61900],
    neto: [36800, 39900, 38100, 39000, 43000, 48320],
    occ: [74, 80, 77, 85, 90, 87]
  },
  rows: [{
    p: "Casa de la Luz Dorada",
    z: "Antigua",
    neto: 18420,
    occ: 91,
    adr: 705,
    st: "success",
    stl: "Al día"
  }, {
    p: "Suite Editorial nº 04",
    z: "Ciudad",
    neto: 12180,
    occ: 84,
    adr: 588,
    st: "attention",
    stl: "Falta factura"
  }, {
    p: "Nook Antigua",
    z: "Antigua",
    neto: 9640,
    occ: 78,
    adr: 512,
    st: "success",
    stl: "Al día"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owner-dashboard/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Brushstroke = __ds_scope.Brushstroke;

__ds_ns.ICON_PATHS = __ds_scope.ICON_PATHS;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.Sparkle = __ds_scope.Sparkle;

__ds_ns.Amount = __ds_scope.Amount;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardMedia = __ds_scope.CardMedia;

__ds_ns.DOMAIN_CATEGORIES = __ds_scope.DOMAIN_CATEGORIES;

__ds_ns.DomainBadge = __ds_scope.DomainBadge;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.SectionHead = __ds_scope.SectionHead;

__ds_ns.Farol = __ds_scope.Farol;

__ds_ns.JobCard = __ds_scope.JobCard;

__ds_ns.PropertyCard = __ds_scope.PropertyCard;

__ds_ns.Calendar = __ds_scope.Calendar;

__ds_ns.Donut = __ds_scope.Donut;

__ds_ns.KpiCard = __ds_scope.KpiCard;

__ds_ns.Trend = __ds_scope.Trend;

__ds_ns.SERIES = __ds_scope.SERIES;

__ds_ns.LineChart = __ds_scope.LineChart;

__ds_ns.Gauge = __ds_scope.Gauge;

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.SummaryTable = __ds_scope.SummaryTable;

__ds_ns.EMAIL_HEX = __ds_scope.EMAIL_HEX;

__ds_ns.EmailLayout = __ds_scope.EmailLayout;

__ds_ns.LoadingScreen = __ds_scope.LoadingScreen;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Bento = __ds_scope.Bento;

__ds_ns.BentoTile = __ds_scope.BentoTile;

__ds_ns.BottomNav = __ds_scope.BottomNav;

__ds_ns.Collapsible = __ds_scope.Collapsible;

__ds_ns.Segmented = __ds_scope.Segmented;

__ds_ns.TabNav = __ds_scope.TabNav;

__ds_ns.PillTabs = __ds_scope.PillTabs;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.PillNav = __ds_scope.PillNav;

})();
