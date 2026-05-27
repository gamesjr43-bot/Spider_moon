
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, getDoc,
  setDoc, updateDoc, deleteDoc, query, orderBy, limit,
  where, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Firebase config — SUBSTITUA com suas credenciais do Firebase Console ──
// Acesse: https://console.firebase.google.com → Seu projeto → ⚙️ → Geral → Seus apps
const firebaseConfig = {
  apiKey: "AIzaSyCRm4tZsnRBlwU-0o-o0oHY6WEyozib-pI",
  authDomain: "spider-network-e6257.firebaseapp.com",
  projectId: "spider-network-e6257",
  storageBucket: "spider-network-e6257.firebasestorage.app",
  messagingSenderId: "73380928208",
  appId: "1:73380928208:web:a423ca7e125ab8b52bdcd5",
  measurementId: "G-8BWEYNM241"  
};

// Verificação: avisa no console se as credenciais não foram configuradas
if (firebaseConfig.apiKey.includes("COLE_")) {
  console.error("⚠️ SPIDER NETWORK: Configure as credenciais do Firebase em firebaseConfig!");
}

let app, db, auth;

app  = initializeApp(firebaseConfig);
db   = getFirestore(app);
auth = getAuth(app);

// ── start app immediately ──
function initApp() {

let currentUser = null;
let currentUid  = null;
let lastRegister = 0;
let gameInterval = null;
let score = 0;
let forumCurrentCategory = null;
let forumCurrentTopic    = null;
let allUsers = [];

// ===== UTILS =====
function sanitizeHTML(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

function showMessage(id, msg, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = "msgBox " + type;
}

function showNotification(msg, type = "success") {
  const n = document.createElement("div");
  n.className = "notification " + type;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3200);
}

function getDefaultAvatar(username = "U") {
  const colors = ["#ff6b6b","#4ecdc4","#45b7d1","#96ceb4","#ffeaa7","#a29bfe","#fd79a8"];
  const color = colors[String(username).length % colors.length];
  const init  = String(username).charAt(0).toUpperCase() || "U";
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect width="90" height="90" fill="${color}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="45" font-weight="bold" fill="#111">${init}</text></svg>`)}`;
}

function toMillis(v) {
  if (!v) return Date.now();
  if (v.toMillis) return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  return new Date(v).getTime() || Date.now();
}

function formatDate(v) {
  return new Date(toMillis(v)).toLocaleString("pt-BR");
}

function requireLogin() {
  if (!currentUid || !currentUser) {
    showNotification("Faça login primeiro", "error");
    return false;
  }
  return true;
}

function isAdmin()    { return currentUser?.role === "admin"; }
function isModAdmin() { return ["admin","moderator"].includes(currentUser?.role); }

// ===== LOCAL RECORDS / GAME HELPERS =====
const GAME_BEST_PREFIX = "spider_best_";
const GAME_FIELDS = { flies:"bestFlies", snake:"bestSnake", memory:"bestMemory" };
const ACHIEVEMENTS = [
  {id:"first_fly", icon:"🪰", title:"Primeira Caçada", desc:"Faça pontos no Capturar Moscas.", check:()=>getBest("flies")>0},
  {id:"fly_500", icon:"🕷", title:"Predador Neon", desc:"Faça 500 pontos nas moscas.", check:()=>getBest("flies")>=500},
  {id:"snake_300", icon:"🐍", title:"Cobra Turbo", desc:"Faça 300 pontos no Snake.", check:()=>getBest("snake")>=300},
  {id:"memory_300", icon:"🧠", title:"Memória Hacker", desc:"Faça 300 pontos na memória.", check:()=>getBest("memory")>=300},
  {id:"fighter_win", icon:"🥊", title:"Primeira Vitória", desc:"Ganhe uma luta no Mortal Spider.", check:()=>Number(localStorage.getItem("spider_fight_wins")||0)>=1},
  {id:"all_games", icon:"🏆", title:"Jogador Completo", desc:"Tenha recorde em todos os mini games.", check:()=>getBest("flies")>0 && getBest("snake")>0 && getBest("memory")>0 && Number(localStorage.getItem("spider_fight_wins")||0)>0}
];
function getBest(key){ return Number(localStorage.getItem(GAME_BEST_PREFIX + key) || 0); }
async function syncGameRecordToProfile(key, value){
  if(!currentUid) return;
  const field = GAME_FIELDS[key];
  if(!field) return;
  try{ await updateDoc(doc(db,"users",currentUid),{ [field]: Math.max(Number(value)||0, Number(currentUser?.[field]||0)) }); currentUser[field]=Math.max(Number(value)||0, Number(currentUser?.[field]||0)); }catch(e){ console.warn("sync record", e); }
}
function setBest(key, value){ const v = Number(value)||0; if(v > getBest(key)){ localStorage.setItem(GAME_BEST_PREFIX + key, String(v)); syncGameRecordToProfile(key,v); return true; } return false; }
function getUnlockedAchievements(){ try{return JSON.parse(localStorage.getItem("spider_achievements")||"[]");}catch{return [];} }
async function unlockAchievement(id){
  const ach = ACHIEVEMENTS.find(a=>a.id===id); if(!ach) return;
  const unlocked = getUnlockedAchievements(); if(unlocked.includes(id)) return;
  unlocked.push(id); localStorage.setItem("spider_achievements", JSON.stringify(unlocked));
  showNotification("🏅 Conquista: " + ach.title);
  renderAchievements();
  if(currentUid){ try{ await updateDoc(doc(db,"users",currentUid),{ achievements: unlocked, achievementCount: unlocked.length }); }catch{} }
}
function checkAchievements(){ ACHIEVEMENTS.forEach(a=>{ try{ if(a.check()) unlockAchievement(a.id); }catch{} }); }
function renderAchievements(){
  const grid=document.getElementById("achievementGrid"); if(!grid) return;
  const unlocked=getUnlockedAchievements();
  grid.innerHTML = ACHIEVEMENTS.map(a=>`<div class="achievement-card ${unlocked.includes(a.id)?"unlocked":""}"><span class="ach-icon">${a.icon}</span><b>${a.title}</b><small>${a.desc}</small></div>`).join("");
}
function updateGameBestLabels(){
  const map = { flyBest: "flies", snakeBest: "snake", memoryBest: "memory" };
  Object.entries(map).forEach(([id,key])=>{ const el=document.getElementById(id); if(el) el.textContent = getBest(key); });
  renderAchievements(); checkAchievements();
}
function vibrate(ms=40){ try{ navigator.vibrate?.(ms); }catch{} }
window.updateGameBestLabels = updateGameBestLabels;


// ===== AUTH STATE =====
onAuthStateChanged(auth, async (fbUser) => {
  if (!fbUser) {
    currentUser = null; currentUid = null;
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("authBox").style.display  = "flex";
    window.spiderHideLoader?.();
    return;
  }
  currentUid = fbUser.uid;
  const ref  = doc(db, "users", currentUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { user: fbUser.email?.split("@")[0] || "usuario", email: fbUser.email || "",
      role: "user", bio: "", avatar: "", score: 0, flies: 0, isBanned: false, createdAt: serverTimestamp() });
    currentUser = (await getDoc(ref)).data();
  } else {
    currentUser = snap.data();
  }
  if (currentUser?.isBanned) { await signOut(auth); showMessage("loginMsg","Conta banida","error"); return; }
  abrirSistema();
});

// ===== MATRIX =====
const canvas = document.getElementById("matrix");
const ctx    = canvas.getContext("2d");
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
const letters = "01アイウエオカキクケコ";
const size = 14;
let drops = [];
function initDrops() { drops = []; for (let i=0;i<canvas.width/size;i++) drops[i]=Math.random()*canvas.height/size; }
initDrops();
function drawMatrix() {
  ctx.fillStyle = "rgba(6,6,8,0.05)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#00ffc8"; ctx.font = size+"px monospace";
  for (let i=0;i<drops.length;i++) {
    ctx.fillText(letters[Math.floor(Math.random()*letters.length)], i*size, drops[i]*size);
    if (drops[i]*size>canvas.height&&Math.random()>0.975) drops[i]=0;
    drops[i]++;
  }
}
setInterval(drawMatrix,40);
window.addEventListener("resize",()=>{ resizeCanvas(); initDrops(); });

// ===== SPIDER =====
const spider = document.getElementById("spider");
const thread = document.getElementById("thread");
let sx = window.innerWidth/2, sy = 80;
let spiderRAF = null;
let targetX = window.innerWidth/2, targetY = 80;

function updateSpider() {
  sx += (targetX - sx) * 0.1;
  sy += (targetY - sy) * 0.1;
  spider.style.left = sx + "px";
  spider.style.top  = sy + "px";
  thread.style.left   = (sx + 32) + "px";
  thread.style.height = sy + "px";
  spiderRAF = requestAnimationFrame(updateSpider);
}

// Mouse (desktop)
window.addEventListener("mousemove", (e) => {
  targetX = e.clientX - 32;
  targetY = e.clientY - 32;
});

// Touch (mobile) – follow finger on body but ignore game canvases
document.addEventListener("touchmove", (e) => {
  const tag = e.target.tagName;
  if (tag === "CANVAS") return; // let games handle their own touch
  const t = e.touches[0];
  targetX = t.clientX - 32;
  targetY = t.clientY - 32;
}, { passive: true });

document.addEventListener("touchstart", (e) => {
  const tag = e.target.tagName;
  if (tag === "CANVAS") return;
  const t = e.touches[0];
  // snap instantly on first touch
  sx = t.clientX - 32;
  sy = t.clientY - 32;
  targetX = sx; targetY = sy;
}, { passive: true });

updateSpider();

// ===== PASSWORD STRENGTH =====
const newPassEl = document.getElementById("newPass");
const forcaEl   = document.getElementById("forcaSenha");
newPassEl?.addEventListener("input",function(){
  const v = this.value; let s=0;
  if(v.length>=8)s++; if(/[A-Z]/.test(v))s++; if(/[a-z]/.test(v))s++;
  if(/[0-9]/.test(v))s++; if(/[@$!%*?&]/.test(v))s++;
  if(s<=2){ forcaEl.textContent="⚠️ Senha fraca"; forcaEl.className="weak"; }
  else if(s<=4){ forcaEl.textContent="⚡ Senha média"; forcaEl.className="medium"; }
  else { forcaEl.textContent="✅ Senha forte!"; forcaEl.className="strong"; }
});

window.toggleSenha = (id)=>{ const c=document.getElementById(id); c.type=c.type==="password"?"text":"password"; };

// ===== AUTH TABS =====
window.mostrarCadastro = function(){
  showMessage("loginMsg",""); showMessage("registerMsg","");
  document.getElementById("loginArea").style.display    = "none";
  document.getElementById("cadastroArea").style.display = "block";
  document.getElementById("tabLoginBtn").classList.remove("active");
  document.getElementById("tabRegisterBtn").classList.add("active");
};

window.mostrarLogin = function(){
  showMessage("loginMsg",""); showMessage("registerMsg","");
  document.getElementById("loginArea").style.display    = "block";
  document.getElementById("cadastroArea").style.display = "none";
  document.getElementById("tabLoginBtn").classList.add("active");
  document.getElementById("tabRegisterBtn").classList.remove("active");
};

// ===== REGISTER =====
window.register = async function(){
  const btn = document.getElementById("registerBtn");
  showMessage("registerMsg",""); btn.disabled=true; btn.textContent="Aguarde...";
  const now = Date.now();
  if(now-lastRegister<5000){ showMessage("registerMsg","Aguarde 5 segundos","error"); btn.disabled=false; btn.textContent="CRIAR CONTA"; return; }
  const username = document.getElementById("newUser").value.trim();
  const email    = document.getElementById("newEmail").value.trim();
  const password = document.getElementById("newPass").value.trim();
  if(!username||!email||!password){ showMessage("registerMsg","Preencha todos os campos","error"); btn.disabled=false; btn.textContent="CRIAR CONTA"; return; }
  if(username.length<3){ showMessage("registerMsg","Usuário precisa ter pelo menos 3 caracteres","error"); btn.disabled=false; btn.textContent="CRIAR CONTA"; return; }
  if(password.length<6){ showMessage("registerMsg","A senha precisa ter pelo menos 6 caracteres","error"); btn.disabled=false; btn.textContent="CRIAR CONTA"; return; }
  try {
    const uc = await createUserWithEmailAndPassword(auth,email,password);
    await setDoc(doc(db,"users",uc.user.uid),{ user:username, email, role:"user", bio:"", avatar:"", score:0, flies:0, isBanned:false, createdAt:serverTimestamp() });
    currentUid  = uc.user.uid;
    currentUser = (await getDoc(doc(db,"users",currentUid))).data();
    lastRegister = now;
    showMessage("registerMsg","✅ Conta criada!","success");
    setTimeout(()=>abrirSistema(),700);
  } catch(err){ showMessage("registerMsg",traduzErro(err),"error"); }
  finally{ btn.disabled=false; btn.textContent="CRIAR CONTA"; }
};

// ===== LOGIN =====
window.login = async function(){
  const btn = document.getElementById("loginBtn");
  showMessage("loginMsg",""); btn.disabled=true; btn.textContent="Entrando...";
  const email    = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();
  if(!email||!password){ showMessage("loginMsg","Preencha email e senha","error"); btn.disabled=false; btn.textContent="ENTRAR"; return; }
  try {
    const uc   = await signInWithEmailAndPassword(auth,email,password);
    currentUid = uc.user.uid;
    const snap = await getDoc(doc(db,"users",currentUid));
    currentUser = snap.data();
    if(currentUser?.isBanned){ await signOut(auth); showMessage("loginMsg","Conta banida","error"); return; }
    abrirSistema();
  } catch(err){ showMessage("loginMsg",traduzErro(err),"error"); }
  finally{ btn.disabled=false; btn.textContent="ENTRAR"; }
};

function traduzErro(err){
  const c=err?.code||"";
  if(c.includes("email-already-in-use")) return "Email já cadastrado";
  if(c.includes("invalid-email"))        return "Email inválido";
  if(c.includes("weak-password"))        return "Senha fraca";
  if(c.includes("user-not-found")||c.includes("wrong-password")||c.includes("invalid-credential")) return "Email ou senha incorretos";
  if(c.includes("network-request-failed")) return "Sem conexão";
  return err?.message || "Erro desconhecido";
}

// ===== SISTEMA =====
function abrirSistema(){
  if(!currentUser) return;
  document.getElementById("authBox").style.display    = "none";
  document.getElementById("dashboard").style.display  = "flex";
  window.spiderHideLoader?.();
  updateGameBestLabels();
  const isAdm = isAdmin();
  document.getElementById("nav-admin").style.display  = isAdm?"flex":"none";
  document.getElementById("mnav-admin").style.display = isAdm?"flex":"none";

  // sidebar user chip
  const av = currentUser.avatar || getDefaultAvatar(currentUser.user);
  document.getElementById("sidebarAvatar").src      = av;
  document.getElementById("sidebarUsername").textContent = currentUser.user || "usuário";
  document.getElementById("sidebarRole").textContent     = currentUser.role || "user";

  document.getElementById("welcomeText").textContent = `Olá, ${currentUser.user}! 👋`;
  document.getElementById("homeScore").textContent = currentUser.score || 0;
  document.getElementById("homeFlies").textContent = currentUser.flies || 0;

  // Abre home imediatamente; carrega o resto lazy para não travar
  abrirPainel("home");
  setTimeout(()=>carregarPerfil(), 100);
  setTimeout(()=>carregarHomeStats(), 400);
  // Ranking e chat carregam só quando o usuário navegar até eles
}

window.logout = async function(){
  await signOut(auth);
  currentUser=null; currentUid=null;
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("authBox").style.display   = "flex";
  // close chat if open
  document.getElementById("chatPanel").classList.remove("open");
  document.getElementById("chatToggleBtn").classList.remove("chat-open");
};

// ===== PERFIL =====
async function carregarPerfil(){
  if(!requireLogin()) return;
  const snap = await getDoc(doc(db,"users",currentUid));
  currentUser = snap.data();

  const av = currentUser.avatar || getDefaultAvatar(currentUser.user);
  document.getElementById("avatar").src          = av;
  document.getElementById("sidebarAvatar").src   = av;
  document.getElementById("perfilUser").textContent  = currentUser.user || "";
  document.getElementById("sidebarUsername").textContent = currentUser.user || "";
  document.getElementById("perfilRole").textContent  = currentUser.role || "user";
  document.getElementById("bioInput").value          = currentUser.bio  || "";
  document.getElementById("perfilScore").textContent = `🏆 ${currentUser.score||0} pts`;
  document.getElementById("perfilFlies").textContent = `🪰 ${currentUser.flies||0} moscas`;

  document.getElementById("homeScore").textContent = currentUser.score || 0;
  document.getElementById("homeFlies").textContent = currentUser.flies || 0;
}

window.salvarPerfil = async function(){
  if(!requireLogin()) return;
  const bio = document.getElementById("bioInput").value;
  try {
    await updateDoc(doc(db,"users",currentUid),{bio});
    currentUser.bio = bio;
    showMessage("profileMsg","✅ Perfil salvo!","success");
    setTimeout(()=>showMessage("profileMsg",""),2500);
  } catch { showMessage("profileMsg","Erro ao salvar","error"); }
};

document.getElementById("avatarUpload")?.addEventListener("change",async function(e){
  if(!requireLogin()) return;
  const file = e.target.files[0]; if(!file) return;
  if(file.size>500000){ showMessage("profileMsg","Imagem muito grande (máx 500KB)","error"); return; }
  const reader = new FileReader();
  reader.onload = async function(ev){
    try {
      await updateDoc(doc(db,"users",currentUid),{avatar:ev.target.result});
      currentUser.avatar = ev.target.result;
      document.getElementById("avatar").src        = ev.target.result;
      document.getElementById("sidebarAvatar").src = ev.target.result;
      showMessage("profileMsg","✅ Avatar atualizado!","success");
    } catch { showMessage("profileMsg","Erro ao atualizar avatar","error"); }
  };
  reader.readAsDataURL(file);
});

// ===== HOME STATS =====
async function carregarHomeStats(){
  try {
    const [tSnap, rSnap] = await Promise.all([
      getDocs(collection(db,"forumTopics")),
      getDocs(collection(db,"forumReplies"))
    ]);
    document.getElementById("homeTopics").textContent  = tSnap.size;
    document.getElementById("homeReplies").textContent = rSnap.size;
  } catch(e) {
    document.getElementById("homeTopics").textContent  = "—";
    document.getElementById("homeReplies").textContent = "—";
  }
}

