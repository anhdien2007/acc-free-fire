
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

/** ✅ DÁN firebaseConfig WEB (</>) CỦA BẠN Ở ĐÂY */
const firebaseConfig = {
  apiKey: "AIzaSyAQi6Sc0q-fIjc4YlU8S8oIrbiWwWQOTfQ",
  authDomain: "frree-fire-account.firebaseapp.com",
  projectId: "frree-fire-account",
  storageBucket: "frree-fire-account.firebasestorage.app",
  messagingSenderId: "114631923260",
  appId: "1:114631923260:web:a2e67ec00a1104ab059539",
  measurementId: "G-92GKSTZDBM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const COL = "inventory"; // collection name

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();
const setVal = (id, v) => $(id).value = (v ?? "");
const showMsg = (t) => { $("msg").textContent = t || ""; };

function computeRemaining(price, deposit){
  price = Number(price || 0);
  deposit = Number(deposit || 0);
  return Math.max(0, price - deposit);
}
function formatMoney(n){
  return Number(n || 0).toLocaleString("en-US");
}
function todayStr(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function daysLeft(due){
  if(!due) return "";
  const now = new Date();
  const end = new Date(due + "T00:00:00");
  return Math.ceil((end - now) / (1000*60*60*24));
}
function isOverdue(item){
  return item.status === "Installment" && item.installmentDue && item.installmentDue < todayStr();
}
const STATUS_FLOW = ["Available","Reserved","Installment","Sold"];

function nextStatus(cur){
  const i = STATUS_FLOW.indexOf(cur);
  return STATUS_FLOW[(i + 1) % STATUS_FLOW.length];
}

function statusBadgeClass(s){
  if(s === "Sold") return "danger";
  if(s === "Installment") return "ok";
  return "";
}

async function cycleStatus(id){
  const it = ALL.find(x=>x.id === id);
  if(!it) return;
  const ns = nextStatus(it.status || "Available");
  await autoSave(id, "status", ns);
}

function makeId(){
  return "ACC-" + Math.random().toString(16).slice(2,10).toUpperCase();
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ---------- UI live calc ----------
$("price").addEventListener("input", () => setVal("remaining", String(computeRemaining(val("price"), val("depositPaid")))));
$("depositPaid").addEventListener("input", () => setVal("remaining", String(computeRemaining(val("price"), val("depositPaid")))));

$("imageFile").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f){ $("preview").src=""; return; }
  $("preview").src = await readAsDataURL(f);
});
function readAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ---------- Auth ----------
$("btnLogin").addEventListener("click", async ()=>{
  $("loginMsg").textContent = "Logging in...";
  const email = val("loginEmail");
  const pass = $("loginPass").value;
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    $("loginMsg").textContent = "";
  }catch(e){
    console.error(e);
    $("loginMsg").textContent = e?.code || e?.message || "Login failed";
  }
});

$("btnLogout").addEventListener("click", async ()=>{
  await signOut(auth);
});

// ---------- Realtime ----------
let ALL = [];
let unsub = null;

function bindRealtime(){
  const q = query(collection(db, COL), orderBy("updatedAt", "desc"));
  unsub = onSnapshot(q, (snap)=>{
    ALL = snap.docs.map(d=>({ id: d.id, ...d.data() }));
    render();
  });
}
function unbindRealtime(){
  if(unsub){ unsub(); unsub = null; }
}

// ---------- Storage upload ----------
async function uploadImageIfAny(itemId){
  const f = $("imageFile").files?.[0];
  if(!f) return null;

  // (optional) limit size 5MB
  if (f.size > 5 * 1024 * 1024) throw new Error("Ảnh > 5MB. Chọn ảnh nhỏ hơn.");

  const safeName = f.name.replace(/[^\w.\-]+/g, "_");
  const path = `images/${itemId}/${Date.now()}_${safeName}`;
  const r = ref(storage, path);
  await uploadBytes(r, f, { contentType: f.type });
  const url = await getDownloadURL(r);
  return { imageUrl: url, imagePath: path };
}

