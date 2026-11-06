// Lectura de horarios y de listas pegadas (del portal, de WhatsApp o escritas a mano).

export function clientKey(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(s\.?\s?l\.?u?|s\.?\s?a\.?|s\.?\s?c\.?p\.?)(?=\s|$)/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toMin(str) {
  const m = String(str).trim().toLowerCase().match(/^(\d{1,2})(?:\s*[:.h']\s*(\d{2}))?\s*h?$/);
  if (!m) return null;
  const h = +m[1], mi = m[2] ? +m[2] : 0;
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

export function fmt(min) {
  if (min == null || !isFinite(min)) return '--:--';
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Una hora: "9", "9:30", "9.30", "9h30", "9h". Nunca empieza en medio de un número ("300", "08940")
// ni sigue con más cifras.
const T = String.raw`(?<![\w.:/,])\d{1,2}(?:\s*[:.h']\s*\d{2})?(?!\d)\s*h?`;
const T2 = String.raw`(?<![\d.:])\d{1,2}(?:\s*[:.h']\s*\d{2})?(?!\d)\s*h?`; // la segunda hora va justo tras "-" o "/"
const PREFIX = String.raw`(de\s+(?:les\s+|las\s+)?|desde\s+(?:las\s+|les\s+)?|horari[o]?:?\s*|entrega:?\s*)?`;
const SEP = String.raw`\s*(?:-|–|—|\/|a\s+les|a\s+las|a|hasta\s+(?:las\s+|les\s+)?|fins\s+a(?:\s+les)?)\s*`;
const RANGE = () => new RegExp(`${PREFIX}(${T})${SEP}(${T2})(?![\\w:])`, 'gi');
const FROM = () => /(?:a\s+partir\s+(?:de\s+)?(?:las\s+|les\s+)?|desde\s+(?:las\s+|les\s+)?)(\d{1,2}(?:[:.h']\d{2})?\s*h?)(?![\d:])/gi;
const FROM_AFTER = () => /(?<![\d:.])(\d{1,2}(?:[:.h']\d{2})?)\s*(?:h|hs|horas)?\.?\s+en\s+adelante/gi; // "14:00 HS. EN ADELANTE"
const UNTIL = () => /(?:antes\s+(?:de\s+)?(?:las\s+|les\s+)?|hasta\s+(?:las\s+|les\s+)?|abans\s+de\s+les\s+)(\d{1,2}(?:[:.h']\d{2})?\s*h?)(?![\d:])/gi;

// "de 4 a 7" sin más: en un horario de entrega es por la tarde.
function afternoon(a, b) {
  return a >= 60 && b <= 7 * 60 ? [a + 720, b + 720] : [a, b];
}

function rangeMatches(text, loose = false) {
  const out = [];
  const s = String(text || ''), re = RANGE();
  let m;
  while ((m = re.exec(s))) {
    const [all, prefix, a, b] = m;
    // Un "9-11" a secas no cuenta (en una dirección suele ser un número de portal), salvo en un
    // campo que solo puede ser un horario (loose).
    const explicit = loose || prefix || /[:.h']/.test(a) || /[:.h']/.test(b) || /\s(a|hasta|fins)\s/i.test(all);
    let from = toMin(a), to = toMin(b);
    if (explicit && from != null && to != null) [from, to] = afternoon(from, to);
    // Candidato descartado ("12 - 9:00" = portal + hora): se sigue buscando desde el carácter siguiente.
    if (!explicit || from == null || to == null || to <= from) { re.lastIndex = m.index + 1; continue; }
    out.push({ index: m.index, length: all.length, win: [from, to] });
  }
  return out;
}

export function mergeWindows(ws) {
  const sorted = ws.slice().sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else out.push([...w]);
  }
  return out;
}

// Devuelve [[desde, hasta], ...] en minutos, sin solapes.
export function parseWindows(text, { loose = false } = {}) {
  const s = String(text || '');
  const ranges = rangeMatches(s, loose);
  const out = ranges.map((r) => r.win);
  let rest = s;
  for (const r of ranges.slice().reverse()) rest = rest.slice(0, r.index) + ' '.repeat(r.length) + rest.slice(r.index + r.length);
  for (const m of [...rest.matchAll(FROM()), ...rest.matchAll(FROM_AFTER())]) { const a = toMin(m[1]); if (a != null && a < 21 * 60) out.push([a, 21 * 60]); }
  for (const m of rest.matchAll(UNTIL())) { const b = toMin(m[1]); if (b != null && b > 6 * 60) out.push([6 * 60, b]); }
  return mergeWindows(out);
}

// Quita del texto solo los horarios que parseWindows acepta (sin tocar tabuladores ni separadores).
export function stripWindows(text) {
  let s = String(text || '');
  for (const r of rangeMatches(s).reverse()) s = s.slice(0, r.index) + s.slice(r.index + r.length);
  s = s.replace(FROM(), '').replace(FROM_AFTER(), '').replace(UNTIL(), '');
  return s.replace(/\b(horari[o]?|entrega)\b\s*:?/gi, '').replace(/[  ]{2,}/g, ' ').trim();
}

const PREFIX_RE = /^(c\/|c\.\s|cl\.|calle\b|carrer\b|crta\.?|ctra\.?|carretera\b|av\.|avda\.?|avinguda\b|avenida\b|pl\.|pza\.?|pla[çc]a\b|plaza\b|pg\.|passeig\b|paseo\b|ronda\b|rbla\.?|rambla\b|via\b|v[ií]a\b|trav\.?|travessera\b|travesera\b|gran via\b|cam[ií]\b|cami\b|pol[ií]gon\b|pol\.|pol[ií]gono\b|urb\.|torrent\b|ptge\.?|passatge\b|pasaje\b)/i;
const PHONE_RE = /^(?:(?:tel[eé]?f?(?:ono)?|tlf|tfno|m[oó]vil|m[oò]bil)\.?\s*:?\s*)?\+?\d[\d\s.-]{7,}\d$/i;

function addressScore(s) {
  const t = s.trim();
  let score = 0;
  if (PREFIX_RE.test(t)) score += 2;
  if (/\d|s\/n/i.test(t)) score += 1;
  if (/\b\d{5}\b/.test(t)) score += 2;
  return score;
}

export function looksLikeAddress(s) {
  return addressScore(s) >= 2;
}

const isPhone = (s) => PHONE_RE.test(s.trim()) && s.replace(/\D/g, '').length >= 9;

// Cada parada: { name, address, windows, phone }. Bloques separados por línea en blanco = una parada
// por bloque (cada línea, un dato); si no hay líneas en blanco, una parada por línea.
export function parseList(text) {
  const raw = String(text || '').replace(/\r/g, '');
  const bullet = /^\s*(?:[•·*▪►-]\s+|\d{1,3}\s*(?:[.)]\s*-?|-)\s+)/;
  const blockMode = /\n\s*\n/.test(raw.trim());
  const blocks = blockMode
    ? raw.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    : raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => [l]);

  return blocks.filter((b) => b.length).map((lines) => {
    lines = lines.map((l, i) => (i === 0 ? l.replace(bullet, '') : l));
    const windows = mergeWindows(lines.flatMap(parseWindows));
    // Primero se separan las columnas y luego se quitan los horarios de cada una.
    let parts = (blockMode ? lines : lines[0].split(/\t|\s\|\s|;|\s[-–—]\s/))
      .map((p) => stripWindows(p).replace(/^[\s\-–—|,;]+|[\s\-–—|,;]+$/g, '').trim())
      .filter(Boolean);
    let phone = '';
    parts = parts.filter((p) => (isPhone(p) ? ((phone = phone || p.replace(/^[^\d+]+/, '').trim()), false) : true));

    let name = '', address = '';
    const scores = parts.map(addressScore);
    const best = Math.max(-1, ...scores);
    const addrIdx = best >= 2 ? scores.indexOf(best) : -1;
    if (parts.length === 1) {
      if (addrIdx === 0) address = parts[0]; else name = parts[0];
    } else if (addrIdx > 0) {
      name = parts.slice(0, addrIdx).join(' - ');
      address = parts.slice(addrIdx).join(', ');
    } else if (addrIdx === 0) {
      // Dirección primero: lo que sigue y parece población/código postal va con ella; el resto es el nombre.
      let k = 1;
      while (k < parts.length && /^\d{5}\b/.test(parts[k])) k++;
      address = parts.slice(0, k).join(', ');
      name = parts.slice(k).join(' - ');
    } else {
      name = parts[0];
      address = parts.slice(1).join(', ');
    }
    return { name: name || address, address, windows, phone };
  });
}
