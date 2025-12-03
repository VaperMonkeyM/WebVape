// main.js (type="module")

// ======================================================
// 1. IMPORTAR FIREBASE Y CONFIG PERSONALIZADA
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
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
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

// 🔐 SOLO ESTOS UID SON ADMIN
const ADMIN_UIDs = ["zzmyV3WtENYwJ28OUlEaNjCpMA13"];

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

  currentRole = "user"; // siempre seguro

  if (snap.exists()) currentUserData = snap.data();

  // 🔐 Seguridad REAL: solo UID autorizados pueden ser admin
  if (ADMIN_UIDs.includes(uid)) currentRole = "admin";
}

function updateAuthUI() {
  const label = $("#userNameLabel");
  const logout = $("#btnLogout");
  const adminLink = $(".nav-admin-link");

  if (!currentUser) {
    label && (label.textContent = "");
    logout?.classList.add("hidden");
    adminLink?.classList.add("hidden");
    return;
  }

  if (label) label.textContent = `Hola, ${currentUserData?.nombre}`;
  logout?.classList.remove("hidden");

  if (currentRole === "admin") adminLink?.classList.remove("hidden");
}

function setupAuthForms() {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  // LOGIN
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginError").textContent = "";

    const email = $("#loginEmail").value.trim();
    const pass = $("#loginPassword").value;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast("Sesión iniciada");
      window.location.href = "index.html";
    } catch {
      $("#loginError").textContent = "Credenciales incorrectas.";
    }
  });

  // REGISTRO
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#registerError").textContent = "";

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
        creadoEn: new Date(),
      });

      showToast("Cuenta creada");
      window.location.href = "login.html";
    } catch {
      $("#registerError").textContent = "Error al registrar.";
    }
  });

  // LOGOUT
  $("#btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  // OBSERVER
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    currentUserData = null;

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

  // ALL
  const btnAll = document.createElement("button");
  btnAll.className = "chip";
  btnAllDataset = "all";
  btnAll.textContent = "Todos";
  if (currentFilter === "all") btnAll.classList.add("chip-active");
  btnAll.onclick = () => {
    currentFilter = "all";
    renderProducts();
    renderCategoryFilters();
  };
  box.appendChild(btnAll);

  // RESTO
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

// ⭐ ADMIN - LISTA DE CATEGORÍAS CON MENÚ 3 PUNTOS
function renderAdminCategoryList() {
  const list = $("#adminCategoryList");
  const select = $("#vaperCategory");
  if (!list || !select) return;

  list.innerHTML = "";
  select.innerHTML = "";

  currentCategories.forEach((c) => {
    const row = document.createElement("div");
    row.className = "admin-vaper-item";

    row.innerHTML = `
      <span>${c.nombre}</span>
      <div class="menu-dots">
        <button class="menu-dots-btn">⋮</button>
        <div class="menu-dots-menu hidden">
          <button class="edit-cat">Editar</button>
          <button class="delete-cat" style="color:#ff3b6a;">Eliminar</button>
        </div>
      </div>
    `;

    const dotsBtn = row.querySelector(".menu-dots-btn");
    const menu = row.querySelector(".menu-dots-menu");

    dotsBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    // EDITAR
    row.querySelector(".edit-cat").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      const nuevo = prompt("Nuevo nombre:", c.nombre);
      if (!nuevo) return;

      await updateDoc(doc(db, "categorias", c.id), {
        nombre: nuevo,
        slug: slugify(nuevo),
      });

      showToast("Categoría actualizada");
      menu.classList.add("hidden");
    });

    // ELIMINAR
    row.querySelector(".delete-cat").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      await deleteDoc(doc(db, "categorias", c.id));
      showToast("Categoría eliminada");
      menu.classList.add("hidden");
    });

    document.addEventListener("pointerdown", (ev) => {
      if (!row.contains(ev.target)) menu.classList.add("hidden");
    });

    list.appendChild(row);

    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
}

