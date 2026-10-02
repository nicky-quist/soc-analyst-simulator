// Console stylesheet

import { THEME_CSS } from '../theme.js';

export const APP_CSS = `
  ${THEME_CSS}
  * { box-sizing: border-box; }
  body { background: var(--bg); margin: 0; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: var(--surface-alt); }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--primary); }
  select:focus, input:focus, textarea:focus { outline: none; border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-soft); }
  button:focus-visible, a:focus-visible, [role="tab"]:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  .skip-link { position: absolute; left: -9999px; top: 8px; z-index: 1000; padding: 8px 14px; border-radius: 6px; background: var(--primary); color: var(--on-primary); font-weight: 700; font-size: 13px; text-decoration: none; }
  .skip-link:focus { left: 8px; }
  .app-shell { display: flex; align-items: stretch; min-height: 100vh; }
  .app-rail {
    width: 60px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 0 12px;
    position: sticky; top: 0; height: 100vh; overflow-y: auto; overflow-x: hidden;
  }
  .app-content { flex: 1; min-width: 0; }
  .rail-nav-btn {
    position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
    border-radius: 9px; cursor: pointer; font-family: inherit; border: 1px solid transparent; background: transparent;
    color: var(--text-secondary);
  }
  .rail-nav-btn[data-active="true"] { background: var(--primary-soft); color: var(--primary-strong); border-color: var(--primary); }
  .rail-nav-btn:hover:not([data-active="true"]) { background: var(--surface-alt); color: var(--text); }
  .rail-count {
    position: absolute; top: -3px; right: -3px; min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px;
    background: var(--primary); color: var(--on-primary); font-size: 9.5px; font-weight: 800; line-height: 15px;
    text-align: center; border: 1.5px solid var(--surface);
  }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0; animation: live-pulse 2s ease-in-out infinite; }
  @keyframes live-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52,211,153,0.5); } 50% { opacity: 0.55; box-shadow: 0 0 0 3px rgba(52,211,153,0); } }
  .sim-btn:hover:not(:disabled) { filter: brightness(1.12); }
  .sim-btn-primary:hover:not(:disabled) { box-shadow: var(--glow-primary); }
  .sim-tile { transition: transform 0.15s, box-shadow 0.15s; }
  .sim-tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
  table tbody tr:hover { background: var(--surface-hover) !important; }
  .sim-alert-row { transition: background 0.1s; }
  .sim-body { display: grid; grid-template-columns: 272px minmax(0, 1fr) 300px; align-items: start; }
  .sim-queue { background: var(--surface); border-right: 1px solid var(--border); position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }
  .sim-main { padding: 20px 24px 60px; min-width: 0; }
  .sim-rail { border-left: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; max-height: 100vh; overflow-y: auto; padding: 16px; }
  .sim-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sim-dash-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
  .sim-dash-grid > * { display: flex; flex-direction: column; }
  .sim-tile-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  @media (max-width: 1240px) { .sim-tile-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 1000px) {
    .sim-dash-grid { grid-template-columns: minmax(0, 1fr); }
    .sim-dash-grid > * { grid-column: span 1 !important; }
  }
  @media (max-width: 620px) { .sim-tile-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  table tbody tr:hover { background: var(--surface-alt); }
  @media (max-width: 1200px) {
    .sim-body { grid-template-columns: 250px minmax(0, 1fr); }
    .sim-rail { grid-column: 1 / -1; border-left: none; border-top: 1px solid var(--border); position: static; max-height: none; }
  }
  @media (max-width: 900px) {
    .sim-body { display: block; }
    .sim-queue { position: static; max-height: 250px; border-right: none; border-bottom: 1px solid var(--border); }
    .sim-main { padding: 16px 14px 48px; }
    .sim-form-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .app-rail { width: 48px; }
    .rail-nav-btn { width: 38px; height: 38px; }
  }
  /* Tab strips wrap on phones */
  @media (max-width: 640px) {
    .sim-tabs { flex-wrap: wrap !important; overflow-x: visible !important; }
  }
  /* Touch: give in-page buttons a comfortable target. */
  @media (pointer: coarse) {
    main button, [role="tab"], .report-overlay button { min-height: 40px; }
  }
  /* Report metrics grid */
  .report-metrics { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
  @media (max-width: 820px) { .report-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 420px) { .report-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* The shift report prints as a page of its own. */
  @media print {
    .app-shell, .skip-link { display: none !important; }
    body { background: #fff !important; }
    .report-overlay { position: static !important; overflow: visible !important; background: #fff !important; }
    .report-actions { display: none !important; }
    .report-overlay .sim-card, .report-overlay > div > div { break-inside: avoid; }
  }
  @media (prefers-reduced-motion: reduce) {
    .live-dot { animation: none; }
    .sim-tile, .sim-alert-row { transition: none; }
    .sim-tile:hover { transform: none; }
  }
`;
