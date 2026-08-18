// app.js — QuoteIt v1 prototype. Preact + htm, no build step.
// Screens: Today, Appointments, Add Room, Rooms (hub), Pick radiators, Estimate,
// Signature (customer acceptance + capture), My quotes. Bottom tab bar switches
// between Today / Appointments / Quote / My quotes; the quote flow (Add
// Room..Signature) lives inside the Quote tab exactly as before.

import { h, render } from "./vendor/preact.mjs";
import { useState, useEffect, useMemo, useRef } from "./vendor/hooks.mjs";
import htm from "./vendor/htm.mjs";
import {
  priceRadiatorLine,
  radiatorsSubtotal,
  nhsDiscount,
  installationPrice,
  removalPrice,
  accessoriesSubtotal,
  depositAmount,
  balanceRemaining,
  round2,
} from "./pricing.js";

const html = htm.bind(h);

const STORAGE_KEY = "quoteit_v1_state";
const QUOTE_HISTORY_KEY = "quoteit_quote_history_v1";

// ---------- inline SVG icons (no icon libraries, no emoji) ----------

const ChevronLeft = () =>
  html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

const Plus = () =>
  html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

const Minus = () =>
  html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

const IconToday = () =>
  html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="3" x2="8" y2="7"></line><line x1="16" y1="3" x2="16" y2="7"></line><circle cx="12" cy="15" r="2"></circle></svg>`;

const IconAppointments = () =>
  html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="7" y1="13" x2="13" y2="13"></line><line x1="7" y1="17" x2="11" y2="17"></line></svg>`;

const IconQuote = () =>
  html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 L18 2 L18 22 L6 22 Z"></path><line x1="9" y1="7" x2="15" y2="7"></line><line x1="9" y1="11" x2="15" y2="11"></line><line x1="9" y1="15" x2="13" y2="15"></line></svg>`;

const IconMyQuotes = () =>
  html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>`;

const IconPhone = () =>
  html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"></path></svg>`;

// ---------- animated wordmark (ported faithfully from static/logo.html — the
// identity source of truth; the timeline was tuned over five owner-review
// passes, do not "improve" the motion, only the wiring around it) ----------

const LOGO_INK = "#1a1a1a";
const LOGO_RED = "#ff0403";

const LOGO_TEXT_X = 24;
const LOGO_TEXT_Y = 210;
const LOGO_FONT_SIZE = 170;
const LOGO_SWOOSH_D = "M 22 240 C 150 262, 330 262, 470 234 C 535 220, 580 212, 618 192";

function logoWordmarkMarkup() {
  return (
    '<text class="wordmark" x="' + LOGO_TEXT_X + '" y="' + LOGO_TEXT_Y + '" ' +
    'font-family="Archivo, -apple-system, BlinkMacSystemFont, sans-serif" ' +
    'font-weight="900" font-size="' + LOGO_FONT_SIZE + '">' +
      '<tspan class="capq" fill="' + LOGO_INK + '">Q</tspan>' +
      '<tspan fill="' + LOGO_INK + '">uote</tspan>' +
      '<tspan class="islot" fill="none" dx="16">I</tspan>' +
      '<tspan fill="' + LOGO_RED + '" dx="10">t</tspan>' +
    '</text>' +
    '<path class="swoosh" d="' + LOGO_SWOOSH_D + '" fill="none" stroke="' + LOGO_RED + '" ' +
      'stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<g class="pen-group" opacity="0">' +
      '<path class="pen-body" fill="' + LOGO_RED + '"></path>' +
      '<rect class="pen-clip" fill="' + LOGO_INK + '" opacity="0.85"></rect>' +
      '<circle class="pen-tip" fill="' + LOGO_INK + '"></circle>' +
    '</g>'
  );
}

// slim straight ballpoint drawn nib-at-origin pointing +x — see logo.html for
// the full rationale (no curves so it stays sharp at small sizes)
function logoBuildPenPathD(len, w) {
  var nibBaseX = -len * 0.16;
  var shoulderX = -len * 0.86;
  var tailX = -len;
  var shaftHalf = w * 0.5;
  var capHalf = shaftHalf * 0.82;
  return (
    "M0,0" +
    " L" + nibBaseX + "," + -shaftHalf +
    " L" + shoulderX + "," + -shaftHalf +
    " L" + shoulderX + "," + -capHalf +
    " L" + tailX + "," + -capHalf +
    " L" + tailX + "," + capHalf +
    " L" + shoulderX + "," + capHalf +
    " L" + shoulderX + "," + shaftHalf +
    " L" + nibBaseX + "," + shaftHalf +
    " Z"
  );
}

function logoBuildPenClipRect(len, w) {
  var shaftHalf = w * 0.5;
  var capHalf = shaftHalf * 0.82;
  var x1 = -len * 0.9;
  var x2 = -len * 0.76;
  var thickness = w * 0.14;
  return { x: x1, y: -capHalf - thickness, width: x2 - x1, height: thickness };
}