// ---------- CRUD ----------
async function saveItem(){
  const btn = $("btnSave");
  try{
    btn.disabled = true;
    showMsg("Saving...");

    const id = val("id") || makeId();

    const price = Number(val("price") || 0);
    const depositPaid = Number(val("depositPaid") || 0);
    const remaining = computeRemaining(price, depositPaid);

    // upload image if selected
    const img = await uploadImageIfAny(id);

    const refDoc = doc(db, COL, id);

    await setDoc(refDoc, { createdAt: serverTimestamp() }, { merge: true });

const existing = ALL.find(x => x.id === id);
const finalImageUrl  = img?.imageUrl  ?? existing?.imageUrl  ?? null;
const finalImagePath = img?.imagePath ?? existing?.imagePath ?? null;

await setDoc(refDoc, {
  price,
  depositPaid,
  remaining,
  emailAcc: val("emailAcc"),
  emailParent: val("emailParent"),
  status: $("status").value,
  installmentDue: val("installmentDue"),
  imageUrl: finalImageUrl,
  imagePath: finalImagePath,
  updatedAt: serverTimestamp(),
}, { merge: true });

    showMsg("✅ Saved!");
    clearForm();

  }catch(e){
    console.error(e);
    const msg = e?.code || e?.message || "unknown";
    showMsg("❌ Save lỗi: " + msg);
    alert("Save lỗi: " + msg);
  }finally{
    btn.disabled = false;
  }
}

async function deleteById(){
  const id = val("id");
  if(!id) return alert("Nhập ID để xoá");
  if(!confirm("Xoá " + id + " ?")) return;

  try{
    const it = ALL.find(x=>x.id === id);
    if(it?.imagePath){
      try{ await deleteObject(ref(storage, it.imagePath)); }catch(e){}
    }
    await deleteDoc(doc(db, COL, id));
    showMsg("🗑️ Deleted!");
    clearForm();
  }catch(e){
    console.error(e);
    alert(e?.code || e?.message || "Delete failed");
  }
}

function clearForm(){
  ["id","price","depositPaid","remaining","emailAcc","emailParent","installmentDue"].forEach(k=>setVal(k,""));
  $("status").value = "Available";
  $("imageFile").value = "";
  $("preview").src = "";
}

$("btnSave").addEventListener("click", saveItem);
$("btnClear").addEventListener("click", clearForm);
$("btnDelete").addEventListener("click", deleteById);

// ---------- Render ----------
$("statusFilter").addEventListener("change", render);
$("search").addEventListener("input", render);

