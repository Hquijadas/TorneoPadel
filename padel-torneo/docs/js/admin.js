import { db, auth, CATEGORIAS } from './firebase-config.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, onSnapshot, query, orderBy, where,
  doc, deleteDoc, addDoc, getDocs, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const loginSection     = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const userEmailEl      = document.getElementById('user-email');
const btnLogout        = document.getElementById('btn-logout');
const statsBar         = document.getElementById('stats-bar');
const pairsContainer   = document.getElementById('pairs-container');
const gruposContainer  = document.getElementById('grupos-admin-container');
const viewInscritos    = document.getElementById('view-inscritos');
const viewGrupos       = document.getElementById('view-grupos');

let currentCategory = 'all';
let allPairs        = [];
let unsubPairs      = null;
let unsubGrupos     = null;

// ── Auth state ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    userEmailEl.textContent = user.email;
    initDashboard();
  } else {
    loginSection.style.display = 'flex';
    dashboardSection.style.display = 'none';
    if (unsubPairs)  { unsubPairs();  unsubPairs  = null; }
    if (unsubGrupos) { unsubGrupos(); unsubGrupos = null; }
  }
});

// ── Google Sign-In ───────────────────────────────────────────────────────────
document.getElementById('btn-google-login').addEventListener('click', async () => {
  const btn      = document.getElementById('btn-google-login');
  const errEl    = document.getElementById('login-error');
  btn.disabled   = true;
  btn.innerHTML  = '<span class="spinner" style="border-color:rgba(0,0,0,0.2);border-top-color:#555;"></span>&nbsp; Conectando…';
  errEl.style.display = 'none';

  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    // onAuthStateChanged se encarga del resto
  } catch (err) {
    console.error('Error al iniciar sesión con Google:', err);
    const msgs = {
      'auth/popup-closed-by-user':     'Cerraste la ventana de Google antes de completar el login.',
      'auth/cancelled-popup-request':  'Solicitud cancelada. Inténtalo de nuevo.',
      'auth/popup-blocked':            'El navegador bloqueó la ventana emergente. Permite las ventanas emergentes e inténtalo de nuevo.',
      'auth/unauthorized-domain':      'Este dominio no está autorizado en Firebase. Revisa la configuración de Authentication.',
    };
    errEl.textContent = msgs[err.code] || '❌ Error al iniciar sesión. Inténtalo de nuevo.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20" /> Iniciar sesión con Google';
  }
});

// ── Logout ───────────────────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => signOut(auth));

// ── Tabs de categoría ────────────────────────────────────────────────────────
document.querySelectorAll('#tabs-bar .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs-bar .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.cat;
    renderPairs();
  });
});

// ── Tabs de vista (Inscritos / Grupos) ───────────────────────────────────────
document.getElementById('view-btn-inscritos').addEventListener('click', () => {
  document.getElementById('view-btn-inscritos').classList.add('active');
  document.getElementById('view-btn-grupos').classList.remove('active');
  viewInscritos.style.display = 'block';
  viewGrupos.style.display = 'none';
});

document.getElementById('view-btn-grupos').addEventListener('click', () => {
  document.getElementById('view-btn-grupos').classList.add('active');
  document.getElementById('view-btn-inscritos').classList.remove('active');
  viewGrupos.style.display = 'block';
  viewInscritos.style.display = 'none';
});