// cubic-bezier(x1,y1,x2,y2) solver — CSS semantics, designer-readable curves
function logoCubicBezier(x1, y1, x2, y2) {
  function sampleX(t) {
    var mt = 1 - t;
    return 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
  }
  function sampleY(t) {
    var mt = 1 - t;
    return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
  }
  return function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var lo = 0, hi = 1, t = x;
    for (var i = 0; i < 24; i++) {
      var cx = sampleX(t);
      if (Math.abs(cx - x) < 0.0005) break;
      if (cx < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

const LOGO_EASE_ENTRANCE = logoCubicBezier(0.16, 1, 0.3, 1); // crisp UI entrance
const LOGO_EASE_DRAW = logoCubicBezier(0.55, 0.06, 0.25, 1); // bite -> sweep -> feather off
const LOGO_EASE_FLIGHT = logoCubicBezier(0.42, 0.05, 0.16, 1); // gentle pick-up -> settle

function logoEaseOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function logoCubicBezierPoint(p0, p1, p2, p3, t) {
  var mt = 1 - t;
  var a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

// a human hand holds the pen at a FIXED writing tilt for the whole stroke
// (nib down-left, barrel up-right); only the nib position tracks the path
const LOGO_WRITE_ANGLE = 140;
const LOGO_FINAL_ANGLE = 90; // nib straight down, standing as the I

/** The QuoteIt animated wordmark, ported faithfully from static/logo.html.
 *  Plays once on mount; `static` renders the final lockup immediately with
 *  no animation (used in the app header). Respects prefers-reduced-motion. */
function AnimatedLogo({ static: isStatic }) {
  const svgRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    svg.innerHTML = logoWordmarkMarkup();

    let cancelled = false;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function applyPenShape(penD, clipRect, tipR) {
      svg.querySelector(".pen-body").setAttribute("d", penD);
      var clip = svg.querySelector(".pen-clip");
      clip.setAttribute("x", clipRect.x);
      clip.setAttribute("y", clipRect.y);
      clip.setAttribute("width", clipRect.width);
      clip.setAttribute("height", clipRect.height);
      svg.querySelector(".pen-tip").setAttribute("r", tipR);
    }

    function setFinalState(finalCx, finalNibY) {
      var text = svg.querySelector(".wordmark");
      var swoosh = svg.querySelector(".swoosh");
      var penGroup = svg.querySelector(".pen-group");
      text.style.opacity = "1";
      text.style.transform = "translateY(0px)";
      swoosh.style.strokeDasharray = "none";
      swoosh.style.strokeDashoffset = "0";
      penGroup.setAttribute("opacity", "1");
      penGroup.setAttribute(
        "transform",
        "translate(" + finalCx + "," + finalNibY + ") rotate(" + LOGO_FINAL_ANGLE + ")"
      );
    }

    function setHiddenState() {
      var text = svg.querySelector(".wordmark");
      var swoosh = svg.querySelector(".swoosh");
      var penGroup = svg.querySelector(".pen-group");
      var len = swoosh.getTotalLength();
      text.style.opacity = "0";
      text.style.transform = "translateY(10px)";
      swoosh.style.strokeDasharray = len;
      swoosh.style.strokeDashoffset = len;
      penGroup.setAttribute("opacity", "0");
    }

    function init() {
      if (cancelled) return;
      var islot = svg.querySelector(".islot");
      var capq = svg.querySelector(".capq");
      if (!islot || !capq) return;
      var bbox = islot.getBBox();
      // height reference = the capital Q's ink box; a hidden glyph's own
      // bbox over-reports and makes the pen tower over the wordmark
      var capBox = capq.getBBox();

      var finalCx = bbox.x + bbox.width / 2;
      var finalNibY = bbox.y + bbox.height;

      var penLen = (finalNibY - capBox.y) * 1.02;
      var penW = penLen * 0.11;
      var penD = logoBuildPenPathD(penLen, penW);
      var clipRect = logoBuildPenClipRect(penLen, penW);
      var tipR = penW * 0.16;

      applyPenShape(penD, clipRect, tipR);

      if (isStatic || reduceMotion) {
        setFinalState(finalCx, finalNibY);
        return;
      }

      setHiddenState();

      var text = svg.querySelector(".wordmark");
      var swoosh = svg.querySelector(".swoosh");
      var penGroup = svg.querySelector(".pen-group");
      var totalLen = swoosh.getTotalLength();

      function setPen(x, y, angle) {
        penGroup.setAttribute("transform", "translate(" + x + "," + y + ") rotate(" + angle + ")");
      }

      // one continuous timeline, one clock, evaluated per frame
      // fade 350 | draw 800 (starts at 250, overlapping the fade) | flight 850
      var D_FADE = 350, D_DRAW = 800, D_FLIGHT = 850;
      var T_DRAW_START = 250;
      var T_DRAW_END = T_DRAW_START + D_DRAW;
      var T_FLIGHT_END = T_DRAW_END + D_FLIGHT;

      // rotation reaches vertical by 75% of the flight — the last stretch is
      // a pure vertical slide of an already-vertical pen
      var FLIGHT_ROTATE_FRACTION = 0.75;

      // the whole airborne move is ONE cubic Bezier: C1 pulls up-forward (the
      // pick-up), C2 sits directly above the slot so the arrival tangent is
      // exactly vertical — lands dead-on at t=1 by construction
      var drawEndPoint = swoosh.getPointAtLength(totalLen);
      var finalPoint = { x: finalCx, y: finalNibY };
      var flightC1 = { x: drawEndPoint.x + penLen * 0.1, y: drawEndPoint.y - penLen * 0.6 };
      var flightC2 = { x: finalPoint.x, y: Math.min(drawEndPoint.y, finalPoint.y) - penLen * 0.42 };

      var start = null;

      function frame(now) {
        if (cancelled) return;
        if (start === null) start = now;
        var elapsed = now - start;

        var fe = LOGO_EASE_ENTRANCE(Math.min(1, elapsed / D_FADE));
        text.style.opacity = fe;
        text.style.transform = "translateY(" + (10 * (1 - fe)) + "px)";

        if (elapsed < T_DRAW_START) {
          penGroup.setAttribute("opacity", "0");
        } else if (elapsed <= T_DRAW_END) {
          penGroup.setAttribute("opacity", "1");
          var dt = (elapsed - T_DRAW_START) / D_DRAW;
          var len = LOGO_EASE_DRAW(dt) * totalLen;
          swoosh.style.strokeDashoffset = totalLen - len;
          var pt = swoosh.getPointAtLength(len);
          // fixed writing tilt + a subtle organic wobble that fades to
          // exactly zero over the last 10% of the stroke
          var wobbleEnvelope = dt < 0.9 ? 1 : Math.max(0, 1 - (dt - 0.9) / 0.1);
          var angle = LOGO_WRITE_ANGLE + 3 * Math.sin(dt * Math.PI * 2.6) * wobbleEnvelope;
          setPen(pt.x, pt.y, angle);
        } else if (elapsed <= T_FLIGHT_END) {
          var atT = LOGO_EASE_FLIGHT((elapsed - T_DRAW_END) / D_FLIGHT);
          var pos = logoCubicBezierPoint(drawEndPoint, flightC1, flightC2, finalPoint, atT);
          var rotT = Math.min(1, atT / FLIGHT_ROTATE_FRACTION);
          var angle = LOGO_WRITE_ANGLE + (LOGO_FINAL_ANGLE - LOGO_WRITE_ANGLE) * logoEaseOutCubic(rotT);
          setPen(pos.x, pos.y, angle);
          if (elapsed >= T_FLIGHT_END) return;
        } else {
          setPen(finalPoint.x, finalPoint.y, LOGO_FINAL_ANGLE);
          return;
        }

        rafRef.current = requestAnimationFrame(frame);
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(init);
    } else if (typeof window !== "undefined") {
      window.addEventListener("load", init);
    }

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isStatic]);

  return html`<svg
    ref=${svgRef}
    class=${`brand-logo${isStatic ? " brand-logo-static" : ""}`}
    viewBox="0 0 700 300"
    xmlns="http://www.w3.org/2000/svg"
  ></svg>`;
}

// ---------- state helpers ----------

function defaultState() {
  return {
    rooms: [],
    accessories: { appHub: false, timer: false, fuseSpur: false, towelLarge: 0, towelSmall: 0 },
    removal: { count: 0, electric: false },
    nhsOn: false,
    supplyOnly: false,
    depositRate: 0.5,
    screen: "rooms",
    activeRoomId: null,
    // ---- navigation / booking-data additions ----
    activeTab: "today",
    quoteCustomer: null, // { name, address, leadId } set by "Start quote"
    draftOwner: null, // username stamped when a quote is started — shared-device guard
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    return defaultState();
  }
}

// ---------- quote history (My quotes tab) ----------

function loadQuoteHistory() {
  try {
    const raw = localStorage.getItem(QUOTE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveQuoteToHistory(entry) {
  const history = loadQuoteHistory();
  history.unshift(entry);
  localStorage.setItem(QUOTE_HISTORY_KEY, JSON.stringify(history));
}

function depositLabel(rate) {
  if (rate === 0.5) return "50% deposit";
  if (rate === 0.25) return "25% deposit";
  return "No payment today";
}

/**
 * Pure pricing breakdown for a quote's current config (rooms/accessories/removal/
 * nhsOn/depositRate) — the single source of truth shared by the Estimate screen,
 * the Signature/save step and the My quotes read-only detail view, so all three
 * price the same way through pricing.js.
 */
function buildQuoteBreakdown(state, catalogue) {
  const totalRadiatorCount = state.rooms.reduce((s, r) => s + roomRadiatorCount(r), 0);
  const totalQuotedKw = state.rooms.reduce((s, r) => s + roomQuotedKw(r, catalogue), 0);

  const roomLines = state.rooms.map((room) => {
    const lines = Object.entries(room.radiators || {})
      .filter(([, qty]) => qty > 0)
      .map(([code, qty]) => {
        const model = catalogue.radiators.find((m) => m.code === code);
        const priced = priceRadiatorLine(model.price, qty, room.colour, state.supplyOnly);
        return { code, qty, model, ...priced };
      });
    return { room, lines };
  });

  const allLines = roomLines.flatMap((rl) => rl.lines);
  const radSubtotal = radiatorsSubtotal(allLines);
  const discount = nhsDiscount(radSubtotal, state.nhsOn);

  const colourUpliftByRoom = roomLines.map(({ room, lines }) => {
    if (!room.colour) return null;
    // Pure colour uplift, before any supply-only markup on top (colourAdjusted
    // is the price after colour but before the supply x1.2+50 step).
    const uplift = lines.reduce((s, l) => s + (l.colourAdjusted - l.model.price) * l.qty, 0);
    return { room, uplift: round2(uplift) };
  });

  const accessoryItems = [];
  const accessoryDisplay = [];

  accessoryDisplay.push({ label: "Protostat (included, 1/radiator)", price: 0, included: true });

  state.rooms.forEach((room) => {
    if (room.rfRelay) {
      const count = roomRadiatorCount(room);
      if (count > 0) {
        accessoryItems.push({ price: 50, qty: count });
        accessoryDisplay.push({ label: `RF Relay — ${room.name} (${count})`, price: round2(50 * count) });
      }
    }
    if (room.wirelessThermostat) {
      accessoryItems.push({ price: 100, qty: 1 });
      accessoryDisplay.push({ label: `Wireless thermostat — ${room.name}`, price: 100 });
    }
  });

  if (state.accessories.appHub) {
    accessoryItems.push({ price: 150, qty: 1 });
    accessoryDisplay.push({ label: "App Hub", price: 150 });
  }
  if (state.accessories.timer) {
    accessoryItems.push({ price: 100, qty: 1 });
    accessoryDisplay.push({ label: "Timer", price: 100 });
  }
  if (state.accessories.fuseSpur) {
    accessoryItems.push({ price: 30, qty: 1 });
    accessoryDisplay.push({ label: "Fuse spur", price: 30 });
  }
  if (state.accessories.towelLarge > 0) {
    accessoryItems.push({ price: 350, qty: state.accessories.towelLarge });
    accessoryDisplay.push({
      label: `Towel rail large 600W × ${state.accessories.towelLarge}`,
      price: round2(350 * state.accessories.towelLarge),
    });
  }
  if (state.accessories.towelSmall > 0) {
    accessoryItems.push({ price: 250, qty: state.accessories.towelSmall });
    accessoryDisplay.push({
      label: `Towel rail small 400W × ${state.accessories.towelSmall}`,
      price: round2(250 * state.accessories.towelSmall),
    });
  }

  const accTotal = accessoriesSubtotal(accessoryItems);
  // Supply-only = no visit: installation and removal disappear entirely (owner ruling).
  const installTotal = state.supplyOnly ? 0 : installationPrice(totalRadiatorCount);
  const removalTotal = state.supplyOnly ? 0 : removalPrice(state.removal.count, state.removal.electric);

  const total = round2(radSubtotal - discount + accTotal + installTotal + removalTotal);
  const deposit = depositAmount(total, state.depositRate);
  const balance = balanceRemaining(total, deposit);

  return {
    totalRadiatorCount,
    totalQuotedKw,
    roomLines,
    colourUpliftByRoom,
    accessoryDisplay,
    radSubtotal,
    discount,
    accTotal,
    installTotal,
    removalTotal,
    total,
    deposit,
    balance,
  };
}

/**
 * Builds a My-quotes history entry from the in-progress quote, priced fresh
 * through buildQuoteBreakdown at save time (owner ruling: totals are computed
 * AT SAVE TIME, not carried over from an earlier screen render).
 */
function buildQuoteEntry(state, catalogue, repName, sigData = { signature: null, signedAt: null, financeIndependent: false }) {
  const b = buildQuoteBreakdown(state, catalogue);
  const customer = currentCustomer(state);
  return {
    id: makeId(),
    savedAt: new Date().toISOString(),
    repName,
    customer: {
      name: customer.name,
      postcode: customer.address,
      leadId: state.quoteCustomer ? state.quoteCustomer.leadId : null,
    },
    snapshot: {
      rooms: state.rooms,
      accessories: state.accessories,
      removal: state.removal,
      nhsOn: state.nhsOn,
      supplyOnly: state.supplyOnly,
      depositRate: state.depositRate,
    },
    totals: {
      radiatorsSubtotal: b.radSubtotal,
      nhsDiscount: b.discount,
      install: b.installTotal,
      removal: b.removalTotal,
      accessories: b.accTotal,
      total: b.total,
      depositAmount: b.deposit,
      balance: b.balance,
    },
    paymentChoice: depositLabel(state.depositRate),
    // Customer acceptance step (Signature screen) — signature is a PNG data URL
    // or null when the rep chose "Save without signature"; financeIndependent
    // is the paper-form checkbox, never blocks saving either way.
    signature: sigData.signature,
    signedAt: sigData.signedAt,
    financeIndependent: !!sigData.financeIndependent,
  };
}

// ---------- appointment helpers ----------

/** "YYYY-MM-DD" for Europe/London today, matching the fixture's date format. */
function todayLondonISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

/** "0xxxxxxxxxxx" display form of a digits-only 44-prefixed number; "" if absent. */
function formatPhoneDisplay(digits) {
  if (!digits) return "";
  if (digits.startsWith("44")) return "0" + digits.slice(2);
  return "+" + digits;
}

function formatApptDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "Today" / "Tomorrow" / "Yesterday", else "Mon 17 Aug" — reps think in days, not dates. */
function relativeDayLabel(isoDate) {
  const today = todayLondonISO();
  if (isoDate === today) return "Today";
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((new Date(`${isoDate}T12:00:00`) - new Date(`${today}T12:00:00`)) / dayMs);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatApptDate(isoDate);
}

function sortByDateTime(a, b) {
  const ka = `${a.appt_date} ${a.appt_start}`;
  const kb = `${b.appt_date} ${b.appt_start}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** Relative day (Today/Tomorrow/Yesterday/Mon 17 Aug) + London wall-clock time,
 * for a saved-at ISO timestamp — used on My quotes list + detail chip. */
function relativeSavedLabel(isoString) {
  const d = new Date(isoString);
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).formatToParts(d);
  const isoDate = `${dateParts.find((p) => p.type === "year").value}-${dateParts.find((p) => p.type === "month").value}-${dateParts.find((p) => p.type === "day").value}`;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${relativeDayLabel(isoDate)} · ${time}`;
}

/** crypto.randomUUID needs a secure context — absent over plain http on the
 *  LAN (phone testing), which blanked the quote screen. Fall back gracefully. */
function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function newRoomDraft() {
  return {
    id: makeId(),
    name: "",
    length: "",
    width: "",
    height: "",
    factor: 5,
    radiators: {},
    colour: false,
    rfRelay: false,
    wirelessThermostat: false,
  };
}

function roomVolume(room) {
  const l = parseFloat(room.length) || 0;
  const w = parseFloat(room.width) || 0;
  const h = parseFloat(room.height) || 0;
  return l * w * h;
}

function roomNeededKw(room) {
  return (roomVolume(room) * room.factor) / 100;
}

function roomRadiatorCount(room) {
  return Object.values(room.radiators || {}).reduce((s, q) => s + q, 0);
}

function roomQuotedKw(room, catalogue) {
  if (!catalogue) return 0;
  let kw = 0;
  for (const [code, qty] of Object.entries(room.radiators || {})) {
    if (!qty) continue;
    const model = catalogue.radiators.find((r) => r.code === code);
    if (model) kw += model.kw * qty;
  }
  return kw;
}

/** The active quote's customer — always set from a today-appointment via "Start quote". */
function currentCustomer(state) {
  return state.quoteCustomer || { name: "", address: "" };
}

/** A quote may only be open for a customer whose appointment is TODAY (owner ruling). */
function quoteCustomerValidToday(state) {
  return !!(state.quoteCustomer && state.quoteCustomer.apptDate === todayLondonISO());
}

// ---------- shared bits ----------

function Header({ title, sub, chip, onBack }) {
  return html`
    <div class="header">
      ${onBack &&
      html`<div class="header-back" onClick=${onBack}><${ChevronLeft} /></div>`}
      <div class="header-titles">
        <p class="header-title">${title}</p>
        ${sub && html`<p class="header-sub">${sub}</p>`}
      </div>
      ${chip && html`<div class="chip">${chip}</div>`}
    </div>
  `;
}

function TopLinks({ onReset, onSignOut }) {
  return html`
    <img class="brand-mark" src="/static/icons/icon-32.png" alt="QuoteIt" />
    <div class="top-links">
      <button class="reset-link" onClick=${onReset}>Reset quote</button>
      <button class="reset-link" onClick=${onSignOut}>Sign out</button>
    </div>
  `;
}

function Toast({ message }) {
  if (!message) return null;
  return html`<div class="toast">${message}</div>`;
}

function StatusChip({ status }) {
  const label = status === "cancelled" ? "Cancelled" : "Active";
  return html`<span class="status-chip status-${status || "active"}">${label}</span>`;
}

/** tel: href for a digits-only phone number. shared/phone.py already strips a
 *  leading 0 to a 44 prefix before storage, but this stays defensive in case
 *  older data slips through with the 0 still in place. */
function telHref(digits) {
  if (!digits) return "";
  if (digits.startsWith("44")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+44${digits.slice(1)}`;
  return `tel:+${digits}`;
}

/** Phone number hidden behind a tap — never shown by default in a card list.
 *  Once revealed it renders as a real tel: link so a tap dials straight out;
 *  it does not toggle back to hidden (a second tap should dial, not hide). */
function PhoneReveal({ label, digits }) {
  const [revealed, setRevealed] = useState(false);
  if (!digits) return null;
  return html`
    <div class="phone-reveal" onClick=${(e) => { e.stopPropagation(); if (!revealed) setRevealed(true); }}>
      <${IconPhone} />
      <span class="phone-reveal-label">${label}:</span>
      ${revealed
        ? html`<a class="phone-reveal-link" href=${telHref(digits)} onClick=${(e) => e.stopPropagation()}>${formatPhoneDisplay(digits)}</a>`
        : html`<span class="phone-reveal-value">tap to reveal</span>`}
    </div>
  `;
}

// ---------- Bottom tab bar ----------

const TABS = [
  { key: "today", label: "Today", icon: IconToday },
  { key: "appointments", label: "Appointments", icon: IconAppointments },
  { key: "quote", label: "Quote", icon: IconQuote },
  { key: "myQuotes", label: "My quotes", icon: IconMyQuotes },
];

function TabBar({ activeTab, onSelect }) {
  return html`
    <div class="tab-bar">
      ${TABS.map(
        (t) => html`
          <div class=${`tab-bar-item ${activeTab === t.key ? "selected" : ""}`} onClick=${() => onSelect(t.key)}>
            <${t.icon} />
            <span>${t.label}</span>
          </div>
        `
      )}
    </div>
  `;
}

// ---------- Login screen ----------

function LoginScreen({ onLogin, error, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit() {
    if (loading || !username || !password) return;
    onLogin(username, password);
  }

  return html`
    <div class="screen">
      <div class="login-logo"><${AnimatedLogo} /></div>
      <div class="body">
        <div class="field">
          <label>Username</label>
          <input
            type="text"
            autocomplete="username"
            value=${username}
            onInput=${(e) => setUsername(e.target.value)}
            onKeyDown=${(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div class="field">
          <label>Password</label>
          <input
            type="password"
            autocomplete="current-password"
            value=${password}
            onInput=${(e) => setPassword(e.target.value)}
            onKeyDown=${(e) => e.key === "Enter" && submit()}
          />
        </div>
        ${error && html`<p class="field-error">${error}</p>`}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" disabled=${loading} onClick=${submit}>Sign in</button>
      </div>
    </div>
  `;
}

// ---------- Appointment card (shared by Today + Appointments) ----------

function AppointmentCard({ appt, onClick, showDate }) {
  return html`
    <div class="appt-card" onClick=${onClick}>
      <div class="appt-card-top">
        <span class="appt-card-time">
          ${showDate && html`<span class="appt-card-date">${relativeDayLabel(appt.appt_date)}</span>`}
          ${appt.appt_start}
        </span>
        <${StatusChip} status=${appt.status} />
      </div>
      <div class="appt-card-name">${appt.customer}</div>
      <div class="appt-card-sub">${appt.postcode || "No postcode on file"}</div>
      <${PhoneReveal} label="Mobile" digits=${appt.mobile_phone_number || appt.phone_number} />
    </div>
  `;
}

// ---------- Today tab ----------

function TodayScreen({ appointments, rep, loading, onOpenAppointment }) {
  const today = todayLondonISO();
  const todays = appointments
    .filter((a) => a.appt_date === today && a.status === "active")
    .sort(sortByDateTime);
  const nextUpcoming = appointments
    .filter((a) => a.appt_date > today && a.status === "active")
    .sort(sortByDateTime)[0];

  return html`
    <div class="screen">
      <${Header} title="Today" sub=${rep} chip=${formatApptDate(today)} />
      <div class="body">
        ${loading && html`<p class="hero-advisory">Loading appointments…</p>`}
        ${!loading &&
        todays.length === 0 &&
        html`
          <p class="hero-advisory">No appointments today.</p>
          ${nextUpcoming &&
          html`
            <p class="section-label" style="margin-top:20px">Next upcoming</p>
            <${AppointmentCard} appt=${nextUpcoming} showDate=${true} onClick=${() => onOpenAppointment(nextUpcoming)} />
          `}
        `}
        ${todays.map(
          (a) => html`<${AppointmentCard} appt=${a} onClick=${() => onOpenAppointment(a)} />`
        )}
      </div>
    </div>
  `;
}

// ---------- Appointments tab ----------

function AppointmentsScreen({ appointments, rep, loading, onOpenAppointment }) {
  const today = todayLondonISO();
  // Upcoming only (owner ruling 16 Aug): past appointments were already quoted
  // on paper — they aren't workable inventory, so they don't appear here.
  const upcoming = appointments.filter((a) => a.appt_date >= today).sort(sortByDateTime);

  return html`
    <div class="screen">
      <${Header} title="Appointments" sub=${rep} chip=${`${upcoming.length} upcoming`} />
      <div class="body">
        ${loading && html`<p class="hero-advisory">Loading appointments…</p>`}
        ${!loading &&
        html`
          ${upcoming.length === 0 && html`<p class="hero-advisory">None upcoming.</p>`}
          ${upcoming.map(
            (a) => html`<${AppointmentCard} appt=${a} showDate=${true} onClick=${() => onOpenAppointment(a)} />`
          )}
        `}
      </div>
    </div>
  `;
}

// ---------- Quote tab landing (no valid today-customer selected) ----------

function QuotePickerScreen({ todays, rep, loading, onPick }) {
  return html`
    <div class="screen">
      <${Header} title="Quote" sub=${rep} chip=${`${todays.length} today`} />
      <div class="body">
        <p class="section-label">Quote today's appointments</p>
        ${loading && html`<p class="hero-advisory">Loading appointments…</p>`}
        ${!loading &&
        todays.length === 0 &&
        html`<p class="hero-advisory">
          No appointments today. Quoting opens from an appointment on the day of the visit.
        </p>`}
        ${todays.map((a) => html`<${AppointmentCard} appt=${a} onClick=${() => onPick(a)} />`)}
      </div>
    </div>
  `;
}

// ---------- Appointment detail ----------

function AppointmentDetailScreen({ appt, onBack, onStartQuote }) {
  return html`
    <div class="screen">
      <${Header} title=${appt.customer} sub=${`${formatApptDate(appt.appt_date)} · ${appt.appt_start}–${appt.appt_end}`} onBack=${onBack} />
      <div class="body">
        <div class="toggle-row"><span>Status</span><${StatusChip} status=${appt.status} /></div>
        <div class="toggle-row"><span>Rep</span><span>${appt.rep_name}</span></div>
        <div class="toggle-row"><span>Appointment type</span><span>${appt.appt_type || "—"}</span></div>
        ${appt.is_rebook && html`<div class="toggle-row"><span>Rebook</span><span>Yes</span></div>`}
        <hr class="divider" />
        <p class="section-label">Contact</p>
        <div class="toggle-row"><span>Postcode</span><span>${appt.postcode || "—"}</span></div>
        <div class="toggle-row"><span>Location</span><span>${appt.location || "—"}</span></div>
        <div class="toggle-row"><span>Email</span><span>${appt.email || "—"}</span></div>
        <div class="toggle-row"><span>Phone</span><span>${formatPhoneDisplay(appt.phone_number) || "—"}</span></div>
        <div class="toggle-row"><span>Mobile</span><span>${formatPhoneDisplay(appt.mobile_phone_number) || "—"}</span></div>
        <div class="toggle-row"><span>Alternative</span><span>${formatPhoneDisplay(appt.alt_phone_number) || "—"}</span></div>
        <hr class="divider" />
        <p class="section-label">Reference</p>
        <div class="toggle-row"><span>Lead ID</span><span>${appt.lead_id || "—"}</span></div>
      </div>
      <div class="btn-row">
        ${appt.appt_date === todayLondonISO()
          ? html`<button class="btn btn-primary" onClick=${onStartQuote}>Start quote</button>`
          : html`
              <div class="quote-locked-note">
                Quoting opens on the day of the appointment
                (${relativeDayLabel(appt.appt_date)})
              </div>
            `}
      </div>
    </div>
  `;
}

// ---------- My quotes tab ----------

function MyQuotesScreen({ history, repName, onOpen }) {
  // Own-data rule (owner ruling): a shared device must only ever list the
  // signed-in rep's own saved quotes. Entries saved before repName existed
  // have no owner at all — show those to everyone rather than hiding them.
  const mine = history
    .filter((q) => !q.repName || q.repName === repName)
    .slice()
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));

  return html`
    <div class="screen">
      <${Header} title="My quotes" chip=${`${mine.length}`} />
      <div class="body">
        ${mine.length === 0 &&
        html`<p class="hero-advisory">No saved quotes yet. Quotes you save after signing appear here.</p>`}
        ${mine.map(
          (q) => html`
            <div class="room-card" onClick=${() => onOpen(q)}>
              <div>
                <div class="room-card-name">${q.customer.name}</div>
                <div class="room-card-sub">${relativeSavedLabel(q.savedAt)}</div>
                <div class="badge-row">
                  <span class="room-card-badge">${q.paymentChoice}</span>
                  <span class="room-card-badge">${q.snapshot.rooms.length} room${q.snapshot.rooms.length === 1 ? "" : "s"}</span>
                  ${q.snapshot.supplyOnly && html`<span class="room-card-badge">Supply only</span>`}
                  ${q.signature && html`<span class="room-card-badge badge-signed">SIGNED</span>`}
                </div>
              </div>
              <div class="room-card-kw">£${q.totals.total.toFixed(2)}</div>
            </div>
          `
        )}
      </div>
    </div>
  `;
}

// ---------- My quotes tab — read-only saved quote detail ----------

function QuoteDetailScreen({ entry, catalogue, onBack }) {
  const snapshotState = {
    rooms: entry.snapshot.rooms,
    accessories: entry.snapshot.accessories,
    removal: entry.snapshot.removal,
    nhsOn: entry.snapshot.nhsOn,
    // Older saved entries predate supply-only mode — default to install (false).
    supplyOnly: entry.snapshot.supplyOnly || false,
    depositRate: entry.snapshot.depositRate,
  };
  const b = buildQuoteBreakdown(snapshotState, catalogue);

  return html`
    <div class="screen">
      <${Header}
        title=${entry.customer.name}
        sub=${entry.customer.postcode}
        chip=${`Saved ${relativeSavedLabel(entry.savedAt)}`}
        onBack=${onBack}
      />
      <div class="body">
        ${entry.signature &&
        html`
          <div class="badge-row" style="margin-bottom:12px">
            <span class="room-card-badge badge-signed">SIGNED</span>
          </div>
          <img class="signature-image" src=${entry.signature} alt="Customer signature" />
        `}

        <p class="section-label">Radiators</p>
        ${b.roomLines.map(
          ({ room, lines }) =>
            lines.length > 0 &&
            html`
              <div>
                <p style="font-weight:700;font-size:15px;margin:8px 0 4px">${room.name}</p>
                ${lines.map(
                  (l) => html`
                    <div class="estimate-line">
                      <span class="estimate-line-label">${l.qty} × ${l.code}</span>
                      <span class="estimate-line-price">£${l.lineTotal.toFixed(2)}</span>
                    </div>
                  `
                )}
              </div>
            `
        )}

        ${b.colourUpliftByRoom
          .filter(Boolean)
          .map(
            (c) => html`
              <div class="estimate-line">
                <span class="estimate-line-label">${c.room.name} — colour finish uplift (+20%)</span>
                <span class="estimate-line-price">£${c.uplift.toFixed(2)}</span>
              </div>
            `
          )}

        <hr class="divider" />
        <p class="section-label">Accessories</p>
        ${b.accessoryDisplay.map(
          (a) => html`
            <div class=${`estimate-line ${a.included ? "included" : ""}`}>
              <span class="estimate-line-label">${a.label}</span>
              <span class="estimate-line-price">${a.included ? "Included" : `£${a.price.toFixed(2)}`}</span>
            </div>
          `
        )}

        ${!snapshotState.supplyOnly &&
        html`
          <hr class="divider" />
          <p class="section-label">Installation & extras</p>
          <div class="estimate-line">
            <span class="estimate-line-label">Installation, ${b.totalRadiatorCount} radiator${b.totalRadiatorCount === 1 ? "" : "s"}</span>
            <span class="estimate-line-price">£${entry.totals.install.toFixed(2)}</span>
          </div>
          <div class="estimate-line">
            <span class="estimate-line-label">Removal & collection${entry.snapshot.removal.count ? ` (${entry.snapshot.removal.count})` : ""}</span>
            <span class="estimate-line-price">£${entry.totals.removal.toFixed(2)}</span>
          </div>
        `}

        ${entry.snapshot.nhsOn &&
        html`
          <hr class="divider" />
          <div class="estimate-line discount">
            <span class="estimate-line-label">NHS discount</span>
            <span class="estimate-line-price">−£${entry.totals.nhsDiscount.toFixed(2)}</span>
          </div>
        `}

        <hr class="divider" />
        <div class="total-hero">
          <p class="total-hero-label">Total</p>
          <p class="total-hero-value">£${entry.totals.total.toFixed(2)}</p>
          <p class="no-vat-note">
            ${snapshotState.supplyOnly
              ? "Prices include VAT — supply only (no installation)"
              : "No VAT to add — Trust installation (energy-saving relief)"}
          </p>
        </div>

        <p class="section-label">Payment</p>
        <div class="toggle-row">
          <span>${entry.paymentChoice}</span>
          <span>£${entry.totals.depositAmount.toFixed(2)}</span>
        </div>
        <div class="balance-line">
          <span>Balance on completion</span>
          <span>£${entry.totals.balance.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}

// ---------- Screen 01: Add Room ----------

function AddRoomScreen({ state, setState, catalogue, showToast }) {
  const [draft, setDraft] = useState(newRoomDraft());

  const volume = roomVolume(draft);
  const kw = (volume * draft.factor) / 100;

  const canSave = draft.name.trim() !== "" && volume > 0;

  function updateField(key, value) {
    setDraft({ ...draft, [key]: value });
  }

  function commitRoom() {
    if (!canSave) return null;
    return {
      ...draft,
      length: parseFloat(draft.length) || 0,
      width: parseFloat(draft.width) || 0,
      height: parseFloat(draft.height) || 0,
    };
  }

  function saveAndAddAnother() {
    const room = commitRoom();
    if (!room) return;
    setState({ ...state, rooms: [...state.rooms, room] });
    setDraft(newRoomDraft());
  }

  function doneMeasuring() {
    const room = commitRoom();
    const rooms = room ? [...state.rooms, room] : state.rooms;
    setState({ ...state, rooms, screen: "rooms" });
  }

  return html`
    <div class="screen">
      <${Header}
        title="Add room"
        sub=${`${currentCustomer(state).name} · ${currentCustomer(state).address}`}
        chip=${`Room ${state.rooms.length + 1}`}
        onBack=${state.rooms.length > 0 ? () => setState({ ...state, screen: "rooms" }) : null}
      />
      <div class="body">
        <div class="field">
          <label>Room name</label>
          <input
            type="text"
            placeholder="e.g. Living room"
            value=${draft.name}
            onInput=${(e) => updateField("name", e.target.value)}
          />
        </div>

        <div class="field">
          <label>Dimensions (m)</label>
          <div class="dim-cards">
            <div class="dim-card">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Length"
                value=${draft.length}
                onInput=${(e) => updateField("length", e.target.value)}
              />
            </div>
            <div class="dim-card">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Width"
                value=${draft.width}
                onInput=${(e) => updateField("width", e.target.value)}
              />
            </div>
            <div class="dim-card">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Height"
                value=${draft.height}
                onInput=${(e) => updateField("height", e.target.value)}
              />
            </div>
          </div>
        </div>

        <p class="volume-line">Room volume ${volume.toFixed(1)} m³</p>

        <p class="section-label">Insulation factor</p>
        ${catalogue.insulation_factors.map(
          (f) => html`
            <div
              class=${`card factor-card ${draft.factor === f.value ? "selected" : ""}`}
              onClick=${() => updateField("factor", f.value)}
            >
              <div class="factor-badge">${f.value}</div>
              <div>
                <div class="factor-title">${f.label}</div>
                <div class="factor-sub">${f.sub}</div>
              </div>
            </div>
          `
        )}

        <div class="hero">
          <span class="hero-number">${kw.toFixed(1)}</span><span class="hero-unit">kW</span>
          <p class="hero-caption">heating needed for this room</p>
          <p class="hero-advisory">Guide figure — quote what suits the customer</p>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" disabled=${!canSave} onClick=${saveAndAddAnother}>
          Save & add another room
        </button>
        <button class="btn btn-secondary" onClick=${doneMeasuring}>
          Done measuring — view rooms
        </button>
      </div>
    </div>
  `;
}

// ---------- Screen 02: Rooms (hub) ----------

function RoomsScreen({ state, setState, catalogue }) {
  const houseTotalKw = state.rooms.reduce((s, r) => s + roomNeededKw(r), 0);
  const allHaveRadiators =
    state.rooms.length > 0 && state.rooms.every((r) => roomRadiatorCount(r) > 0);

  function openRoom(room) {
    setState({ ...state, screen: "pickRadiators", activeRoomId: room.id });
  }

  function addAnotherRoom() {
    setState({ ...state, screen: "addRoom" });
  }

  function mainCta() {
    if (allHaveRadiators) {
      setState({ ...state, screen: "estimate" });
      return;
    }
    const target = state.rooms.find((r) => roomRadiatorCount(r) === 0) || state.rooms[0];
    if (target) setState({ ...state, screen: "pickRadiators", activeRoomId: target.id });
  }

  return html`
    <div class="screen">
      <${Header} title="Rooms" chip=${`${state.rooms.length} rooms`} />
      <div class="body">
        ${state.rooms.length === 0 &&
        html`<p class="hero-advisory">No rooms yet — add your first room below.</p>`}
        ${state.rooms.map((room) => {
          const vol = roomVolume(room);
          const kw = roomNeededKw(room);
          return html`
            <div class="room-card" onClick=${() => openRoom(room)}>
              <div>
                <div class="room-card-name">${room.name}</div>
                <div class="room-card-sub">
                  ${room.length} × ${room.width} × ${room.height} m · ${vol.toFixed(1)} m³
                </div>
                <span class="room-card-badge">Factor ${room.factor}</span>
              </div>
              <div class="room-card-kw">${kw.toFixed(1)} kW</div>
            </div>
          `;
        })}
        <div class="card dashed" onClick=${addAnotherRoom}>
          <${Plus} /> Add another room
        </div>

        ${state.rooms.length > 0 &&
        html`
          <div class="panel-strip">
            <span class="section-label" style="margin:0">House total</span>
            <span class="house-total-kw">${houseTotalKw.toFixed(1)} kW</span>
          </div>
        `}
      </div>
      ${state.rooms.length > 0 &&
      html`
        <div class="btn-row">
          <button class="btn btn-primary" onClick=${mainCta}>
            ${allHaveRadiators ? "View estimate" : "Choose radiators"}
          </button>
        </div>
      `}
    </div>
  `;
}

// ---------- Screen 03: Pick radiators ----------

function PickRadiatorsScreen({ state, setState, catalogue }) {
  const room = state.rooms.find((r) => r.id === state.activeRoomId);
  const [activeFamily, setActiveFamily] = useState(catalogue.families[0].key);

  if (!room) {
    return html`
      <div class="screen">
        <${Header} title="Pick radiators" onBack=${() => setState({ ...state, screen: "rooms" })} />
        <div class="body"><p>Room not found.</p></div>
      </div>
    `;
  }

  const neededKw = roomNeededKw(room);
  const quotedKw = roomQuotedKw(room, catalogue);
  const covered = quotedKw >= neededKw && neededKw > 0;
  const radiatorCount = roomRadiatorCount(room);

  function updateRoom(patch) {
    const rooms = state.rooms.map((r) => (r.id === room.id ? { ...r, ...patch } : r));
    setState({ ...state, rooms });
  }

  function setQty(code, qty) {
    const radiators = { ...room.radiators };
    if (qty <= 0) delete radiators[code];
    else radiators[code] = qty;
    updateRoom({ radiators });
  }

  return html`
    <div class="screen">
      <${Header}
        title="Pick radiators"
        sub=${`${room.name} · needs ${neededKw.toFixed(1)} kW`}
        onBack=${() => setState({ ...state, screen: "rooms" })}
      />
      <div class="body">
        <div class=${`coverage-strip`}>
          <div class=${`coverage-value ${covered ? "covered" : ""}`}>
            ${quotedKw.toFixed(1)} of ${neededKw.toFixed(1)} kW
          </div>
          <div class="coverage-sub">
            ${radiatorCount} radiator${radiatorCount === 1 ? "" : "s"} selected
          </div>
        </div>

        <div class="toggle-row">
          <span>RAL colour / smooth finish (this room, +20%)</span>
          <button
            class=${`toggle ${room.colour ? "on" : ""}`}
            onClick=${() => updateRoom({ colour: !room.colour })}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
        <div class="toggle-row">
          <span>RF Relay, all radiators (+£50 each)</span>
          <button
            class=${`toggle ${room.rfRelay ? "on" : ""}`}
            onClick=${() => updateRoom({ rfRelay: !room.rfRelay })}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
        <div class="toggle-row">
          <span>Wireless thermostat, this room (£100)</span>
          <button
            class=${`toggle ${room.wirelessThermostat ? "on" : ""}`}
            onClick=${() => updateRoom({ wirelessThermostat: !room.wirelessThermostat })}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>

        <div class="tabs">
          ${catalogue.families.map(
            (f) => html`
              <div
                class=${`tab ${activeFamily === f.key ? "selected" : ""}`}
                onClick=${() => setActiveFamily(f.key)}
              >
                ${f.label}
              </div>
            `
          )}
        </div>

        ${catalogue.radiators
          .filter((m) => m.family === activeFamily)
          .map((m) => {
            const qty = room.radiators[m.code] || 0;
            return html`
              <div class="model-row">
                <div class="model-info">
                  <div class="model-code">${m.code}</div>
                  <div class="model-sub">${m.kw} kW · ${m.width_cm}cm</div>
                </div>
                <div class="model-price">£${m.price}</div>
                ${qty === 0
                  ? html`<button class="add-btn" onClick=${() => setQty(m.code, 1)}><${Plus} /></button>`
                  : html`
                      <div class="stepper active">
                        <button class="stepper-btn" onClick=${() => setQty(m.code, qty - 1)}><${Minus} /></button>
                        <span class="stepper-qty">${qty}</span>
                        <button class="stepper-btn" onClick=${() => setQty(m.code, qty + 1)}><${Plus} /></button>
                      </div>
                    `}
              </div>
            `;
          })}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onClick=${() => setState({ ...state, screen: "rooms" })}>
          Done — back to rooms
        </button>
      </div>
    </div>
  `;
}

// ---------- Screen 04: Estimate ----------

function EstimateScreen({ state, setState, catalogue, showToast }) {
  const b = buildQuoteBreakdown(state, catalogue);
  const {
    totalRadiatorCount,
    roomLines,
    colourUpliftByRoom,
    accessoryDisplay,
    discount,
    installTotal,
    removalTotal,
    total,
    balance,
  } = b;

  function updateAccessories(patch) {
    setState({ ...state, accessories: { ...state.accessories, ...patch } });
  }

  function updateRemoval(patch) {
    setState({ ...state, removal: { ...state.removal, ...patch } });
  }

  return html`
    <div class="screen">
      <${Header}
        title="Estimate"
        sub=${`${currentCustomer(state).name} · ${currentCustomer(state).address}`}
        chip=${`${totalRadiatorCount} radiators`}
        onBack=${() => setState({ ...state, screen: "rooms" })}
      />
      <div class="body">
        <p class="section-label">Quote type</p>
        <div class="deposit-options">
          <div
            class=${`card deposit-card ${!state.supplyOnly ? "selected" : ""}`}
            onClick=${() => setState({ ...state, supplyOnly: false })}
          >
            <div class="deposit-card-label">Trust install</div>
          </div>
          <div
            class=${`card deposit-card ${state.supplyOnly ? "selected" : ""}`}
            onClick=${() => setState({ ...state, supplyOnly: true })}
          >
            <div class="deposit-card-label">Supply only</div>
          </div>
        </div>

        <p class="section-label">Radiators</p>
        ${roomLines.map(
          ({ room, lines }) =>
            lines.length > 0 &&
            html`
              <div>
                <p style="font-weight:700;font-size:15px;margin:8px 0 4px">${room.name}</p>
                ${lines.map(
                  (l) => html`
                    <div class="estimate-line">
                      <span class="estimate-line-label">${l.qty} × ${l.code}</span>
                      <span class="estimate-line-price">£${l.lineTotal.toFixed(2)}</span>
                    </div>
                  `
                )}
              </div>
            `
        )}

        ${colourUpliftByRoom
          .filter(Boolean)
          .map(
            (c) => html`
              <div class="estimate-line">
                <span class="estimate-line-label">${c.room.name} — colour finish uplift (+20%)</span>
                <span class="estimate-line-price">£${c.uplift.toFixed(2)}</span>
              </div>
            `
          )}

        <hr class="divider" />
        <p class="section-label">Accessories</p>
        <p class="hero-advisory" style="margin:0 0 10px">
          Per-room extras — RF relay (£50/radiator), wireless thermostat (£100/room) and
          RAL colour (+20%) — are set on each room's radiator screen and appear here when on.
        </p>
        ${accessoryDisplay.map(
          (a) => html`
            <div class=${`estimate-line ${a.included ? "included" : ""}`}>
              <span class="estimate-line-label">${a.label}</span>
              <span class="estimate-line-price">${a.included ? "Included" : `£${a.price.toFixed(2)}`}</span>
            </div>
          `
        )}
        <div class="toggle-row">
          <span>App Hub (£150)</span>
          <button class=${`toggle ${state.accessories.appHub ? "on" : ""}`} onClick=${() => updateAccessories({ appHub: !state.accessories.appHub })}><span class="toggle-knob"></span></button>
        </div>
        <div class="toggle-row">
          <span>Timer (£100)</span>
          <button class=${`toggle ${state.accessories.timer ? "on" : ""}`} onClick=${() => updateAccessories({ timer: !state.accessories.timer })}><span class="toggle-knob"></span></button>
        </div>
        <div class="toggle-row">
          <span>Fuse spur (£30)</span>
          <button class=${`toggle ${state.accessories.fuseSpur ? "on" : ""}`} onClick=${() => updateAccessories({ fuseSpur: !state.accessories.fuseSpur })}><span class="toggle-knob"></span></button>
        </div>
        <div class="toggle-row">
          <span>Towel rail large 600W (£350)</span>
          <span>
            <input
              type="number"
              min="0"
              class="qty-input"
              value=${state.accessories.towelLarge}
              onInput=${(e) => updateAccessories({ towelLarge: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </span>
        </div>
        <div class="toggle-row">
          <span>Towel rail small 400W (£250)</span>
          <span>
            <input
              type="number"
              min="0"
              class="qty-input"
              value=${state.accessories.towelSmall}
              onInput=${(e) => updateAccessories({ towelSmall: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </span>
        </div>

        ${!state.supplyOnly &&
        html`
          <hr class="divider" />
          <p class="section-label">Installation & extras</p>
          <div class="estimate-line">
            <span class="estimate-line-label">Installation, ${totalRadiatorCount} radiator${totalRadiatorCount === 1 ? "" : "s"}</span>
            <span class="estimate-line-price">£${installTotal.toFixed(2)}</span>
          </div>
          <div class="estimate-line">
            <span class="estimate-line-label">
              ${state.removal.electric ? "Removal only, electric (£50 each)" : "Removal & collection (£75 each)"}
            </span>
            <span>
              <input
                type="number"
                min="0"
                class="qty-input"
                value=${state.removal.count}
                onInput=${(e) => updateRemoval({ count: Math.max(0, parseInt(e.target.value) || 0) })}
              />
            </span>
            <span class="estimate-line-price">£${removalTotal.toFixed(2)}</span>
          </div>
          <div class="toggle-row">
            <span>Removal only — electric heaters (£50 instead of £75)</span>
            <button class=${`toggle ${state.removal.electric ? "on" : ""}`} onClick=${() => updateRemoval({ electric: !state.removal.electric })}><span class="toggle-knob"></span></button>
          </div>
        `}

        <hr class="divider" />
        <div class="toggle-row">
          <span style="font-weight:700">NHS discount — 10% off radiators</span>
          <button class=${`toggle ${state.nhsOn ? "on" : ""}`} onClick=${() => setState({ ...state, nhsOn: !state.nhsOn })}><span class="toggle-knob"></span></button>
        </div>
        ${state.nhsOn &&
        html`
          <div class="estimate-line discount">
            <span class="estimate-line-label">NHS discount</span>
            <span class="estimate-line-price">−£${discount.toFixed(2)}</span>
          </div>
        `}

        <hr class="divider" />
        <div class="total-hero">
          <p class="total-hero-label">Total</p>
          <p class="total-hero-value">£${total.toFixed(2)}</p>
          <p class="no-vat-note">
            ${state.supplyOnly
              ? "Prices include VAT — supply only (no installation)"
              : "No VAT to add — Trust installation (energy-saving relief)"}
          </p>
        </div>

        <p class="section-label">Payment today</p>
        <div class="deposit-options">
          <div
            class=${`card deposit-card ${state.depositRate === 0.5 ? "selected" : ""}`}
            onClick=${() => setState({ ...state, depositRate: 0.5 })}
          >
            <div class="deposit-card-label">50% deposit</div>
            <div class="deposit-card-value">£${depositAmount(total, 0.5).toFixed(2)}</div>
          </div>
          <div
            class=${`card deposit-card ${state.depositRate === 0.25 ? "selected" : ""}`}
            onClick=${() => setState({ ...state, depositRate: 0.25 })}
          >
            <div class="deposit-card-label">25% deposit</div>
            <div class="deposit-card-value">£${depositAmount(total, 0.25).toFixed(2)}</div>
          </div>
        </div>
        <div
          class=${`card deposit-full ${state.depositRate === 0 ? "selected" : ""}`}
          onClick=${() => setState({ ...state, depositRate: 0 })}
        >
          <div class="deposit-card-label">No payment today · Customer deciding — office will follow up</div>
        </div>

        <div class="balance-line">
          <span>Balance on completion</span>
          <span>£${balance.toFixed(2)}</span>
        </div>
      </div>
      <div class="btn-row">
        <button
          class="btn btn-primary"
          onClick=${() => setState({ ...state, screen: "signature" })}
        >
          Take signature
        </button>
        <button class="btn btn-secondary" onClick=${() => showToast("Share estimate — coming in v2")}>
          Share estimate
        </button>
      </div>
    </div>
  `;
}

// ---------- Screen 05: Signature — customer acceptance + the save step ----------

/** Signature capture pad — pointer events so it works with mouse AND touch
 *  (Preact has no forwardRef in this vendored build, so the canvas ref and
 *  drawing logic live directly in SignatureScreen rather than a sub-component). */
function SignatureScreen({ state, catalogue, repName, onBack, onSave }) {
  const b = buildQuoteBreakdown(state, catalogue);
  const customer = currentCustomer(state);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [financeIndependent, setFinanceIndependent] = useState(false);

  // Size the backing bitmap to the CSS box × devicePixelRatio once on mount so
  // strokes aren't blurry on retina/phone screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pointFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const point = pointFromEvent(e);
    const last = lastPointRef.current;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasSignature) setHasSignature(true);
  }

  function handlePointerUp(e) {
    if (drawingRef.current) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {
        // some browsers auto-release on pointerup already — ignore
      }
    }
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function acceptAndSave() {
    if (!hasSignature) return;
    onSave({
      signature: canvasRef.current.toDataURL("image/png"),
      signedAt: new Date().toISOString(),
      financeIndependent,
    });
  }

  function saveWithoutSignature() {
    onSave({ signature: null, signedAt: null, financeIndependent });
  }

  return html`
    <div class="screen">
      <${Header} title="Customer acceptance" onBack=${onBack} />
      <div class="body">
        <div class="card">
          <div class="room-card-name">${customer.name}</div>
          <div class="room-card-sub">${customer.address || "No postcode on file"}</div>
          <hr class="divider" />
          <div class="toggle-row" style="font-weight:700;font-size:17px">
            <span>Total</span><span>£${b.total.toFixed(2)}</span>
          </div>
        </div>

        <div class="disclaimer-checkbox-row">
          <input
            type="checkbox"
            id="finance-independent"
            checked=${financeIndependent}
            onChange=${(e) => setFinanceIndependent(e.target.checked)}
          />
          <label for="finance-independent">
            The customer's decision to take finance was made independently, without influence or
            pressure from us
          </label>
        </div>

        <ul class="disclaimer-bullets">
          <li>Any additional electrical or plumbing work is not included in the quoted price unless explicitly specified in writing on your estimate.</li>
          <li>The estimated delivery and installation timeframe is between 4 to 6 weeks, but this period may vary due to demand and seasonal fluctuations.</li>
          <li>If you're removing Night Storage Heaters, please consider your tariff, as Economy 7 may not be the most suitable for our radiators.</li>
          <li>Terms and Conditions are available online.</li>
        </ul>

        <div class="field">
          <label>Customer signature</label>
          <canvas
            ref=${canvasRef}
            class="signature-canvas"
            onPointerDown=${handlePointerDown}
            onPointerMove=${handlePointerMove}
            onPointerUp=${handlePointerUp}
            onPointerCancel=${handlePointerUp}
          ></canvas>
          <button class="signature-clear-btn" onClick=${clearSignature}>Clear</button>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" disabled=${!hasSignature} onClick=${acceptAndSave}>
          Accept & save
        </button>
        <button class="btn btn-secondary" onClick=${saveWithoutSignature}>
          Save without signature
        </button>
      </div>
      <p class="signature-footer">Advisor: ${repName} · ${formatApptDate(todayLondonISO())}</p>
    </div>
  `;
}

// ---------- App root ----------

function App() {
  const [state, setStateRaw] = useState(loadState());
  const [catalogue, setCatalogue] = useState(null);
  const [toast, setToast] = useState(null);
  // Identity lives server-side (the session), never in localStorage state.
  const [repName, setRepName] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  // Ephemeral — which appointment's detail view is open (Today/Appointments tabs).
  const [openAppointment, setOpenAppointment] = useState(null);
  const [pendingSwitch, setPendingSwitch] = useState(null); // appt awaiting discard-confirm
  const [quoteHistory, setQuoteHistory] = useState(loadQuoteHistory());
  // Ephemeral — which saved quote's read-only detail view is open (My quotes tab).
  const [openQuoteEntry, setOpenQuoteEntry] = useState(null);

  useEffect(() => {
    fetch("/api/catalogue")
      .then((r) => r.json())
      .then(setCatalogue);
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRepName(d.rep_name))
      .finally(() => setAuthChecked(true));
  }, []);

  function setState(next) {
    setStateRaw(next);
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Own-data rule: the server filters to the session rep only — no rep param,
  // never fetch all reps' data.
  useEffect(() => {
    if (!repName) return;
    setAppointmentsLoading(true);
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((data) => setAppointments(data.appointments || []))
      .finally(() => setAppointmentsLoading(false));
  }, [repName]);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  function resetQuote() {
    localStorage.removeItem(STORAGE_KEY);
    setStateRaw({ ...defaultState(), activeTab: state.activeTab });
  }

  function handleLogin(username, password) {
    setLoginLoading(true);
    setLoginError(null);
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("bad-creds");
        return r.json();
      })
      .then((d) => {
        // Shared-device rule (owner ruling): a draft stamped for a different rep
        // must never leak into this rep's session on sign-in — reset it. History
        // is never touched here; drafts survive sign-out on purpose.
        if (state.draftOwner && state.draftOwner !== d.rep_name) {
          setStateRaw({ ...defaultState(), draftOwner: null });
        }
        setRepName(d.rep_name);
      })
      .catch(() => setLoginError("Incorrect username or password"))
      .finally(() => setLoginLoading(false));
  }

  function handleSignOut() {
    fetch("/api/logout", { method: "POST" }).finally(() => {
      setRepName(null);
      setAppointments([]);
      setOpenAppointment(null);
    });
  }

  function goToTab(tab) {
    setOpenAppointment(null);
    setOpenQuoteEntry(null);
    if (tab === "myQuotes") setQuoteHistory(loadQuoteHistory()); // pick up quotes saved since mount
    setState({ ...state, activeTab: tab });
  }

  // The save step (Signature screen). repName is the session identity already
  // held in app state from /api/me on mount — never a client guess. sigData is
  // { signature, signedAt, financeIndependent } from the customer-acceptance step.
  function handleSaveQuote(sigData) {
    const entry = buildQuoteEntry(state, catalogue, repName, sigData);
    saveQuoteToHistory(entry);
    setQuoteHistory(loadQuoteHistory());
    setStateRaw({ ...defaultState(), activeTab: "myQuotes" });
    showToast("Quote saved");
  }

  function startQuoteFromAppointment(appt) {
    const hasWork = state.rooms.length > 0;
    const sameCustomer = state.quoteCustomer && state.quoteCustomer.leadId === appt.lead_id;
    if (hasWork && !sameCustomer) {
      // Rooms measured for someone else — never silently mix customers' quotes.
      setPendingSwitch(appt);
      return;
    }
    setState({
      ...state,
      quoteCustomer: { name: appt.customer, address: appt.postcode || "", leadId: appt.lead_id, apptDate: appt.appt_date },
      activeTab: "quote",
      draftOwner: repName,
    });
    setOpenAppointment(null);
  }

  function confirmSwitchTo(appt) {
    const fresh = defaultState();
    setState({
      ...fresh,
      quoteCustomer: { name: appt.customer, address: appt.postcode || "", leadId: appt.lead_id, apptDate: appt.appt_date },
      activeTab: "quote",
      draftOwner: repName,
    });
    setPendingSwitch(null);
    setOpenAppointment(null);
  }

  if (!authChecked) {
    return html`<div class="screen"><div class="body"><p>Loading…</p></div></div>`;
  }

  if (!repName) {
    return html`<${LoginScreen} onLogin=${handleLogin} error=${loginError} loading=${loginLoading} />`;
  }

  if (!catalogue) {
    return html`<div class="screen"><div class="body"><p>Loading…</p></div></div>`;
  }

  let screen;
  if (openAppointment) {
    screen = html`
      <${AppointmentDetailScreen}
        appt=${openAppointment}
        onBack=${() => setOpenAppointment(null)}
        onStartQuote=${() => startQuoteFromAppointment(openAppointment)}
      />
    `;
  } else if (openQuoteEntry) {
    screen = html`
      <${QuoteDetailScreen}
        entry=${openQuoteEntry}
        catalogue=${catalogue}
        onBack=${() => setOpenQuoteEntry(null)}
      />
    `;
  } else if (state.activeTab === "today") {
    screen = html`
      <${TodayScreen}
        appointments=${appointments}
        rep=${repName}
        loading=${appointmentsLoading}
        onOpenAppointment=${setOpenAppointment}
      />
    `;
  } else if (state.activeTab === "appointments") {
    screen = html`
      <${AppointmentsScreen}
        appointments=${appointments}
        rep=${repName}
        loading=${appointmentsLoading}
        onOpenAppointment=${setOpenAppointment}
      />
    `;
  } else if (state.activeTab === "myQuotes") {
    screen = html`<${MyQuotesScreen} history=${quoteHistory} repName=${repName} onOpen=${setOpenQuoteEntry} />`;
  } else if (!quoteCustomerValidToday(state)) {
    // Quote tab with no valid today-customer (owner ruling: quotes only open on
    // the appointment day) — the tab becomes the picker for today's appointments.
    const todays = appointments
      .filter((a) => a.appt_date === todayLondonISO() && a.status === "active")
      .sort(sortByDateTime);
    screen = html`
      <${QuotePickerScreen}
        todays=${todays}
        rep=${repName}
        loading=${appointmentsLoading}
        onPick=${startQuoteFromAppointment}
      />
    `;
  } else {
    // Quote tab — the existing room-quote flow, untouched.
    if (state.rooms.length === 0 && state.screen === "rooms") {
      screen = html`<${AddRoomScreen} state=${state} setState=${setState} catalogue=${catalogue} showToast=${showToast} />`;
    } else if (state.screen === "addRoom") {
      screen = html`<${AddRoomScreen} state=${state} setState=${setState} catalogue=${catalogue} showToast=${showToast} />`;
    } else if (state.screen === "pickRadiators") {
      screen = html`<${PickRadiatorsScreen} state=${state} setState=${setState} catalogue=${catalogue} />`;
    } else if (state.screen === "estimate") {
      screen = html`<${EstimateScreen} state=${state} setState=${setState} catalogue=${catalogue} showToast=${showToast} />`;
    } else if (state.screen === "signature") {
      screen = html`
        <${SignatureScreen}
          state=${state}
          catalogue=${catalogue}
          repName=${repName}
          onBack=${() => setState({ ...state, screen: "estimate" })}
          onSave=${handleSaveQuote}
        />
      `;
    } else {
      screen = html`<${RoomsScreen} state=${state} setState=${setState} catalogue=${catalogue} />`;
    }
  }

  const currentQuoteName = (state.quoteCustomer && state.quoteCustomer.name) || "the current customer";

  return html`
    <div>
      <${TopLinks} onReset=${resetQuote} onSignOut=${handleSignOut} />
      <div class="tab-content">${screen}</div>
      <${TabBar} activeTab=${state.activeTab} onSelect=${goToTab} />
      <${Toast} message=${toast} />
      ${pendingSwitch &&
      html`
        <div class="modal-scrim" onClick=${() => setPendingSwitch(null)}>
          <div class="modal-card" onClick=${(e) => e.stopPropagation()}>
            <div class="modal-title">Quote in progress</div>
            <p class="modal-text">
              You have an unfinished quote for <b>${currentQuoteName}</b>${" "}
              (${state.rooms.length} room${state.rooms.length === 1 ? "" : "s"} measured).
              Starting a quote for <b>${pendingSwitch.customer}</b> will discard it.
            </p>
            <button class="btn btn-primary" onClick=${() => confirmSwitchTo(pendingSwitch)}>
              Discard & start for ${pendingSwitch.customer}
            </button>
            <button class="btn btn-secondary" onClick=${() => setPendingSwitch(null)}>
              Keep ${currentQuoteName}'s quote
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById("app"));
