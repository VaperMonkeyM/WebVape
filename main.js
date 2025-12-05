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
let editingVaper = null;

// ======== CARRITO ========
let cart = [];

function loadCart() {
  const stored = localStorage.getItem("cart");
  cart = stored ? JSON.parse(stored) : [];
  updateCartUI();
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  
  // Si hay usuario logueado, guardar en Firestore
  if (currentUser) {
    const ref = doc(db, "users", currentUser.uid);
    updateDoc(ref, { cart: cart }).catch((err) => {
      console.log("Error guardando carrito en Firebase:", err);
    });
  }
  
  updateCartUI();
}

async function loadCartFromFirebase(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().cart) {
      cart = snap.data().cart;
      localStorage.setItem("cart", JSON.stringify(cart));
      updateCartUI();
    }
  } catch (err) {
    console.log("Error cargando carrito de Firebase:", err);
  }
}

function addToCart(vaper, flavorName) {
  const item = {
    id: vaper.id,
    modelo: vaper.nombre,
    sabor: flavorName,
    pickup: null,
    timestamp: new Date().toISOString(),
  };
  cart.push(item);
  saveCart();
  showToast("Añadido al carrito");
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  showToast("Removido del carrito");
}

function updateCartUI() {
  const countEl = document.querySelector(".cart-count");
  if (countEl) countEl.textContent = cart.length;
}

