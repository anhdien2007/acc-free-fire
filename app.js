// ---------------- Firebase imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

/** ✅ KEEP your firebaseConfig */
const firebaseConfig = {
  apiKey: "AIzaSyAQi6Sc0q-fIjc4YlU8S8oIrbiWwWQOTfQ",
  authDomain: "frree-fire-account.firebaseapp.com",
  projectId: "frree-fire-account",
  storageBucket: "frree-fire-account.firebasestorage.app",
  messagingSenderId: "114631923260",
  appId: "1:114631923260:web:a2e67ec00a1104ab059539",
  measurementId: "G-92GKSTZDBM"
};
async function setStatusQuick(id, newStatus, clickedBtn) {
  // Slide the row/card first (nice feedback)
  const container = clickedBtn?.closest("tr") || clickedBtn?.closest(".cardItem");
  slideOut(container);

  // Sound type
  if (newStatus === "Sold") playUiSound("sold");
  else if (newStatus === "Installment") playUiSound("money");
  else playUiSound("ok");

  // Wait a tiny bit so slide animation is visible
  await new Promise(r => setTimeout(r, 120));

  try {
    await setDoc(
      doc(db, COL, id),
      { status: newStatus, updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Glow animation on the clicked button (if you added .success before)
    const btn = document.querySelector(`button[data-id="${id}"][data-status="${newStatus}"]`);
    if (btn) {
      btn.classList.add("success");
      setTimeout(() => btn.classList.remove("success"), 600);
    }

    showMsg(`✅ ${id}: set to ${newStatus}`);
  } catch (e) {
    console.error(e);
    alert(e?.code || e?.message || "Update status failed");
  }
}


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const COL = "inventory";

// ---------------- Helpers ----------------
const $ = (id) => document.getElementById(id);
const val = (id) => String($(id)?.value ?? "").trim();
const setVal = (id, v) => { const el = $(id); if (el) el.value = (v ?? ""); };
const showMsg = (t) => { const el = $("msg"); if (el) el.textContent = t || ""; };

function normalize(s) {
  return String(s ?? "").trim().toLowerCase();
}

function computeRemaining(price, deposit) {
  price = Number(price || 0);
  deposit = Number(deposit || 0);
  return Math.max(0, price - deposit);
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function todayStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysLeft(due) {
  if (!due) return "";
  const now = new Date();
  const end = new Date(due + "T00:00:00");
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function isOverdue(item) {
  return item.status === "Installment" && item.installmentDue && item.installmentDue < todayStr();
}

function makeId() {
  return "ACC-" + Math.random().toString(16).slice(2, 10).toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}
// ===== Sound (no external file needed) =====
let __audioCtx = null;

function playUiSound(type = "ok") {
  try {
    if (!__audioCtx) __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = __audioCtx;

    // Some browsers require user interaction before audio works (your click is interaction ✅)
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    // Choose tone by action
    const freq =
      type === "sold" ? 260 :
      type === "money" ? 520 :
      420;

    o.type = "triangle";
    o.frequency.value = freq;

    // Soft volume envelope
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(now);
    o.stop(now + 0.13);
  } catch (e) {
    // If audio fails, just ignore (no crash)
  }
}

// ===== Small helper for slide-out animation =====
function slideOut(el) {
  if (!el) return;
  el.classList.add("item-slide-out");
  setTimeout(() => el.classList.remove("item-slide-out"), 220);
}

// ---------------- UI live calc ----------------
$("price")?.addEventListener("input", () => {
  setVal("remaining", String(computeRemaining(val("price"), val("depositPaid"))));
});
$("depositPaid")?.addEventListener("input", () => {
  setVal("remaining", String(computeRemaining(val("price"), val("depositPaid"))));
});

// Preview image
$("imageFile")?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) { $("preview").src = ""; return; }
  $("preview").src = await readAsDataURL(f);
});

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ---------------- Auth ----------------
$("btnLogin")?.addEventListener("click", async () => {
  $("loginMsg").textContent = "Logging in...";
  const email = val("loginEmail");
  const pass = $("loginPass").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    $("loginMsg").textContent = "";
  } catch (e) {
    console.error(e);
    $("loginMsg").textContent = e?.code || e?.message || "Login failed";
  }
});

$("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
});

// ---------------- Realtime ----------------
let ALL = [];
let unsub = null;

