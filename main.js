// main.js (type="module")

// ======================================================
// 1. IMPORTAR FIREBASE
// ======================================================

import { firebaseConfig } from "./firebase/firebaseConfig.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
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

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";


// ======================================================
// 2. INICIALIZAR FIREBASE
// ======================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


// ======================================================
// 3. VARIABLES GLOBALES
// ======================================================

// ⛔️ SOLO ESTE EMAIL ES ADMIN
const ADMIN_EMAIL = "cainlopezburgos@gmail.com";

let currentUser = null;
let currentUserData = null;
let currentRole = "user";

let currentProducts = [];
let currentCategories = [];

let currentFilter = "all";
let reservasCount = 0;
let editingVaper = null;


// ======================================================
// UTILIDADES
// ======================================================

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

async function uploadFlavorImage(file, vaperId, flavorName) {
  const slug = slugify(flavorName || file.name);
  const ref = storageRef(storage, `sabores/${vaperId}/${slug}`);
  await uploadBytes(ref, file);
  return await getDownloadURL(ref);
}


// ======================================================
// 4. AUTENTICACIÓN
// ======================================================

async function loadUserData(user) {
  // user viene de Firebase Auth
  const uid = user.uid;
  const email = (user.email || "").toLowerCase();

  // Por defecto siempre "user"
  currentRole = "user";

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  currentUserData = snap.exists() ? snap.data() : {};

  // Por si el doc no tiene nombre, usamos email de auth
  if (!currentUserData.nombre) {
    currentUserData.nombre = user.email || "";
  }

  // ✅ SOLO ESTE CORREO ES ADMIN
  if (email === ADMIN_EMAIL.toLowerCase()) {
    currentRole = "admin";
  }

  console.log("[AUTH] User:", email, "Rol:", currentRole);
}

// ✅ VERIFICAR ACCESO ADMIN
export async function checkAdminAccess() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      const noAccessDiv = $("#noAccessMessage");
      const adminPanel = $("#adminPanel");

      if (!user) {
        // No está logueado
        if (noAccessDiv) noAccessDiv.classList.remove("hidden");
        if (adminPanel) adminPanel.classList.add("hidden");
        resolve(false);
        return;
      }

      const email = (user.email || "").toLowerCase();
      if (email === ADMIN_EMAIL.toLowerCase()) {
        // Es admin
        if (noAccessDiv) noAccessDiv.classList.add("hidden");
        if (adminPanel) adminPanel.classList.remove("hidden");
        resolve(true);
      } else {
        // No es admin
        if (noAccessDiv) noAccessDiv.classList.remove("hidden");
        if (adminPanel) adminPanel.classList.add("hidden");
        resolve(false);
      }
    });
  });
}

function updateAuthUI() {
  const label = $("#userNameLabel");
  const logout = $("#btnLogout");
  const adminLink = $(".nav-admin-link");
  const mobileAdminLinks = $$(".mobile-admin-link");

  if (!currentUser) {
    if (label) label.textContent = "";
    if (logout) logout.classList.add("hidden");
    if (adminLink) adminLink.classList.add("hidden");
    mobileAdminLinks.forEach(link => link.classList.add("hidden"));
    return;
  }

  if (label) {
    label.textContent = `Hola, ${currentUserData?.nombre || currentUser.email || ""}`;
  }

  if (logout) logout.classList.remove("hidden");

  if (adminLink) {
    if (currentRole === "admin") {
      adminLink.classList.remove("hidden");
    } else {
      adminLink.classList.add("hidden");
    }
  }

  mobileAdminLinks.forEach(link => {
    if (currentRole === "admin") {
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }
  });
}