// ===== RANKING =====
let rankingMode = "score";
window.setRankingMode = function(mode){
  rankingMode = mode;
  ["score","bestFlies","bestSnake","bestMemory","fightWins"].forEach(m=>{
    const el=document.getElementById("rankTab-"+m); if(el) el.classList.toggle("active", m===mode);
  });
  carregarRanking();
};
async function carregarRanking(){
  if(!requireLogin()) return;
  try {
    const labelMap = { score:"pontos", bestFlies:"moscas", bestSnake:"snake", bestMemory:"memória", fightWins:"vitórias" };
    const q = query(collection(db,"users"),orderBy(rankingMode,"desc"),limit(50));
    const snap = await getDocs(q);
    const users = snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>!u.isBanned);
    const list  = document.getElementById("rankingList");
    const medals = ["🥇","🥈","🥉"];
    const posClass = ["gold","silver","bronze"];
    if(!users.length){ list.innerHTML=`<div class="empty-state"><span class="empty-icon">🏆</span>Ninguém pontuou ainda nesse ranking.</div>`; return; }
    list.innerHTML = users.map((u,i)=>{
      const isMe = u.id === currentUid;
      const avatarSrc = u.avatar || getDefaultAvatar(u.user);
      const value = Number(u[rankingMode] || 0);
      const pos  = i<3 ? `<span class="rank-pos ${posClass[i]}">${medals[i]}</span>`
                       : `<span class="rank-pos" style="color:var(--text-dim)">#${i+1}</span>`;
      return `
        <div class="rank-item ${i<3?"rank-"+(i+1):""}" style="${isMe?"border-color:rgba(0,255,200,0.4);":""};animation-delay:${i*0.05}s">
          ${pos}
          <img src="${avatarSrc}" class="rank-avatar">
          <span class="rank-name" style="${isMe?"color:var(--primary)":""}">
            ${sanitizeHTML(u.user)} ${isMe?"<span style='font-size:10px;color:var(--text-dim)'>(você)</span>":""}
          </span>
          <div class="rank-stats">
            <span class="rank-score">${value}</span>
            <span class="rank-flies">${labelMap[rankingMode]}</span>
          </div>
        </div>`;
    }).join("");
  } catch(err){ console.error("Ranking:",err); showNotification("Ranking ainda sem dados para essa categoria", "warning"); }
}

// ===== CHAT =====
async function carregarChat(){
  if(!requireLogin()) return;
  try {
    const q = query(collection(db,"chat"),orderBy("createdAt","asc"),limit(100));
    const snap = await getDocs(q);
    renderChat(snap.docs.map(d=>({id:d.id,...d.data()})));
  } catch(err){ console.error("Chat:",err); }
}

function renderChat(messages){
  const div = document.getElementById("chatMessages");
  div.innerHTML = messages.map(msg=>{
    const own   = msg.uid===currentUid || msg.user===currentUser?.user;
    const admin = msg.role==="admin";
    return `
      <div class="chat-msg ${own?"own":""} ${admin?"admin":""}">
        <div class="chat-msg-header">
          <span class="chat-msg-user ${admin?"adminUser":""}">${sanitizeHTML(msg.user)} ${admin?"👑":""}</span>
          <span class="chat-msg-time">${formatDate(msg.createdAt)}</span>
        </div>
        <div class="chat-msg-content">${sanitizeHTML(msg.content)}</div>
      </div>`;
  }).join("");
  div.scrollTop = div.scrollHeight;
}

window.sendChat = async function(){
  if(!requireLogin()) return;
  const input = document.getElementById("chatInput");
  const content = input.value.trim(); if(!content) return;
  try {
    await addDoc(collection(db,"chat"),{ uid:currentUid, user:currentUser.user,
      role:currentUser.role||"user", content, createdAt:serverTimestamp() });
    input.value = "";
    await carregarChat();
  } catch { showNotification("Erro ao enviar","error"); }
};

window.toggleChat = function(){
  const panel = document.getElementById("chatPanel");
  const btn   = document.getElementById("chatToggleBtn");
  const open  = panel.classList.contains("open");
  if(open){
    panel.classList.remove("open");
    btn.classList.remove("chat-open");
  } else {
    window.spiderLoadingDelay("Abrindo chat global...", async ()=>{
      panel.classList.add("open");
      btn.classList.add("chat-open");
      if(currentUid) await carregarChat();
    }, "💬", 300);
  }
};

// ===== PAINÉIS =====
window.abrirPainel = async function(painel){
  const nomes = { home:"Carregando home...", perfil:"Carregando perfil...", forum:"Carregando fórum...", ranking:"Carregando ranking...", admin:"Carregando painel admin..." };
  return window.spiderWithLoading(nomes[painel] || "Carregando área...", async ()=>{
  // Usa só classList (sem style.display manual) para evitar conflito com CSS .panel.active
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  const el = document.getElementById(painel);
  if(el) el.classList.add("active");

  // update nav buttons
  ["home","perfil","forum","ranking","admin"].forEach(id=>{
    const nb = document.getElementById("nav-"+id);
    const mb = document.getElementById("mnav-"+id);
    if(nb) nb.classList.toggle("active", id===painel);
    if(mb) mb.classList.toggle("active", id===painel);
  });

  const titles = { home:"HOME", perfil:"MEU PERFIL", forum:"FÓRUM", ranking:"RANKING", admin:"ADMIN" };
  document.getElementById("topbarTitle").textContent = titles[painel] || painel.toUpperCase();

  if(painel==="admin"){
    if(!isAdmin()){ showNotification("Acesso negado","error"); abrirPainel("home"); return; }
    await carregarAdminStats(); adminShowUsers();
  }
  if(painel==="forum")   await carregarForum();
  if(painel==="ranking") await carregarRanking();
  if(painel==="perfil")  await carregarPerfil();
  }, painel==="forum" ? "💬" : painel==="ranking" ? "🏆" : painel==="admin" ? "⚙️" : "🕷", 520);
};

// ===== ADMIN =====
async function carregarAdminStats(){
  if(!isAdmin()) return;
  const [uS,cS,tS,rS] = await Promise.all([
    getDocs(collection(db,"users")), getDocs(collection(db,"chat")),
    getDocs(collection(db,"forumTopics")), getDocs(collection(db,"forumReplies"))
  ]);
  const users = uS.docs.map(d=>d.data());
  document.getElementById("statUsers").textContent    = uS.size;
  document.getElementById("statMessages").textContent = cS.size;
  document.getElementById("statBanned").textContent   = users.filter(u=>u.isBanned).length;
  document.getElementById("statTopics").textContent   = tS.size;
  document.getElementById("statReplies").textContent  = rS.size;
  document.getElementById("statFlies").textContent    = users.reduce((s,u)=>s+(u.flies||0),0);
}

window.adminShowUsers = async function(){
  if(!isAdmin()) return;
  ["adminUsersSection","adminAnnouncementSection","adminAuditSection","adminCategorySection"]
    .forEach(id=>document.getElementById(id).style.display="none");
  document.getElementById("adminUsersSection").style.display="block";
  const snap = await getDocs(collection(db,"users"));
  allUsers = snap.docs.map(d=>({id:d.id,...d.data()}));
  renderUserList(allUsers);
};

function renderUserList(users){
  document.getElementById("userList").innerHTML = users.map(u=>`
    <div class="user-item ${u.isBanned?"banned":""} ${u.role||"user"}">
      <div class="user-info">
        <img src="${u.avatar||getDefaultAvatar(u.user)}" class="user-item-avatar">
        <div>
          <div class="user-item-name">${sanitizeHTML(u.user)}</div>
          <div class="user-item-role">${u.role||"user"} ${u.isBanned?"(BANIDO)":""}</div>
        </div>
      </div>
      <div class="user-actions">
        ${u.role!=="admin"?`
          <button onclick="banUser('${u.id}',${!u.isBanned})" class="${u.isBanned?"success":"danger"}" style="padding:6px 10px;font-size:11px">
            ${u.isBanned?"Desbanir":"Banir"}
          </button>
          <button onclick="promoteUser('${u.id}','${u.role==="user"?"moderator":"user"}')" class="secondary" style="padding:6px 10px;font-size:11px">
            ${u.role==="user"?"Promover":"Rebaixar"}
          </button>
        `:""}
      </div>
    </div>`).join("");
}

window.filterUsers = function(){
  const s = document.getElementById("userSearchInput").value.toLowerCase();
  renderUserList(allUsers.filter(u=>String(u.user||"").toLowerCase().includes(s)));
};

window.banUser = async function(userId,ban){
  if(!isAdmin()) return;
  await updateDoc(doc(db,"users",userId),{isBanned:ban});
  await addDoc(collection(db,"audit"),{ user:currentUser.user, action:ban?"Baniu usuário":"Desbaniu usuário", createdAt:serverTimestamp() });
  showNotification(ban?"Usuário banido":"Usuário desbanido");
  adminShowUsers(); carregarAdminStats();
};

window.promoteUser = async function(userId,role){
  if(!isAdmin()) return;
  await updateDoc(doc(db,"users",userId),{role});
  await addDoc(collection(db,"audit"),{ user:currentUser.user, action:`Cargo alterado para ${role}`, createdAt:serverTimestamp() });
  showNotification("Cargo atualizado");
  adminShowUsers();
};

window.adminShowAnnouncement = function(){
  ["adminUsersSection","adminAnnouncementSection","adminAuditSection","adminCategorySection"]
    .forEach(id=>document.getElementById(id).style.display="none");
  document.getElementById("adminAnnouncementSection").style.display="block";
};

window.sendAnnouncement = async function(){
  if(!isAdmin()) return;
  const text = document.getElementById("announcementText").value.trim(); if(!text) return;
  await addDoc(collection(db,"chat"),{ uid:currentUid, user:currentUser.user, role:"admin",
    content:"[📢 ANÚNCIO] "+text, createdAt:serverTimestamp() });
  showNotification("Anúncio enviado!");
  document.getElementById("announcementText").value="";
};

window.adminShowAudit = function(){
  ["adminUsersSection","adminAnnouncementSection","adminAuditSection","adminCategorySection"]
    .forEach(id=>document.getElementById(id).style.display="none");
  document.getElementById("adminAuditSection").style.display="block";
  carregarAudit();
};

async function carregarAudit(){
  if(!isAdmin()) return;
  const q = query(collection(db,"audit"),orderBy("createdAt","desc"),limit(50));
  const snap = await getDocs(q);
  document.getElementById("auditLog").innerHTML = snap.docs.map(d=>{
    const l=d.data();
    return `<div class="audit-entry"><span class="audit-action">${sanitizeHTML(l.action)}</span><span style="color:#888">por ${sanitizeHTML(l.user)}</span><span class="audit-time">${formatDate(l.createdAt)}</span></div>`;
  }).join("");
}

window.adminClearChat = async function(){
  if(!isAdmin()) return;
  if(!confirm("Limpar todo o chat?")) return;
  const snap = await getDocs(collection(db,"chat"));
  await Promise.all(snap.docs.map(d=>deleteDoc(doc(db,"chat",d.id))));
  showNotification("Chat limpo!"); carregarChat(); carregarAdminStats();
};

window.adminShowCategories = function(){
  if(!isAdmin()) return;
  ["adminUsersSection","adminAnnouncementSection","adminAuditSection","adminCategorySection"]
    .forEach(id=>document.getElementById(id).style.display="none");
  document.getElementById("adminCategorySection").style.display="block";
  adminLoadCategories();
};

async function adminLoadCategories(){
  const q = query(collection(db,"forumCategories"),orderBy("order","asc"));
  const snap = await getDocs(q);
  document.getElementById("adminCategoryList").innerHTML = snap.docs.map(d=>{
    const cat=d.data();
    return `
      <div class="forum-category-card">
        <div class="forum-category-icon">${sanitizeHTML(cat.icon||"💬")}</div>
        <div class="forum-category-info">
          <div class="forum-category-name">${sanitizeHTML(cat.name)}</div>
          <div class="forum-category-desc">${sanitizeHTML(cat.description||"")}</div>
        </div>
        <button onclick="adminDeleteCategory('${d.id}')" class="danger" style="font-size:11px;padding:6px 10px">Deletar</button>
      </div>`;
  }).join("");
}

window.adminCreateCategory = async function(){
  if(!isAdmin()) return;
  const name = document.getElementById("catName").value.trim();
  const desc = document.getElementById("catDesc").value.trim();
  const icon = document.getElementById("catIcon").value.trim()||"💬";
  if(!name){ showNotification("Nome obrigatório","error"); return; }
  await addDoc(collection(db,"forumCategories"),{ name, description:desc, icon, order:Date.now(), createdAt:serverTimestamp() });
  document.getElementById("catName").value=""; document.getElementById("catDesc").value=""; document.getElementById("catIcon").value="";
  showNotification("Categoria criada"); adminLoadCategories();
};

window.adminDeleteCategory = async function(id){
  if(!isAdmin()) return;
  if(!confirm("Deletar categoria?")) return;
  await deleteDoc(doc(db,"forumCategories",id)); adminLoadCategories();
};

// ===== GAME - MOSCAS =====
let flyDifficulty = 'facil';
let flyTimerVal = 60;
let flyTimerInterval = null;

window.setFlyDifficulty = function(diff){
  flyDifficulty = diff;
  const names = { facil:"Difícil", medio:"Pesado", dificil:"Insano", inferno:"Inferno" };
  const modeEl=document.getElementById('flyMode'); if(modeEl) modeEl.textContent = names[diff] || "Insano";
  ['facil','medio','dificil','inferno'].forEach(d=>{
    const btn = document.getElementById('flyDiff'+d.charAt(0).toUpperCase()+d.slice(1));
    if(btn) btn.classList.toggle('active', d===diff);
  });
  stopGame(false); startGame();
};

window.toggleGame = function(){
  const modal = document.getElementById("gameModal");
  const open  = modal.classList.contains("open");
  if(open){ modal.classList.remove("open"); stopGame(true); }
  else {
    window.spiderLoadingDelay("Preparando Capturar Moscas Hardcore...", ()=>{ modal.classList.add("open"); startGame(); }, "🪰", 320);
  }
};

function getFlyConfig(){
  // O modo antigo era fácil demais. Agora até o primeiro modo já é desafiador.
  if(flyDifficulty==='facil')   return { speed:[1.6,3.2], count:6,  pts:12, time:45, fps:50, size:7, spider:18, comboMs:650, fake:.10, bomb:.04, gold:.04, dodge:0.035, dash:.025, label:"Difícil" };
  if(flyDifficulty==='medio')   return { speed:[2.6,5.2], count:9,  pts:18, time:35, fps:55, size:6, spider:16, comboMs:520, fake:.18, bomb:.09, gold:.035, dodge:0.055, dash:.045, label:"Pesado" };
  if(flyDifficulty==='dificil') return { speed:[4.0,7.8], count:12, pts:28, time:25, fps:60, size:5, spider:14, comboMs:390, fake:.28, bomb:.15, gold:.025, dodge:0.085, dash:.075, label:"Insano" };
  return                               { speed:[5.5,10.5],count:15, pts:40, time:20, fps:60, size:4, spider:12, comboMs:300, fake:.35, bomb:.22, gold:.018, dodge:0.120, dash:.110, label:"Inferno" };
}

