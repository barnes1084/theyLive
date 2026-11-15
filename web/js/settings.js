// The settings screen: a page of sliders and switches, one tab per group,
// built from TUNING. Every change applies at once and is saved.
import { TUNING, tune, resetTuning, saveTuning } from './tuning.js';

const root = document.getElementById('settings');
const tabs = root.querySelector('.tabs');
const body = root.querySelector('.body');
let onChange = () => {};
let onClose = () => {};
let current = 0;
const rows = []; // { t, update() }

function decimals(step) {
  const s = String(step);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
}

function format(t, v) {
  if (t.auto && v === 0) return 'AUTO';
  if (t.pct) return `${Math.round(v * 100)}%`;
  const n = v.toFixed(decimals(t.step));
  if (t.unit === '×') return `${n}×`;
  return t.unit ? `${n} ${t.unit}` : n;
}

function changed() {
  saveTuning();
  onChange();
}

function makeRow(t) {
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('label');
  label.textContent = t.label;
  if (t.note) {
    const note = document.createElement('small');
    note.textContent = t.note;
    label.append(note);
  }
  const value = document.createElement('output');
  const reset = document.createElement('button');
  reset.className = 'reset';
  reset.type = 'button';
  reset.title = 'Back to default';
  reset.textContent = '↺';
  row.append(label, value, reset);

  let control;
  let update;
  if (t.type === 'bool') {
    control = document.createElement('button');
    control.type = 'button';
    control.className = 'toggle';
    control.addEventListener('click', () => {
      tune[t.key] = !tune[t.key];
      update();
      changed();
    });
    update = () => {
      control.textContent = tune[t.key] ? 'ON' : 'OFF';
      control.classList.toggle('on', tune[t.key]);
      value.textContent = '';
    };
  } else if (t.type === 'choice') {
    control = document.createElement('div');
    control.className = 'choices';
    const buttons = Object.entries(t.options).map(([v, name]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.addEventListener('click', () => {
        tune[t.key] = v;
        update();
        changed();
      });
      control.append(b);
      return [v, b];
    });
    update = () => {
      for (const [v, b] of buttons) b.classList.toggle('on', tune[t.key] === v);
      value.textContent = '';
    };
  } else {
    control = document.createElement('input');
    control.type = 'range';
    control.min = t.min;
    control.max = t.max;
    control.step = t.step;
    control.addEventListener('input', () => {
      tune[t.key] = Number(control.value);
      update();
      changed();
    });
    update = () => {
      control.value = tune[t.key];
      value.textContent = format(t, tune[t.key]);
    };
  }
  const base = update;
  update = () => {
    base();
    row.classList.toggle('changed', tune[t.key] !== t.def);
  };
  reset.addEventListener('click', () => {
    tune[t.key] = t.def;
    update();
    changed();
  });
  row.append(control);
  rows.push({ t, update });
  update();
  return row;
}

// Build the tabs and pages.
const pages = [];
for (const t of TUNING) {
  if (t.group) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = t.group;
    const index = pages.length;
    tab.addEventListener('click', () => show(index));
    tabs.append(tab);
    const page = document.createElement('div');
    page.className = 'page';
    body.append(page);
    pages.push({ tab, page });
  } else pages[pages.length - 1].page.append(makeRow(t));
}

function show(index) {
  current = index;
  pages.forEach((p, i) => {
    p.tab.classList.toggle('on', i === index);
    p.page.hidden = i !== index;
  });
  body.scrollTop = 0;
}

root.querySelector('.reset-all').addEventListener('click', () => {
  if (!confirm('Put every setting back to its default?')) return;
  resetTuning();
  for (const r of rows) r.update();
  changed();
});
root.querySelector('.done').addEventListener('click', () => closeSettings());
addEventListener('keydown', (e) => {
  if (!root.hidden && e.code === 'Escape') {
    e.stopImmediatePropagation();
    closeSettings();
  }
}, true);

export function isSettingsOpen() {
  return !root.hidden;
}

/** Shows the settings; `changed` runs after every change, `closed` on DONE. */
export function openSettings(changed, closed) {
  onChange = changed || onChange;
  onClose = closed || onClose;
  for (const r of rows) r.update();
  show(current);
  root.hidden = false;
  document.body.classList.add('settings-open');
}

export function closeSettings() {
  if (root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('settings-open');
  onClose();
}
