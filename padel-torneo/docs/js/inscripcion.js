import { db, CATEGORIAS } from './firebase-config.js';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Poblar el select de categorías ──────────────────────────────────────────
const catSelect = document.getElementById('categoria');
CATEGORIAS.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  catSelect.appendChild(opt);
});

// ── Envío del formulario ─────────────────────────────────────────────────────
const form         = document.getElementById('inscripcion-form');
const alertSuccess = document.getElementById('alert-success');
const alertError   = document.getElementById('alert-error');
const btnSubmit    = document.getElementById('btn-submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validación básica
  const campos = ['j1_nombre','j1_apellidos','j1_telefono','j2_nombre','j2_apellidos','j2_telefono','categoria'];
  for (const campo of campos) {
    if (!form[campo].value.trim()) {
      showAlert(alertError, '❌ Por favor, rellena todos los campos antes de inscribirte.');
      return;
    }
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span class="spinner"></span>&nbsp; Inscribiendo…';

  const pareja = {
    jugador1: {
      nombre:    form.j1_nombre.value.trim(),
      apellidos: form.j1_apellidos.value.trim(),
      telefono:  form.j1_telefono.value.trim()
    },
    jugador2: {
      nombre:    form.j2_nombre.value.trim(),
      apellidos: form.j2_apellidos.value.trim(),
      telefono:  form.j2_telefono.value.trim()
    },
    categoria:        form.categoria.value,
    estado:           'inscrita',
    fechaInscripcion: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'parejas'), pareja);
    showAlert(alertSuccess, `✅ ¡Pareja inscrita correctamente en ${pareja.categoria}!`);
    form.reset();
  } catch (err) {
    console.error('Error al inscribir:', err);
    showAlert(alertError, '❌ Error al inscribirse. Inténtalo de nuevo o contacta con el organizador.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '🎾 Inscribirse al torneo';
  }
});

// ── Lista en tiempo real ─────────────────────────────────────────────────────
const pairsContainer = document.getElementById('pairs-container');
const pairsCount     = document.getElementById('pairs-count');

const q = query(collection(db, 'parejas'), orderBy('fechaInscripcion', 'asc'));

onSnapshot(q, (snapshot) => {
  pairsCount.textContent = snapshot.size;

  if (snapshot.empty) {
    pairsContainer.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎾</div>
        <p>Todavía no hay parejas inscritas.<br><strong>¡Sé el primero!</strong></p>
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
    const pairs = byCategory[cat];
    if (!pairs.length) return;
    const catKey = catToKey(cat);
    html += `
      <div class="category-section">
        <div class="category-title">
          <span class="cat-tag cat-${catKey}">${cat}</span>
          <span class="count-badge">${pairs.length} ${pairs.length === 1 ? 'pareja' : 'parejas'}</span>
        </div>
        <div class="pairs-grid">
          ${pairs.map(p => pairCardHTML(p)).join('')}
        </div>
      </div>`;
  });

  pairsContainer.innerHTML = html || `
    <div class="empty-state">
      <div class="icon">🎾</div>
      <p>No hay parejas inscritas aún.</p>
    </div>`;
}, (err) => {
  console.error('Error al cargar parejas:', err);
  pairsContainer.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <p>Error al cargar las inscripciones. Recarga la página.</p>
    </div>`;
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function pairCardHTML(p) {
  const fecha = p.fechaInscripcion
    ? new Date(p.fechaInscripcion.seconds * 1000).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
    : 'Reciente';
  return `
    <div class="pair-card">
      <div class="pair-names">🧑 ${esc(p.jugador1.nombre)} ${esc(p.jugador1.apellidos)}</div>
      <div class="pair-names">🧑 ${esc(p.jugador2.nombre)} ${esc(p.jugador2.apellidos)}</div>
      <div class="pair-meta" style="margin-top:0.2rem;">📅 ${fecha}</div>
    </div>`;
}

function catToKey(cat) {
  return cat.toLowerCase().replace(/ /g, '-');
}

function showAlert(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5500);
}

/** Escape minimal HTML to avoid XSS from user-entered names */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
