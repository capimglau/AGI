/* ═══════════════════════════════════════════════════════════════════
   Sunburst3D — anéis concêntricos premium em SVG puro (sem libs, sem
   Canvas). Componente genérico: não conhece nada do domínio (não sabe
   o que é "Locação" ou "proprietário") — só recebe, por anel, uma
   lista de {key,value,color,selected?,locked?} e desenha.

   Uso:
     const chart = new Sunburst3D(containerEl, {
       rings: [
         {id:'inner', rIn:100, rOut:188, mode:'icon',   gapDeg:.9, power:.3},
         {id:'outer', rIn:200, rOut:312, mode:'avatar', gapDeg:.7, power:.5},
       ],
       getIcon:  (ringId,key) => '<path .../>' | null,
       getLabel: (ringId,key) => 'AB' | null,
       onToggle: (ringId,key) => {...},   // clique na fatia/tag/quadrado da legenda
       onOpen:   (ringId,key) => {...},   // clique no nome da legenda
     });
     chart.update({ inner:[{key,value,color,selected}, ...], outer:[...] });
     chart.setHub({label,value,sub,subIcon});
     chart.renderLegend('inner', ulEl, {title:'Tipo'});
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls) => { const e = document.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); return e; };

  function mix(hex, target, amt) {
    const h = hex.replace('#', ''), t = target.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const tr = parseInt(t.slice(0, 2), 16), tg = parseInt(t.slice(2, 4), 16), tb = parseInt(t.slice(4, 6), 16);
    const mr = Math.round(r + (tr - r) * amt), mg = Math.round(g + (tg - g) * amt), mb = Math.round(b + (tb - b) * amt);
    return '#' + [mr, mg, mb].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function luminance(hex) {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const markColor = hex => (luminance(hex) > 0.42 ? '#16202E' : '#ffffff');

  let uid = 0;

  class Sunburst3D {
    constructor(container, opts) {
      this.container = container;
      this.size = opts.size || 640;
      this.cx = this.size / 2; this.cy = this.size / 2;
      this.lightAngle = opts.light != null ? opts.light : 315;
      this.rings = opts.rings || [];
      this.getIcon = opts.getIcon || (() => null);
      this.getLabel = opts.getLabel || (() => null);
      this.onToggle = opts.onToggle || (() => {});
      this.onOpen = opts.onOpen || (() => {});
      this.uid = ++uid;
      this._els = {}; // ringId -> { key -> record }
      this._prevSig = {}; // ringId -> signature string (pra saber quando repovoar)
      this._lastData = {};
      this._build();
    }

    // ─── ângulo -> ponto, luz -> fator 0..1 ───
    polar(r, angDeg) {
      const a = (angDeg - 90) * Math.PI / 180;
      return { x: this.cx + r * Math.cos(a), y: this.cy + r * Math.sin(a) };
    }
    ringPath(rOut, rIn, a0, a1) {
      const p1 = this.polar(rOut, a0), p2 = this.polar(rOut, a1);
      const p3 = this.polar(rIn, a1), p4 = this.polar(rIn, a0);
      const large = a1 - a0 > 180 ? 1 : 0;
      return `M${p1.x} ${p1.y} A${rOut} ${rOut} 0 ${large} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${rIn} ${rIn} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
    }
    lightFactor(midDeg) {
      const d = (midDeg - this.lightAngle) * Math.PI / 180;
      return (1 + Math.cos(d)) / 2;
    }

    _build() {
      const c = this.container;
      c.classList.add('sb3d-stage');
      c.innerHTML = '';
      const svg = el('svg'); svg.setAttribute('viewBox', `0 0 ${this.size} ${this.size}`); svg.setAttribute('aria-hidden', 'true');
      const defs = el('defs'); defs.setAttribute('id', `sb3d-defs-${this.uid}`);
      svg.appendChild(defs);
      const haloG = el('g'); const connG = el('g');
      svg.appendChild(haloG); svg.appendChild(connG);
      this._svg = svg; this._defs = defs; this._haloG = haloG; this._connG = connG;

      // O anel maior (rOut) recebe a sombra de elevação do conjunto
      // inteiro — quem chama decide qual é (cfg.big:true), já que é o
      // único que sabe a ordem visual pretendida dos anéis.
      this._ringGroups = {};
      this.rings.forEach(cfg => {
        const g = el('g', 'sb3d-ring' + (cfg.big ? ' sb3d-ring-outer' : ''));
        g.dataset.ring = cfg.id;
        svg.appendChild(g);
        this._ringGroups[cfg.id] = g;
        this._els[cfg.id] = {};
      });

      c.appendChild(svg);

      const cards = document.createElement('div'); cards.className = 'sb3d-cards';
      c.appendChild(cards); this._cards = cards;

      const hub = document.createElement('div'); hub.className = 'sb3d-hub';
      hub.innerHTML = '<div class="sb3d-hub-label"></div><div class="sb3d-hub-value"></div><div class="sb3d-hub-sub" style="display:none"></div><div class="sb3d-hub-sub2" style="display:none"></div>';
      hub.addEventListener('click', () => this._hubClick && this._hubClick());
      // O cartão glass preenche o vão livre no meio do anel mais interno
      // (2× o rIn dele, em % do stage) — nasce do próprio config, não é
      // um número fixo solto no CSS.
      const innerMost = Math.min(...this.rings.map(r => r.rIn));
      const hubPct = (innerMost * 2 / this.size * 100 * 0.94).toFixed(2) + '%';
      hub.style.width = hubPct; hub.style.height = hubPct;
      c.appendChild(hub); this._hub = hub;
    }

    onHubClick(fn) { this._hubClick = fn; }

    setHub({ label, value, sub, sub2 }) {
      this._hub.querySelector('.sb3d-hub-label').textContent = label || '';
      this._hub.querySelector('.sb3d-hub-value').textContent = value || '';
      const subEl = this._hub.querySelector('.sb3d-hub-sub');
      if (sub) { subEl.style.display = ''; subEl.textContent = sub; } else subEl.style.display = 'none';
      const sub2El = this._hub.querySelector('.sb3d-hub-sub2');
      if (sub2) { sub2El.style.display = ''; sub2El.textContent = sub2; } else sub2El.style.display = 'none';
    }

    _ensureSheen(cfg) {
      if (cfg._sheenDone) return;
      cfg._sheenDone = true;
      const gradId = `sb3d-sheen-${this.uid}-${cfg.id}`;
      const grad = el('linearGradient'); grad.setAttribute('id', gradId);
      grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%'); grad.setAttribute('x2', '0%'); grad.setAttribute('y2', '100%');
      grad.innerHTML = '<stop offset="0%" stop-color="#ffffff" stop-opacity=".18"/><stop offset="40%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>';
      this._defs.appendChild(grad);
      const sheen = el('path', 'sb3d-sheen');
      sheen.setAttribute('d', this.ringPath(cfg.rOut, cfg.rIn, 0, 359.9));
      sheen.setAttribute('fill', `url(#${gradId})`);
      sheen.setAttribute('pointer-events', 'none');
      this._ringGroups[cfg.id].appendChild(sheen);
    }

    // ─── calcula ângulos a partir dos valores (proporcional, com
    // suavização opcional via power<1 pra fatias minúsculas não
    // sumirem) — a única "matemática de gráfico" do componente. ───
    _computeSegs(cfg, items) {
      const p = cfg.power || 1;
      const weights = items.map(it => Math.pow(Math.max(it.value, 0), p));
      const wSum = weights.reduce((a, b) => a + b, 0) || 1;
      const total = items.reduce((a, b) => a + Math.max(b.value, 0), 0) || 1;
      const gap = cfg.gapDeg != null ? cfg.gapDeg : 1;
      let acc = 0;
      return items.map((it, i) => {
        const frac = Math.max(weights[i] / wSum, 0.004);
        const startA = acc * 360, endA = (acc + frac) * 360;
        acc += frac;
        const mid = (startA + endA) / 2;
        const rad = (mid - 90) * Math.PI / 180;
        return { ...it, startA: startA + gap / 2, endA: endA - gap / 2, mid,
          pct: it.value / total * 100, dir: { x: Math.cos(rad), y: Math.sin(rad) } };
      });
    }

    update(dataByRing) {
      this._lastData = dataByRing;
      this.rings.forEach(cfg => {
        const items = dataByRing[cfg.id] || [];
        this._renderRing(cfg, items);
      });
    }

    _renderRing(cfg, items) {
      this._ensureSheen(cfg);
      const segs = this._computeSegs(cfg, items);
      const sig = segs.map(s => s.key).join('|');
      const group = this._ringGroups[cfg.id];
      const store = this._els[cfg.id];
      if (this._prevSig[cfg.id] !== sig) {
        // mantém a <path class="sb3d-sheen"> (última filha), só limpa fatias
        Array.from(group.querySelectorAll(':scope > g.sb3d-slice')).forEach(n => n.remove());
        this._haloG.querySelectorAll(`[data-ring="${cfg.id}"]`).forEach(n => n.remove());
        this._connG.querySelectorAll(`[data-ring="${cfg.id}"]`).forEach(n => n.remove());
        this._cards.querySelectorAll(`[data-ring="${cfg.id}"]`).forEach(n => n.remove());
        this._els[cfg.id] = {};
        this._prevSig[cfg.id] = sig;
      }
      const sheen = group.querySelector('.sb3d-sheen');

      segs.forEach(s => {
        let rec = this._els[cfg.id][s.key];
        let isNew = false;
        if (!rec) {
          isNew = true;
          rec = this._createSlice(cfg, s);
          this._els[cfg.id][s.key] = rec;
          group.insertBefore(rec.g, sheen);
        }
        this._updateSlice(cfg, rec, s);
        if (isNew) {
          rec.g.classList.add('sb3d-entering');
          rec.g.addEventListener('animationend', () => rec.g.classList.remove('sb3d-entering'), { once: true });
        }
      });
    }

    _createSlice(cfg, s) {
      const g = el('g', `sb3d-slice mode-${cfg.mode}`);
      g.dataset.ring = cfg.id; g.dataset.key = s.key;

      const side = el('path', 'side'); side.setAttribute('pointer-events', 'none');
      side.setAttribute('transform', 'translate(5,11)');
      g.appendChild(side);

      const path = el('path', 'main');
      g.appendChild(path);
      const gradId = `sb3d-grad-${this.uid}-${cfg.id}-${Math.random().toString(36).slice(2, 8)}`;
      const grad = el('linearGradient'); grad.setAttribute('id', gradId); grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      grad.innerHTML = '<stop class="s0" offset="0%"/><stop class="s1" offset="52%"/><stop class="s2" offset="100%"/>';
      this._defs.appendChild(grad);
      path.setAttribute('fill', `url(#${gradId})`);

      const hi = el('path', 'hi'); hi.setAttribute('fill', 'none'); hi.setAttribute('stroke', '#fff');
      hi.setAttribute('stroke-width', 1.6); hi.setAttribute('stroke-linecap', 'round'); hi.setAttribute('pointer-events', 'none');
      g.appendChild(hi);
      const inHi = el('path', 'inhi'); inHi.setAttribute('fill', 'none'); inHi.setAttribute('stroke', '#fff');
      inHi.setAttribute('stroke-width', 1.4); inHi.setAttribute('stroke-linecap', 'round'); inHi.setAttribute('pointer-events', 'none');
      g.appendChild(inHi);

      const markG = el('g', cfg.mode === 'icon' ? 'sb3d-icon' : 'sb3d-avatar');
      g.appendChild(markG);

      g.addEventListener('click', () => { if (!s.locked) this.onToggle(cfg.id, s.key); });
      g.addEventListener('pointerenter', () => this._hoverTag(cfg, s.key, true));
      g.addEventListener('pointerleave', () => this._hoverTag(cfg, s.key, false));

      let halo = null;
      if (cfg.mode === 'avatar') {
        halo = el('path', 'sb3d-halo'); halo.dataset.ring = cfg.id; halo.dataset.key = s.key;
        halo.setAttribute('stroke-width', 3);
        this._haloG.appendChild(halo);
      }
      const line = el('line', 'sb3d-connector'); line.dataset.ring = cfg.id; line.dataset.key = s.key;
      this._connG.appendChild(line);

      const tag = document.createElement('div');
      tag.className = 'sb3d-tag'; tag.dataset.ring = cfg.id; tag.dataset.key = s.key;
      tag.innerHTML = '<span class="sb3d-tag-dot"></span><span class="sb3d-tag-txt"><span class="sb3d-tag-name"></span><span class="sb3d-tag-val"></span></span><span class="sb3d-tag-pct"></span>';
      tag.addEventListener('click', () => { if (!s.locked) this.onToggle(cfg.id, s.key); });
      this._cards.appendChild(tag);

      return { g, path, side, hi, inHi, markG, grad, halo, line, tag, hover: false };
    }

    _hoverTag(cfg, key, on) {
      const rec = this._els[cfg.id][key];
      if (!rec) return;
      rec.hover = on;
      this._positionTag(cfg, rec, this._lastSeg(cfg, key));
    }
    _lastSeg(cfg, key) {
      const items = this._lastData[cfg.id] || [];
      const segs = this._computeSegs(cfg, items);
      return segs.find(s => s.key === key);
    }

    _updateSlice(cfg, rec, s) {
      rec.path.setAttribute('d', this.ringPath(cfg.rOut, cfg.rIn, s.startA, s.endA));
      rec.side.setAttribute('d', this.ringPath(cfg.rOut, cfg.rIn, s.startA, s.endA));
      rec.g.classList.toggle('is-selected', !!s.selected);

      const lf = this.lightFactor(s.mid);
      rec.side.setAttribute('fill', mix(s.color, '#000000', 0.56 - lf * 0.16));
      rec.path.style.setProperty('--sc', s.color);

      const gp1 = this.polar(cfg.rOut + 8, s.mid), gp2 = this.polar(cfg.rIn - 8, s.mid);
      rec.grad.setAttribute('x1', gp1.x); rec.grad.setAttribute('y1', gp1.y);
      rec.grad.setAttribute('x2', gp2.x); rec.grad.setAttribute('y2', gp2.y);
      rec.grad.querySelector('.s0').setAttribute('stop-color', mix(s.color, '#ffffff', 0.20 + lf * 0.24));
      rec.grad.querySelector('.s1').setAttribute('stop-color', s.color);
      rec.grad.querySelector('.s2').setAttribute('stop-color', mix(s.color, '#000000', 0.30 - lf * 0.08));

      if (s.endA - s.startA > 13) {
        const hiSpan = Math.min(s.endA - s.startA - 4, 26);
        const a0 = s.mid - hiSpan / 2, a1 = s.mid + hiSpan / 2;
        const hp1 = this.polar(cfg.rOut - 2, a0), hp2 = this.polar(cfg.rOut - 2, a1);
        rec.hi.setAttribute('d', `M${hp1.x} ${hp1.y} A${cfg.rOut - 2} ${cfg.rOut - 2} 0 0 1 ${hp2.x} ${hp2.y}`);
        rec.hi.setAttribute('opacity', (0.12 + lf * 0.36).toFixed(2));
        rec.hi.style.display = '';
        const ip1 = this.polar(cfg.rIn + 2, a0), ip2 = this.polar(cfg.rIn + 2, a1);
        rec.inHi.setAttribute('d', `M${ip1.x} ${ip1.y} A${cfg.rIn + 2} ${cfg.rIn + 2} 0 0 1 ${ip2.x} ${ip2.y}`);
        rec.inHi.setAttribute('opacity', (0.08 + lf * 0.34).toFixed(2));
        rec.inHi.style.display = '';
      } else { rec.hi.style.display = 'none'; rec.inHi.style.display = 'none'; }

      const mc = markColor(s.color);
      if (cfg.mode === 'icon') {
        const icon = this.getIcon(cfg.id, s.key);
        const ip = this.polar(cfg.markR || (cfg.rOut + cfg.rIn) / 2, s.mid);
        if (icon) rec.markG.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
        else rec.markG.innerHTML = '';
        rec.markG.style.color = mc;
        const scale = s.selected ? 2.3 : 1.75;
        rec.markG.setAttribute('transform', `translate(${ip.x - 12 * scale} ${ip.y - 12 * scale}) scale(${scale})`);
        rec.g.style.transform = s.selected ? `translate(${s.dir.x * (cfg.explode || 18)}px, ${s.dir.y * (cfg.explode || 18)}px)` : '';
      } else {
        const label = s.locked ? '' : this.getLabel(cfg.id, s.key);
        if (label) {
          const ap = this.polar(cfg.markR || (cfg.rOut + cfg.rIn) / 2, s.mid);
          rec.markG.innerHTML = `<text x="${ap.x}" y="${ap.y + 0.5}" style="fill:${mc}">${label}</text>`;
        } else rec.markG.innerHTML = '';
        const op = this.polar((cfg.rOut + cfg.rIn) / 2, s.mid);
        rec.g.style.transformOrigin = `${op.x}px ${op.y}px`;
        rec.g.style.transform = s.selected ? 'scale(1.045)' : '';
        if (rec.halo) {
          const grow = cfg.grow || 14;
          rec.halo.setAttribute('d', this.ringPath(cfg.rOut + grow, Math.max(cfg.rIn - grow * 0.4, 0), s.startA, s.endA));
          rec.halo.setAttribute('stroke', s.color);
          rec.halo.setAttribute('fill', s.color);
          rec.halo.classList.toggle('on', !!s.selected);
        }
      }

      this._positionTag(cfg, rec, s);
    }

    _positionTag(cfg, rec, s) {
      if (!s) return;
      const labelR = cfg.labelR != null ? cfg.labelR : cfg.rOut + 40;
      const lp = this.polar(labelR, s.mid);
      const show = !!s.selected || !!rec.hover;
      rec.tag.classList.toggle('show', show);
      rec.tag.style.left = (lp.x / this.size * 100) + '%';
      rec.tag.style.top = (lp.y / this.size * 100) + '%';
      rec.tag.classList.toggle('left', s.dir.x < -0.15);
      // A tag ficou mais larga com o % (Locação/Silvio, perto da lateral,
      // tomam quase o anel inteiro) — precisa de mais folga que antes
      // pra não estourar a borda da tela.
      const tx = -50 - Math.max(-42, Math.min(42, s.dir.x * 42));
      rec.tag.style.setProperty('--tx', tx + '%');
      rec.tag.querySelector('.sb3d-tag-dot').style.background = s.color;
      rec.tag.querySelector('.sb3d-tag-name').textContent = s.key;
      rec.tag.querySelector('.sb3d-tag-val').textContent = s.valueLabel != null ? s.valueLabel : s.value;
      rec.tag.querySelector('.sb3d-tag-pct').textContent = s.pct.toFixed(s.pct < 10 ? 1 : 0) + '%';

      if (s.selected) {
        const edgeR = cfg.mode === 'icon' ? cfg.rOut + (cfg.explode || 18) : cfg.rOut + (cfg.grow || 14) * 0.6;
        const outerP = this.polar(edgeR, s.mid);
        rec.line.setAttribute('x1', outerP.x); rec.line.setAttribute('y1', outerP.y);
        rec.line.setAttribute('x2', lp.x); rec.line.setAttribute('y2', lp.y);
        rec.line.style.opacity = 0.32;
      } else {
        rec.line.style.opacity = 0;
      }
    }

    // ─── Legenda premium: quadrado, nome, valor, percentual, barra ───
    renderLegend(ringId, ulEl, opts) {
      opts = opts || {};
      const items = this._lastData[ringId] || [];
      const segs = this._computeSegs(this._ringById(ringId), items);
      ulEl.innerHTML = '';
      segs.forEach(s => {
        const li = document.createElement('li');
        li.className = s.locked ? 'nosel' : (s.selected ? 'on' : '');
        li.dataset.ring = ringId; li.dataset.key = s.key;
        const barPct = Math.max(s.pct, s.pct > 0 ? 0.6 : 0);
        li.innerHTML =
          `<span class="sb3d-legend-sq" style="background:${s.color}"></span>` +
          `<span class="sb3d-legend-nm">${s.key}</span>` +
          `<span class="sb3d-legend-right"><span class="sb3d-legend-pct">${s.pct.toFixed(s.pct < 10 ? 1 : 0)}%</span><span class="sb3d-legend-val">${s.valueLabel != null ? s.valueLabel : s.value}</span></span>` +
          `<span class="sb3d-legend-bar-wrap"><span class="sb3d-legend-bar" style="width:${barPct}%;background:${s.color};--bc:${s.color}66"></span></span>`;
        if (!s.locked) {
          li.querySelector('.sb3d-legend-sq').addEventListener('click', e => { e.stopPropagation(); this.onToggle(ringId, s.key); });
          li.addEventListener('click', () => this.onOpen(ringId, s.key));
        }
        ulEl.appendChild(li);
      });
      if (opts.title) ulEl.setAttribute('aria-label', opts.title);
    }

    _ringById(id) { return this.rings.find(r => r.id === id); }
  }

  global.Sunburst3D = Sunburst3D;
})(window);
