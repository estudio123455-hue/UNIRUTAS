// ============================================================
// perfil.js  —  Carga robusta del perfil de UniRutas
// ------------------------------------------------------------
// Arregla el bug "No se encontraron datos del usuario":
//   1) Espera a que Firebase Auth confirme la sesión.
//   2) Si el documento del usuario no existe, lo crea con
//      datos por defecto tomados de Auth (correo, nombre).
//   3) Renderiza el perfil y las estadísticas.
// ============================================================

import { getAuth, onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs, serverTimestamp, orderBy, limit
} from "firebase/firestore";

const auth = getAuth();
const db = getFirestore();

const COLECCION_USUARIOS = "usuarios";
const COLECCION_PELOTONES = "pelotones";

// ------------------------------------------------------------
// 1. Esperar a la sesión ANTES de leer Firestore
// ------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const datos = await cargarOcrearUsuario(user);
    pintarPerfil(datos, user);
    await cargarMisPelotones(user.uid);
    await cargarEstadisticas(user.uid);
  } catch (err) {
    console.error("Error cargando perfil:", err);
    mostrarToast("No se pudo cargar tu perfil. Revisa tu conexión.");
  }
});

// ------------------------------------------------------------
// 2. Cargar el documento del usuario; si no existe, crearlo
// ------------------------------------------------------------
async function cargarOcrearUsuario(user) {
  const ref = doc(db, COLECCION_USUARIOS, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data();
  }

  // El documento no existe -> lo creamos con valores por defecto
  const nuevo = {
    nombre: user.displayName || "Usuario",
    correo: user.email || "",
    barrio: "",
    universidad: "",
    vehiculo: "bicicleta",
    verified_email: user.emailVerified || false,
    creadoEn: serverTimestamp()
  };
  await setDoc(ref, nuevo);
  return nuevo;
}