function startGame(){
  const cfg = getFlyConfig();
  const gameCanvas = document.getElementById("modalGameCanvas");
  const gameCtx    = gameCanvas.getContext("2d");
  let gSpider = { x:gameCanvas.width/2, y:gameCanvas.height/2, size:cfg.spider };
  let flies   = [];
  let dangerLevel = 1;
  let tick = 0;
  score = 0;
  let combo = 0;
  let lastCatch = 0;
  updateGameBestLabels();
  const modeEl=document.getElementById('flyMode'); if(modeEl) modeEl.textContent = cfg.label;
  const comboEl = document.getElementById("flyCombo"); if(comboEl) comboEl.textContent = "x0";
  flyTimerVal = cfg.time;
  document.getElementById("liveScore").textContent = "0";
  const timerEl = document.getElementById("flyTimer");
  timerEl.className = "game-timer";
  timerEl.textContent = flyTimerVal + "s";

  clearInterval(flyTimerInterval);
  flyTimerInterval = setInterval(()=>{
    flyTimerVal--;
    // A cada 8 segundos o jogo fica mais cruel: mais velocidade e mais moscas.
    if(flyTimerVal > 0 && flyTimerVal % 8 === 0){
      dangerLevel += 0.14;
      if(flies.length < cfg.count + Math.floor(dangerLevel)) spawnFly();
      showScorePopup("⚠");
    }
    timerEl.textContent = flyTimerVal + "s";
    if(flyTimerVal <= 10) timerEl.className = "game-timer urgent";
    if(flyTimerVal <= 0){
      clearInterval(flyTimerInterval);
      stopGame(true);
      document.getElementById("gameModal").classList.remove("open");
      showNotification("⏱️ Tempo esgotado! Pontos: " + score);
    }
  }, 1000);

  function randomType(){
    const r = Math.random();
    if(r < cfg.bomb) return "bomb";
    if(r < cfg.bomb + cfg.fake) return "fake";
    if(r > 1 - cfg.gold) return "gold";
    return "normal";
  }

  function spawnFly(type=randomType()){
    const angle = Math.random()*Math.PI*2;
    const [sMin,sMax] = cfg.speed;
    const speed = (sMin + Math.random()*(sMax-sMin)) * dangerLevel;
    let x, y, tries=0;
    do {
      x = Math.random()*(gameCanvas.width-36)+18;
      y = Math.random()*(gameCanvas.height-36)+18;
      tries++;
    } while(Math.hypot(x-gSpider.x,y-gSpider.y) < 70 && tries < 20);
    const sizeBonus = type === "gold" ? 2 : type === "bomb" ? 4 : type === "fake" ? 1 : 0;
    flies.push({ x, y, type, life:0, pulse:Math.random()*10,
      size:cfg.size + sizeBonus,
      vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed });
  }

  for(let i=0;i<cfg.count;i++) spawnFly(i<2?"normal":undefined);

  gameCanvas.onmousemove = (e)=>{
    const r=gameCanvas.getBoundingClientRect();
    const scaleX=gameCanvas.width/r.width, scaleY=gameCanvas.height/r.height;
    gSpider.x=(e.clientX-r.left)*scaleX; gSpider.y=(e.clientY-r.top)*scaleY;
  };
  gameCanvas.ontouchmove = (e)=>{
    e.preventDefault();
    const r=gameCanvas.getBoundingClientRect(); const t=e.touches[0];
    const scaleX=gameCanvas.width/r.width, scaleY=gameCanvas.height/r.height;
    gSpider.x=(t.clientX-r.left)*scaleX; gSpider.y=(t.clientY-r.top)*scaleY;
  };

  clearInterval(gameInterval);
  gameInterval = setInterval(()=>{
    tick++;
    gameCtx.fillStyle="rgba(6,6,8,0.31)"; gameCtx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
    gameCtx.strokeStyle="rgba(255,60,110,0.07)"; gameCtx.lineWidth=0.5;
    for(let i=0;i<6;i++){
      gameCtx.beginPath(); gameCtx.arc(gSpider.x,gSpider.y,gSpider.size*3*i/4+gSpider.size,0,Math.PI*2); gameCtx.stroke();
    }

    // Spider menor = hitbox mais difícil.
    gameCtx.beginPath(); gameCtx.arc(gSpider.x,gSpider.y,gSpider.size,0,Math.PI*2);
    const grad=gameCtx.createRadialGradient(gSpider.x-4,gSpider.y-4,2,gSpider.x,gSpider.y,gSpider.size);
    grad.addColorStop(0,"#00ffc8"); grad.addColorStop(1,"#00665c");
    gameCtx.fillStyle=grad; gameCtx.fill();
    gameCtx.strokeStyle="rgba(0,255,200,0.6)"; gameCtx.lineWidth=1.3; gameCtx.stroke();
    gameCtx.fillStyle="#ff3c6e";
    gameCtx.beginPath(); gameCtx.arc(gSpider.x-4,gSpider.y-4,2,0,Math.PI*2); gameCtx.fill();
    gameCtx.beginPath(); gameCtx.arc(gSpider.x+4,gSpider.y-4,2,0,Math.PI*2); gameCtx.fill();

    flies.forEach((fly,idx)=>{
      fly.life++;
      fly.pulse += 0.18;

      // Dodge: a mosca foge da aranha quando chega perto.
      const dx = fly.x - gSpider.x, dy = fly.y - gSpider.y;
      const d = Math.hypot(dx,dy) || 1;
      if(d < 82 && fly.type !== "bomb"){
        fly.vx += (dx/d) * cfg.dodge * dangerLevel;
        fly.vy += (dy/d) * cfg.dodge * dangerLevel;
      }
      // Dash imprevisível.
      if(Math.random() < cfg.dash){
        const a=Math.random()*Math.PI*2;
        fly.vx += Math.cos(a) * 0.9 * dangerLevel;
        fly.vy += Math.sin(a) * 0.9 * dangerLevel;
      }
      const maxV = cfg.speed[1] * dangerLevel * (fly.type==='bomb'?0.85:1.15);
      const v = Math.hypot(fly.vx, fly.vy) || 1;
      if(v > maxV){ fly.vx = fly.vx/v*maxV; fly.vy = fly.vy/v*maxV; }

      fly.x+=fly.vx; fly.y+=fly.vy;
      if(fly.x<fly.size || fly.x>gameCanvas.width-fly.size)  { fly.vx*=-1; fly.x=Math.max(fly.size, Math.min(gameCanvas.width-fly.size, fly.x)); }
      if(fly.y<fly.size || fly.y>gameCanvas.height-fly.size) { fly.vy*=-1; fly.y=Math.max(fly.size, Math.min(gameCanvas.height-fly.size, fly.y)); }

      // Depois de alguns segundos, a mosca normal vai ficando menor.
      if(fly.type === "normal" && fly.life % 90 === 0 && fly.size > Math.max(3, cfg.size-1)) fly.size -= .35;

      const drawSize = fly.size + Math.sin(fly.pulse)*0.7;
      if(fly.type === "bomb"){
        gameCtx.fillStyle="rgba(255,60,110,0.16)";
        gameCtx.beginPath(); gameCtx.arc(fly.x,fly.y,drawSize+7,0,Math.PI*2); gameCtx.fill();
        gameCtx.fillStyle="#111"; gameCtx.beginPath(); gameCtx.arc(fly.x,fly.y,drawSize+2,0,Math.PI*2); gameCtx.fill();
        gameCtx.strokeStyle="#ff3c6e"; gameCtx.lineWidth=2; gameCtx.stroke();
        gameCtx.fillStyle="#ff3c6e"; gameCtx.font="12px Arial"; gameCtx.fillText("✹", fly.x-5, fly.y+4);
      } else {
        gameCtx.beginPath(); gameCtx.arc(fly.x,fly.y,drawSize,0,Math.PI*2);
        const fg=gameCtx.createRadialGradient(fly.x-2,fly.y-2,1,fly.x,fly.y,drawSize);
        if(fly.type === "fake") { fg.addColorStop(0,"#b46cff"); fg.addColorStop(1,"#5a1a99"); }
        else if(fly.type === "gold") { fg.addColorStop(0,"#fff2a8"); fg.addColorStop(1,"#d6a800"); }
        else { fg.addColorStop(0,"#ff6666"); fg.addColorStop(1,"#cc0000"); }
        gameCtx.fillStyle=fg; gameCtx.fill();
        gameCtx.fillStyle="rgba(220,220,255,0.35)";
        gameCtx.beginPath(); gameCtx.ellipse(fly.x-drawSize*.8,fly.y-drawSize*.6,drawSize*.8,drawSize*.38,-.3,0,Math.PI*2); gameCtx.fill();
        gameCtx.beginPath(); gameCtx.ellipse(fly.x+drawSize*.8,fly.y-drawSize*.6,drawSize*.8,drawSize*.38,.3,0,Math.PI*2);  gameCtx.fill();
      }

      const dist=Math.hypot(gSpider.x-fly.x,gSpider.y-fly.y);
      const hitSize = gSpider.size + fly.size;
      if(dist < hitSize){
        flies.splice(idx,1);
        const now = Date.now();
        if(fly.type === "bomb"){
          combo = 0; score = Math.max(0, score - Math.round(cfg.pts*2.2)); flyTimerVal = Math.max(1, flyTimerVal-4);
          if(comboEl) comboEl.textContent = "x0";
          document.getElementById("liveScore").textContent=score;
          vibrate(80); showScorePopup("-" + Math.round(cfg.pts*2.2)); spawnFly("bomb"); return;
        }
        if(fly.type === "fake"){
          combo = 0; score = Math.max(0, score - cfg.pts); flyTimerVal = Math.max(1, flyTimerVal-2);
          if(comboEl) comboEl.textContent = "x0";
          document.getElementById("liveScore").textContent=score;
          vibrate(60); showScorePopup("-" + cfg.pts); spawnFly(); return;
        }
        combo = (now - lastCatch < cfg.comboMs) ? Math.min(combo + 1, 12) : 1;
        lastCatch = now;
        const multiplier = fly.type === "gold" ? 3 : 1;
        const gained = Math.round(cfg.pts * multiplier * (1 + Math.max(0, combo-1) * 0.10));
        score += gained;
        if(comboEl) comboEl.textContent = "x" + combo;
        document.getElementById("liveScore").textContent=score;
        vibrate(fly.type === "gold" ? 45 : 22);
        spawnFly(); showScorePopup(gained);
      }
    });
    while(flies.length < cfg.count + Math.floor(dangerLevel-1)) spawnFly();
  }, 1000/cfg.fps);
}

async function stopGame(saveScore=true){
  clearInterval(gameInterval);
  clearInterval(flyTimerInterval);
  if(saveScore && score>0){
    const isNew = setBest("flies", score);
    updateGameBestLabels();
    if(isNew) showNotification("🏆 Novo recorde nas moscas: " + score);
  }
  if(saveScore && score>0 && currentUid){
    await updateDoc(doc(db,"users",currentUid),{ score:increment(score), flies:increment(Math.floor(score/10)) });
    carregarPerfil(); carregarRanking();
  }
}

function showScorePopup(pts){
  const p=document.createElement("div"); p.className="score-popup";
  p.textContent = (typeof pts === "number") ? `+${pts}` : String(pts);
  if(String(pts).startsWith("-")) p.style.color = "var(--accent)";
  document.body.appendChild(p); setTimeout(()=>p.remove(),900);
}

// ===== SNAKE GAME =====
let snakeInterval = null;
let snakeState    = null;
let snakePauseToggle = null;
let restartSnake = null;
window.snakePauseToggle = null;
window.restartSnake = null;

window.toggleSnake = function(){
  const modal = document.getElementById("snakeModal");
  if(modal.classList.contains("open")){
    modal.classList.remove("open");
    if(snakeState){ snakeState.cleanup(); snakeState=null; }
    clearInterval(snakeInterval); snakeInterval=null;
  } else {
    window.spiderLoadingDelay("Carregando Snake Turbo...", ()=>{
      modal.classList.add("open");
      if(snakeState){ snakeState.cleanup(); snakeState=null; }
      clearInterval(snakeInterval); snakeInterval=null;
      initSnake();
    }, "🐍", 320);
  }
};

function initSnake(){
  const canvas = document.getElementById("snakeCanvas");
  const ctx    = canvas.getContext("2d");
  const CELL = 18;
  const COLS = Math.floor(canvas.width / CELL);
  const ROWS = Math.floor(canvas.height / CELL);

  /* ── state ─────────────────────────────── */
  let snake     = [{ x: Math.floor(COLS/2), y: Math.floor(ROWS/2) }];
  let dir       = null;
  let nextDir   = null;
  let food      = null;
  let bonus     = null;          // rare bonus item
  let bonusTimer= 0;
  let walls     = [];            // obstacle cells
  let pts       = 0;
  let level     = 1;
  let running   = false;
  let dead      = false;
  let flashTick = 0;             // for death flash

  updateGameBestLabels();
  document.getElementById("snakeScore").textContent = "0";
  document.getElementById("snakeLevelStat").textContent = "1";
  document.getElementById("snakeStatusStat").textContent = "Ready";
  document.getElementById("snakePausePill").classList.remove("show");
  document.getElementById("snakeHint").textContent  = "Toque/Arraste ou use WASD para começar!";
  let paused = false;

  /* ── helpers ────────────────────────────── */
  function freeCell(){
    let f, tries=0;
    do {
      f = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) };
      tries++;
    } while(tries<500 && (
      snake.some(s=>s.x===f.x&&s.y===f.y) ||
      walls.some(w=>w.x===f.x&&w.y===f.y) ||
      (food && food.x===f.x && food.y===f.y)
    ));
    return f;
  }

  function spawnFood(){ food = freeCell(); }

  function buildWalls(){
    walls = [];
    const count = Math.min(4 + (level-1)*3, 30);
    for(let i=0;i<count;i++){
      const w = freeCell();
      // avoid spawning on snake head neighbourhood
      if(Math.abs(w.x-snake[0].x)>3 || Math.abs(w.y-snake[0].y)>3) walls.push(w);
    }
  }

  function getSpeed(){
    // starts at 150ms, drops 8ms per level, floor 60ms
    return Math.max(60, 150 - (level-1)*8);
  }

  spawnFood();
  buildWalls();

  /* ── draw ───────────────────────────────── */
  const COLORS = {
    bg:     "#060608",
    grid:   "rgba(0,255,200,0.04)",
    head:   "#00ffc8",
    body1:  "#00d4a8",
    body2:  "#008866",
    food:   "#ff3c6e",
    bonus:  "#ffd700",
    wall:   "#5533aa",
    wallB:  "rgba(120,80,255,0.6)",
    death:  "#ff3c6e",
  };

  function drawRect(x,y,color,glow,alpha){
    ctx.save();
    if(alpha!==undefined) ctx.globalAlpha=alpha;
    ctx.shadowBlur   = glow||0;
    ctx.shadowColor  = color;
    ctx.fillStyle    = color;
    ctx.beginPath();
    ctx.roundRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2, 3);
    ctx.fill();
    ctx.restore();
  }

  function render(){
    /* background */
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    /* grid */
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth   = 0.5;
    for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); ctx.stroke(); }
    for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); ctx.stroke(); }

    /* walls */
    walls.forEach(w=>{
      drawRect(w.x,w.y,COLORS.wall,8);
      ctx.strokeStyle=COLORS.wallB; ctx.lineWidth=1;
      ctx.strokeRect(w.x*CELL+1,w.y*CELL+1,CELL-2,CELL-2);
    });

    /* food */
    if(food){
      const pulse = 0.7 + 0.3*Math.sin(Date.now()*0.006);
      drawRect(food.x,food.y,COLORS.food,12*pulse);
      ctx.fillStyle="#ff8888";
      ctx.beginPath(); ctx.arc(food.x*CELL+CELL/2, food.y*CELL+CELL/2, 3,0,Math.PI*2); ctx.fill();
    }

    /* bonus */
    if(bonus){
      const bp = 0.5+0.5*Math.sin(Date.now()*0.01);
      drawRect(bonus.x,bonus.y,COLORS.bonus,16*bp);
      ctx.font="bold 11px sans-serif"; ctx.textAlign="center"; ctx.fillStyle=COLORS.bonus;
      ctx.fillText("★", bonus.x*CELL+CELL/2, bonus.y*CELL+CELL-2);
    }

    /* snake – flash red if dead */
    const flashOn = dead && (flashTick%6)<3;
    snake.forEach((s,i)=>{
      if(dead){
        drawRect(s.x,s.y, flashOn?"#ff0000":"#440000", flashOn?20:4);
      } else {
        const t = i===0
          ? COLORS.head
          : `rgba(0,${Math.max(80,168-i*4)},${Math.max(40,120-i*3)},${Math.max(0.3,0.85-i/snake.length*0.5)})`;
        drawRect(s.x,s.y,t,i===0?14:0);
        /* eyes on head */
        if(i===0){
          ctx.fillStyle="#000";
          const ex = dir ? (dir.x===1?CELL-5 : dir.x===-1?3 : CELL/2-3) : CELL/2-3;
          const ey = dir ? (dir.y===1?CELL-5 : dir.y===-1?3 : CELL/2-3) : CELL/2-3;
          ctx.beginPath(); ctx.arc(s.x*CELL+ex,   s.y*CELL+ey,   2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.x*CELL+ex+4, s.y*CELL+ey,   2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle="#00ffcc";
          ctx.beginPath(); ctx.arc(s.x*CELL+ex+1, s.y*CELL+ey-1, 1,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.x*CELL+ex+5, s.y*CELL+ey-1, 1,0,Math.PI*2); ctx.fill();
        }
      }
    });

    /* HUD */
    ctx.shadowBlur=0;
    ctx.fillStyle="rgba(0,255,200,0.7)";
    ctx.font="bold 12px 'Orbitron',monospace"; ctx.textAlign="left";
    ctx.fillText("SCORE:"+pts, 6, 16);
    ctx.fillStyle="rgba(255,215,0,0.7)";
    ctx.textAlign="right";
    ctx.fillText("LVL "+level, canvas.width-6, 16);

    /* overlay screens */
    if(dead){
      flashTick++;
      if(flashTick>40){
        ctx.fillStyle="rgba(6,6,8,0.82)"; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle="#ff3c6e"; ctx.font="bold 28px 'Orbitron',monospace"; ctx.textAlign="center";
        ctx.shadowBlur=20; ctx.shadowColor="#ff3c6e";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2-18);
        ctx.shadowBlur=0;
        ctx.fillStyle="#00ffc8"; ctx.font="14px 'Orbitron',monospace";
        ctx.fillText("Score: "+pts+" · Level: "+level, canvas.width/2, canvas.height/2+12);
        ctx.fillStyle="rgba(0,255,200,0.45)"; ctx.font="11px 'Exo 2',sans-serif";
        ctx.fillText("Toque ou pressione qualquer tecla para jogar de novo", canvas.width/2, canvas.height/2+36);
      }
    } else if(!running){
      ctx.fillStyle="rgba(0,255,200,0.65)"; ctx.font="bold 14px 'Orbitron',monospace"; ctx.textAlign="center";
      ctx.shadowBlur=10; ctx.shadowColor="#00ffc8";
      ctx.fillText("READY?", canvas.width/2, canvas.height/2);
      ctx.shadowBlur=0;
    }
  }

  /* ── step ───────────────────────────────── */
  function step(){
    if(!running || dead) return;
    const d = nextDir || dir;
    if(!d) return;
    dir = d; nextDir = null;

    const head = snake[0];
    const nh   = { x:(head.x+d.x+COLS)%COLS, y:(head.y+d.y+ROWS)%ROWS };

    /* hit wall? */
    if(walls.some(w=>w.x===nh.x&&w.y===nh.y)){
      die(); return;
    }
    /* hit self? */
    if(snake.some(s=>s.x===nh.x&&s.y===nh.y)){
      die(); return;
    }

    snake.unshift(nh);

    /* eat food */
    if(food && nh.x===food.x && nh.y===food.y){
      pts += 10 * level;
      document.getElementById("snakeScore").textContent = pts;
      showScorePopup(10*level);
      spawnFood();
      /* level up every 5 foods */
      if(pts % (50*level) === 0){
        level++;
        document.getElementById("snakeLevelStat").textContent = String(level);
        document.getElementById("snakeHint").textContent="LEVEL "+level+"!";
        setTimeout(()=>{ document.getElementById("snakeHint").textContent=""; },1200);
        buildWalls();
        clearInterval(snakeInterval);
        snakeInterval = setInterval(step, getSpeed());
      }
      /* bonus food chance */
      if(!bonus && Math.random()<0.25){
        bonus = freeCell();
        bonusTimer = 80;
      }
    } else {
      snake.pop();
    }

    /* eat bonus */
    if(bonus && nh.x===bonus.x && nh.y===bonus.y){
      pts += 50 * level;
      document.getElementById("snakeScore").textContent = pts;
      showScorePopup(50*level);
      bonus = null;
    }

    /* bonus timeout */
    if(bonus){
      bonusTimer--;
      if(bonusTimer<=0) bonus=null;
    }

    render();
  }

  function die(){
    dead    = true;
    const newBest = setBest("snake", pts);
    updateGameBestLabels();
    document.getElementById("snakeStatusStat").textContent = newBest ? "Recorde!" : "Game Over";
    if(newBest) showNotification("🏆 Novo recorde no Snake: " + pts);
    if(currentUid && pts>0){ updateDoc(doc(db,"users",currentUid),{ score:increment(pts), bestSnake:Math.max(pts, Number(currentUser?.bestSnake||0)) }).then(()=>{ carregarRanking(); carregarPerfil(); }).catch(()=>{}); }
    checkAchievements();
    running = false;
    clearInterval(snakeInterval);
    document.getElementById("snakeHint").textContent="";
    flashTick=0;
    /* keep rendering for death animation */
    let deathRaf;
    function deathAnim(){
      render();
      if(flashTick<=60) deathRaf=requestAnimationFrame(deathAnim);
    }
    deathAnim();
  }

  function startRunning(nd){
    running=true; paused=false; dir=nd;
    document.getElementById("snakeStatusStat").textContent = "Jogando";
    document.getElementById("snakePausePill").classList.remove("show");
    document.getElementById("snakeHint").textContent="";
    clearInterval(snakeInterval);
    snakeInterval = setInterval(step, getSpeed());
  }

  /* ── keyboard ───────────────────────────── */
  const DIRS = {
    ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0},
    W:{x:0,y:-1},S:{x:0,y:1},A:{x:-1,y:0},D:{x:1,y:0},
  };
  const handleKey = (e)=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    const nd = DIRS[e.key];
    if(dead){ initSnake(); return; }
    if(!running && nd){ startRunning(nd); return; }
    if(nd && dir && !(nd.x===-dir.x && nd.y===-dir.y)) nextDir=nd;
  };
  document.addEventListener("keydown", handleKey);

  /* ── touch swipe ────────────────────────── */
  let tStart = null;
  canvas.addEventListener("touchstart", e=>{
    e.preventDefault();
    tStart = { x:e.touches[0].clientX, y:e.touches[0].clientY };
  }, {passive:false});
  canvas.addEventListener("touchend", e=>{
    e.preventDefault();
    if(!tStart) return;
    const dx=e.changedTouches[0].clientX-tStart.x, dy=e.changedTouches[0].clientY-tStart.y;
    tStart=null;
    if(Math.abs(dx)<8 && Math.abs(dy)<8){
      if(dead){ initSnake(); return; }
      return;
    }
    const nd = Math.abs(dx)>Math.abs(dy)
      ? (dx>0?{x:1,y:0}:{x:-1,y:0})
      : (dy>0?{x:0,y:1}:{x:0,y:-1});
    if(dead){ initSnake(); return; }
    if(!running){ startRunning(nd); return; }
    if(!(nd.x===-dir.x && nd.y===-dir.y)) nextDir=nd;
  }, {passive:false});

  snakePauseToggle = function(){
    if(dead) return;
    paused = !paused;
    document.getElementById("snakePausePill").classList.toggle("show", paused);
    document.getElementById("snakeStatusStat").textContent = paused ? "Pausado" : (running ? "Jogando" : "Ready");
    if(paused){ clearInterval(snakeInterval); }
    else if(running){ clearInterval(snakeInterval); snakeInterval = setInterval(step, getSpeed()); }
  };
  restartSnake = function(){ initSnake(); };
  window.snakePauseToggle = snakePauseToggle;
  window.restartSnake = restartSnake;
  const oldStep = step;
  snakeState = { cleanup(){ clearInterval(snakeInterval); document.removeEventListener("keydown",handleKey); window.snakePauseToggle=null; window.restartSnake=null; } };
  render();
}

