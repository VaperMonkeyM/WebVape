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
  getDocs,
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

  if (label) label.textContent = `Hola, ${currentUserData.nombre}`;
  logout?.classList.remove("hidden");

  if (currentRole === "admin") adminLink?.classList.remove("hidden");
}

function setupAuthForms() {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  // Login
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

  // Registro
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
        rol: "user",
        creadoEn: new Date(),
      });

      showToast("Cuenta creada");
      window.location.href = "login.html";
    } catch {
      $("#registerError").textContent = "Error al registrar.";
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

  // ALL
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

  // Otras categorías
  currentCategories.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = c.nombre;
    btn.dataset.filter = c.id;
    if (currentFilter === c.id) btn.classList.add("chip-active");

    btn.onclick = () => {
      currentFilter = c.id;
      renderProducts();
      renderCategoryFilters();
    };

    box.appendChild(btn);
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
    li.textContent = c.nombre;
    list.appendChild(li);

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
    list = list.filter((p) => p.categoriaId === currentFilter);

  list.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const catObj = currentCategories.find((c) => c.id === p.categoriaId);
    const catName = catObj ? c.nombre : "—";

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

          <button class="btn-tertiary btn-reservar"${p.enStock ? "" : "disabled"}>
            Reservar
          </button>
        </div>
      </div>
    `;

    card.querySelector(".btn-reservar").onclick = () => openVaperModal(p);

    grid.appendChild(card);
  });
}

// ⭐⭐⭐ FIX COMPLETO PARA MÓVIL — SECCIÓN ADMIN ⭐⭐⭐

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

      <span class="admin-badge-stock ${p.enStock ? "ok" : "off"} stock-toggle">
        ${p.enStock ? "En stock" : "Sin stock"}
      </span>
    `;

    // ************** FIX MÓVIL **************
    const badge = item.querySelector(".stock-toggle");

    badge.addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const nuevoValor = !p.enStock;
      const ref = doc(db, "vapers", p.id);
      await updateDoc(ref, { enStock: nuevoValor });

      showToast(
        nuevoValor
          ? "El vaper está ahora EN STOCK"
          : "El vaper está ahora SIN STOCK"
      );
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

    // ENVIAR A VERCELO (GMAIL BOT)
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
// 8. INICIALIZACIÓN
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  setupAuthForms();
  setupCategories();
  setupVapers();
  setupModal();
});

// ======================================================
// MENU MÓVIL
// ======================================================

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobileMenu");

if (menuToggle) {
  menuToggle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    mobileMenu.classList.toggle("hidden");
  });
}

document.addEventListener("pointerdown", (e) => {
  if (
    !mobileMenu.classList.contains("hidden") &&
    !mobileMenu.contains(e.target) &&
    !menuToggle.contains(e.target)
  ) {
    mobileMenu.classList.add("hidden");
  }
});