function setupAuthForms() {
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  // LOGIN
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginError").textContent = "";
    try {
      await signInWithEmailAndPassword(
        auth,
        $("#loginEmail").value.trim(),
        $("#loginPassword").value
      );
      window.location.href = "index.html";
    } catch {
      $("#loginError").textContent = "Credenciales incorrectas.";
    }
  });

  // REGISTRO
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#registerError").textContent = "";

    try {
      const email = $("#regEmail").value.trim();
      const pass = $("#regPassword").value;

      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      await setDoc(doc(db, "users", cred.user.uid), {
        nombre: $("#regName").value.trim(),
        instagram: $("#regIg").value.trim(),
        correo: email,
        creadoEn: new Date(),
      });

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

  // OBSERVER DE ESTADO DE SESIÓN
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    currentUserData = null;
    currentRole = "user";

    if (user) {
      await loadUserData(user);
    }

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

// ADMIN: CATEGORÍAS (LISTA + EDICIÓN)

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

    row.querySelector(".edit-cat").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      const nuevo = prompt("Nuevo nombre de categoría:", c.nombre);
      if (!nuevo) return;

      await updateDoc(doc(db, "categorias", c.id), {
        nombre: nuevo,
        slug: slugify(nuevo),
      });

      showToast("Categoría actualizada");
      menu.classList.add("hidden");
    });

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
// 6. VAPERS — LISTA PÚBLICA
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
    const img = p.imagenUrl || "https://via.placeholder.com/300x200?text=Vaper";

    card.innerHTML = `
      <div class="product-image">
        <img src="${img}">
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


// ======================================================
// 6b. LISTA ADMIN — VAPERS (CON SABORES)
// ======================================================

function renderAdminProductList() {
  const box = $("#adminVaperList");
  if (!box) return;

  box.innerHTML = "";

  currentProducts.forEach((p) => {
    const catName =
      currentCategories.find((c) => c.id === p.categoriaId)?.nombre || "";

    const sabores = Array.isArray(p.sabores) ? p.sabores : [];

    const item = document.createElement("div");
    item.className = "admin-vaper-block";

    item.innerHTML = `
      <div class="vaper-header">
        <div>
          <strong>${p.nombre}</strong>
          <div class="admin-vaper-meta">${catName}</div>
        </div>
        <span class="admin-badge-stock ${p.enStock ? "ok" : "off"}">
          ${p.enStock ? "En stock" : "Sin stock"}
        </span>
      </div>

      <div class="vaper-flavors">
        ${
          sabores.length
            ? sabores
                .map(
                  (s) => `
                  <div class="flavor-row">
                    <span>${s.nombre}</span>
                  </div>`
                )
                .join("")
            : "<em>Sin sabores aún</em>"
        }
      </div>

      <div class="admin-actions" style="margin-top:10px;">
        <button class="btn-small toggle-stock-btn">
          ${p.enStock ? "Marcar sin stock" : "Marcar en stock"}
        </button>
        <button class="btn-small edit-vaper-btn">Editar</button>
        <button class="btn-small delete-vaper-btn" style="background:#ff3b6a;color:white;">
          Eliminar
        </button>
      </div>
    `;

    item.querySelector(".toggle-stock-btn").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "vapers", p.id), { enStock: !p.enStock });
      showToast("Stock actualizado");
    });

    item.querySelector(".delete-vaper-btn").addEventListener("pointerdown", async (e) => {
      e.stopPropagation();
      await deleteDoc(doc(db, "vapers", p.id));
      showToast("Vaper eliminado");
    });

    item.querySelector(".edit-vaper-btn").addEventListener("pointerdown", () => {
      openEditVaperModal(p);
    });

    box.appendChild(item);
  });
}


// ======================================================
// 6c. CREAR NUEVO VAPER
// ======================================================

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
    const imagenUrl = $("#vaperImage").value.trim();

    if (!nombre || !categoriaId) return;

    await addDoc(collection(db, "vapers"), {
      nombre,
      categoriaId,
      imagenUrl: imagenUrl || "",
      sabores: [],
      enStock: true,
      creadoEn: new Date(),
    });

    e.target.reset();
    showToast("Vaper añadido");
  });
}


// ======================================================
// 6d. EDITOR DE VAPER (MODAL ADMIN)
// ======================================================

function addFlavorEditRow(container, flavor = { nombre: "", imagenUrl: "" }) {
  const row = document.createElement("div");
  row.className = "flavor-edit-row";
  row.dataset.currentUrl = flavor.imagenUrl || "";

  row.innerHTML = `
    <input type="text" class="flavor-name" placeholder="Nombre del sabor"
      value="${flavor.nombre || ""}">
    <input type="file" class="flavor-file" accept="image/*">
    ${
      flavor.imagenUrl
        ? `<button type="button" class="btn-small view-flavor">Ver</button>`
        : ""
    }
  `;

  const viewBtn = row.querySelector(".view-flavor");
  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      const url = row.dataset.currentUrl;
      if (url) window.open(url, "_blank");
    });
  }

  container.appendChild(row);
}

function openEditVaperModal(vaper) {
  editingVaper = vaper;

  $("#editVaperTitle").textContent = `Editar ${vaper.nombre}`;
  $("#editVaperName").value = vaper.nombre;
  $("#editVaperImg").value = vaper.imagenUrl || "";

  const selCat = $("#editVaperCategory");
  selCat.innerHTML = "";
  currentCategories.forEach((c) => {
    const op = document.createElement("option");
    op.value = c.id;
    op.textContent = c.nombre;
    if (c.id === vaper.categoriaId) op.selected = true;
    selCat.appendChild(op);
  });

  const cont = $("#editVaperFlavors");
  cont.innerHTML = "";

  const sabores = Array.isArray(vaper.sabores) ? vaper.sabores : [];
  if (sabores.length) {
    sabores.forEach((s) => addFlavorEditRow(cont, s));
  } else {
    addFlavorEditRow(cont);
  }

  $("#editVaperModal").classList.remove("hidden");
}

function closeEditVaperModal() {
  $("#editVaperModal").classList.add("hidden");
  editingVaper = null;
}

function setupEditVaperModal() {
  $("#editVaperClose")?.addEventListener("click", closeEditVaperModal);

  $("#editVaperModal")?.addEventListener("click", (e) => {
    if (e.target.id === "editVaperModal") closeEditVaperModal();
  });

  $("#addFlavorBtn")?.addEventListener("click", () => {
    addFlavorEditRow($("#editVaperFlavors"));
  });

  $("#saveVaperChanges")?.addEventListener("click", async () => {
    if (!editingVaper) return;

    const ref = doc(db, "vapers", editingVaper.id);

    const nombre = $("#editVaperName").value.trim();
    const categoriaId = $("#editVaperCategory").value;
    const imagenUrl = $("#editVaperImg").value.trim();

    const rows = Array.from(document.querySelectorAll(".flavor-edit-row"));

    const sabores = (
      await Promise.all(
        rows.map(async (row) => {
          const name = row.querySelector(".flavor-name").value.trim();
          if (!name) return null;

          const file = row.querySelector(".flavor-file").files[0];
          let url = row.dataset.currentUrl || "";

          if (file) {
            url = await uploadFlavorImage(file, editingVaper.id, name);
          }

          return { nombre: name, imagenUrl: url };
        })
      )
    ).filter(Boolean);

    await updateDoc(ref, {
      nombre,
      categoriaId,
      imagenUrl,
      sabores,
    });

    showToast("Vaper actualizado");
    closeEditVaperModal();
  });
}


// ======================================================
// 7. MODAL DE RESERVA (PÚBLICO)
// ======================================================

let modalVaper = null;

function openVaperModal(vaper) {
  modalVaper = vaper;

  $("#modalVaperImage").src =
    vaper.imagenUrl || "https://via.placeholder.com/300x200?text=Vaper";
  $("#modalVaperName").textContent = vaper.nombre;

  const cat = currentCategories.find((c) => c.id === vaper.categoriaId);
  $("#modalVaperCategory").textContent = cat ? cat.nombre : "";

  const sel = $("#modalFlavorSelect");
  sel.innerHTML = "";

  const sabores = Array.isArray(vaper.sabores) ? vaper.sabores : [];
  sabores.forEach((s) => {
    const nombre = s.nombre || s;
    const op = document.createElement("option");
    op.value = nombre;
    op.textContent = nombre;
    sel.appendChild(op);
  });

  $("#vaperModal").classList.remove("hidden");
}

function closeVaperModal() {
  $("#vaperModal").classList.add("hidden");
}

function setupModalReserva() {
  $("#modalCloseBtn")?.addEventListener("click", closeVaperModal);

  $("#vaperModal")?.addEventListener("click", (e) => {
    if (e.target.id === "vaperModal") closeVaperModal();
  });

  $("#btnReservar")?.addEventListener("click", async () => {
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
    const cartEl = $(".cart-count");
    if (cartEl) cartEl.textContent = reservasCount;

    fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelo: modalVaper.nombre,
        sabor,
        nombre: currentUserData?.nombre || "",
        instagram: currentUserData?.instagram || "",
      }),
    }).catch(() => {});

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
  setupModalReserva();
  setupEditVaperModal();
});


// ======================================================
// 9. MENÚ MÓVIL
// ======================================================

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobileMenu");

menuToggle?.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  mobileMenu.classList.toggle("hidden");
});

document.addEventListener("pointerdown", (e) => {
  if (
    mobileMenu &&
    !mobileMenu.classList.contains("hidden") &&
    !mobileMenu.contains(e.target) &&
    !menuToggle.contains(e.target)
  ) {
    mobileMenu.classList.add("hidden");
  }
});