// ===== FIGHT GAME - MORTAL SPIDER =====
let fightRAF  = null;
let fightState= null;
let fightKeys = {};
/* Unified button-state map (buttons + keyboard share same state) */
const fbState = {};   // "p1_left", "p1_right", "p1_jump", etc.
let fightDifficulty = localStorage.getItem("spider_fight_difficulty") || "hard";
window.setFightDifficulty = function(level){
  fightDifficulty = level;
  localStorage.setItem("spider_fight_difficulty", level);
  ["Normal","Hard","Nightmare"].forEach(n=>{
    const el=document.getElementById("fightDiff"+n);
    if(el) el.classList.toggle("active", level===n.toLowerCase() || (n==="Hard"&&level==="hard"));
  });
  if(fightState){ restartFight(); }
};

/* ── button handlers (HTML) ─────────────────────────────────── */
window.fbDown = function(e, player, action){
  e.preventDefault();
  fbState[player+"_"+action] = true;
};
window.fbUp = function(e, player, action){
  e.preventDefault();
  fbState[player+"_"+action] = false;
};

/* backward-compat stubs (used nowhere now but keep in case) */
window.p1Action   = ()=>{};
window.p2Action   = ()=>{};
window.p1StopMove = ()=>{};
window.p2StopMove = ()=>{};

window.toggleFight  = function(){
  const modal = document.getElementById("fightModal");
  if(modal.classList.contains("open")){ modal.classList.remove("open"); stopFight(); }
  else {
    window.spiderLoadingDelay("Preparando Mortal Spider...", ()=>{ modal.classList.add("open"); startFight(); }, "🥊", 340);
  }
};
window.restartFight = function(){ stopFight(); startFight(); };

function stopFight(){
  if(fightRAF) cancelAnimationFrame(fightRAF);
  fightRAF=null; fightState=null;
  document.removeEventListener("keydown", fightKeyDown);
  document.removeEventListener("keyup",   fightKeyUp);
  Object.keys(fbState).forEach(k=>{ fbState[k]=false; });
}

function fightKeyDown(e){
  fightKeys[e.key]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
}
function fightKeyUp(e){ fightKeys[e.key]=false; }

function readFightInput(){
  // P1: A/D move, W jump, E dash, F punch, G kick, H special, C block
  fbState.p1_left    = !!(fightKeys['a']||fightKeys['A']||fbState.p1_left);
  fbState.p1_right   = !!(fightKeys['d']||fightKeys['D']||fbState.p1_right);
  fbState.p1_jump    = !!(fightKeys['w']||fightKeys['W']||fbState.p1_jump);
  fbState.p1_dash    = !!(fightKeys['e']||fightKeys['E']||fbState.p1_dash);
  fbState.p1_punch   = !!(fightKeys['f']||fightKeys['F']||fbState.p1_punch);
  fbState.p1_kick    = !!(fightKeys['g']||fightKeys['G']||fbState.p1_kick);
  fbState.p1_special = !!(fightKeys['h']||fightKeys['H']||fbState.p1_special);
  fbState.p1_block   = !!(fightKeys['c']||fightKeys['C']||fbState.p1_block);
  // P2: arrows, Shift dash, J punch, K kick, L special, ; block
  fbState.p2_left    = !!(fightKeys['ArrowLeft'] ||fbState.p2_left);
  fbState.p2_right   = !!(fightKeys['ArrowRight']||fbState.p2_right);
  fbState.p2_jump    = !!(fightKeys['ArrowUp']   ||fbState.p2_jump);
  fbState.p2_dash    = !!(fightKeys['Shift']     ||fbState.p2_dash);
  fbState.p2_punch   = !!(fightKeys['j']||fightKeys['J']||fbState.p2_punch);
  fbState.p2_kick    = !!(fightKeys['k']||fightKeys['K']||fbState.p2_kick);
  fbState.p2_special = !!(fightKeys['l']||fightKeys['L']||fbState.p2_special);
  fbState.p2_block   = !!(fightKeys[';']||fightKeys[':']||fbState.p2_block);
}

function startFight(){
  const canvas = document.getElementById("fightCanvas");
  const ctx    = canvas.getContext("2d");
  const W=canvas.width, H=canvas.height;
  const GROUND = H - 44;

  // Highlight saved difficulty buttons.
  window.setFightDifficulty(fightDifficulty);

  document.removeEventListener("keydown", fightKeyDown);
  document.removeEventListener("keyup",   fightKeyUp);
  document.addEventListener("keydown", fightKeyDown);
  document.addEventListener("keyup",   fightKeyUp);
  Object.keys(fbState).forEach(k=>{ fbState[k]=false; });

  const AI = {
    normal:    { reaction:18, aggression:0.38, block:0.20, dash:0.10, error:0.25, speed:3.45, damage:0.92, timer:70 },
    hard:      { reaction:11, aggression:0.56, block:0.32, dash:0.18, error:0.12, speed:3.85, damage:1.00, timer:60 },
    nightmare: { reaction:7,  aggression:0.72, block:0.45, dash:0.28, error:0.05, speed:4.25, damage:1.10, timer:50 }
  }[fightDifficulty] || AI?.hard;

  const GRAVITY    = 0.68;
  const JUMP_VY    = -15.5;
  const MAX_SPEED  = 4.25;
  const ACCEL      = 0.85;
  const FRICTION   = 0.78;
  const DASH_SPEED = 10.5;
  const PUSH_FORCE = 6.8;
  const BEST_OF    = 2;
  const DMG        = { jab:5, punch:10, kick:15, special:28, chip:3 };
  const COST       = { punch:7, kick:12, special:45, dash:22, block:0.45 };
  const FRAME      = { punch:13, kick:18, special:24 };
  const RANGE      = { punch:58, kick:78, special:96 };
  const ACTIVE     = { punch:[4,8], kick:[6,11], special:[7,15] };
  const COOLDOWN   = { punch:9, kick:14, special:22 };

  let roundNum=1, p1Wins=0, p2Wins=0;
  let roundOver=false, roundOverTimer=0, matchOver=false;
  let roundStartTimer=84;
  let fightTimer = AI.timer*60;
  let particles=[], sparks=[], shockwaves=[];
  let screenShake=0, hitStop=0, bgTick=0;
  let aiTimer=0;

  function makePlayer(x, color, name, side, cpu=false){
    return {
      x, y:GROUND, vx:0, vy:0, color, name, side, cpu,
      hp:100, maxHp:100, sp:0, st:100, maxSt:100,
      onGround:true, coyote:0, jumpBuffer:0, dashCd:0, invuln:0,
      action:null, actionFrame:0, actionCooldown:0, hitCooldown:0, hitThisSwing:false,
      blocking:false, guard:100, guardBroken:0,
      comboCount:0, comboTimer:0, queuedAttack:null,
      frame:0, facingRight:side==='left', effects:[], lastHitBy:null
    };
  }

  let p1=makePlayer(82,'#00ffc8','P1','left',false);
  let p2=makePlayer(W-82,'#ff3c6e','CPU','right',true);
  fightState={players:[p1,p2]};

  function addEffect(p,text,color){ p.effects.push({text,x:p.x,y:p.y-58,life:34,color}); }
  function spawnParticles(x,y,color,count=8,power=1){
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2, s=(2+Math.random()*4)*power;
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,color,size:2+Math.random()*3,life:20+Math.random()*18});
    }
  }
  function spawnSparkLine(x,y,color){
    for(let i=0;i<10;i++) sparks.push({x,y,dx:(Math.random()*2-1)*35,dy:(Math.random()*2-1)*22,color,life:15+Math.random()*10});
  }

  function updateBars(){
    [["p1",p1],["p2",p2]].forEach(([id,p])=>{
      const hp=document.getElementById(id+'Hp'), hpNum=document.getElementById(id+'HpNum'), sp=document.getElementById(id+'Sp'), st=document.getElementById(id+'St');
      if(hp) hp.style.width=Math.max(0,p.hp/p.maxHp*100)+'%';
      if(hpNum) hpNum.textContent=Math.round(Math.max(0,p.hp));
      if(sp) sp.style.width=Math.max(0,Math.min(100,p.sp))+'%';
      if(st) st.style.width=Math.max(0,Math.min(100,p.st))+'%';
    });
  }

  function clearInput(pid){ ['left','right','jump','dash','punch','kick','special','block'].forEach(a=>fbState[pid+'_'+a]=false); }

  function cpuAI(){
    // reset one-tap actions so the CPU does not hold attacks forever
    ['punch','kick','special','dash','jump'].forEach(a=>fbState['p2_'+a]=false);
    if(roundOver||roundStartTimer>0||matchOver) return;
    aiTimer--;
    if(aiTimer>0) return;
    aiTimer = AI.reaction + Math.floor(Math.random()*7);
    if(Math.random()<AI.error){ clearInput('p2'); return; }

    const dist = p1.x-p2.x, abs=Math.abs(dist);
    const p1Attacking = !!p1.action || p1.queuedAttack;
    p2.facingRight = dist>0;

    fbState.p2_left=false; fbState.p2_right=false; fbState.p2_block=false;

    if(p2.guardBroken>0){ fbState.p2_left=dist>0; fbState.p2_right=dist<0; return; }

    if(p1Attacking && abs<92 && Math.random()<AI.block && p2.st>15){
      fbState.p2_block=true;
      if(Math.random()<AI.dash && p2.st>35){ fbState.p2_dash=true; fbState.p2_left=dist>0; fbState.p2_right=dist<0; }
      return;
    }
    if(abs>82){
      fbState.p2_left = dist<0; fbState.p2_right = dist>0;
      if(abs>140 && Math.random()<AI.dash && p2.st>35) fbState.p2_dash=true;
      return;
    }
    if(abs<34 && Math.random()<0.42){
      fbState.p2_left = dist>0; fbState.p2_right = dist<0;
      if(Math.random()<AI.dash && p2.st>35) fbState.p2_dash=true;
      return;
    }
    const r=Math.random();
    if(r<AI.aggression*0.28 && p2.sp>=60) fbState.p2_special=true;
    else if(r<AI.aggression*0.58) fbState.p2_kick=true;
    else if(r<AI.aggression) fbState.p2_punch=true;
    else if(r<AI.aggression+0.12 && p2.onGround) fbState.p2_jump=true;
  }

  function doAttack(p,type){
    if(p.action || p.actionCooldown>0 || p.guardBroken>0) { p.queuedAttack=type; return; }
    if(type==='special' && p.sp<55) return;
    if(p.st < COST[type]) return;
    p.st-=COST[type];
    if(type==='special') p.sp-=55;
    p.action=type; p.actionFrame=0; p.hitThisSwing=false; p.queuedAttack=null;
  }

  function applyInput(p,pid){
    const pre=pid+'_';
    if(roundOver||roundStartTimer>0||matchOver){ clearInput(pid); return; }

    if(fbState[pre+'jump']){ p.jumpBuffer=7; fbState[pre+'jump']=false; }
    if(fbState[pre+'punch']){ doAttack(p,'punch'); fbState[pre+'punch']=false; }
    if(fbState[pre+'kick']){ doAttack(p,'kick'); fbState[pre+'kick']=false; }
    if(fbState[pre+'special']){ doAttack(p,'special'); fbState[pre+'special']=false; }

    const wantsBlock = !!fbState[pre+'block'] && !p.action && p.st>5 && p.guardBroken<=0;
    p.blocking=wantsBlock;
    if(p.blocking){ p.st=Math.max(0,p.st-COST.block); }

    if(fbState[pre+'left'] && !p.blocking) p.vx = Math.max(p.vx-ACCEL, -MAX_SPEED*(p.cpu?AI.speed/MAX_SPEED:1));
    else if(fbState[pre+'right'] && !p.blocking) p.vx = Math.min(p.vx+ACCEL, MAX_SPEED*(p.cpu?AI.speed/MAX_SPEED:1));
    else p.vx*=FRICTION;

    if(fbState[pre+'dash'] && p.dashCd<=0 && p.st>=COST.dash && !p.blocking){
      const dir = fbState[pre+'left']?-1:fbState[pre+'right']?1:(p.facingRight?1:-1);
      p.vx = dir*DASH_SPEED; p.st-=COST.dash; p.dashCd=34; p.invuln=7; fbState[pre+'dash']=false;
      shockwaves.push({x:p.x,y:p.y-18,r:4,life:14,color:p.color});
    }

    if(p.jumpBuffer>0 && (p.onGround||p.coyote>0) && !p.blocking){
      p.vy=JUMP_VY; p.onGround=false; p.coyote=0; p.jumpBuffer=0;
    }
  }

  function resolveAttacks(){
    [[p1,p2],[p2,p1]].forEach(([atk,def])=>{
      if(!atk.action || atk.hitThisSwing) return;
      const [as,ae]=ACTIVE[atk.action];
      if(atk.actionFrame<as || atk.actionFrame>ae) return;
      const dist=Math.abs(atk.x-def.x);
      const yOk=Math.abs((atk.y-35)-(def.y-35))<54;
      if(dist>RANGE[atk.action] || !yOk || def.invuln>0) return;
      atk.hitThisSwing=true;

      const dir=def.x>atk.x?1:-1;
      const isBlocked=def.blocking && atk.action!=='special' && def.guardBroken<=0;
      if(isBlocked){
        def.guard=Math.max(0,def.guard-(atk.action==='kick'?24:15));
        const chip=DMG.chip;
        def.hp=Math.max(0,def.hp-chip);
        def.vx=dir*PUSH_FORCE*0.35;
        atk.vx-=dir*1.6;
        addEffect(def,'-'+chip+' GUARD','#b9d7ff');
        spawnParticles(def.x,def.y-34,'#b9d7ff',5,0.75); screenShake=Math.max(screenShake,2); hitStop=3;
        if(def.guard<=0){ def.guardBroken=70; def.blocking=false; addEffect(def,'GUARD BREAK!','#ffd700'); screenShake=8; hitStop=8; }
      } else if(def.hitCooldown<=0){
        let dmg=DMG[atk.action]*(def.cpu?1:AI.damage);
        atk.comboCount=(atk.comboTimer>0)?atk.comboCount+1:1;
        atk.comboTimer=46;
        if(atk.comboCount>1) dmg*=1+Math.min(0.55,atk.comboCount*0.12);
        dmg=Math.floor(dmg);
        def.hp=Math.max(0,def.hp-dmg);
        def.hitCooldown=18; def.lastHitBy=atk;
        def.vx=dir*(PUSH_FORCE+(atk.action==='special'?3:0));
        if(atk.action==='special'){ def.vy=-9; def.onGround=false; shockwaves.push({x:def.x,y:def.y-30,r:8,life:22,color:atk.color}); }
        else if(atk.action==='kick'){ def.vy=-4; }
        atk.sp=Math.min(100, atk.sp+(atk.action==='punch'?10:14));
        const icon={punch:'👊',kick:'🦵',special:'⚡'}[atk.action];
        addEffect(def,'-'+dmg+icon+(atk.comboCount>1?' x'+atk.comboCount:''),atk.color);
        spawnParticles(def.x,def.y-35,atk.color,atk.action==='special'?18:10,atk.action==='special'?1.4:1);
        spawnSparkLine(def.x,def.y-34,atk.color);
        screenShake=Math.max(screenShake,atk.action==='special'?11:5); hitStop=atk.action==='special'?8:4;
      }
      updateBars();
    });
  }

  function drawBG(){
    bgTick++;
    const sx=(Math.random()*2-1)*screenShake, sy=(Math.random()*2-1)*screenShake;
    ctx.save(); ctx.translate(sx,sy);
    const sky=ctx.createLinearGradient(0,0,0,GROUND);
    sky.addColorStop(0,'#07000d'); sky.addColorStop(.55,'#150328'); sky.addColorStop(1,'#260b38');
    ctx.fillStyle=sky; ctx.fillRect(-20,-20,W+40,H+40);
    for(let i=0;i<12;i++){
      const x=(i*47+bgTick*0.7)%W;
      ctx.fillStyle=i%2?'rgba(0,255,200,0.055)':'rgba(255,60,110,0.055)';
      ctx.fillRect(x,30+(i%4)*22,2,85);
    }
    ctx.fillStyle='#180720'; ctx.fillRect(0,GROUND,W,H-GROUND);
    for(let i=0;i<W;i+=34){ ctx.fillStyle=i%68?'rgba(255,255,255,0.035)':'rgba(0,255,200,0.07)'; ctx.fillRect(i,GROUND,33,H-GROUND); }
    ctx.fillStyle='rgba(0,255,200,0.35)'; ctx.fillRect(0,GROUND,W,2);
    ctx.save(); ctx.globalAlpha=.05; ctx.fillStyle='#ff3c6e'; ctx.font="bold 62px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('MORTAL',W/2,116); ctx.fillText('SPIDER',W/2,176); ctx.restore();
    ctx.restore();
    screenShake*=0.72;

    if(!roundOver && roundStartTimer<=0 && !matchOver){
      const tRatio=fightTimer/(AI.timer*60);
      ctx.fillStyle=tRatio>.45?'#00ffc8':tRatio>.22?'#ffd700':'#ff3c6e';
      ctx.fillRect(W*.3,4,W*.4*Math.max(0,tRatio),4);
      const secs=Math.ceil(fightTimer/60);
      const timerEl=document.getElementById('fightTimerDisplay');
      if(timerEl){ timerEl.textContent=secs; timerEl.style.color=tRatio>.45?'var(--gold)':tRatio>.22?'#ffa500':'#ff3c6e'; }
    }
  }

  function drawFighter(p){
    const x=Math.round(p.x), y=Math.round(p.y), fl=!p.facingRight;
    const flash=p.hitCooldown>0 && p.hitCooldown%4<2;
    const col=flash?'#fff':p.color;
    ctx.save(); if(fl){ ctx.translate(x*2,0); ctx.scale(-1,1); }
    ctx.fillStyle='rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(x,GROUND+4,22,6,0,0,Math.PI*2); ctx.fill();
    const limp=p.onGround?Math.sin(p.frame*.32)*8:0;
    ctx.lineCap='round'; ctx.lineWidth=5; ctx.strokeStyle=col; ctx.shadowBlur=8; ctx.shadowColor=col;
    ctx.beginPath(); ctx.moveTo(x,y-15); ctx.lineTo(x-12,y+limp); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y-15); ctx.lineTo(x+12,y-limp); ctx.stroke();
    if(p.action==='kick') { const pr=Math.sin((p.actionFrame/FRAME.kick)*Math.PI); ctx.beginPath(); ctx.moveTo(x+8,y-15); ctx.lineTo(x+28+18*pr,y-20-12*pr); ctx.stroke(); }
    ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(x-13,y-47,26,32,5); ctx.fill();
    const atk=p.action, prog=atk?Math.sin((p.actionFrame/FRAME[atk])*Math.PI):0, arm=atk?18+28*prog:16;
    ctx.beginPath(); ctx.moveTo(x-12,y-38); ctx.lineTo(x-18,y-30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+12,y-38); ctx.lineTo(x+arm,y-33); ctx.stroke();
    if(p.blocking){ ctx.shadowBlur=15; ctx.strokeStyle='rgba(185,215,255,.9)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(x+21,y-31,19,-1.05,1.05); ctx.stroke(); }
    if(p.guardBroken>0){ ctx.fillStyle='#ffd700'; ctx.font="bold 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('BREAK',x,y-82); }
    ctx.shadowBlur=10; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y-58,14,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle='rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(x-10,y-64,20,10,3); ctx.fill();
    ctx.shadowBlur=9; ctx.shadowColor='#ff3c6e'; ctx.fillStyle='#ff3c6e'; ctx.beginPath(); ctx.arc(x+5,y-59,3,0,Math.PI*2); ctx.arc(x-5,y-59,3,0,Math.PI*2); ctx.fill();
    if(p.invuln>0){ ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y-38,27,0,Math.PI*2); ctx.stroke(); }
    if(p.sp>=55){ ctx.strokeStyle='rgba(255,215,0,.85)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y-44,28+Math.sin(bgTick*.2)*3,0,Math.PI*2); ctx.stroke(); }
    ctx.shadowBlur=0; ctx.fillStyle=p.color; ctx.font="bold 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(p.name,x,y-76);
    if(p.comboCount>1 && p.comboTimer>0){ ctx.fillStyle='#ffd700'; ctx.font="bold 12px 'Orbitron',monospace"; ctx.fillText(p.comboCount+'x COMBO',x,y-91); }
    ctx.restore();
    p.effects.forEach(ef=>{ ctx.save(); ctx.globalAlpha=ef.life/34; ctx.fillStyle=ef.color; ctx.shadowBlur=8; ctx.shadowColor=ef.color; ctx.font="bold 14px 'Exo 2',sans-serif"; ctx.textAlign='center'; ctx.fillText(ef.text,ef.x,ef.y); ctx.restore(); ef.y-=.95; ef.life--; });
    p.effects=p.effects.filter(e=>e.life>0);
  }

  function drawFX(){
    particles.forEach(p=>{ ctx.save(); ctx.globalAlpha=p.life/35; ctx.fillStyle=p.color; ctx.shadowBlur=6; ctx.shadowColor=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore(); p.x+=p.vx; p.y+=p.vy; p.vy+=.28; p.life--; p.size*=.95; });
    particles=particles.filter(p=>p.life>0);
    sparks.forEach(s=>{ ctx.save(); ctx.globalAlpha=s.life/25; ctx.strokeStyle=s.color; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x+s.dx*(1-s.life/25),s.y+s.dy*(1-s.life/25)); ctx.stroke(); ctx.restore(); s.life--; });
    sparks=sparks.filter(s=>s.life>0);
    shockwaves.forEach(w=>{ ctx.save(); ctx.globalAlpha=w.life/22; ctx.strokeStyle=w.color; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(w.x,w.y,w.r,0,Math.PI*2); ctx.stroke(); ctx.restore(); w.r+=3.5; w.life--; });
    shockwaves=shockwaves.filter(w=>w.life>0);
  }

  function resetRound(){
    p1=makePlayer(82,'#00ffc8','P1','left',false);
    p2=makePlayer(W-82,'#ff3c6e','CPU','right',true);
    fightState.players=[p1,p2];
    roundOver=false; roundOverTimer=0; roundStartTimer=84; fightTimer=AI.timer*60; particles=[]; sparks=[]; shockwaves=[]; aiTimer=0;
    clearInput('p1'); clearInput('p2'); updateBars();
    document.getElementById('fightRoundLabel').textContent='ROUND '+roundNum;
    const st=document.getElementById('fightStatus'); st.textContent=p1Wins+' - '+p2Wins; st.style.color='';
  }

  function matchWin(winner){
    matchOver=true; roundOver=true; roundOverTimer=999999;
    const st=document.getElementById('fightStatus');
    st.textContent = winner===p1 ? 'P1 CAMPEÃO!' : 'CPU CAMPEÃO!';
    st.style.color = winner.color;
    if(winner===p1){
      const wins=Number(localStorage.getItem('spider_fight_wins')||0)+1;
      localStorage.setItem('spider_fight_wins',String(wins));
      unlockAchievement('fighter_win');
      if(currentUid){ updateDoc(doc(db,'users',currentUid),{ fightWins:increment(1), score:increment(160) }).then(()=>{ carregarRanking(); carregarPerfil(); }).catch(()=>{}); }
    }
  }

  function doRoundOver(winner){
    if(roundOver||matchOver) return;
    roundOver=true; winner===p1?p1Wins++:p2Wins++;
    const st=document.getElementById('fightStatus'); st.textContent=winner.name+' venceu o round'; st.style.color=winner.color;
    spawnParticles(winner.x,winner.y-35,winner.color,22,1.35); shockwaves.push({x:winner.x,y:winner.y-35,r:10,life:24,color:winner.color});
    if(p1Wins>=BEST_OF || p2Wins>=BEST_OF){ matchWin(winner); }
    else { roundOverTimer=155; roundNum++; }
  }

  function stepPlayer(p){
    if(hitStop>0) return;
    p.jumpBuffer=Math.max(0,p.jumpBuffer-1);
    p.dashCd=Math.max(0,p.dashCd-1);
    p.invuln=Math.max(0,p.invuln-1);
    p.guardBroken=Math.max(0,p.guardBroken-1);
    if(!p.blocking && !p.action) p.st=Math.min(100,p.st+0.55+(p.onGround?0.18:0));
    if(!p.blocking) p.guard=Math.min(100,p.guard+0.35);
    p.vy+=GRAVITY; p.y+=p.vy; p.x+=p.vx;
    if(p.y>=GROUND){ p.y=GROUND; p.vy=0; if(!p.onGround){ p.onGround=true; } p.coyote=6; }
    else { p.onGround=false; p.coyote=Math.max(0,p.coyote-1); }
    p.x=Math.max(22,Math.min(W-22,p.x));
    const opp=p===p1?p2:p1; if(!p.action) p.facingRight=opp.x>p.x;
    if(p.action){ p.actionFrame++; if(p.actionFrame>=FRAME[p.action]){ p.action=null; p.actionFrame=0; p.actionCooldown=COOLDOWN[p.action]||8; if(p.queuedAttack) { const q=p.queuedAttack; p.queuedAttack=null; doAttack(p,q); } } }
    p.actionCooldown=Math.max(0,p.actionCooldown-1); p.hitCooldown=Math.max(0,p.hitCooldown-1); p.comboTimer=Math.max(0,p.comboTimer-1); p.frame++;
  }

  function loop(){
    fightRAF=requestAnimationFrame(loop);
    if(!fightState) return;
    ctx.clearRect(0,0,W,H); drawBG();

    if(roundStartTimer>0){
      roundStartTimer--; drawFighter(p1); drawFighter(p2); drawFX();
      ctx.fillStyle='rgba(0,0,0,.52)'; ctx.fillRect(0,0,W,H);
      ctx.shadowBlur=22; ctx.shadowColor='#ffd700'; ctx.fillStyle='#ffd700'; ctx.font="bold 42px 'Orbitron',monospace"; ctx.textAlign='center';
      ctx.fillText(roundStartTimer>28?String(Math.ceil(roundStartTimer/28)):'FIGHT!',W/2,H/2+13); ctx.shadowBlur=0; return;
    }
    if(matchOver){
      drawFighter(p1); drawFighter(p2); drawFX(); ctx.fillStyle='rgba(0,0,0,.68)'; ctx.fillRect(0,0,W,H);
      const winner=p1Wins>p2Wins?p1:p2; ctx.shadowBlur=24; ctx.shadowColor=winner.color; ctx.fillStyle=winner.color; ctx.font="bold 32px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(winner===p1?'VITÓRIA!':'DERROTA!',W/2,H/2-18);
      ctx.shadowBlur=0; ctx.fillStyle='#ffd700'; ctx.font="bold 14px 'Orbitron',monospace"; ctx.fillText('PLACAR '+p1Wins+' - '+p2Wins,W/2,H/2+12); ctx.fillStyle='#e8e8f0'; ctx.font="12px 'Exo 2',sans-serif"; ctx.fillText('aperte 🔄 para revanche',W/2,H/2+34); return;
    }
    if(roundOver){
      drawFighter(p1); drawFighter(p2); drawFX(); ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,H);
      const winner=(p1.hp>p2.hp)?p1:p2; ctx.shadowBlur=18; ctx.shadowColor=winner.color; ctx.fillStyle=winner.color; ctx.font="bold 30px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(winner.name+' WINS!',W/2,H/2-10);
      ctx.shadowBlur=0; ctx.fillStyle='#ffd700'; ctx.font="bold 15px 'Orbitron',monospace"; ctx.fillText('P1 '+p1Wins+' — CPU '+p2Wins,W/2,H/2+22);
      roundOverTimer--; if(roundOverTimer<=0) resetRound(); return;
    }

    readFightInput(); cpuAI(); applyInput(p1,'p1'); applyInput(p2,'p2');
    if(hitStop>0){ hitStop--; } else { fightTimer--; }
    if(fightTimer<=0) doRoundOver(p1.hp>=p2.hp?p1:p2);
    stepPlayer(p1); stepPlayer(p2); resolveAttacks();
    drawFighter(p1); drawFighter(p2); drawFX(); updateBars();
    if(p1.hp<=0 || p2.hp<=0) doRoundOver(p1.hp<=0?p2:p1);
  }

  const st=document.getElementById('fightStatus'); st.textContent='0 - 0'; st.style.color='';
  document.getElementById('fightRoundLabel').textContent='ROUND 1';
  updateBars(); loop();
}