function render(){
  // stats
document.getElementById("statTotal").textContent = ALL.length;
document.getElementById("statAvail").textContent = ALL.filter(x=>x.status==="Available").length;
document.getElementById("statInst").textContent = ALL.filter(x=>x.status==="Installment").length;
document.getElementById("statOverdue").textContent = ALL.filter(x=>isOverdue(x)).length;
  // filter + search
  const filter = $("statusFilter").value;
  const s = $("search").value.trim().toLowerCase();

  let data = (filter === "ALL") ? ALL : ALL.filter(x=>x.status===filter);

  if(s){
    data = data.filter(x =>
      (x.id||"").toLowerCase().includes(s) ||
      (x.emailAcc||"").toLowerCase().includes(s) ||
      (x.emailParent||"").toLowerCase().includes(s)
    );
    // mobile cards
const cards = document.getElementById("cards");
if(cards){
  cards.innerHTML = "";
  data.forEach(item=>{
    const d = daysLeft(item.installmentDue);
    const dText = (d === "" ? "" : (d < 0 ? `Overdue ${Math.abs(d)}d` : `${d}d left`));
    const badgeClass = (d !== "" && d < 0) ? "danger" : "ok";
    const img = item.imageUrl ? `<img class="thumb" src="${item.imageUrl}">` : `<div class="thumb"></div>`;

    const div = document.createElement("div");
    div.className = "cardItem";
    if(isOverdue(item)) div.style.borderColor = "rgba(255,59,92,.35)";

    div.innerHTML = `
      <div class="cardTop">
        ${img}
        <div style="flex:1">
          <div style="font-weight:900">${escapeHtml(item.id)}</div>
          <div class="muted">${escapeHtml(item.status || "")}</div>
          ${dText ? `<div class="badge ${badgeClass}" style="margin-top:6px">${escapeHtml(dText)}</div>` : ``}
        </div>
        <button class="btn" data-action="edit" data-id="${item.id}">Edit</button>
      </div>

      <div class="cardMeta">
        <span class="badge">Price: ${escapeHtml(item.price ?? 0)}</span>
        <span class="badge">Paid: ${escapeHtml(item.depositPaid ?? 0)}</span>
        <span class="badge">Remain: ${escapeHtml(item.remaining ?? 0)}</span>
      </div>

      <div class="cardLine">
        <div>
          <div class="muted">Customer</div>
          <div>${escapeHtml(item.customerName || "-")}</div>
        </div>
        <div style="text-align:right">
          <div class="muted">Phone</div>
          <div>${escapeHtml(item.customerPhone || "-")}</div>
        </div>
      </div>

      <div class="cardLine">
        <div>
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
}
    return;
  }

  const tb = $("tbody");
  tb.innerHTML = "";

  data.forEach(item=>{
    const tr = document.createElement("tr");
    if(isOverdue(item)) tr.classList.add("overdue");

    const d = daysLeft(item.installmentDue);
    const dText = (d === "" ? "" : (d < 0 ? `Quá ${Math.abs(d)}d` : `${d}d`));

    const img = item.imageUrl
      ? `<img class="thumb" src="${item.imageUrl}">`
      : `<div class="thumb"></div>`;

    tr.innerHTML = `
      <td>${img}</td>
      <td><b>${escapeHtml(item.id)}</b></td>
      <td>${formatMoney(item.price ?? 0)}</td>
      <td>${formatMoney(item.depositPaid ?? 0)}</td>
      <td>${formatMoney(item.remaining ?? 0)}</td>
      <td>${escapeHtml(item.emailAcc || "")}</td>
      <td>${escapeHtml(item.emailParent || "")}</td>
      <td>
  <div style="display:flex;gap:8px;align-items:center">
    <select data-id="${item.id}" data-field="status">
      ${["Available","Reserved","Installment","Sold"].map(st=>`<option ${item.status===st?"selected":""}>${st}</option>`).join("")}
    </select>
  </div>
</td>

      <td>${escapeHtml(item.installmentDue || "")}</td>
      <td>${escapeHtml(dText)}</td>
      <td><button data-action="edit" data-id="${item.id}">Edit</button></td>
    `;
    tb.appendChild(tr);
  });

  // Edit button -> load into form
  tb.querySelectorAll("button[data-action='edit']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      const it = ALL.find(x=>x.id===id);
      if(!it) return;

      setVal("id", it.id);
      setVal("price", it.price ?? 0);
      setVal("depositPaid", it.depositPaid ?? 0);
      setVal("remaining", it.remaining ?? 0);
      setVal("emailAcc", it.emailAcc || "");
      setVal("emailParent", it.emailParent || "");
      $("status").value = it.status || "Available";
      setVal("installmentDue", it.installmentDue || "");
      $("preview").src = it.imageUrl || "";
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });
}

// ---------- Auth gate ----------
onAuthStateChanged(auth, (user)=>{
  if(user){
    $("loginCard").classList.add("hidden");
    $("app").classList.remove("hidden");
    bindRealtime();
  }else{
    unbindRealtime();
    $("app").classList.add("hidden");
    $("loginCard").classList.remove("hidden");
  }
});
