// main.js (type="module")

// ======================================================
// 1. IMPORTAR FIREBASE Y CONFIG
// ======================================================

import { firebaseConfig } from "./firebase/firebaseConfig.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ======================================================
// 2. INICIALIZAR FIREBASE
// ======================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ======================================================
// 3. VARIABLES GLOBALES
// ======================================================

let currentUser = null;
let currentUserData = null;
let currentRole = "user";

let currentProducts = [];
let currentCategories = [];

let currentFilter = "all";
let reservasCount = 0;

// Helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function showToast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2100);
}

function slugify(str) {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ======================================================
// 4. AUTENTICACIÓN
// ======================================================

async function loadUserData(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentUserData = snap.data();
    currentRole = currentUserData.rol || "user";
  }
}

function updateAuthUI() {
  const label = $("#userNameLabel");
  const logout = $("#btnLogout");
  const adminLink = $(".nav-admin-link");

  if (!currentUser) {
    if (label) label.textContent = "";
    logout?.classList.add("hidden");
    adminLink?.classList.add("hidden");
    return;
  }

  if (label && currentUserData) {
    label.textContent = `Hola, ${currentUserData.nombre}`;
  }
  logout?.classList.remove("hidden");

  if (currentRole === "admin") {
    adminLink?.classList.remove("hidden");
  } else {
    adminLink?.classList.add("hidden");
  }
}

function setupAuthForms() {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  // Login
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginError") && ($("#loginError").textContent = "");

    const email = $("#loginEmail").value.trim();
    const pass = $("#loginPassword").value;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast("Sesión iniciada");
      window.location.href = "index.html";
    } catch {
      $("#loginError") && ($("#loginError").textContent = "Credenciales incorrectas.");
    }
  });

  // Registro
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#registerError") && ($("#registerError").textContent = "");

    const nombre = $("#regName").value.trim();
    const instagram = $("#regIg").value.trim();
    const email = $("#regEmail").value.trim();
    const pass = $("#regPassword").value;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, "users", cred.user.uid), {
        nombre,
        instagram,
        correo: email,
        rol: "user",
        creadoEn: new Date(),
      });

      showToast("Cuenta creada");
      window.location.href = "login.html";
    } catch {
      $("#registerError") && ($("#registerError").textContent = "Error al registrar.");
    }
  });

  // Logout
  $("#btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  // Observer
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    currentUserData = null;
    currentRole = "user";

    if (user) await loadUserData(user.uid);
    updateAuthUI();
  });
}

// ======================================================
// 5. CATEGORÍAS
// ======================================================

function renderCategoryFilters() {
  const box = $("#categoryFilters");
  if (!box) return;

  box.innerHTML = "";

  // Botón "Todos"
  const btnAll = document.createElement("button");
  btnAll.className = "chip";
  btnAll.dataset.filter = "all";
  btnAll.textContent = "Todos";
  if (currentFilter === "all") btnAll.classList.add("chip-active");
  btnAll.onclick = () => {
    currentFilter = "all";
    renderProducts();
    renderCategoryFilters();
  };
  box.appendChild(btnAll);

  // Cada categoría
  currentCategories.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = c.nombre;
    b.dataset.filter = c.id;
    if (currentFilter === c.id) b.classList.add("chip-active");

    b.onclick = () => {
      currentFilter = c.id;
      renderProducts();
      renderCategoryFilters();
    };

    box.appendChild(b);
  });
}

function renderAdminCategoryList() {
  const list = $("#adminCategoryList");
  const select = $("#vaperCategory");
  if (!list || !select) return;

  list.innerHTML = "";
  select.innerHTML = "";

  currentCategories.forEach((c) => {
    const li = document.createElement("li");
    li.className = "admin-cat-item";
    li.innerHTML = `
      <span>${c.nombre}</span>
      <div class="admin-actions">
        <button class="menu-btn" type="button">⋮</button>
        <div class="admin-menu hidden">
          <div class="admin-menu-item edit-cat">✏️ Editar</div>
          <div class="admin-menu-item delete-cat">🗑 Eliminar</div>
        </div>
      </div>
    `;

    const menuBtn = li.querySelector(".menu-btn");
    const menu = li.querySelector(".admin-menu");

    menuBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    // Editar categoría (solo nombre)
    li.querySelector(".edit-cat").addEventListener("click", async () => {
      const nuevoNombre = prompt("Nuevo nombre de la categoría:", c.nombre);
      if (!nuevoNombre) return;
      await updateDoc(doc(db, "categorias", c.id), {
        nombre: nuevoNombre.trim(),
        slug: slugify(nuevoNombre),
      });
      showToast("Categoría actualizada");
    });

    // Eliminar categoría
    li.querySelector(".delete-cat").addEventListener("click", async () => {
      const ok = confirm(
        "¿Eliminar esta categoría? Los vapers seguirán existiendo, pero sin categoría."
      );
      if (!ok) return;
      await deleteDoc(doc(db, "categorias", c.id));
      showToast("Categoría eliminada");
    });

    list.appendChild(li);

    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
}

function setupCategories() {
  // Escuchar categorías
  const qCat = query(collection(db, "categorias"), orderBy("nombre"));
  onSnapshot(qCat, (snap) => {
    currentCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategoryFilters();
    renderAdminCategoryList();
  });

  // Formulario añadir categoría
  const form = $("#categoryForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#catName").value.trim();
    if (!name) return;

    await addDoc(collection(db, "categorias"), {
      nombre: name,
      slug: slugify(name),
    });

    $("#catName").value = "";
    showToast("Categoría añadida");
  });
}