// ===== MORTAL SPIDER V3 - override de jogabilidade/personagens =====
function startFight(){
  const canvas = document.getElementById("fightCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const GROUND = 205;
  const GRAV = 0.72;
  const BEST_OF = 2;
  let t = 0, hitStop = 0, shake = 0;
  let round = 1, p1Rounds = 0, p2Rounds = 0;
  let roundIntro = 90, roundOver = false, matchOver = false, roundOverTimer = 0;
  let fightTimer = 99 * 60;
  let particles = [], texts = [], trails = [];
  const DIFF = {
    normal:{speed:2.05, react:22, aggression:.50, block:.18, special:.18, timer:99},
    hard:{speed:2.35, react:15, aggression:.66, block:.28, special:.25, timer:90},
    nightmare:{speed:2.65, react:10, aggression:.82, block:.38, special:.34, timer:80}
  }[fightDifficulty] || {speed:2.35, react:15, aggression:.66, block:.28, special:.25, timer:90};
  fightTimer = DIFF.timer * 60;

  window.setFightDifficulty(fightDifficulty);
  document.removeEventListener("keydown", fightKeyDown);
  document.removeEventListener("keyup", fightKeyUp);
  document.addEventListener("keydown", fightKeyDown);
  document.addEventListener("keyup", fightKeyUp);

  function makePlayer(x, color, accent, name, cpu=false){
    return {x,y:GROUND,vx:0,vy:0,w:32,h:72,color,accent,name,cpu,face:1,hp:100,sp:10,st:100,guard:100,onGround:true,coyote:0,
      action:null,af:0,cool:0,hitDone:false,block:false,guardBreak:0,inv:0,dashCd:0,combo:0,comboT:0,aiT:0,aiIntent:"idle",lastHit:0,walkFrame:0};
  }
  let p1 = makePlayer(86,"#00ffc8","#64ff8f","SPIDER",false);
  let p2 = makePlayer(W-86,"#ff3c6e","#9b5cff","VENOM",true); p2.face = -1;
  fightState = {players:[p1,p2]};

  function clearBtns(prefix){ ["left","right","jump","dash","punch","kick","special","block"].forEach(a=>fbState[prefix+"_"+a]=false); }
  function syncBtnVisual(){
    document.querySelectorAll('.fight-btn').forEach(b=>b.classList.remove('pressed'));
    const map = {left:'l', right:'r', jump:'j'};
    for(const k in fbState){
      if(!fbState[k]) continue;
      const m=k.match(/^(p[12])_(.+)$/); if(!m) continue;
      const id = `fb-${m[1]}-${map[m[2]]||m[2]}`;
      const el = document.getElementById(id); if(el) el.classList.add('pressed');
    }
  }
  function readInput(){
    fbState.p1_left    = !!(fightKeys.a||fightKeys.A||fbState.p1_left);
    fbState.p1_right   = !!(fightKeys.d||fightKeys.D||fbState.p1_right);
    fbState.p1_jump    = !!(fightKeys.w||fightKeys.W||fbState.p1_jump);
    fbState.p1_dash    = !!(fightKeys.e||fightKeys.E||fbState.p1_dash);
    fbState.p1_block   = !!(fightKeys.c||fightKeys.C||fightKeys.s||fightKeys.S||fbState.p1_block);
    fbState.p1_punch   = !!(fightKeys.f||fightKeys.F||fbState.p1_punch);
    fbState.p1_kick    = !!(fightKeys.g||fightKeys.G||fbState.p1_kick);
    fbState.p1_special = !!(fightKeys.h||fightKeys.H||fightKeys[' ']||fbState.p1_special);
    fbState.p2_left    = !!(fightKeys.ArrowLeft || fbState.p2_left);
    fbState.p2_right   = !!(fightKeys.ArrowRight|| fbState.p2_right);
    fbState.p2_jump    = !!(fightKeys.ArrowUp   || fbState.p2_jump);
    fbState.p2_block   = !!(fightKeys.ArrowDown || fbState.p2_block);
    fbState.p2_dash    = !!(fightKeys.Shift     || fbState.p2_dash);
    fbState.p2_punch   = !!(fightKeys.j||fightKeys.J||fbState.p2_punch);
    fbState.p2_kick    = !!(fightKeys.k||fightKeys.K||fbState.p2_kick);
    fbState.p2_special = !!(fightKeys.l||fightKeys.L||fbState.p2_special);
    syncBtnVisual();
  }
  function consume(prefix, action){ const k=prefix+"_"+action; if(fbState[k]){ fbState[k]=false; return true; } return false; }
  function vibrate(ms=12){ try{ navigator.vibrate && navigator.vibrate(ms); }catch{} }
  function status(txt,col){ const s=document.getElementById('fightStatus'); if(s){ s.textContent=txt; if(col) s.style.color=col; } }
  function text(txt,x,y,col){ texts.push({txt,x,y,col,life:42}); }
  function burst(x,y,col,n=10,pow=1){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, v=(1+Math.random()*2.7)*pow; particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1,size:2+Math.random()*3,life:22+Math.random()*18,col}); } }
  function startAction(p,type){
    if(p.action || p.cool>0 || p.guardBreak>0) return false;
    const spec={punch:{st:10,frames:20},kick:{st:18,frames:28},special:{st:35,sp:100,frames:42},dash:{st:20,frames:12},block:{st:0,frames:1}}[type];
    if(!spec) return false;
    if(p.st < spec.st || (spec.sp && p.sp < spec.sp)) return false;
    if(type==='special' && p.sp < 100) { text('SEM SP',p.x,p.y-86,'#ffd700'); return false; }
    if(type==='dash' && p.dashCd>0) return false;
    if(type==='block'){ p.block=true; return true; }
    p.st -= spec.st; if(spec.sp) p.sp = 0;
    p.action = type; p.af = 0; p.hitDone = false; p.cool = type==='punch'?5:type==='kick'?9:14;
    if(type==='dash'){
      p.dashCd=34; p.inv=8; p.vx = p.face * 7.2; trails.push({x:p.x,y:p.y,col:p.color,life:14}); vibrate(8);
    }
    if(type==='special'){ burst(p.x,p.y-34,p.color,18,0.9); shake=4; vibrate(22); }
    return true;
  }
  function applyInput(p,prefix){
    p.block = false;
    const left = fbState[prefix+'_left'], right = fbState[prefix+'_right'];
    const opp = p===p1?p2:p1;
    if(!p.action || p.action==='dash'){
      let dir = (right?1:0)-(left?1:0);
      const max = p.cpu?DIFF.speed:2.6;
      p.vx += dir * 0.68;
      p.vx *= p.onGround ? 0.78 : 0.92;
      if(dir!==0){ p.face = dir; p.walkFrame += .22; }
      p.vx = Math.max(-max,Math.min(max,p.vx));
    } else p.vx *= .86;
    if((consume(prefix,'jump')) && (p.onGround || p.coyote>0)){ p.vy=-10.5; p.onGround=false; p.coyote=0; vibrate(7); }
    if(fbState[prefix+'_block'] && p.st>8 && !p.action){ startAction(p,'block'); p.st-=.32; }
    if(consume(prefix,'dash')) startAction(p,'dash');
    if(consume(prefix,'punch')) startAction(p,'punch');
    if(consume(prefix,'kick')) startAction(p,'kick');
    if(consume(prefix,'special')) startAction(p,'special');
    if(!p.action && !p.block) p.face = opp.x>p.x?1:-1;
  }
  function cpuAI(){
    p2.aiT--;
    if(p2.aiT>0) return;
    clearBtns('p2');
    const d = p1.x-p2.x, ad=Math.abs(d), close=ad<54, mid=ad<112;
    p2.aiT = Math.max(5, Math.floor(DIFF.react + Math.random()*12));
    if(p2.hp<32 && Math.random()<.16){ fbState.p2_block=true; return; }
    if(p1.action && Math.random()<DIFF.block){ fbState.p2_block=true; return; }
    if(!close){ fbState[d>0?'p2_right':'p2_left']=true; if(Math.random()<.14) fbState.p2_dash=true; }
    if(mid && Math.random()<.20) fbState[d>0?'p2_left':'p2_right']=true;
    if(close && Math.random()<DIFF.aggression){ fbState[Math.random()<.62?'p2_punch':'p2_kick']=true; }
    if(mid && p2.sp>=100 && Math.random()<DIFF.special){ fbState.p2_special=true; }
    if(Math.random()<.045 && p2.onGround) fbState.p2_jump=true;
  }
  function step(p){
    if(hitStop>0) return;
    p.coyote = p.onGround ? 6 : Math.max(0,p.coyote-1);
    p.inv=Math.max(0,p.inv-1); p.cool=Math.max(0,p.cool-1); p.dashCd=Math.max(0,p.dashCd-1); p.guardBreak=Math.max(0,p.guardBreak-1);
    p.comboT=Math.max(0,p.comboT-1); if(p.comboT<=0) p.combo=0;
    p.vy += GRAV; p.y += p.vy; p.x += p.vx;
    if(p.y>=GROUND){ p.y=GROUND; p.vy=0; p.onGround=true; } else p.onGround=false;
    p.x = Math.max(24,Math.min(W-24,p.x));
    if(!p.block) p.guard = Math.min(100,p.guard+0.32);
    if(!p.action && !p.block) p.st = Math.min(100,p.st+0.95);
    p.sp = Math.min(100,p.sp+0.035);
    if(p.action){ p.af++; const max={punch:20,kick:28,special:42,dash:12}[p.action]||1; if(p.af>=max){ p.action=null; p.af=0; p.hitDone=false; } }
  }
  function hitSpec(type){
    return type==='punch'?{dmg:8,range:52,from:6,to:12,knock:4,stun:6,col:'#00ffc8'}:
           type==='kick'?{dmg:13,range:66,from:9,to:16,knock:6,stun:8,col:'#ff7a3c'}:
           type==='special'?{dmg:25,range:86,from:14,to:26,knock:10,stun:13,col:'#ffd700'}:null;
  }
  function resolveHits(att,def){
    if(!att.action || att.hitDone || att.action==='dash') return;
    const s=hitSpec(att.action); if(!s || att.af<s.from || att.af>s.to) return;
    const dx=def.x-att.x, ad=Math.abs(dx), vertical=Math.abs((def.y-36)-(att.y-36));
    if(ad>s.range || vertical>58) return;
    att.hitDone=true;
    if(def.inv>0) return;
    let blocked = def.block && Math.sign(dx || att.face) !== def.face && def.guardBreak<=0;
    let dmg=s.dmg;
    if(blocked){
      dmg=Math.ceil(dmg*.25); def.guard-=s.dmg*2.2; text('BLOCK',def.x,def.y-84,'#bfe8ff'); burst(def.x,def.y-42,'#bfe8ff',6,.5); hitStop=3;
      if(def.guard<=0){ def.guardBreak=78; def.guard=30; text('GUARDA QUEBRADA',def.x,def.y-98,'#ffd700'); dmg+=7; blocked=false; shake=7; }
    } else {
      att.combo++; att.comboT=90; att.sp=Math.min(100,att.sp+8+(att.combo*1.2)); hitStop=s.stun; shake=att.action==='special'?10:5; vibrate(att.action==='special'?35:15);
      text(att.combo>1?att.combo+'x':'HIT',def.x,def.y-91,s.col); burst(def.x,def.y-42,s.col,att.action==='special'?22:12,att.action==='special'?1.5:1);
    }
    def.hp=Math.max(0,def.hp-dmg); def.vx = Math.sign(dx || att.face)*s.knock; def.vy = Math.min(def.vy,-2.6); def.lastHit=18;
    if(def.hp<=0) endRound(att);
  }
  function endRound(winner){
    if(roundOver||matchOver) return;
    roundOver=true; roundOverTimer=140; winner===p1?p1Rounds++:p2Rounds++; status(winner.name+' venceu', winner.color); burst(winner.x,winner.y-45,winner.color,28,1.4);
    if(p1Rounds>=BEST_OF || p2Rounds>=BEST_OF){
      matchOver=true; roundOverTimer=99999;
      status(winner===p1?'P1 CAMPEÃO':'CPU CAMPEÃO', winner.color);
      if(winner===p1){
        const wins=Number(localStorage.getItem('spider_fight_wins')||0)+1;
        localStorage.setItem('spider_fight_wins',String(wins));
        try{ unlockAchievement('fighter_win'); }catch{}
        if(currentUid){ updateDoc(doc(db,'users',currentUid),{ fightWins:increment(1), score:increment(160) }).then(()=>{ carregarRanking(); carregarPerfil(); }).catch(()=>{}); }
      }
    }
  }
  function nextRound(){
    round++; roundIntro=90; roundOver=false; fightTimer=DIFF.timer*60; particles=[]; texts=[]; trails=[];
    p1 = makePlayer(86,"#00ffc8","#64ff8f","SPIDER",false);
    p2 = makePlayer(W-86,"#ff3c6e","#9b5cff","VENOM",true); p2.face=-1;
    fightState.players=[p1,p2]; clearBtns('p1'); clearBtns('p2');
    document.getElementById('fightRoundLabel').textContent='ROUND '+round; status(p1Rounds+' - '+p2Rounds,''); updateBars();
  }
  function updateBars(){
    const set=(id,val)=>{ const e=document.getElementById(id); if(e) e.style.width=Math.max(0,Math.min(100,val))+'%'; };
    set('p1Hp',p1.hp); set('p2Hp',p2.hp); set('p1Sp',p1.sp); set('p2Sp',p2.sp); set('p1St',p1.st); set('p2St',p2.st);
    const p1n=document.getElementById('p1HpNum'), p2n=document.getElementById('p2HpNum'); if(p1n) p1n.textContent=Math.ceil(p1.hp); if(p2n) p2n.textContent=Math.ceil(p2.hp);
    const tm=document.getElementById('fightTimerDisplay'); if(tm){ tm.textContent=Math.max(0,Math.ceil(fightTimer/60)); tm.style.color=fightTimer<15*60?'#ff3c6e':'#ffd700'; }
  }
  function drawBG(){
    const sx=shake? (Math.random()-.5)*shake:0, sy=shake? (Math.random()-.5)*shake:0; ctx.setTransform(1,0,0,1,sx,sy); shake*=.84; if(shake<.2) shake=0;
    ctx.fillStyle='#050509'; ctx.fillRect(-10,-10,W+20,H+20);
    const grd=ctx.createLinearGradient(0,0,0,H); grd.addColorStop(0,'rgba(0,255,200,.09)'); grd.addColorStop(.55,'rgba(255,60,110,.035)'); grd.addColorStop(1,'rgba(0,0,0,.78)'); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(0,255,200,.10)'; ctx.lineWidth=1;
    for(let x=(t*.35)%34; x<W; x+=34){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x-58,H); ctx.stroke(); }
    for(let y=38; y<GROUND; y+=32){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,GROUND+2,W,H-GROUND);
    ctx.strokeStyle='rgba(0,255,200,.55)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,GROUND+2); ctx.lineTo(W,GROUND+2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.08)'; ctx.font="bold 12px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('SPIDER ARENA',W/2,25);
  }
  function limb(ctx,x1,y1,x2,y2,col,w=5){ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
  function drawFighter(p){
    const x=p.x,y=p.y, f=p.face, bob=Math.sin(t*.16+p.x*.03)*2, walk=Math.sin(p.walkFrame)*5;
    const hurt=p.lastHit>0; p.lastHit=Math.max(0,p.lastHit-1);
    ctx.save(); if(hurt) ctx.globalAlpha=.72+Math.sin(t)*.18;
    const body=p.color, glow=p.accent;
    // shadow
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x,y+7,30,8,0,0,Math.PI*2); ctx.fill();
    if(p.action==='dash' || p.sp>=100){ ctx.shadowBlur=18; ctx.shadowColor=p.color; ctx.strokeStyle=p.sp>=100?'rgba(255,215,0,.75)':p.color; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y-42,32+Math.sin(t*.2)*3,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0; }
    // legs
    limb(ctx,x-9,y-22,x-16+walk*.25,y,p.color,6); limb(ctx,x+9,y-22,x+16-walk*.25,y,p.color,6);
    limb(ctx,x-16+walk*.25,y,x-21+walk*.20,y+7,p.accent,5); limb(ctx,x+16-walk*.25,y,x+21-walk*.20,y+7,p.accent,5);
    // torso armor
    ctx.shadowBlur=16; ctx.shadowColor=p.color; ctx.fillStyle=body; ctx.beginPath(); ctx.roundRect(x-17,y-61+bob,34,43,9); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle='rgba(0,0,0,.46)'; ctx.beginPath(); ctx.roundRect(x-10,y-56+bob,20,30,6); ctx.fill();
    ctx.strokeStyle=p.accent; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-10,y-50+bob); ctx.lineTo(x,y-36+bob); ctx.lineTo(x+10,y-50+bob); ctx.stroke();
    // head/mask
    ctx.shadowBlur=12; ctx.shadowColor=p.color; ctx.fillStyle='#111116'; ctx.beginPath(); ctx.roundRect(x-14,y-83+bob,28,24,8); ctx.fill();
    ctx.shadowBlur=8; ctx.shadowColor=p.color; ctx.fillStyle=p.color; ctx.beginPath(); ctx.ellipse(x+f*5,y-72+bob,5,3,0,0,Math.PI*2); ctx.ellipse(x-f*5,y-72+bob,5,3,0,0,Math.PI*2); ctx.fill();
    // arms based on action
    let armR=20, armL=-20, ay=y-48+bob;
    if(p.action==='punch'){ const pr=Math.sin((p.af/20)*Math.PI); armR=f*(22+34*pr); }
    if(p.action==='kick'){ const pr=Math.sin((p.af/28)*Math.PI); limb(ctx,x+f*10,y-24,x+f*(25+33*pr),y-12-pr*9,p.accent,7); }
    if(p.action==='special'){ const pr=Math.sin((p.af/42)*Math.PI); ctx.strokeStyle='rgba(255,215,0,.85)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(x+f*(34+45*pr),y-45,14+12*pr,0,Math.PI*2); ctx.stroke(); armR=f*(26+28*pr); }
    limb(ctx,x-13,y-53+bob,x+(f<0?armR:armL),ay+8,p.color,6);
    limb(ctx,x+13,y-53+bob,x+(f>0?armR:armL),ay+8,p.color,6);
    if(p.block){ ctx.shadowBlur=18; ctx.shadowColor='#bfe8ff'; ctx.strokeStyle='rgba(190,232,255,.94)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(x+f*24,y-48,22,-1.2*f,1.2*f, f<0); ctx.stroke(); ctx.shadowBlur=0; }
    if(p.guardBreak>0){ ctx.fillStyle='#ffd700'; ctx.font="bold 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('BREAK',x,y-93); }
    ctx.fillStyle=p.color; ctx.font="bold 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(p.name,x,y-91);
    if(p.combo>1 && p.comboT>0){ ctx.fillStyle='#ffd700'; ctx.font="bold 12px 'Orbitron',monospace"; ctx.fillText(p.combo+'x COMBO',x,y-106); }
    ctx.restore();
  }
  function drawFX(){
    trails.forEach(r=>{ ctx.save(); ctx.globalAlpha=r.life/14; ctx.strokeStyle=r.col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(r.x,r.y-39,28,0,Math.PI*2); ctx.stroke(); ctx.restore(); r.life--; }); trails=trails.filter(r=>r.life>0);
    particles.forEach(p=>{ ctx.save(); ctx.globalAlpha=p.life/38; ctx.fillStyle=p.col; ctx.shadowBlur=8; ctx.shadowColor=p.col; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore(); p.x+=p.vx; p.y+=p.vy; p.vy+=.22; p.life--; }); particles=particles.filter(p=>p.life>0);
    texts.forEach(q=>{ ctx.save(); ctx.globalAlpha=q.life/42; ctx.fillStyle=q.col; ctx.shadowBlur=10; ctx.shadowColor=q.col; ctx.font="bold 13px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(q.txt,q.x,q.y); ctx.restore(); q.y-=.7; q.life--; }); texts=texts.filter(q=>q.life>0);
  }
  function overlay(){
    if(roundIntro>0){
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=roundIntro>30?'#ffd700':'#00ffc8'; ctx.shadowBlur=24; ctx.shadowColor=ctx.fillStyle; ctx.font="bold 40px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(roundIntro>30?'ROUND '+round:'FIGHT!',W/2,H/2+10); ctx.shadowBlur=0;
    }
    if(matchOver){ const win=p1Rounds>p2Rounds; ctx.fillStyle='rgba(0,0,0,.68)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=win?'#00ffc8':'#ff3c6e'; ctx.shadowBlur=24; ctx.shadowColor=ctx.fillStyle; ctx.font="bold 32px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(win?'VITÓRIA!':'DERROTA!',W/2,H/2-15); ctx.shadowBlur=0; ctx.fillStyle='#ffd700'; ctx.font="bold 14px 'Orbitron',monospace"; ctx.fillText('PLACAR '+p1Rounds+' - '+p2Rounds,W/2,H/2+15); ctx.fillStyle='#e8e8f0'; ctx.font="12px 'Exo 2',sans-serif"; ctx.fillText('toque em REVANCHE para jogar de novo',W/2,H/2+38); }
    else if(roundOver){ const win=p1.hp>=p2.hp?p1:p2; ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=win.color; ctx.shadowBlur=20; ctx.shadowColor=win.color; ctx.font="bold 28px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(win.name+' WINS!',W/2,H/2); ctx.shadowBlur=0; }
  }
  function loop(){
    fightRAF=requestAnimationFrame(loop); if(!fightState) return; t++;
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H); drawBG();
    if(roundIntro>0){ roundIntro--; drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateBars(); return; }
    if(matchOver){ drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateBars(); return; }
    if(roundOver){ drawFighter(p1); drawFighter(p2); drawFX(); overlay(); roundOverTimer--; if(roundOverTimer<=0) nextRound(); updateBars(); return; }
    readInput(); cpuAI(); applyInput(p1,'p1'); applyInput(p2,'p2');
    if(hitStop>0){ hitStop--; } else { fightTimer--; step(p1); step(p2); }
    resolveHits(p1,p2); resolveHits(p2,p1);
    if(fightTimer<=0) endRound(p1.hp>=p2.hp?p1:p2);
    drawFighter(p1); drawFighter(p2); drawFX(); updateBars();
  }
  document.getElementById('fightRoundLabel').textContent='ROUND 1'; status('0 - 0',''); updateBars(); loop();
}


const FORUM_LIMITS = { title: 80, content: 1200, reply: 900, cooldown: 9000 };
let lastForumPostAt = 0;
function canForumPost(kind, text){
  if(!requireLogin()) return false;
  if(currentUser?.isBanned){ showNotification("Conta banida não pode postar.","error"); return false; }
  const now=Date.now();
  if(now-lastForumPostAt<FORUM_LIMITS.cooldown){ showNotification("Calma um pouco para evitar spam.","warning"); return false; }
  const max = kind === "title" ? FORUM_LIMITS.title : kind === "reply" ? FORUM_LIMITS.reply : FORUM_LIMITS.content;
  if(String(text||"").length > max){ showNotification("Texto muito grande. Limite: "+max+" caracteres.","warning"); return false; }
  return true;
}
function markForumPosted(){ lastForumPostAt = Date.now(); }

// ===== FORUM =====
function forumShowView(view){
  ['categories','topics','topic','newTopic'].forEach(v=>{
    document.getElementById('forumView-'+v).style.display='none';
  });
  document.getElementById('forumView-'+view).style.display='block';
}

async function carregarForum(){
  forumShowView('categories');
  const list=document.getElementById('forumCategoryList');
  list.innerHTML='';
  const snap = await getDocs(collection(db,"forumCategories"));
  if(snap.empty){
    list.innerHTML=`<div class="empty-state"><span class="empty-icon">💬</span>Nenhuma categoria ainda.</div>`;
    return;
  }
  snap.forEach(docu=>{
    const cat=docu.data();
    list.innerHTML+=`
      <div class="forum-category-card" onclick="forumOpenCategory('${docu.id}','${sanitizeHTML(cat.name)}','${cat.icon||"💬"}')">
        <div class="forum-category-icon">${cat.icon||"💬"}</div>
        <div class="forum-category-info">
          <div class="forum-category-name">${sanitizeHTML(cat.name)}</div>
          <div class="forum-category-desc">${sanitizeHTML(cat.description||"")}</div>
        </div>
        <span class="forum-category-arrow">›</span>
      </div>`;
  });
}

window.forumOpenCategory = async function(id,name,icon){
  return window.spiderWithLoading("Buscando tópicos...", async ()=>{
    forumCurrentCategory={id,name,icon};
    document.getElementById('forumCatTitle').textContent=icon+" "+name;
    forumShowView('topics');
    await forumLoadTopics();
  }, "📋", 420);
};

async function forumLoadTopics(){
  const list=document.getElementById('forumTopicList');
  list.innerHTML='';
  const q=query(collection(db,"forumTopics"),orderBy("createdAt","desc"));
  const snap=await getDocs(q);
  let found=false;
  const docs = snap.docs.sort((a,b)=>Number(!!b.data().pinned)-Number(!!a.data().pinned) || toMillis(b.data().createdAt)-toMillis(a.data().createdAt));
  docs.forEach(docu=>{
    const t=docu.data();
    if(t.category!==forumCurrentCategory.id) return;
    found=true;
    list.innerHTML+=`
      <div class="forum-topic-item" onclick="forumOpenTopic('${docu.id}')" style="${t.pinned?'border-color:rgba(255,215,0,.35);':''}">
        <div class="forum-topic-title">${t.pinned?'📌 ':''}${sanitizeHTML(t.title)}</div>
        <div class="forum-topic-meta">
          <span>por <strong style="color:var(--primary)">${sanitizeHTML(t.author)}</strong></span>
          <span>❤️ ${Number(t.likes||0)}</span>
          <span>${formatDate(t.createdAt)}</span>
        </div>
      </div>`;
  });
  if(!found) list.innerHTML=`<div class="empty-state"><span class="empty-icon">📝</span>Nenhum tópico ainda. Seja o primeiro!</div>`;
}

window.forumShowCategories = function(){ forumCurrentCategory=null; forumCurrentTopic=null; carregarForum(); };
window.forumShowTopics     = function(){ forumCurrentTopic=null; forumShowView('topics'); forumLoadTopics(); };
window.forumShowNewTopic   = function(){
  document.getElementById('forumNewTitle').value=''; document.getElementById('forumNewContent').value='';
  showMessage('forumMsg',''); forumShowView('newTopic');
};

window.forumCreateTopic = async function(){
  const title  =document.getElementById('forumNewTitle').value.trim();
  const content=document.getElementById('forumNewContent').value.trim();
  if(!title||!content){ showMessage('forumMsg','Preencha título e conteúdo','error'); return; }
  if(!canForumPost("title", title) || !canForumPost("content", content)) return;
  await addDoc(collection(db,"forumTopics"),{ category:forumCurrentCategory.id, title, content,
    author:currentUser.user, authorId:currentUid, authorRole:currentUser.role||"user", likes:0, pinned:false, locked:false, createdAt:serverTimestamp() });
  markForumPosted();
  showNotification("Tópico criado!"); forumShowTopics();
  carregarHomeStats();
  updateGameBestLabels();
  renderAchievements();
};

window.forumOpenTopic = async function(id){
  return window.spiderWithLoading("Abrindo tópico e respostas...", async ()=>{
    const ref=doc(db,"forumTopics",id);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    const topic=snap.data();
    forumCurrentTopic={id,...topic};
    document.getElementById('forumTopicTitle').textContent=topic.title;
    document.getElementById('forumTopicBody').innerHTML=`
      <div class="forum-topic-body-content">${sanitizeHTML(topic.content)}</div>
      <div style="font-size:12px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:10px;margin-top:10px">
        por <strong style="color:var(--primary)">${sanitizeHTML(topic.author)}</strong> · ❤️ ${Number(topic.likes||0)} · ${formatDate(topic.createdAt)}
      </div>
      <div class="topic-actions">
        <button class="tiny-action" onclick="forumLikeTopic(event,'${id}')">❤️ Curtir</button>
        ${isModAdmin()?`<button class="tiny-action" onclick="forumTogglePin(event,'${id}',${!topic.pinned})">${topic.pinned?'📌 Desfixar':'📌 Fixar'}</button>`:''}
        ${(isModAdmin() || topic.authorId===currentUid)?`<button class="tiny-action danger" onclick="forumDeleteTopic(event,'${id}')">🗑 Apagar</button>`:''}
      </div>`;
    forumShowView('topic');
    await forumLoadReplies(id);
  }, "💬", 420);
};

async function forumLoadReplies(topicId){
  const list=document.getElementById('forumRepliesList');
  list.innerHTML='';
  const q=query(collection(db,"forumReplies"),orderBy("createdAt","asc"));
  const snap=await getDocs(q);
  let found=false;
  const docs = snap.docs.sort((a,b)=>Number(!!b.data().pinned)-Number(!!a.data().pinned) || toMillis(b.data().createdAt)-toMillis(a.data().createdAt));
  docs.forEach(docu=>{
    const r=docu.data();
    if(r.topic!==topicId) return;
    found=true;
    list.innerHTML+=`
      <div class="forum-reply">
        <div class="forum-reply-header">
          <span class="forum-reply-author ${r.authorRole||""}">${sanitizeHTML(r.author)}</span>
          <span style="font-size:11px;color:var(--text-dim)">${formatDate(r.createdAt)}</span>
        </div>
        <div class="forum-reply-content">${sanitizeHTML(r.content)}</div>
      </div>`;
  });
  if(!found) list.innerHTML=`<div class="empty-state" style="padding:20px"><span class="empty-icon" style="font-size:32px">💬</span>Nenhuma resposta ainda.</div>`;
}

window.forumSendReply = async function(){
  const input=document.getElementById('forumReplyInput');
  const content=input.value.trim(); if(!content) return;
  if(forumCurrentTopic?.locked){ showNotification("Tópico trancado.","warning"); return; }
  if(!canForumPost("reply", content)) return;
  await addDoc(collection(db,"forumReplies"),{ topic:forumCurrentTopic.id, content,
    author:currentUser.user, authorId:currentUid, authorRole:currentUser.role||"user", createdAt:serverTimestamp() });
  markForumPosted();
  input.value=""; await forumLoadReplies(forumCurrentTopic.id);
  carregarHomeStats();
};

window.forumLikeTopic = async function(ev,id){
  ev?.stopPropagation?.(); if(!requireLogin()) return;
  const key="liked_topic_"+id; if(localStorage.getItem(key)){ showNotification("Você já curtiu esse tópico.","warning"); return; }
  await updateDoc(doc(db,"forumTopics",id),{ likes:increment(1) });
  localStorage.setItem(key,"1");
  showNotification("Curtido!");
  if(forumCurrentTopic?.id===id) forumOpenTopic(id); else forumLoadTopics();
};
window.forumTogglePin = async function(ev,id,value){
  ev?.stopPropagation?.(); if(!isModAdmin()) return showNotification("Só mod/admin.","error");
  await updateDoc(doc(db,"forumTopics",id),{ pinned:!!value }); showNotification(value?"Tópico fixado":"Tópico desfixado"); forumLoadTopics();
};
window.forumDeleteTopic = async function(ev,id){
  ev?.stopPropagation?.(); if(!isModAdmin() && forumCurrentTopic?.authorId!==currentUid) return showNotification("Sem permissão.","error");
  if(!confirm("Apagar este tópico?")) return;
  await deleteDoc(doc(db,"forumTopics",id)); showNotification("Tópico apagado."); forumShowTopics(); carregarHomeStats();
};



// ===== MEMORY GAME =====
let memoryDifficulty = "facil";
let memoryTimerInterval = null;
let memoryOpenCards = [];
let memoryLock = false;
let memoryScoreVal = 0;
let memoryMovesVal = 0;
let memoryTimeLeft = 60;

function getMemoryConfig(){
  if(memoryDifficulty === "facil") return { pairs: 6, time: 70, cols: 4, bonus: 12 };
  if(memoryDifficulty === "medio") return { pairs: 8, time: 60, cols: 4, bonus: 18 };
  return { pairs: 10, time: 50, cols: 5, bonus: 26 };
}

window.setMemoryDifficulty = function(diff){
  memoryDifficulty = diff;
  ["facil","medio","dificil"].forEach(d=>{
    const el = document.getElementById("memDiff" + d.charAt(0).toUpperCase() + d.slice(1));
    if(el) el.classList.toggle("active", d===diff);
  });
  restartMemory();
};

window.toggleMemory = function(){
  const modal = document.getElementById("memoryModal");
  if(modal.classList.contains("open")){
    modal.classList.remove("open");
    clearInterval(memoryTimerInterval);
  } else {
    window.spiderLoadingDelay("Montando jogo da memória...", ()=>{ modal.classList.add("open"); restartMemory(); }, "🧠", 320);
  }
};

window.restartMemory = function(){
  const cfg = getMemoryConfig();
  const grid = document.getElementById("memoryGrid");
  if(!grid) return;
  clearInterval(memoryTimerInterval);
  updateGameBestLabels();
  memoryOpenCards = [];
  memoryLock = false;
  memoryScoreVal = 0;
  memoryMovesVal = 0;
  memoryTimeLeft = cfg.time;
  document.getElementById("memoryScore").textContent = "0";
  document.getElementById("memoryMoves").textContent = "0";
  document.getElementById("memoryTimer").textContent = memoryTimeLeft + "s";
  document.getElementById("memoryHint").textContent = "Ache os pares antes do tempo acabar.";
  grid.style.gridTemplateColumns = `repeat(${cfg.cols}, minmax(46px, 1fr))`;
  const icons = ["🕷","🕸","⚡","🔥","💎","🧬","🛡","🚀","👾","🐍","🥊","🪰"];
  const cards = icons.slice(0, cfg.pairs).flatMap((icon, i)=>[{icon,id:i+"a"},{icon,id:i+"b"}]).sort(()=>Math.random()-0.5);
  grid.innerHTML = cards.map((c,idx)=>`<button class="memory-card" data-icon="${c.icon}" data-id="${c.id}" data-index="${idx}" onclick="flipMemoryCard(this)">?</button>`).join("");
  memoryTimerInterval = setInterval(()=>{
    memoryTimeLeft--;
    document.getElementById("memoryTimer").textContent = memoryTimeLeft + "s";
    if(memoryTimeLeft <= 0){
      clearInterval(memoryTimerInterval);
      memoryLock = true;
      document.getElementById("memoryHint").textContent = "Tempo esgotado! Reinicie para tentar bater o recorde.";
      setBest("memory", memoryScoreVal);
      updateGameBestLabels();
      checkAchievements();
    }
  },1000);
};

window.flipMemoryCard = function(card){
  if(memoryLock || card.classList.contains("open") || card.classList.contains("matched")) return;
  card.classList.add("open");
  card.textContent = card.dataset.icon;
  memoryOpenCards.push(card);
  vibrate(20);
  if(memoryOpenCards.length < 2) return;
  memoryLock = true;
  memoryMovesVal++;
  document.getElementById("memoryMoves").textContent = memoryMovesVal;
  const [a,b] = memoryOpenCards;
  const cfg = getMemoryConfig();
  if(a.dataset.icon === b.dataset.icon){
    a.classList.add("matched"); b.classList.add("matched");
    const gained = Math.max(5, cfg.bonus + memoryTimeLeft - memoryMovesVal);
    memoryScoreVal += gained;
    document.getElementById("memoryScore").textContent = memoryScoreVal;
    showScorePopup(gained);
    memoryOpenCards = [];
    memoryLock = false;
    const allMatched = [...document.querySelectorAll("#memoryGrid .memory-card")].every(c=>c.classList.contains("matched"));
    if(allMatched){
      clearInterval(memoryTimerInterval);
      const finalScore = memoryScoreVal + memoryTimeLeft * 2;
      memoryScoreVal = finalScore;
      document.getElementById("memoryScore").textContent = finalScore;
      const newBest = setBest("memory", finalScore);
      updateGameBestLabels();
      document.getElementById("memoryHint").textContent = newBest ? "🏆 Novo recorde!" : "Você venceu!";
      showNotification((newBest ? "🏆 Novo recorde: " : "Vitória: ") + finalScore);
      if(currentUid && finalScore>0){ updateDoc(doc(db,"users",currentUid),{ score:increment(finalScore), bestMemory:Math.max(finalScore, Number(currentUser?.bestMemory||0)) }).then(()=>{ carregarRanking(); carregarPerfil(); }).catch(()=>{}); }
      checkAchievements();
    }
  } else {
    setTimeout(()=>{
      a.classList.remove("open"); b.classList.remove("open");
      a.textContent = "?"; b.textContent = "?";
      memoryOpenCards = [];
      memoryLock = false;
    }, 650);
  }
};


const SECURITY_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function me() { return get(/databases/$(database)/documents/users/$(request.auth.uid)); }
    function isAdmin() { return signedIn() && me().data.role == "admin"; }
    function isMod() { return signedIn() && (me().data.role == "admin" || me().data.role == "moderator"); }
    function notBanned() { return signedIn() && me().data.isBanned != true; }

    match /users/{userId} {
      allow read: if signedIn();
      allow create: if signedIn() && request.auth.uid == userId;
      allow update: if signedIn() && (
        request.auth.uid == userId && !('role' in request.resource.data.diff(resource.data).changedKeys()) && !('isBanned' in request.resource.data.diff(resource.data).changedKeys())
        || isAdmin()
      );
      allow delete: if isAdmin();
    }

    match /chat/{msgId} {
      allow read: if signedIn();
      allow create: if notBanned() && request.resource.data.content is string && request.resource.data.content.size() <= 500;
      allow update, delete: if isMod();
    }

    match /forumCategories/{catId} {
      allow read: if signedIn();
      allow create, update, delete: if isAdmin();
    }

    match /forumTopics/{topicId} {
      allow read: if signedIn();
      allow create: if notBanned() && request.resource.data.title.size() <= 80 && request.resource.data.content.size() <= 1200;
      allow update: if isMod() || (notBanned() && request.resource.data.diff(resource.data).changedKeys().hasOnly(['likes']));
      allow delete: if isMod() || (signedIn() && resource.data.authorId == request.auth.uid);
    }

    match /forumReplies/{replyId} {
      allow read: if signedIn();
      allow create: if notBanned() && request.resource.data.content.size() <= 900;
      allow update, delete: if isMod() || (signedIn() && resource.data.authorId == request.auth.uid);
    }

    match /reports/{reportId} {
      allow read, update, delete: if isMod();
      allow create: if notBanned()
        && request.resource.data.reason is string
        && request.resource.data.reason.size() <= 200;
    }

    match /gameScores/{scoreId} {
      allow read: if signedIn();
      allow create: if notBanned()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.game in ['flies','snake','memory','fight']
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 100000;
      allow update, delete: if isAdmin();
    }
  }
}`;
function adminHideAll(){ ["adminUsersSection","adminAnnouncementSection","adminAuditSection","adminCategorySection","adminSecuritySection"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; }); }
window.adminShowSecurity = function(){ if(!isAdmin()) return; adminHideAll(); const sec=document.getElementById("adminSecuritySection"); if(sec) sec.style.display="block"; const box=document.getElementById("securityRulesBox"); if(box) box.textContent=SECURITY_RULES; };
window.copySecurityRules = function(){ navigator.clipboard?.writeText(SECURITY_RULES); showNotification("Regras copiadas!"); };


// Spider V2: exposição controlada para recursos extras externos
window.spiderFirebase = {
  db, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, increment, serverTimestamp
};
window.spiderGetContext = function(){
  return { currentUid, currentUser, isModAdmin: isModAdmin(), isAdmin: isAdmin(), requireLogin };
};
window.spiderRefresh = { carregarRanking, carregarForum, carregarChat, carregarPerfil, carregarHomeStats };

// expose globals
window.carregarForum   = carregarForum;
window.carregarRanking = carregarRanking;
window.carregarChat    = carregarChat;
} // end initApp()
initApp();

// ===== MORTAL SPIDER V4 - botões e personagens melhorados =====
// Esta versão sobrescreve startFight() para deixar o mini game mais responsivo no celular,
// com personagens desenhados em partes, golpes mais legíveis, IA melhor e HUD mais claro.
function startFight(){
  const canvas = document.getElementById("fightCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width || 500, H = canvas.height || 240;
  const GROUND = H - 34;
  const GRAV = 0.74;
  const BEST_OF = 2;

  if(typeof setFightDifficulty === 'function') setFightDifficulty(fightDifficulty || 'hard');
  document.removeEventListener("keydown", fightKeyDown);
  document.removeEventListener("keyup", fightKeyUp);
  document.addEventListener("keydown", fightKeyDown);
  document.addEventListener("keyup", fightKeyUp);
  Object.keys(fbState).forEach(k=>fbState[k]=false);

  const DIFFS = {
    normal:    { speed:2.25, react:24, aggro:.48, block:.18, dash:.10, special:.10, dmg:.94, timer:99 },
    hard:      { speed:2.65, react:16, aggro:.66, block:.28, dash:.20, special:.18, dmg:1.00, timer:90 },
    nightmare: { speed:3.00, react:10, aggro:.82, block:.42, dash:.30, special:.28, dmg:1.10, timer:80 }
  };
  const AI = DIFFS[fightDifficulty] || DIFFS.hard;

  let tick=0, hitStop=0, shake=0;
  let round=1, p1Rounds=0, p2Rounds=0;
  let fightTimer=AI.timer*60;
  let intro=84, roundOver=false, matchOver=false, roundOverTimer=0;
  let particles=[], floatText=[], waves=[];

  const COST = { punch:8, kick:14, upper:18, dash:24, special:55, block:.55 };
  const DMG  = { punch:8, kick:14, upper:17, special:30, chip:3 };
  const RANGE= { punch:54, kick:78, upper:60, special:105 };
  const FRAMES = { punch:16, kick:24, upper:26, special:38 };
  const ACTIVE = { punch:[5,9], kick:[8,14], upper:[9,15], special:[12,23] };

  function makeFighter(x, palette, name, face, cpu=false){
    return {
      x, y:GROUND, vx:0, vy:0, face, cpu,
      name, palette,
      hp:100, maxHp:100, st:100, sp:12, guard:100,
      onGround:true, coyote:0, inv:0, dashCd:0, guardBreak:0,
      block:false, action:null, af:0, cool:0, hitDone:false,
      combo:0, comboT:0, aiT:0, aiIntent:'idle', walk:0, hurt:0,
      lastDir:face, queued:null
    };
  }

  const SPIDER = { main:'#00ffc8', light:'#73ffe4', dark:'#052d29', eye:'#ff3c6e', suit:'#10141a', aura:'rgba(0,255,200,.24)' };
  const VENOM  = { main:'#ff3c6e', light:'#ff8cab', dark:'#2b0714', eye:'#9b5cff', suit:'#151019', aura:'rgba(255,60,110,.24)' };
  let p1 = makeFighter(86, SPIDER, 'SPIDER', 1, false);
  let p2 = makeFighter(W-86, VENOM, 'VENOM', -1, true);
  fightState = { players:[p1,p2] };

  const q = id => document.getElementById(id);
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
  function sign(n){ return n<0?-1:1; }
  function clearBtn(prefix){ ['left','right','jump','dash','punch','kick','special','block'].forEach(a=>fbState[prefix+'_'+a]=false); }
  function setStatus(text,color=''){ const el=q('fightStatus'); if(el){ el.textContent=text; el.style.color=color; } }
  function updateBars(){
    [['p1',p1],['p2',p2]].forEach(([id,p])=>{
      const hp=q(id+'Hp'), hpN=q(id+'HpNum'), sp=q(id+'Sp'), st=q(id+'St');
      if(hp) hp.style.width=clamp(p.hp,0,100)+'%';
      if(hpN) hpN.textContent=Math.max(0,Math.ceil(p.hp));
      if(sp) sp.style.width=clamp(p.sp,0,100)+'%';
      if(st) st.style.width=clamp(p.st,0,100)+'%';
    });
    const tm=q('fightTimerDisplay'); if(tm) tm.textContent=Math.max(0,Math.ceil(fightTimer/60));
    const rd=q('fightRoundLabel'); if(rd) rd.textContent='ROUND '+round;
  }
  function btnVisual(){
    document.querySelectorAll('.fight-btn').forEach(btn=>btn.classList.remove('pressed','special-ready'));
    document.querySelectorAll('.fight-btn-special').forEach(btn=>{ if(p1.sp>=100) btn.classList.add('special-ready'); });
  }
  function addText(txt,x,y,col){ floatText.push({txt,x,y,col,life:42}); }
  function burst(x,y,col,n=10,power=1){
    for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, s=(1.6+Math.random()*4.2)*power; particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.2,size:2+Math.random()*3,col,life:26+Math.random()*18}); }
  }
  function wave(x,y,col){ waves.push({x,y,r:8,col,life:22}); }
  function vibrate(ms=18){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

  function readInput(){
    const key = k => !!fightKeys[k];
    fbState.p1_left    = !!(key('a')||key('A')||fbState.p1_left);
    fbState.p1_right   = !!(key('d')||key('D')||fbState.p1_right);
    fbState.p1_jump    = !!(key('w')||key('W')||fbState.p1_jump);
    fbState.p1_dash    = !!(key('e')||key('E')||fbState.p1_dash);
    fbState.p1_punch   = !!(key('f')||key('F')||fbState.p1_punch);
    fbState.p1_kick    = !!(key('g')||key('G')||fbState.p1_kick);
    fbState.p1_special = !!(key('h')||key('H')||fbState.p1_special);
    fbState.p1_block   = !!(key('c')||key('C')||fbState.p1_block);
    // P2 local permanece opcional; a CPU controla quando nenhum botão P2 é pressionado.
    fbState.p2_left    = !!(key('ArrowLeft') || fbState.p2_left);
    fbState.p2_right   = !!(key('ArrowRight')|| fbState.p2_right);
    fbState.p2_jump    = !!(key('ArrowUp')   || fbState.p2_jump);
    fbState.p2_dash    = !!(key('Shift')     || fbState.p2_dash);
    fbState.p2_punch   = !!(key('j')||key('J')||fbState.p2_punch);
    fbState.p2_kick    = !!(key('k')||key('K')||fbState.p2_kick);
    fbState.p2_special = !!(key('l')||key('L')||fbState.p2_special);
    fbState.p2_block   = !!(key(';')||key(':')||fbState.p2_block);
  }

  function anyP2Manual(){ return ['left','right','jump','dash','punch','kick','special','block'].some(a=>fbState['p2_'+a]); }
  function cpuAI(){
    if(anyP2Manual()) return;
    ['left','right','jump','dash','punch','kick','special','block'].forEach(a=>fbState['p2_'+a]=false);
    p2.aiT--;
    const dist = Math.abs(p1.x-p2.x), dir = p1.x>p2.x?1:-1;
    p2.face = dir;
    const choose = ()=>{
      if(p2.guardBreak>0) return 'retreat';
      if(p2.hp<32 && Math.random()<.25) return 'defend';
      if(p1.action && dist<90 && Math.random()<AI.block) return 'defend';
      if(dist>116) return Math.random()<AI.dash?'dashin':'approach';
      if(dist<44) return Math.random()<.35?'retreat':'attack';
      if(Math.random()<AI.aggro) return 'attack';
      return Math.random()<.22?'defend':'approach';
    };
    if(p2.aiT<=0){ p2.aiIntent=choose(); p2.aiT=AI.react+Math.floor(Math.random()*12); }
    if(p2.aiIntent==='approach') fbState[dir>0?'p2_right':'p2_left']=true;
    if(p2.aiIntent==='retreat') fbState[dir>0?'p2_left':'p2_right']=true;
    if(p2.aiIntent==='dashin'){ fbState[dir>0?'p2_right':'p2_left']=true; fbState.p2_dash=true; }
    if(p2.aiIntent==='defend'){ fbState.p2_block=true; if(dist>100) fbState[dir>0?'p2_right':'p2_left']=true; }
    if(p2.aiIntent==='attack'){
      if(dist>78) fbState[dir>0?'p2_right':'p2_left']=true;
      else if(p2.sp>=100 && Math.random()<AI.special) fbState.p2_special=true;
      else if(dist<52 && Math.random()<.45) fbState.p2_punch=true;
      else fbState.p2_kick=true;
    }
  }

  function startAttack(p,type){
    if(p.cool>0 || p.guardBreak>0) return;
    if(p.action){ p.queued=type; return; }
    const cost = type==='special'?COST.special:type==='kick'?COST.kick:COST.punch;
    if(type==='special' && p.sp<100){ if(!p.cpu) addText('SEM ESPECIAL',p.x,p.y-96,'#ffd700'); return; }
    if(p.st<cost){ if(!p.cpu) addText('SEM STAMINA',p.x,p.y-96,'#ffd700'); return; }
    p.st-=cost; if(type==='special') p.sp=0;
    p.action=type; p.af=0; p.hitDone=false; p.cool=type==='special'?30:type==='kick'?16:9;
    p.vx += p.face*(type==='special'?2.6:type==='kick'?1.7:.9);
  }

  function applyInput(p,id){
    const left=!!fbState[id+'_left'], right=!!fbState[id+'_right'];
    const jump=!!fbState[id+'_jump'], dash=!!fbState[id+'_dash'];
    const block=!!fbState[id+'_block'];
    const speed = p.cpu?AI.speed:2.75;
    p.block = block && !p.action && p.st>8 && p.guardBreak<=0;
    if(p.block){ p.vx*=.72; p.st=Math.max(0,p.st-COST.block); }
    if(!p.block && !p.action){
      if(left){ p.vx-=.78; p.face=-1; p.walk++; }
      if(right){ p.vx+=.78; p.face=1; p.walk++; }
    }
    p.vx = clamp(p.vx, -speed*1.35, speed*1.35);
    if(jump && (p.onGround || p.coyote>0) && !p.block){ p.vy=-14.8; p.onGround=false; p.coyote=0; fbState[id+'_jump']=false; }
    if(dash && p.dashCd<=0 && p.st>=COST.dash && !p.block){
      p.st-=COST.dash; p.dashCd=32; p.inv=8; p.vx=p.face*10.8; wave(p.x,p.y-34,p.palette.light); burst(p.x-p.face*16,p.y-30,p.palette.main,6,.7); fbState[id+'_dash']=false;
    }
    if(fbState[id+'_punch']){ startAttack(p,'punch'); fbState[id+'_punch']=false; }
    if(fbState[id+'_kick']){ startAttack(p,'kick'); fbState[id+'_kick']=false; }
    if(fbState[id+'_special']){ startAttack(p,'special'); fbState[id+'_special']=false; }
  }

  function hurt(target, attacker, amount, kind){
    if(target.inv>0) return false;
    const facingAttack = target.face === -attacker.face;
    const blocked = target.block && target.guardBreak<=0 && facingAttack;
    if(blocked){
      target.guard -= kind==='special'?32:kind==='kick'?19:12;
      target.st = Math.max(0,target.st-(kind==='special'?12:6));
      target.hp = Math.max(0,target.hp-DMG.chip);
      burst(target.x,target.y-46,'#bfe8ff',7,.8); wave(target.x,target.y-48,'#bfe8ff'); addText('BLOCK',target.x,target.y-88,'#bfe8ff');
      hitStop = 4; shake = Math.max(shake,3);
      if(target.guard<=0){ target.guardBreak=74; target.guard=45; target.block=false; addText('GUARDA QUEBRADA',target.x,target.y-104,'#ffd700'); shake=7; }
      return true;
    }
    const dmg = amount*(attacker.cpu?AI.dmg:1);
    target.hp = Math.max(0,target.hp-dmg);
    target.hurt=12; target.inv=kind==='special'?9:5; target.block=false;
    target.vx += attacker.face*(kind==='special'?9.5:kind==='kick'?7.2:4.8);
    target.vy += kind==='special'?-3.4:kind==='kick'?-1.7:-.7;
    attacker.sp = Math.min(100, attacker.sp + (kind==='special'?0:kind==='kick'?16:11));
    attacker.combo = attacker.comboT>0 ? attacker.combo+1 : 1; attacker.comboT=72;
    const col = kind==='special' ? '#ffd700' : attacker.palette.main;
    burst(target.x,target.y-48,col,kind==='special'?22:12,kind==='special'?1.4:1);
    wave(target.x,target.y-48,col); addText('-'+Math.round(dmg),target.x,target.y-92,col);
    if(attacker.combo>1) addText(attacker.combo+'x COMBO',attacker.x,attacker.y-106,'#ffd700');
    shake = Math.max(shake, kind==='special'?10:5); hitStop = kind==='special'?9:5; vibrate(kind==='special'?40:18);
    return true;
  }

  function resolveHit(attacker,target){
    if(!attacker.action || attacker.hitDone) return;
    const af=attacker.af, active=ACTIVE[attacker.action];
    if(!active || af<active[0] || af>active[1]) return;
    const dx=(target.x-attacker.x)*attacker.face;
    const vertical=Math.abs((target.y-44)-(attacker.y-44));
    const inRange = dx>6 && dx<RANGE[attacker.action] && vertical<70;
    if(inRange){
      attacker.hitDone=true;
      const damage = attacker.action==='special'?DMG.special:attacker.action==='kick'?DMG.kick:DMG.punch;
      hurt(target,attacker,damage,attacker.action);
    }
  }

  function step(p){
    p.inv=Math.max(0,p.inv-1); p.dashCd=Math.max(0,p.dashCd-1); p.cool=Math.max(0,p.cool-1); p.hurt=Math.max(0,p.hurt-1);
    p.guardBreak=Math.max(0,p.guardBreak-1); p.comboT=Math.max(0,p.comboT-1); if(p.comboT<=0) p.combo=0;
    if(!p.block && !p.action) p.st=Math.min(100,p.st+0.58+(p.onGround?.24:0));
    if(!p.block) p.guard=Math.min(100,p.guard+.34);
    p.vy+=GRAV; p.x+=p.vx; p.y+=p.vy; p.vx*=p.onGround?.82:.94;
    if(p.y>=GROUND){ p.y=GROUND; p.vy=0; p.onGround=true; p.coyote=6; } else { p.onGround=false; p.coyote=Math.max(0,p.coyote-1); }
    p.x=clamp(p.x,28,W-28);
    if(p.action){
      p.af++;
      if(p.action==='special' && p.af%4===0) burst(p.x+p.face*38,p.y-45,p.palette.light,2,.45);
      if(p.af>=FRAMES[p.action]){ const next=p.queued; p.action=null; p.af=0; p.hitDone=false; p.queued=null; if(next) startAttack(p,next); }
    }
  }

  function endRound(winner){
    if(roundOver || matchOver) return;
    roundOver=true; roundOverTimer=130;
    if(winner===p1) p1Rounds++; else p2Rounds++;
    setStatus(winner.name+' venceu',winner.palette.main);
    burst(winner.x,winner.y-48,winner.palette.main,24,1.3); wave(winner.x,winner.y-48,winner.palette.main);
    if(p1Rounds>=BEST_OF || p2Rounds>=BEST_OF){
      matchOver=true; roundOverTimer=999999;
      setStatus(p1Rounds>p2Rounds?'SPIDER CAMPEÃO':'VENOM CAMPEÃO',p1Rounds>p2Rounds?p1.palette.main:p2.palette.main);
      if(p1Rounds>p2Rounds){
        const wins=Number(localStorage.getItem('spider_fight_wins')||0)+1;
        localStorage.setItem('spider_fight_wins',String(wins));
        try{ if(typeof unlockAchievement==='function') unlockAchievement('fighter_win'); }catch(e){}
        try{ if(currentUid && typeof updateDoc==='function'){ updateDoc(doc(db,'users',currentUid),{ fightWins:increment(1), score:increment(160) }).then(()=>{ carregarRanking(); carregarPerfil(); }).catch(()=>{}); } }catch(e){}
      }
    }
  }
  function nextRound(){
    round++; fightTimer=AI.timer*60; intro=72; roundOver=false;
    p1=makeFighter(86,SPIDER,'SPIDER',1,false); p2=makeFighter(W-86,VENOM,'VENOM',-1,true); fightState.players=[p1,p2];
    clearBtn('p1'); clearBtn('p2'); setStatus(p1Rounds+' - '+p2Rounds,''); particles=[]; floatText=[]; waves=[];
  }

  function drawBG(){
    ctx.save();
    const sx=(shake>0?(Math.random()-.5)*shake:0), sy=(shake>0?(Math.random()-.5)*shake:0); if(shake>0) shake*=.82;
    ctx.translate(sx,sy);
    const grad=ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#090915'); grad.addColorStop(.56,'#06070b'); grad.addColorStop(1,'#020203'); ctx.fillStyle=grad; ctx.fillRect(-20,-20,W+40,H+40);
    // arena neon
    ctx.strokeStyle='rgba(0,255,200,.10)'; ctx.lineWidth=1;
    for(let x=-40;x<W+80;x+=40){ ctx.beginPath(); ctx.moveTo(x,GROUND+16); ctx.lineTo(W/2+(x-W/2)*.25,H-3); ctx.stroke(); }
    for(let y=GROUND+15;y<H;y+=11){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.fillStyle='rgba(0,255,200,.08)'; ctx.fillRect(0,GROUND+4,W,3);
    ctx.fillStyle='rgba(255,60,110,.08)'; ctx.fillRect(0,GROUND+10,W,2);
    ctx.fillStyle='rgba(255,255,255,.035)'; ctx.font="bold 54px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('SPIDER',W/2,72);
    ctx.restore();
  }
  function limb(x1,y1,x2,y2,col,w=5){ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
  function drawFighter(p){
    const f=p.face, bob=Math.sin(t*.12+p.x*.02)*2, walk=(Math.sin(p.walk*.5)*5)*(Math.abs(p.vx)>.25?1:0);
    const x=p.x, y=p.y, pal=p.palette;
    ctx.save();
    if(p.hurt>0){ ctx.globalAlpha=.65+.35*Math.sin(t*1.7); }
    ctx.shadowBlur=18; ctx.shadowColor=pal.main;
    // aura / invencibilidade
    if(p.inv>0 || p.sp>=100){ ctx.strokeStyle=p.sp>=100?'rgba(255,215,0,.8)':pal.aura; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y-43,34+Math.sin(t*.25)*3,0,Math.PI*2); ctx.stroke(); }
    // legs
    limb(x-9,y-26,x-16+walk,y,pal.light,7); limb(x+9,y-26,x+16-walk,y,pal.light,7);
    limb(x-16+walk,y,x-23+walk*.6,y+5,pal.main,5); limb(x+16-walk,y,x+23-walk*.6,y+5,pal.main,5);
    // body
    ctx.fillStyle=pal.suit; ctx.beginPath(); ctx.roundRect(x-18,y-66+bob,36,45,9); ctx.fill();
    ctx.shadowBlur=10; ctx.fillStyle=pal.dark; ctx.beginPath(); ctx.roundRect(x-12,y-58+bob,24,30,7); ctx.fill();
    ctx.strokeStyle=pal.main; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-10,y-54+bob); ctx.lineTo(x,y-39+bob); ctx.lineTo(x+10,y-54+bob); ctx.stroke();
    // head
    ctx.shadowBlur=14; ctx.fillStyle='#101016'; ctx.beginPath(); ctx.roundRect(x-15,y-88+bob,30,25,9); ctx.fill();
    ctx.fillStyle=pal.main; ctx.shadowColor=pal.main; ctx.shadowBlur=10; ctx.beginPath(); ctx.ellipse(x+f*6,y-76+bob,5.2,3.2,0,0,Math.PI*2); ctx.ellipse(x-f*6,y-76+bob,5.2,3.2,0,0,Math.PI*2); ctx.fill();
    // arms / attack pose
    let rightArm=f*22, leftArm=-f*18, ay=y-51+bob;
    if(p.action==='punch'){ const pr=Math.sin((p.af/FRAMES.punch)*Math.PI); rightArm=f*(24+36*pr); }
    if(p.action==='kick'){ const pr=Math.sin((p.af/FRAMES.kick)*Math.PI); limb(x+f*9,y-25,x+f*(28+44*pr),y-13-pr*8,pal.light,8); }
    if(p.action==='special'){
      const pr=Math.sin((p.af/FRAMES.special)*Math.PI); rightArm=f*(28+34*pr);
      ctx.strokeStyle='rgba(255,215,0,.9)'; ctx.lineWidth=4; ctx.shadowColor='#ffd700'; ctx.shadowBlur=18; ctx.beginPath(); ctx.arc(x+f*(45+35*pr),y-47,12+18*pr,0,Math.PI*2); ctx.stroke();
    }
    limb(x-12,y-55+bob,x+(f<0?rightArm:leftArm),ay+9,pal.main,6);
    limb(x+12,y-55+bob,x+(f>0?rightArm:leftArm),ay+9,pal.main,6);
    if(p.block){ ctx.strokeStyle='rgba(190,232,255,.96)'; ctx.shadowColor='#bfe8ff'; ctx.shadowBlur=20; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(x+f*25,y-51,23,-1.18*f,1.18*f,f<0); ctx.stroke(); }
    if(p.guardBreak>0){ ctx.fillStyle='#ffd700'; ctx.shadowBlur=8; ctx.shadowColor='#ffd700'; ctx.font="bold 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('BREAK',x,y-99); }
    ctx.shadowBlur=0; ctx.fillStyle=pal.main; ctx.font="bold 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(p.name,x,y-96);
    if(p.combo>1 && p.comboT>0){ ctx.fillStyle='#ffd700'; ctx.font="bold 12px 'Orbitron',monospace"; ctx.fillText(p.combo+'x COMBO',x,y-112); }
    ctx.restore();
  }
  function drawFX(){
    waves.forEach(w=>{ ctx.save(); ctx.globalAlpha=w.life/22; ctx.strokeStyle=w.col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(w.x,w.y,w.r,0,Math.PI*2); ctx.stroke(); ctx.restore(); w.r+=3.8; w.life--; }); waves=waves.filter(w=>w.life>0);
    particles.forEach(p=>{ ctx.save(); ctx.globalAlpha=p.life/44; ctx.fillStyle=p.col; ctx.shadowColor=p.col; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore(); p.x+=p.vx; p.y+=p.vy; p.vy+=.24; p.life--; p.size*=.965; }); particles=particles.filter(p=>p.life>0);
    floatText.forEach(ft=>{ ctx.save(); ctx.globalAlpha=ft.life/42; ctx.fillStyle=ft.col; ctx.shadowColor=ft.col; ctx.shadowBlur=10; ctx.font="bold 13px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(ft.txt,ft.x,ft.y); ctx.restore(); ft.y-=.75; ft.life--; }); floatText=floatText.filter(ft=>ft.life>0);
  }
  function overlay(){
    if(intro>0){ ctx.fillStyle='rgba(0,0,0,.54)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=intro>28?'#ffd700':'#00ffc8'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=26; ctx.font="bold 36px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(intro>28?'ROUND '+round:'FIGHT!',W/2,H/2+10); ctx.shadowBlur=0; }
    if(roundOver && !matchOver){ const win=p1.hp>=p2.hp?p1:p2; ctx.fillStyle='rgba(0,0,0,.52)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=win.palette.main; ctx.shadowColor=win.palette.main; ctx.shadowBlur=20; ctx.font="bold 28px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(win.name+' WINS!',W/2,H/2+4); ctx.shadowBlur=0; }
    if(matchOver){ const win=p1Rounds>p2Rounds; ctx.fillStyle='rgba(0,0,0,.70)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=win?'#00ffc8':'#ff3c6e'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=26; ctx.font="bold 34px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(win?'VITÓRIA!':'DERROTA!',W/2,H/2-14); ctx.shadowBlur=0; ctx.fillStyle='#ffd700'; ctx.font="bold 14px 'Orbitron',monospace"; ctx.fillText('PLACAR '+p1Rounds+' - '+p2Rounds,W/2,H/2+17); ctx.fillStyle='#e8e8f0'; ctx.font="12px 'Exo 2',sans-serif"; ctx.fillText('toque em REVANCHE para jogar de novo',W/2,H/2+40); }
  }

  function loop(){
    fightRAF=requestAnimationFrame(loop); if(!fightState) return;
    tick++; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H); drawBG();
    if(intro>0){ intro--; drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateBars(); btnVisual(); return; }
    if(matchOver){ drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateBars(); btnVisual(); return; }
    if(roundOver){ drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateBars(); btnVisual(); roundOverTimer--; if(roundOverTimer<=0) nextRound(); return; }
    readInput(); cpuAI(); applyInput(p1,'p1'); applyInput(p2,'p2');
    if(hitStop>0) hitStop--; else { fightTimer--; step(p1); step(p2); }
    resolveHit(p1,p2); resolveHit(p2,p1);
    if(fightTimer<=0) endRound(p1.hp>=p2.hp?p1:p2);
    if(p1.hp<=0) endRound(p2); if(p2.hp<=0) endRound(p1);
    drawFighter(p1); drawFighter(p2); drawFX(); updateBars(); btnVisual();
  }
  setStatus('0 - 0',''); updateBars(); loop();
}