function bindRealtime() {
  const q = query(collection(db, COL), orderBy("updatedAt", "desc"));
  unsub = onSnapshot(q, (snap) => {
    ALL = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
}

function unbindRealtime() {
  if (unsub) { unsub(); unsub = null; }
}

// ---------------- Storage upload ----------------
async function uploadImageIfAny(itemId) {
  const f = $("imageFile")?.files?.[0];
  if (!f) return null;

  if (f.size > 5 * 1024 * 1024) throw new Error("Ảnh > 5MB. Chọn ảnh nhỏ hơn.");

  const safeName = f.name.replace(/[^\w.\-]+/g, "_");
  const path = `images/${itemId}/${Date.now()}_${safeName}`;
  const r = ref(storage, path);

  await uploadBytes(r, f, { contentType: f.type });
  const url = await getDownloadURL(r);
  return { imageUrl: url, imagePath: path };
}

// ---------------- CRUD ----------------
async function saveItem() {
  const btn = $("btnSave");
  try {
    btn.disabled = true;
    showMsg("Saving...");

    const id = val("id") || makeId();

    const price = Number(val("price") || 0);
    const depositPaid = Number(val("depositPaid") || 0);
    const remaining = computeRemaining(price, depositPaid);

    const img = await uploadImageIfAny(id);
    const refDoc = doc(db, COL, id);

    // Keep old image if not uploading a new one
    const existing = ALL.find(x => x.id === id);
    const finalImageUrl = img?.imageUrl ?? existing?.imageUrl ?? null;
    const finalImagePath = img?.imagePath ?? existing?.imagePath ?? null;

    // Save fields (IMPORTANT: add customerName + note so search works)
    await setDoc(refDoc, {
      price,
      depositPaid,
      remaining,
      customerName: val("customerName"),
      emailAcc: val("emailAcc"),
      emailParent: val("emailParent"),
      status: $("status")?.value || "Available",
      installmentDue: val("installmentDue"),
      note: val("note"),
      imageUrl: finalImageUrl,
      imagePath: finalImagePath,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    showMsg("✅ Saved!");
    clearForm();
  } catch (e) {
    console.error(e);
    const msg = e?.code || e?.message || "unknown";
    showMsg("❌ Save lỗi: " + msg);
    alert("Save lỗi: " + msg);
  } finally {
    btn.disabled = false;
  }
}

async function deleteById() {
  const id = val("id");
  if (!id) return alert("Nhập ID để xoá");
  if (!confirm("Xoá " + id + " ?")) return;

  try {
    const it = ALL.find(x => x.id === id);
    if (it?.imagePath) {
      try { await deleteObject(ref(storage, it.imagePath)); } catch (e) {}
    }
    await deleteDoc(doc(db, COL, id));
    showMsg("🗑️ Deleted!");
    clearForm();
  } catch (e) {
    console.error(e);
    alert(e?.code || e?.message || "Delete failed");
  }
}

function clearForm() {
  ["id", "price", "depositPaid", "remaining", "customerName", "emailAcc", "emailParent", "installmentDue", "note"]
    .forEach(k => setVal(k, ""));
  if ($("status")) $("status").value = "Available";
  if ($("imageFile")) $("imageFile").value = "";
  if ($("preview")) $("preview").src = "";
}

$("btnSave")?.addEventListener("click", saveItem);
$("btnClear")?.addEventListener("click", clearForm);
$("btnDelete")?.addEventListener("click", deleteById);

// Search + Filter listeners (ONLY ONCE)
$("search")?.addEventListener("input", render);
$("statusFilter")?.addEventListener("change", render);

// ---------------- Render ----------------
function getFilteredData() {
  const q = normalize($("search")?.value || "");
  const filter = ($("statusFilter")?.value || "ALL").trim();

  let data = [...ALL];

  // Filter by status
  if (filter !== "ALL") {
    // compare exact (your UI uses "Available", "Reserved", etc.)
    data = data.filter(x => String(x.status || "") === filter);
  }

  // Search across fields (ID / customer / email / parent / note)
  if (q) {
    data = data.filter(x => {
      const hay = normalize([
        x.id,
        x.customerName,
        x.emailAcc,
        x.emailParent,
        x.note
      ].filter(Boolean).join(" "));
      return hay.includes(q);
    });
  }

  return data;
}

function render() {
  // stats always from ALL (not filtered)
  $("statTotal").textContent = ALL.length;
  $("statAvail").textContent = ALL.filter(x => x.status === "Available").length;
  $("statInst").textContent = ALL.filter(x => x.status === "Installment").length;
  $("statOverdue").textContent = ALL.filter(x => isOverdue(x)).length;

  const data = getFilteredData();

  // ----- Desktop table -----
  const tb = $("tbody");
  if (tb) {
    tb.innerHTML = "";
    data.forEach(item => {
      const tr = document.createElement("tr");
      if (isOverdue(item)) tr.classList.add("overdue");

      const d = daysLeft(item.installmentDue);
      const dText = (d === "" ? "" : (d < 0 ? `Quá ${Math.abs(d)}d` : `${d}d`));


      tr.innerHTML = `
        <td><b>${escapeHtml(item.id)}</b></td>
        <td>${formatMoney(item.price ?? 0)}</td>
        <td>${formatMoney(item.depositPaid ?? 0)}</td>
        <td>${formatMoney(item.remaining ?? 0)}</td>
        <td>${escapeHtml(item.emailAcc || "")}</td>
        <td>${escapeHtml(item.emailParent || "")}</td>
<td>
  <div style="display:flex;gap:6px;align-items:center">
    <td>
  <div style="display:flex;gap:6px;align-items:center">
    <span class="badge">${escapeHtml(item.status || "Available")}</span>

    <button class="icon-btn"
      title="Set Available"
      data-action="setStatus"
      data-status="Available"
      data-id="${item.id}">✅</button>

    <button class="icon-btn"
      title="Set Installment"
      data-action="setStatus"
      data-status="Installment"
      data-id="${item.id}">💰</button>

    <button class="icon-btn sold"
      title="Mark Sold"
      data-action="setStatus"
      data-status="Sold"
      data-id="${item.id}">❌</button>
  </div>
</td>


        <td>${escapeHtml(item.installmentDue || "")}</td>
        <td>${escapeHtml(dText)}</td>
        <td><button data-action="edit" data-id="${item.id}">Edit</button></td>
      `;
      tb.appendChild(tr);
    });
// Desktop table click handling (one listener)
$("tbody").onclick = (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.action === "setStatus") {
    setStatusQuick(btn.dataset.id, btn.dataset.status, btn);
  }
};


  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "setStatus") {
    setStatusQuick(id, btn.dataset.status);
  }

  if (action === "cycleStatus") {
    const it = ALL.find(x => x.id === id);
    const flow = ["Available", "Reserved", "Installment", "Sold"];
    const cur = it?.status || "Available";
    const next = flow[(flow.indexOf(cur) + 1) % flow.length];
    setStatusQuick(id, next);
  }

  if (action === "edit") {
    loadToForm(id); // your existing edit loader
  }
};

    tb.querySelectorAll("button[data-action='edit']").forEach(btn => {
      btn.addEventListener("click", () => loadToForm(btn.dataset.id));
    });
  }

  // ----- Mobile cards -----
  const cards = $("cards");
  if (cards) {
    cards.innerHTML = "";
    data.forEach(item => {
      const d = daysLeft(item.installmentDue);
      const dText = (d === "" ? "" : (d < 0 ? `Overdue ${Math.abs(d)}d` : `${d}d left`));
      const badgeClass = (d !== "" && d < 0) ? "danger" : "ok";

      const div = document.createElement("div");
      div.className = "cardItem";
      if (isOverdue(item)) div.style.borderColor = "rgba(255,59,92,.35)";

      div.innerHTML = `

        <div class="cardMeta">
          <span class="badge">Price: ${escapeHtml(item.price ?? 0)}</span>
          <span class="badge">Paid: ${escapeHtml(item.depositPaid ?? 0)}</span>
          <span class="badge">Remain: ${escapeHtml(item.remaining ?? 0)}</span>
        </div>

        <div class="cardLine">
          <div style="width:100%">
            <div class="muted">Customer</div>
            <div>${escapeHtml(item.customerName || "-")}</div>
          </div>
        </div>

        <div class="cardLine">
          <div style="width:100%">
            <div class="muted">Email acc</div>
            <div style="word-break:break-all">${escapeHtml(item.emailAcc || "-")}</div>
          </div>
        </div>

        <div class="cardLine">
          <div style="width:100%">
            <div class="muted">Note</div>
            <div style="word-break:break-word">${escapeHtml(item.note || "-")}</div>
          </div>
        </div>
      `;

      cards.appendChild(div);
    });

    cards.querySelectorAll("button[data-action='edit']").forEach(btn => {
      btn.addEventListener("click", () => loadToForm(btn.dataset.id));
    });
  }

function loadToForm(id) {
  const it = ALL.find(x => x.id === id);
  if (!it) return;

  setVal("id", it.id);
  setVal("price", it.price ?? 0);
  setVal("depositPaid", it.depositPaid ?? 0);
  setVal("remaining", it.remaining ?? 0);
  setVal("customerName", it.customerName || "");
  setVal("emailAcc", it.emailAcc || "");
  setVal("emailParent", it.emailParent || "");
  if ($("status")) $("status").value = it.status || "Available";
  setVal("installmentDue", it.installmentDue || "");
  setVal("note", it.note || "");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------- Auth gate ----------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    $("loginCard")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");
    bindRealtime();
  } else {
    unbindRealtime();
    $("app")?.classList.add("hidden");
    $("loginCard")?.classList.remove("hidden");
  }
});
