import { db, CATEGORIAS } from './firebase-config.js';
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const container = document.getElementById('grupos-container');

// ── Suscripción en tiempo real a los grupos ──────────────────────────────────
const q = collection(db, 'grupos');

onSnapshot(q, (snapshot) => {
  if (snapshot.empty) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>
          Los grupos aún no han sido generados.<br>
          Vuelve más tarde o contacta con el organizador.
        </p>
      </div>`;
    return;
  }

  // Agrupar por categoría
  const byCategory = {};
  CATEGORIAS.forEach(c => (byCategory[c] = []));
  snapshot.forEach(doc => {
    const d = doc.data();
    if (byCategory[d.categoria] !== undefined) {
      byCategory[d.categoria].push({ id: doc.id, ...d });
    }
  });

  let html = '';
  CATEGORIAS.forEach(cat => {
    const groups = byCategory[cat];
    if (!groups.length) return;
    groups.sort((a, b) => (a.numeroGrupo || 0) - (b.numeroGrupo || 0));
    const catKey = catToKey(cat);
    html += `
      <div class="category-section">
        <div class="category-title">
          <span class="cat-tag cat-${catKey}">${cat}</span>
          <span class="count-badge">${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}</span>
        </div>
        <div class="groups-grid">
          ${groups.map(g => groupCardHTML(g)).join('')}
        </div>
      </div>`;
  });

  container.innerHTML = html || `
    <div class="empty-state">
      <div class="icon">📋</div>
      <p>No hay grupos disponibles todavía.</p>
    </div>`;
}, (err) => {
  console.error('Error al cargar grupos:', err);
  container.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <p>Error al cargar los grupos:<br><small style="color:var(--danger);">${esc(err.message || err.code || 'Error desconocido')}</small></p>
    </div>`;
});

// ── Renderizado de tarjeta de grupo y partidos (Mobile-First) ───────────────
function groupCardHTML(g) {
  const pairsHTML = (g.parejas || []).map((p, i) => {
    const players = (p.nombre || '').split('/').map(s => s.trim()).filter(Boolean);
    const p1 = players[0] || p.nombre;
    const p2 = players[1] || '';
    return `
      <div class="group-pair-chip">
        <span class="group-seed">${i + 1}</span>
        <div class="group-pair-info">
          <div class="player-line">${esc(p1)}</div>
          ${p2 ? `<div class="player-line">${esc(p2)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const matchesHTML = (g.partidos || []).map((m, idx) => matchCardHTML(m, idx)).join('');

  return `
    <div class="group-card">
      <div class="group-card-header">
        <div class="group-badge">🏅 Grupo ${g.numeroGrupo}</div>
        <span class="group-count">${(g.parejas || []).length} Parejas</span>
      </div>

      <div class="group-section-label">👥 Parejas del grupo</div>
      <div class="group-pairs-chips">
        ${pairsHTML}
      </div>

      <div class="group-section-label" style="margin-top: 1.2rem;">🎾 Partidos del grupo</div>
      <div class="matches-list">
        ${matchesHTML || '<div class="match-row" style="color:var(--text-light)">Sin partidos generados</div>'}
      </div>
    </div>`;
}

function matchCardHTML(m, idx) {
  return `
    <div class="match-fixture-card">
      <div class="match-fixture-header">
        <span class="match-fixture-tag">🎾 Partido ${idx + 1}</span>
        <span class="match-status-tag">Round Robin</span>
      </div>
      <div class="match-fixture-body">
        <div class="team-box team-a">
          ${renderTeamHTML(m.pareja1Nombre)}
        </div>
        <div class="match-vs-divider">
          <span class="vs-circle">VS</span>
        </div>
        <div class="team-box team-b">
          ${renderTeamHTML(m.pareja2Nombre)}
        </div>
      </div>
    </div>`;
}

function renderTeamHTML(rawName) {
  const players = (rawName || '').split('/').map(s => s.trim()).filter(Boolean);
  if (players.length >= 2) {
    return `
      <div class="team-player-row">
        <span class="player-avatar">👤</span>
        <span class="player-name">${esc(players[0])}</span>
      </div>
      <div class="team-player-row">
        <span class="player-avatar">👤</span>
        <span class="player-name">${esc(players[1])}</span>
      </div>`;
  }
  return `
    <div class="team-player-row">
      <span class="player-avatar">👤</span>
      <span class="player-name">${esc(rawName)}</span>
    </div>`;
}

function catToKey(cat) {
  return cat.toLowerCase().replace(/ /g, '-');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