// ======================================================
// 6. VAPERS
// ======================================================

function renderProducts() {
  const grid = $("#productGrid");
  if (!grid) return;

  grid.innerHTML = "";

  // Solo vapers en stock
  let list = currentProducts.filter((p) => p.enStock);

  if (currentFilter !== "all") {
    list = list.filter((p) => p.categoriaId === currentFilter);
  }

  list.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const catObj = currentCategories.find((c) => c.id === p.categoriaId);
    const catName = catObj ? catObj.nombre : "—";

    card.innerHTML = `
      <div class="product-image">
        <img src="${p.imagenUrl}" alt="${p.nombre}">
      </div>

      <div class="product-body">
        <h3>${p.nombre}</h3>
        <p class="product-category">${catName}</p>

        <div class="product-info">
          <span class="product-status in-stock">En stock</span>

          <button class="btn-tertiary btn-reservar">
            Reservar
          </button>
        </div>
      </div>
    `;

    card.querySelector(".btn-reservar").onclick = () => openVaperModal(p);
    grid.appendChild(card);
  });
}

// ---------- ADMIN LISTA VAPERS CON MENÚ ⋮ ----------

function openEditVaperModal(p) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="editCloseBtn">×</button>
      <h3>Editar vaper</h3>

      <div class="form-group">
        <label>Nombre</label>
        <input id="editName" value="${p.nombre}">
      </div>

      <div class="form-group">
        <label>Sabores (separados por coma)</label>
        <input id="editFlavors" value="${p.sabores.join(", ")}">
      </div>

      <div class="form-group">
        <label>Imagen URL</label>
        <input id="editImage" value="${p.imagenUrl}">
      </div>

      <div class="form-group">
        <label>Categoría</label>
        <select id="editCategory">
          ${currentCategories
            .map(
              (c) => `
            <option value="${c.id}" ${c.id === p.categoriaId ? "selected" : ""}>
              ${c.nombre}
            </option>`
            )
            .join("")}
        </select>
      </div>

      <div class="hero-actions" style="margin-top:18px;">
        <button id="editSave" class="btn-primary">Guardar</button>
        <button id="editCancel" class="btn-tertiary">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#editCloseBtn").onclick = close;
  overlay.querySelector("#editCancel").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector("#editSave").onclick = async () => {
    const nombre = overlay.querySelector("#editName").value.trim();
    const sabores = overlay
      .querySelector("#editFlavors")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const imagenUrl = overlay.querySelector("#editImage").value.trim();
    const categoriaId = overlay.querySelector("#editCategory").value;

    if (!nombre || !imagenUrl || !categoriaId) {
      alert("Rellena todos los campos.");
      return;
    }

    await updateDoc(doc(db, "vapers", p.id), {
      nombre,
      sabores,
      imagenUrl,
      categoriaId,
    });

    showToast("Vaper actualizado");
    close();
  };
}