function renderCart() {
  const container = $("#cartContainer");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <p style="font-size: 18px; color: var(--text-soft);">Tu carrito está vacío</p>
        <a href="index.html#vapers" class="btn-primary" style="display: inline-block; margin-top: 20px;">
          Volver a vapers
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="cart-items">
      ${cart.map((item, idx) => `
        <div class="cart-item">
          <div>
            <strong>${item.modelo}</strong>
            <p style="margin: 4px 0; color: var(--text-soft);">Sabor: ${item.sabor}</p>
            <p style="margin: 6px 0; color: var(--text-soft); font-size: 13px;">Horario: ${item.pickup ? formatPickupDisplay(item.pickup) : 'No indicado'}</p>
          </div>
          <button class="btn-small remove-item" data-idx="${idx}" style="background: #ff3b6a; color: white;">
            Eliminar
          </button>
        </div>
      `).join("")}
    </div>
    
    <div style="margin-top: 30px; text-align: center;">
      <button id="checkoutBtn" class="btn-primary full">
        Completar pedido
      </button>
    </div>
  `;

  container.querySelectorAll(".remove-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx);
      removeFromCart(idx);
      renderCart();
    });
  });
  
}

// =========================================

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

function formatDateTimeLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function formatPickupDisplay(iso) {
  if (!iso) return "No indicado";
  // iso may be like 'YYYY-MM-DDTHH:MM' or full ISO; create Date
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Invalid";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mins}`;
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

  // Cargar carrito desde Firebase
  await loadCartFromFirebase(uid);

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
  const authLinks = $$(".nav-auth-link");
  const mobileAuthLinks = $$(".mobile-auth-link");
  const authActionBtns = $$(".auth-action-btn");

  if (!currentUser) {
    if (label) label.textContent = "";
    if (logout) logout.classList.add("hidden");
    if (adminLink) adminLink.classList.add("hidden");
    mobileAdminLinks.forEach(link => link.classList.add("hidden"));
    authLinks.forEach(link => link.classList.remove("hidden"));
    mobileAuthLinks.forEach(link => link.classList.remove("hidden"));
    authActionBtns.forEach(btn => btn.classList.remove("hidden"));
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

  // Ocultar links de auth si está logueado
  authLinks.forEach(link => link.classList.add("hidden"));
  mobileAuthLinks.forEach(link => link.classList.add("hidden"));
  
  // Ocultar botones de acción de auth (Crear cuenta)
  authActionBtns.forEach(btn => btn.classList.add("hidden"));
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

  // Filtrar solo productos con stock
  list = list.filter((p) => p.enStock);

  list.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const catObj = currentCategories.find((c) => c.id === p.categoriaId);
    const catName = catObj ? catObj.nombre : "—";
    const img = p.imagenUrl || "https://via.placeholder.com/300x200?text=Vaper";

    card.innerHTML = `
      <div class="product-image">
        <img src="${img}">
      </div>

      <div class="product-body">
        <h3>${p.nombre}</h3>
        <p class="product-category">${catName}</p>

        <div class="product-info">
          <span class="product-status in-stock">
            En stock
          </span>

          <button class="btn-tertiary btn-reservar">
            Reservar
          </button>
        </div>
      </div>
    `;

    card.querySelector(".btn-reservar").onclick = () => openVaperModal(p);
    grid.appendChild(card);
  });

  // Si el modal está abierto, verificar si el producto aún existe
  if (modalVaper && !$("#vaperModal").classList.contains("hidden")) {
    const vaperAunExiste = currentProducts.find(p => p.id === modalVaper.id && p.enStock);
    if (!vaperAunExiste) {
      closeVaperModal();
      showToast("Producto sin stock");
    }
  }
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
                  (s, idx) => `
                  <div class="flavor-row" data-flavor-idx="${idx}">
                    <span>${s.nombre}</span>
                    <button class="btn-small flavor-stock-btn" style="font-size: 11px; padding: 4px 8px;">
                      ${s.enStock !== false ? "✓ Stock" : "✗ No stock"}
                    </button>
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
      renderProducts();
    });

    // Botones de stock por sabor
    const flavorBtns = item.querySelectorAll(".flavor-stock-btn");
    flavorBtns.forEach((btn, idx) => {
      btn.addEventListener("pointerdown", async (e) => {
        e.stopPropagation();
        const nuevosSabores = [...sabores];
        nuevosSabores[idx].enStock = nuevosSabores[idx].enStock !== false ? false : true;
        await updateDoc(doc(db, "vapers", p.id), { sabores: nuevosSabores });
        showToast("Stock del sabor actualizado");
        renderProducts();
      });
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

  row.innerHTML = `
    <input type="text" class="flavor-name" placeholder="Nombre del sabor"
      value="${flavor.nombre || ""}">
    <input type="text" class="flavor-url" placeholder="URL de imagen del sabor (opcional)"
      value="${flavor.imagenUrl || ""}">
  `;

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

    const sabores = rows
      .map((row) => {
        const name = row.querySelector(".flavor-name").value.trim();
        const url = row.querySelector(".flavor-url").value.trim();
        if (!name) return null;
        return { nombre: name, imagenUrl: url || "" };
      })
      .filter(Boolean);

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
  
  // Filtrar solo sabores con stock
  const saboresEnStock = sabores.filter((s) => s.enStock !== false);
  
  // Si no hay sabores en stock, cerrar modal
  if (saboresEnStock.length === 0) {
    closeVaperModal();
    showToast("Este producto no tiene sabores disponibles");
    return;
  }
  
  saboresEnStock.forEach((s) => {
    const nombre = s.nombre || s;
    const op = document.createElement("option");
    op.value = nombre;
    op.textContent = nombre;
    // attach image URL to option for preview
    if (s.imagenUrl) op.dataset.img = s.imagenUrl;
    sel.appendChild(op);
  });

  const flavorImgEl = $("#modalFlavorImage");
  // helper to update flavor image based on selected option
  function updateFlavorImage() {
    const chosen = sel.options[sel.selectedIndex];
    const vaperImg = $("#modalVaperImage");
    
    if (chosen && chosen.dataset.img) {
      // Flavor has image: hide vaper image, show flavor image
      flavorImgEl.src = chosen.dataset.img;
      flavorImgEl.classList.remove('hidden');
      vaperImg.classList.add('hidden');
    } else {
      // No flavor image: hide flavor image, show vaper image
      flavorImgEl.src = '';
      flavorImgEl.classList.add('hidden');
      vaperImg.classList.remove('hidden');
    }
  }

  // initial set (select first)
  sel.selectedIndex = 0;
  updateFlavorImage();

  sel.addEventListener('change', updateFlavorImage);

  // clear previous errors
  const modalErr = $("#modalError");
  if (modalErr) modalErr.textContent = "";

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

    // Validar que el producto aún esté en stock
    const vaperActual = currentProducts.find(p => p.id === modalVaper.id);
    if (!vaperActual || !vaperActual.enStock) {
      $("#modalError").textContent = "Este producto ya no está disponible.";
      closeVaperModal();
      showToast("Producto sin stock");
      return;
    }

    const sabor = $("#modalFlavorSelect").value;
    if (!sabor) {
      $("#modalError").textContent = "Elige un sabor.";
      return;
    }

    // Validar que el sabor seleccionado aún esté en stock
    const saborObj = vaperActual.sabores?.find(s => s.nombre === sabor);
    if (!saborObj || saborObj.enStock === false) {
      $("#modalError").textContent = "Este sabor ya no está disponible.";
      closeVaperModal();
      showToast("Sabor sin stock");
      return;
    }

    // Añadir al carrito (fecha/hora se pedirá en el checkout)
    addToCart(modalVaper, sabor);
    closeVaperModal();
  });
}


// ======================================================
// 8. CARRITO - CHECKOUT
// ======================================================

function setupCheckout() {
  const checkoutBtn = $("#checkoutBtn");
  if (!checkoutBtn) return;

  const checkoutModal = $("#checkoutModal");
  const checkoutInput = $("#checkoutPickupDatetime");
  const checkoutError = $("#checkoutError");
  const confirmBtn = $("#confirmCheckoutBtn");
  const cancelBtn = $("#cancelCheckoutBtn");
  const closeBtn = $("#checkoutCloseBtn");

  function openCheckoutModal() {
    if (!checkoutModal) return;
    // preset min and default
    const now = new Date();
    const defaultDt = new Date(now.getTime() + 60 * 60 * 1000);
    if (checkoutInput) {
      checkoutInput.min = formatDateTimeLocal(new Date());
      checkoutInput.value = formatDateTimeLocal(defaultDt);
    }
    if (checkoutError) checkoutError.textContent = "";
    checkoutModal.classList.remove('hidden');
  }

  function closeCheckoutModal() {
    if (!checkoutModal) return;
    checkoutModal.classList.add('hidden');
  }

  checkoutBtn.addEventListener('click', () => {
    if (!currentUser) {
      showToast('Debes iniciar sesión');
      return;
    }
    if (cart.length === 0) {
      showToast('El carrito está vacío');
      return;
    }
    openCheckoutModal();
  });

  cancelBtn?.addEventListener('click', () => closeCheckoutModal());
  closeBtn?.addEventListener('click', () => closeCheckoutModal());

  confirmBtn?.addEventListener('click', async () => {
    if (!checkoutInput) return;
    const val = checkoutInput.value;
    if (!val) {
      if (checkoutError) checkoutError.textContent = 'Indica fecha y hora para recogida';
      return;
    }
    const d = new Date(val);
    if (isNaN(d.getTime()) || d.getTime() < Date.now() + 5 * 60 * 1000) {
      if (checkoutError) checkoutError.textContent = 'Selecciona una fecha/hora futura (mínimo +5 minutos).';
      return;
    }

    // assign pickup to all items
    cart = cart.map(it => ({ ...it, pickup: val }));
    saveCart();

    // send email with items
    try {
      await fetch('/api/sendEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({ modelo: item.modelo, sabor: item.sabor, pickup: item.pickup })),
          nombre: currentUserData?.nombre || '',
          instagram: currentUserData?.instagram || '',
          email: currentUser?.email || '',
          hora: new Date().toLocaleString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        })
      });

      // clear cart
      cart = [];
      if (currentUser) {
        const ref = doc(db, 'users', currentUser.uid);
        await updateDoc(ref, { cart: [] }).catch(() => {});
      }
      saveCart();
      closeCheckoutModal();
      showToast('Pedido completado. ¡Gracias!');
      setTimeout(() => window.location.href = 'index.html', 1500);
    } catch (err) {
      console.error('Error al enviar pedido:', err);
      if (checkoutError) checkoutError.textContent = 'Error al enviar pedido';
    }
  });
}


// ======================================================
// 9. INICIALIZACIÓN
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  loadCart();
  setupAuthForms();
  setupCategories();
  setupVapers();
  setupModalReserva();
  setupEditVaperModal();
  
  // Si estamos en cart.html, renderizar carrito y setup checkout
  if (document.body.id === "cartPage" || window.location.pathname.includes("cart.html")) {
    renderCart();
    setupCheckout();
  }

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