// ── Generar grupos ───────────────────────────────────────────────────────────
document.getElementById('btn-generar').addEventListener('click', async () => {
  const btn = document.getElementById('btn-generar');

  const categoriasAGenerar = currentCategory === 'all' ? CATEGORIAS : [currentCategory];
  const totalParejas = categoriasAGenerar.reduce((acc, cat) =>
    acc + allPairs.filter(p => p.categoria === cat).length, 0);

  if (totalParejas < 2) {
    showToast('⚠️ No hay suficientes parejas para generar grupos', true);
    return;
  }

  if (!confirm(
    `¿Generar grupos para: ${categoriasAGenerar.join(', ')}?\n\n` +
    'Si ya existían grupos anteriores se eliminarán y se crearán de nuevo.'
  )) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>&nbsp; Generando…';

  try {
    for (const cat of categoriasAGenerar) {
      const catPairs = allPairs.filter(p => p.categoria === cat);
      if (catPairs.length < 2) continue;

      // 1. Borrar grupos existentes de esta categoría (en batch)
      const existing = await getDocs(
        query(collection(db, 'grupos'), where('categoria', '==', cat))
      );
      if (!existing.empty) {
        const batch = writeBatch(db);
        existing.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 2. Crear nuevos grupos
      const groups = splitIntoGroups(catPairs);
      for (let i = 0; i < groups.length; i++) {
        const gPairs  = groups[i];
        const partidos = generateRoundRobin(gPairs);
        await addDoc(collection(db, 'grupos'), {
          categoria:   cat,
          numeroGrupo: i + 1,
          parejas: gPairs.map(p => ({
            parejaId: p.id,
            nombre:   nombrePareja(p)
          })),
          partidos,
          createdAt: serverTimestamp()
        });
      }
    }
    showToast('✅ Grupos generados correctamente');

    // Cambiar a la vista de grupos
    document.getElementById('view-btn-grupos').click();
  } catch (err) {
    console.error('Error al generar grupos:', err);
    showToast('❌ Error al generar los grupos', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🎲 Generar Grupos';
  }
});

// ── Inicializar dashboard ────────────────────────────────────────────────────
function initDashboard() {
  // Escuchar parejas
  if (unsubPairs) unsubPairs();
  const qPairs = query(collection(db, 'parejas'), orderBy('fechaInscripcion', 'asc'));
  unsubPairs = onSnapshot(qPairs, (snap) => {
    allPairs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateStats();
    renderPairs();
  }, (err) => console.error('Error escuchando parejas:', err));

  // Escuchar grupos
  if (unsubGrupos) unsubGrupos();
  const qGrupos = query(collection(db, 'grupos'), orderBy('categoria'), orderBy('numeroGrupo'));
  unsubGrupos = onSnapshot(qGrupos, (snap) => {
    renderGruposAdmin(snap);
  }, (err) => console.error('Error escuchando grupos:', err));
}

// ── Stats bar ────────────────────────────────────────────────────────────────
function updateStats() {
  const counts = {};
  CATEGORIAS.forEach(c => (counts[c] = 0));
  allPairs.forEach(p => { if (counts[p.categoria] !== undefined) counts[p.categoria]++; });

  statsBar.innerHTML =
    `<div class="stat-pill">Total inscritos: <span>${allPairs.length}</span></div>` +
    CATEGORIAS.map(c =>
      `<div class="stat-pill"><span class="cat-tag cat-${catToKey(c)}" style="font-size:0.65rem;">${c}</span>&nbsp;<span>${counts[c]}</span></div>`
    ).join('');
}

// ── Render parejas ────────────────────────────────────────────────────────────
function renderPairs() {
  const filtered = currentCategory === 'all'
    ? allPairs
    : allPairs.filter(p => p.categoria === currentCategory);

  if (!filtered.length) {
    pairsContainer.innerHTML = `
      <div class="empty-state">
        <div class="icon">👥</div>
        <p>No hay parejas en esta categoría todavía.</p>
      </div>`;
    return;
  }

  if (currentCategory === 'all') {
    let html = '';
    CATEGORIAS.forEach(cat => {
      const catPairs = allPairs.filter(p => p.categoria === cat);
      if (!catPairs.length) return;
      html += `
        <div class="category-section">
          <div class="category-title">
            <span class="cat-tag cat-${catToKey(cat)}">${cat}</span>
            <span class="count-badge">${catPairs.length}</span>
          </div>
          <div class="pairs-grid">
            ${catPairs.map(p => adminPairCard(p)).join('')}
          </div>
        </div>`;
    });
    pairsContainer.innerHTML = html;
  } else {
    pairsContainer.innerHTML = `
      <div class="pairs-grid">
        ${filtered.map(p => adminPairCard(p)).join('')}
      </div>`;
  }

  // Listeners de borrado
  document.querySelectorAll('.btn-delete-pair').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id    = btn.dataset.id;
      const nombre = btn.dataset.nombre;
      if (!confirm(`¿Eliminar la pareja "${nombre}" del torneo?\n\nEsta acción no se puede deshacer.`)) return;
      try {
        await deleteDoc(doc(db, 'parejas', id));
        showToast('🗑️ Pareja eliminada');
      } catch (err) {
        console.error(err);
        showToast('❌ Error al eliminar la pareja', true);
      }
    });
  });
}