function renderAdminProductList() {
  const box = $("#adminVaperList");
  if (!box) return;

  box.innerHTML = "";

  currentProducts.forEach((p) => {
    const catObj = currentCategories.find((c) => c.id === p.categoriaId);
    const catName = catObj ? catObj.nombre : "";

    const item = document.createElement("div");
    item.className = "admin-vaper-item";

    item.innerHTML = `
      <div class="admin-vaper-info">
        <strong>${p.nombre}</strong>
        <span class="admin-vaper-meta">${catName}</span>
      </div>

      <div class="admin-actions">
        <span class="stock-toggle admin-badge-stock ${
          p.enStock ? "ok" : "off"
        }">
          ${p.enStock ? "En stock" : "Sin stock"}
        </span>

        <button class="menu-btn" type="button">⋮</button>

        <div class="admin-menu hidden">
          <div class="admin-menu-item toggle-stock">
            ${p.enStock ? "❌ Quitar stock" : "✅ Poner stock"}
          </div>
          <div class="admin-menu-item edit-vaper">✏️ Editar</div>
          <div class="admin-menu-item delete-vaper">🗑 Eliminar</div>
        </div>
      </div>
    `;

    const stockBadge = item.querySelector(".stock-toggle");
    const menuBtn = item.querySelector(".menu-btn");
    const menu = item.querySelector(".admin-menu");

    // Toggle stock desde el texto
    stockBadge.addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      const nuevo = !p.enStock;
      await updateDoc(doc(db, "vapers", p.id), { enStock: nuevo });
      showToast("Stock actualizado");
    });

    // Abrir / cerrar menú ⋮
    menuBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    // Menú: toggle stock
    item.querySelector(".toggle-stock").addEventListener("click", async () => {
      const nuevo = !p.enStock;
      await updateDoc(doc(db, "vapers", p.id), { enStock: nuevo });
      showToast("Stock actualizado");
    });

    // Menú: editar vaper
    item.querySelector(".edit-vaper").addEventListener("click", () => {
      openEditVaperModal(p);
    });

    // Menú: eliminar vaper
    item.querySelector(".delete-vaper").addEventListener("click", async () => {
      const ok = confirm("¿Eliminar este vaper?");
      if (!ok) return;
      await deleteDoc(doc(db, "vapers", p.id));
      showToast("Vaper eliminado");
    });

    box.appendChild(item);
  });

  // Cerrar menús al hacer click fuera
  document.addEventListener("click", () => {
    $$(".admin-menu").forEach((m) => m.classList.add("hidden"));
  });
}

function setupVapers() {
  // Listener Firestore
  const q = query(collection(db, "vapers"), orderBy("nombre"));
  onSnapshot(q, (snap) => {
    currentProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProducts();
    renderAdminProductList();
  });

  // Añadir vaper
  const form = $("#vaperForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = $("#vaperName").value.trim();
    const categoriaId = $("#vaperCategory").value;
    const sabores = $("#vaperFlavors")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const imagenUrl = $("#vaperImage").value.trim();

    if (!nombre || !categoriaId || !imagenUrl || !sabores.length) return;

    await addDoc(collection(db, "vapers"), {
      nombre,
      categoriaId,
      sabores,
      imagenUrl,
      enStock: true,
      creadoEn: new Date(),
    });

    form.reset();
    showToast("Vaper añadido");
  });
}

// ======================================================
// 7. MODAL + RESERVA (ENVÍO POR EMAIL / API)
// ======================================================

let modalVaper = null;

function openVaperModal(vaper) {
  modalVaper = vaper;
  $("#modalVaperImage").src = vaper.imagenUrl;
  $("#modalVaperName").textContent = vaper.nombre;

  const cat = currentCategories.find((c) => c.id === vaper.categoriaId);
  $("#modalVaperCategory").textContent = cat ? cat.nombre : "";

  const sel = $("#modalFlavorSelect");
  sel.innerHTML = "";
  vaper.sabores.forEach((s) => {
    const op = document.createElement("option");
    op.value = s;
    op.textContent = s;
    sel.appendChild(op);
  });

  $("#modalError").textContent = "";
  $("#vaperModal").classList.remove("hidden");
}

function closeVaperModal() {
  $("#vaperModal").classList.add("hidden");
  modalVaper = null;
}

function setupModal() {
  $("#modalCloseBtn")?.addEventListener("click", closeVaperModal);

  $("#vaperModal")?.addEventListener("click", (e) => {
    if (e.target.id === "vaperModal") closeVaperModal();
  });

  $("#btnReservar")?.addEventListener("click", () => {
    if (!currentUser || !currentUserData) {
      $("#modalError").textContent = "Debes iniciar sesión.";
      return;
    }

    const sabor = $("#modalFlavorSelect").value;
    if (!sabor) {
      $("#modalError").textContent = "Elige un sabor.";
      return;
    }

    reservasCount++;
    const cartCount = $(".cart-count");
    if (cartCount) cartCount.textContent = reservasCount;

    fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelo: modalVaper.nombre,
        sabor,
        nombre: currentUserData.nombre,
        instagram: currentUserData.instagram,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          showToast("Reserva enviada correctamente");
          closeVaperModal();
        } else {
          $("#modalError").textContent =
            "Error al enviar la reserva. Inténtalo más tarde.";
        }
      })
      .catch(() => {
        $("#modalError").textContent =
          "Error al conectar con el servidor.";
      });

    showToast("Enviando reserva...");
  });
}

// ======================================================
// 8. MENÚ MÓVIL
// ======================================================

function setupMobileMenu() {
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobileMenu");

  if (!menuToggle || !mobileMenu) return;

  menuToggle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    mobileMenu.classList.toggle("hidden");
  });

  document.addEventListener("pointerdown", (e) => {
    if (
      !mobileMenu.classList.contains("hidden") &&
      !mobileMenu.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      mobileMenu.classList.add("hidden");
    }
  });
}

// ======================================================
// 9. INIT GLOBAL
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  setupAuthForms();
  setupCategories();
  setupVapers();
  setupModal();
  setupMobileMenu();

  const yearSpan = $("#year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