function setupCategories() {
  const q = query(collection(db, "categorias"), orderBy("nombre"));

  onSnapshot(q, (snap) => {
    currentCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategoryFilters();
    renderAdminCategoryList();
  });

  $("#categoryForm")?.addEventListener("submit", async (e) => {
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

  let list = currentProducts;
  if (currentFilter !== "all")
    list = currentProducts.filter((p) => p.categoriaId === currentFilter);

  list.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const catObj = currentCategories.find((c) => c.id === p.categoriaId);
    const catName = catObj ? catObj.nombre : "—";

    card.innerHTML = `
      <div class="product-image">
        <img src="${p.imagenUrl}">
        ${p.enStock ? "" : `<span class="product-badge">Sin stock</span>`}
      </div>

      <div class="product-body">
        <h3>${p.nombre}</h3>
        <p class="product-category">${catName}</p>

        <div class="product-info">
          <span class="product-status ${p.enStock ? "in-stock" : "out-stock"}">
            ${p.enStock ? "En stock" : "Sin stock"}
          </span>

          <button class="btn-tertiary btn-reservar" ${p.enStock ? "" : "disabled"}>
            Reservar
          </button>
        </div>
      </div>
    `;

    card.querySelector(".btn-reservar").onclick = () => openVaperModal(p);

    grid.appendChild(card);
  });
}

// ⭐ ADMIN VAPERS – MENU 3 PUNTOS
function renderAdminProductList() {
  const box = $("#adminVaperList");
  if (!box) return;

  box.innerHTML = "";

  currentProducts.forEach((p) => {
    const catName = currentCategories.find((c) => c.id === p.categoriaId)?.nombre || "";

    const item = document.createElement("div");
    item.className = "admin-vaper-item";

    item.innerHTML = `
      <div>
        <strong>${p.nombre}</strong>
        <div class="admin-vaper-meta">${catName}</div>
      </div>

      <div class="menu-dots">
        <button class="menu-dots-btn">⋮</button>
        <div class="menu-dots-menu hidden">
          <button class="toggle-stock">${p.enStock ? "Marcar sin stock" : "Marcar en stock"}</button>
          <button class="delete-vaper" style="color:#ff3b6a;">Eliminar</button>
        </div>
      </div>
    `;

    const menu = item.querySelector(".menu-dots-menu");
    const dotsBtn = item.querySelector(".menu-dots-btn");

    dotsBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    // TOGGLE STOCK
    item.querySelector(".toggle-stock").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "vapers", p.id), { enStock: !p.enStock });
      showToast("Stock actualizado");
      menu.classList.add("hidden");
    });

    // DELETE VAPER
    item.querySelector(".delete-vaper").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      await deleteDoc(doc(db, "vapers", p.id));
      showToast("Vaper eliminado");
      menu.classList.add("hidden");
    });

    document.addEventListener("pointerdown", (ev) => {
      if (!item.contains(ev.target)) menu.classList.add("hidden");
    });

    box.appendChild(item);
  });
}

function setupVapers() {
  const q = query(collection(db, "vapers"), orderBy("nombre"));

  onSnapshot(q, (snap) => {
    currentProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProducts();
    renderAdminProductList();
  });

  $("#vaperForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = $("#vaperName").value.trim();
    const categoriaId = $("#vaperCategory").value;
    const sabores = $("#vaperFlavors").value.split(",").map((s) => s.trim());
    const imagenUrl = $("#vaperImage").value.trim();

    if (!nombre || !categoriaId || !imagenUrl) return;

    await addDoc(collection(db, "vapers"), {
      nombre,
      categoriaId,
      sabores,
      imagenUrl,
      enStock: true,
      creadoEn: new Date(),
    });

    e.target.reset();
    showToast("Vaper añadido");
  });
}

// ======================================================
// 7. MODAL + EMAIL
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
    if (!currentUser) {
      $("#modalError").textContent = "Debes iniciar sesión.";
      return;
    }

    const sabor = $("#modalFlavorSelect").value;
    if (!sabor) {
      $("#modalError").textContent = "Elige un sabor.";
      return;
    }

    reservasCount++;
    $(".cart-count").textContent = reservasCount;

    fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelo: modalVaper.nombre,
        sabor,
        nombre: currentUserData.nombre,
        instagram: currentUserData.instagram,
      }),
    });

    showToast("Reserva enviada");
    closeVaperModal();
  });
}

// ======================================================
// 8. INICIALIZACIÓN
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  setupAuthForms();
  setupCategories();
  setupVapers();
  setupModal();
});

// ======================================================
// 9. MENU MÓVIL
// ======================================================

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobileMenu");

menuToggle?.addEventListener("pointerdown", (e) => {
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