// ------------------------------------------------------------
// 3. Pintar los datos en pantalla (adaptado a IDs de perfil.html)
// ------------------------------------------------------------
function pintarPerfil(d, user) {
  // Avatar con iniciales
  const iniciales = (d.nombre || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  setText("avatar", iniciales);

  // Nombre y correo
  setText("profile-name", d.nombre || "Usuario");
  setText("profile-email", d.correo || user.email || "");

  // Badge de vehículo
  setText("vehiculo-text", d.vehiculo || "No definido");

  // Badge de verificación de correo
  const badgeEmail = document.getElementById("badge-email");
  const emailStatus = document.getElementById("email-status");
  if (badgeEmail && emailStatus) {
    if (d.verified_email || user.emailVerified) {
      badgeEmail.className = "badge badge-verified";
      emailStatus.textContent = "✓ Correo verificado";
    } else {
      badgeEmail.className = "badge badge-unverified";
      emailStatus.textContent = "Sin verificar";
    }
  }

  // Llenar formulario de edición
  setText("edit-nombre", d.nombre || "");
  setText("edit-barrio", d.barrio || "");
  setText("edit-universidad", d.universidad || "");
  
  const radioVehiculo = document.querySelector(`input[name="edit-vehiculo"][value="${d.vehiculo}"]`);
  if (radioVehiculo) radioVehiculo.checked = true;
}

// ------------------------------------------------------------
// 4. Mis pelotones (creados vs unidos)
// ------------------------------------------------------------
async function cargarMisPelotones(uid) {
  // Creados: donde el líder soy yo
  const qCreados = query(
    collection(db, COLECCION_PELOTONES),
    where("lider", "==", uid),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  
  // Unidos: donde mi uid está en el arreglo participantes
  const qUnidos = query(
    collection(db, COLECCION_PELOTONES),
    where("participantes", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  const [creadosSnap, unidosSnap] = await Promise.all([
    getDocs(qCreados),
    getDocs(qUnidos)
  ]);

  const creados = creadosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  // En "unidos" excluimos los que yo mismo creé
  const unidos = unidosSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.lider !== uid);

  renderPelotonesLista(creados, unidos);
  return { creados, unidos };
}

function renderPelotonesLista(creados, unidos) {
  const container = document.getElementById("pelotones-list");
  if (!container) return;

  const tabActual = document.querySelector(".tab-btn.active")?.dataset.tab || "creados";
  const lista = tabActual === "creados" ? creados : unidos;

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <p>${tabActual === "creados" ? "No has creado pelotones" : "No te has unido a pelotones"}</p>
      </div>
    `;
    return;
  }

  const vehiculoIconos = {
    bicicleta: "🚲",
    patineta: "⚡",
    pie: "🚶"
  };

  container.innerHTML = lista.map(p => {
    const vehiculoLabel = vehiculoIconos[p.vehiculo] || "🚲";
    const participantes = p.participantes || [];

    return `
      <div class="peloton-item">
        <div class="peloton-route">
          ${p.origen || "Origen"} → ${p.destino || "Destino"}
        </div>
        <div class="peloton-meta">
          <div class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${p.horaSalida || "--:--"}
          </div>
          <div class="meta-item">
            <span>${vehiculoLabel}</span>
          </div>
          <div class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            ${participantes.length}/${p.cupoMax || "?"}
          </div>
        </div>
        <div class="peloton-footer">
          <a href="index.html" class="btn-ver-mapa">Ver en mapa</a>
        </div>
      </div>
    `;
  }).join("");
}

// ------------------------------------------------------------
// 5. Estadísticas
// ------------------------------------------------------------
async function cargarEstadisticas(uid) {
  // Contar pelotones creados
  const qCreados = query(
    collection(db, COLECCION_PELOTONES),
    where("lider", "==", uid)
  );
  const creadosSnap = await getDocs(qCreados);
  setText("stat-creados", creadosSnap.size);
  
  // Contar pelotones unidos
  const qUnidos = query(
    collection(db, COLECCION_PELOTONES),
    where("participantes", "array-contains", uid)
  );
  const unidosSnap = await getDocs(qUnidos);
  setText("stat-unidos", unidosSnap.size);

  // Contar reportes enviados
  const qReportes = query(
    collection(db, "reportes"),
    where("uid", "==", uid)
  );
  const reportesSnap = await getDocs(qReportes);
  setText("stat-reportes", reportesSnap.size);
}

// ------------------------------------------------------------
// 6. Editar perfil
// ------------------------------------------------------------
window.toggleEditForm = function() {
  const form = document.getElementById("edit-form");
  const btn = document.getElementById("btn-toggle-edit");
  form.classList.toggle("open");
  btn.textContent = form.classList.contains("open") ? "Cancelar" : "Editar";
};

window.guardarCambios = async function(e) {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) return;

  const nombre = document.getElementById("edit-nombre").value.trim();
  const barrio = document.getElementById("edit-barrio").value.trim();
  const universidad = document.getElementById("edit-universidad").value.trim();
  const vehiculo = document.querySelector('input[name="edit-vehiculo"]:checked')?.value;

  if (!nombre) {
    mostrarToast("El nombre es requerido", "warning");
    return;
  }

  try {
    // Actualizar en Firestore
    await updateDoc(doc(db, COLECCION_USUARIOS, user.uid), {
      nombre,
      barrio,
      universidad,
      vehiculo
    });

    // Actualizar displayName en Auth
    await updateProfile(user, { displayName: nombre });

    // Recargar datos
    const datos = await cargarOcrearUsuario(user);
    pintarPerfil(datos, user);

    mostrarToast("Perfil actualizado", "success");
    toggleEditForm();
  } catch (error) {
    console.error("Error al guardar:", error);
    mostrarToast("Error al guardar cambios", "error");
  }
};

// ------------------------------------------------------------
// 7. Tabs de pelotones
// ------------------------------------------------------------
window.setTab = function(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  
  // Recargar pelotones con el tab actual
  cargarMisPelotones(auth.currentUser?.uid);
};

// ------------------------------------------------------------
// 8. Cerrar sesión
// ------------------------------------------------------------
window.cerrarSesion = async function() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    mostrarToast("Error al cerrar sesión", "error");
  }
};

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function mostrarToast(msg, tipo = "info") {
  // Importar toast si existe, sino usar fallback
  if (typeof showToast === "function") {
    showToast(msg, tipo);
  } else {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    t.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--gris-900);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 0.9rem;
      z-index: 1000;
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }
}
