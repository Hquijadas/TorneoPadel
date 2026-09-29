import { db, CATEGORIAS } from './firebase-config.js';
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const container = document.getElementById('grupos-container');

// ── Suscripción en tiempo real a los grupos ──────────────────────────────────
const q = query(collection(db, 'grupos'), orderBy('categoria'), orderBy('numeroGrupo'));

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
      <p>Error al cargar los grupos. Recarga la página.</p>
    </div>`;
});

// ── Renderizado de tarjeta de grupo ─────────────────────────────────────────
function groupCardHTML(g) {
  const pairsHTML = (g.parejas || []).map((p, i) => `
    <li>
      <span class="pair-number">${i + 1}</span>
      <span>${esc(p.nombre)}</span>
    </li>`).join('');

  const matchesHTML = (g.partidos || []).map(m => `
    <div class="match-row">
      ${esc(m.pareja1Nombre)} <span class="match-vs">VS</span> ${esc(m.pareja2Nombre)}
    </div>`).join('');

  return `
    <div class="group-card">
      <h3>🏅 Grupo ${g.numeroGrupo}</h3>
      <ul class="group-pairs">${pairsHTML}</ul>
      <div class="matches-title">🎾 Partidos</div>
      ${matchesHTML || '<div class="match-row" style="color:var(--text-light)">Sin partidos generados</div>'}
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