// ── Card de pareja (admin) ────────────────────────────────────────────────────
function adminPairCard(p) {
  const fecha = p.fechaInscripcion
    ? new Date(p.fechaInscripcion.seconds * 1000).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
    : 'Reciente';
  const nombre = nombrePareja(p);
  return `
    <div class="pair-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
        <div style="flex:1;min-width:0;">
          <div class="pair-names">🧑 ${esc(p.jugador1.nombre)} ${esc(p.jugador1.apellidos)}</div>
          <div class="pair-meta">📞 ${esc(p.jugador1.telefono)}</div>
          <div class="pair-names" style="margin-top:0.35rem;">🧑 ${esc(p.jugador2.nombre)} ${esc(p.jugador2.apellidos)}</div>
          <div class="pair-meta">📞 ${esc(p.jugador2.telefono)}</div>
        </div>
        <button class="btn btn-danger btn-delete-pair" data-id="${p.id}" data-nombre="${esc(nombre)}" title="Eliminar pareja">🗑️</button>
      </div>
      <div style="margin-top:0.6rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
        <span class="cat-tag cat-${catToKey(p.categoria)}">${p.categoria}</span>
        <span class="pair-meta">📅 ${fecha}</span>
      </div>
    </div>`;
}

// ── Render grupos (vista admin) ──────────────────────────────────────────────
function renderGruposAdmin(snap) {
  if (snap.empty) {
    gruposContainer.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>Los grupos aún no han sido generados.<br>Usa el botón <strong>"Generar Grupos"</strong> para crearlos.</p>
      </div>`;
    return;
  }

  const byCategory = {};
  CATEGORIAS.forEach(c => (byCategory[c] = []));
  snap.forEach(d => {
    const data = d.data();
    if (byCategory[data.categoria] !== undefined) {
      byCategory[data.categoria].push({ id: d.id, ...data });
    }
  });

  let html = '';
  CATEGORIAS.forEach(cat => {
    const groups = byCategory[cat];
    if (!groups.length) return;
    html += `
      <div class="category-section">
        <div class="category-title">
          <span class="cat-tag cat-${catToKey(cat)}">${cat}</span>
          <span class="count-badge">${groups.length} grupos</span>
        </div>
        <div class="groups-grid">
          ${groups.map(g => groupCardHTML(g)).join('')}
        </div>
      </div>`;
  });

  gruposContainer.innerHTML = html;
}

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
      ${matchesHTML || '<div class="match-row">Sin partidos</div>'}
    </div>`;
}

// ── Algoritmo de formación de grupos ─────────────────────────────────────────
/**
 * Divide un array de parejas en grupos de 3-4.
 * Prioriza grupos de 4; ajusta con grupos de 3 cuando es necesario.
 */
function splitIntoGroups(pairs) {
  const n = pairs.length;

  if (n < 2) return n > 0 ? [pairs] : [];
  if (n <= 4) return [pairs]; // un único grupo

  // Buscamos x (grupos de 3) e y (grupos de 4) tal que 3x + 4y = n
  let y         = Math.floor(n / 4);
  let remainder = n % 4;
  let x         = 0;

  if      (remainder === 0) { x = 0; }           // todo grupos de 4
  else if (remainder === 3) { x = 1; }           // un grupo de 3, resto de 4
  else if (remainder === 2) {
    if (y >= 1) { y -= 1; x = 2; }              // 4+2 → 3+3
    else        { return [pairs]; }              // n=2: un grupo
  } else /* remainder === 1 */ {
    if      (y >= 2) { y -= 2; x = 3; }         // 4+4+1 → 3+3+3
    else if (y === 1) { return [pairs]; }        // n=5: un grupo de 5 (excepcional)
    else             { return [pairs]; }         // n=1
  }

  if (x === 0 && y === 0) return [pairs];

  const result = [];
  let idx = 0;
  for (let i = 0; i < x; i++) { result.push(pairs.slice(idx, idx + 3)); idx += 3; }
  for (let i = 0; i < y; i++) { result.push(pairs.slice(idx, idx + 4)); idx += 4; }
  return result;
}

/**
 * Genera el fixture round-robin (todos contra todos) para un grupo.
 */
function generateRoundRobin(groupPairs) {
  const matches = [];
  for (let i = 0; i < groupPairs.length; i++) {
    for (let j = i + 1; j < groupPairs.length; j++) {
      matches.push({
        pareja1Id:     groupPairs[i].id,
        pareja1Nombre: nombrePareja(groupPairs[i]),
        pareja2Id:     groupPairs[j].id,
        pareja2Nombre: nombrePareja(groupPairs[j]),
        resultado:     null
      });
    }
  }
  return matches;
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function nombrePareja(p) {
  return `${p.jugador1.nombre} ${p.jugador1.apellidos} / ${p.jugador2.nombre} ${p.jugador2.apellidos}`;
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

function showToast(msg, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.background = isError ? '#c0392b' : '#1e8449';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
