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

function isModAdmin() { return ["admin","moderator"].includes(currentUser?.role); }

// ===== LOCAL RECORDS / GAME HELPERS =====
const GAME_BEST_PREFIX = "spider_best_";
const GAME_FIELDS = { flies:"bestFlies", snake:"bestSnake", memory:"bestMemory" };

// Achievement rarities: common | rare | epic | legendary | secret
const ACHIEVEMENTS = [
  // ── CAÇA MOSCAS ──
  {id:"first_fly",    icon:"🪰", title:"Primeira Caçada",   desc:"Faça qualquer pontuação nas moscas.",             rarity:"common",    pts:20,  check:()=>getBest("flies")>0},
  {id:"fly_100",      icon:"🕸", title:"Tecelão de Teias",  desc:"Faça 100+ pontos nas moscas.",                   rarity:"common",    pts:25,  check:()=>getBest("flies")>=100},
  {id:"fly_300",      icon:"🕷", title:"Caçador Neon",      desc:"Faça 300+ pontos nas moscas.",                   rarity:"rare",      pts:40,  check:()=>getBest("flies")>=300},
  {id:"fly_500",      icon:"🕷", title:"Predador Neon",     desc:"Faça 500+ pontos nas moscas.",                   rarity:"rare",      pts:60,  check:()=>getBest("flies")>=500},
  {id:"fly_1000",     icon:"🔥", title:"Infestação Total",  desc:"Faça 1000+ pontos nas moscas.",                  rarity:"epic",      pts:100, check:()=>getBest("flies")>=1000},
  {id:"fly_dificil",  icon:"💀", title:"No Limite do Caos", desc:"Faça qualquer pontuação no modo Difícil.",        rarity:"rare",      pts:50,  check:()=>Number(localStorage.getItem("flyHi_dificil")||0)>0},
  // ── SNAKE ──
  {id:"first_snake",  icon:"🐍", title:"Primeira Rasteira", desc:"Faça qualquer pontuação no Snake.",               rarity:"common",    pts:20,  check:()=>getBest("snake")>0},
  {id:"snake_100",    icon:"🐍", title:"Serpente Jovem",    desc:"Faça 100+ pontos no Snake.",                     rarity:"common",    pts:25,  check:()=>getBest("snake")>=100},
  {id:"snake_300",    icon:"🐍", title:"Cobra Turbo",       desc:"Faça 300+ pontos no Snake.",                     rarity:"rare",      pts:50,  check:()=>getBest("snake")>=300},
  {id:"snake_600",    icon:"🌀", title:"Anaconda Digital",  desc:"Faça 600+ pontos no Snake.",                     rarity:"epic",      pts:90,  check:()=>getBest("snake")>=600},
  {id:"snake_1000",   icon:"👑", title:"Rei das Cobras",    desc:"Faça 1000+ pontos no Snake.",                    rarity:"legendary", pts:150, check:()=>getBest("snake")>=1000},
  {id:"snake_lvl5",   icon:"⬆", title:"Sobe de Fase",      desc:"Chegue ao level 5 no Snake.",                    rarity:"rare",      pts:45,  check:()=>Number(localStorage.getItem("spider_snake_maxlevel")||0)>=5},
  // ── MEMÓRIA ──
  {id:"first_memory", icon:"🧠", title:"Memória de Peixes", desc:"Faça qualquer pontuação na Memória.",             rarity:"common",    pts:20,  check:()=>getBest("memory")>0},
  {id:"memory_180",   icon:"🧠", title:"Memória Afiada",    desc:"Faça 180+ pontos na Memória.",                   rarity:"rare",      pts:50,  check:()=>getBest("memory")>=180},
  {id:"memory_300",   icon:"🧠", title:"Memória Hacker",    desc:"Faça 300+ pontos na Memória.",                   rarity:"epic",      pts:80,  check:()=>getBest("memory")>=300},
  {id:"memory_500",   icon:"🔮", title:"Mente de Cristal",  desc:"Faça 500+ pontos na Memória.",                   rarity:"legendary", pts:130, check:()=>getBest("memory")>=500},
  // ── MORTAL SPIDER ──
  {id:"fighter_win",  icon:"🥊", title:"Primeira Vitória",  desc:"Ganhe 1 luta no Mortal Spider.",                 rarity:"common",    pts:30,  check:()=>fightWinsTotal()>=1},
  {id:"fighter_3",    icon:"🥋", title:"Lutador Dedicado",  desc:"Ganhe 3 lutas no Mortal Spider.",                rarity:"rare",      pts:55,  check:()=>fightWinsTotal()>=3},
  {id:"fighter_10",   icon:"🏅", title:"Veterano do Ringue",desc:"Ganhe 10 lutas no Mortal Spider.",               rarity:"epic",      pts:100, check:()=>fightWinsTotal()>=10},
  {id:"fighter_25",   icon:"🏆", title:"Campeão Mortal",    desc:"Ganhe 25 lutas no Mortal Spider.",               rarity:"legendary", pts:160, check:()=>fightWinsTotal()>=25},
  {id:"fighter_nm",   icon:"💀", title:"Nível Pesadelo",    desc:"Ganhe 1 luta no modo Nightmare.",                rarity:"epic",      pts:120, check:()=>Number(localStorage.getItem("spider_fight_nightmare_wins")||0)>=1},
  // ── SOCIAL / FÓRUM ──
  {id:"first_topic",  icon:"💬", title:"Primeira Palavra",  desc:"Crie seu primeiro tópico no fórum.",              rarity:"common",    pts:20,  check:()=>Number(localStorage.getItem("spider_topics_created")||0)>=1},
  {id:"topic_5",      icon:"📝", title:"Comunicador Neon",  desc:"Crie 5 tópicos no fórum.",                       rarity:"rare",      pts:45,  check:()=>Number(localStorage.getItem("spider_topics_created")||0)>=5},
  {id:"reply_10",     icon:"💬", title:"Voz da Rede",       desc:"Responda 10 vezes no fórum.",                    rarity:"rare",      pts:45,  check:()=>Number(localStorage.getItem("spider_replies_sent")||0)>=10},
  {id:"chat_hello",   icon:"👋", title:"Olá, Rede!",        desc:"Envie sua primeira mensagem no chat.",            rarity:"common",    pts:15,  check:()=>Number(localStorage.getItem("spider_chat_sent")||0)>=1},
  // ── PERFIL / SISTEMA ──
  {id:"set_avatar",   icon:"🎨", title:"Identidade Visual", desc:"Defina um avatar personalizado.",                 rarity:"common",    pts:15,  check:()=>!!localStorage.getItem("spider_has_avatar")},
  {id:"set_bio",      icon:"📄", title:"Quem Sou Eu",       desc:"Escreva sua bio no perfil.",                     rarity:"common",    pts:15,  check:()=>!!localStorage.getItem("spider_has_bio")},
  {id:"skin_buy",     icon:"🛒", title:"Consumidor Neon",   desc:"Compre qualquer skin na loja.",                  rarity:"rare",      pts:40,  check:()=>{try{const o=JSON.parse(localStorage.getItem("spider_owned_skins_v2")||"[]");return o.filter(s=>s!=="neon").length>0;}catch{return false;}}},
  {id:"skin_champ",   icon:"🏆", title:"Estilo Lendário",   desc:"Equipe a skin Campeão Dourado.",                  rarity:"legendary", pts:80,  check:()=>localStorage.getItem("spider_active_skin_v2")==="champion"},
  // ── COMBINAÇÃO / PROGRESSÃO ──
  {id:"all_games",    icon:"🎮", title:"Jogador Completo",  desc:"Tenha recorde em todos os 4 mini games.",        rarity:"epic",      pts:100, check:()=>getBest("flies")>0&&getBest("snake")>0&&getBest("memory")>0&&fightWinsTotal()>0},
  {id:"score_500",    icon:"⭐", title:"Pontuador",         desc:"Acumule 500+ pontos totais no perfil.",           rarity:"rare",      pts:50,  check:()=>Number(localStorage.getItem("spider_total_score_cache")||0)>=500},
  {id:"score_2000",   icon:"🌟", title:"Super Pontuador",   desc:"Acumule 2000+ pontos totais no perfil.",         rarity:"epic",      pts:90,  check:()=>Number(localStorage.getItem("spider_total_score_cache")||0)>=2000},
  {id:"score_5000",   icon:"💎", title:"Lenda da Rede",     desc:"Acumule 5000+ pontos totais no perfil.",         rarity:"legendary", pts:200, check:()=>Number(localStorage.getItem("spider_total_score_cache")||0)>=5000},
  // ── SECRETAS ──
  {id:"secret_combo", icon:"🔥", title:"???",               desc:"Secreto. Continue jogando...",                   rarity:"secret",    pts:150, check:()=>Number(localStorage.getItem("spider_best_combo")||0)>=5, realDesc:"Alcance combo x5 nas moscas."},
  {id:"secret_dark",  icon:"🌑", title:"???",               desc:"Secreto. O escuro tem segredos...",              rarity:"secret",    pts:200, check:()=>localStorage.getItem("spider_active_skin_v2")==="venom"&&fightWinsTotal()>=5, realDesc:"Ganhe 5 lutas com a skin Venom."},
];

// Helper: fight wins total (reads both keys)
function fightWinsTotal(){ return Math.max(Number(localStorage.getItem("spider_fight_wins")||0), Number(localStorage.getItem("spider_best_fight")||0)); }

// Rarity display config
const RARITY_CFG = {
  common:    {label:"Comum",    color:"#a0aec0"},
  rare:      {label:"Raro",     color:"#63b3ed"},
  epic:      {label:"Épico",    color:"#b794f4"},
  legendary: {label:"Lendário", color:"#ffd700"},
  secret:    {label:"???",      color:"#ff3c6e"},
};
function getBest(key){
  // Primary key used by mission system
  const primary = Number(localStorage.getItem(GAME_BEST_PREFIX + key) || 0);
  // Legacy/game-specific keys fallback
  const legacy = key === 'snake'
    ? Number(localStorage.getItem('snakeHi') || 0)
    : key === 'flies'
    ? Math.max(
        Number(localStorage.getItem('flyHi_facil') || 0),
        Number(localStorage.getItem('flyHi_medio') || 0),
        Number(localStorage.getItem('flyHi_dificil') || 0)
      )
    : 0;
  return Math.max(primary, legacy);
}
async function syncGameRecordToProfile(key, value){
  if(!currentUid) return;
  const field = GAME_FIELDS[key];
  if(!field) return;
  try{ await updateDoc(doc(db,"users",currentUid),{ [field]: Math.max(Number(value)||0, Number(currentUser?.[field]||0)) }); currentUser[field]=Math.max(Number(value)||0, Number(currentUser?.[field]||0)); }catch(e){ console.warn("sync record", e); }
}
function setBest(key, value){
  const v = Number(value)||0;
  if(v > getBest(key)){
    // Write to primary key
    localStorage.setItem(GAME_BEST_PREFIX + key, String(v));
    // Keep legacy keys in sync so mini-game UI shows correct hi-score
    if(key === 'snake') localStorage.setItem('snakeHi', String(v));
    syncGameRecordToProfile(key, v);
    return true;
  }
  return false;
}
function getUnlockedAchievements(){ try{return JSON.parse(localStorage.getItem("spider_achievements")||"[]");}catch{return [];} }
async function unlockAchievement(id){
  const ach = ACHIEVEMENTS.find(a=>a.id===id); if(!ach) return;
  const unlocked = getUnlockedAchievements(); if(unlocked.includes(id)) return;
  unlocked.push(id); localStorage.setItem("spider_achievements", JSON.stringify(unlocked));
  const pts = ach.pts || 0;
  const realTitle = (ach.rarity==='secret') ? ach.realDesc || ach.title : ach.title;
  showNotification("🏅 Conquista desbloqueada: " + realTitle + (pts?` · +${pts} pts`:''));
  renderAchievements();
  if(currentUid){
    try{
      const update = { achievements: unlocked, achievementCount: unlocked.length };
      if(pts > 0) update.score = increment(pts);
      await updateDoc(doc(db,"users",currentUid), update);
      if(pts>0){ carregarPerfil(); carregarRanking(); }
    }catch{}
  }
}
function checkAchievements(){ ACHIEVEMENTS.forEach(a=>{ try{ if(a.check()) unlockAchievement(a.id); }catch{} }); }
function renderAchievements(){
  const grid=document.getElementById("achievementGrid"); if(!grid) return;
  const unlocked=getUnlockedAchievements();
  const RARITY_ORDER = ['legendary','epic','rare','common','secret'];
  const sorted = [...ACHIEVEMENTS].sort((a,b)=>{
    const ua=unlocked.includes(a.id), ub=unlocked.includes(b.id);
    if(ua!==ub) return ua?-1:1;
    return RARITY_ORDER.indexOf(a.rarity||'common')-RARITY_ORDER.indexOf(b.rarity||'common');
  });
  const total=ACHIEVEMENTS.length, got=unlocked.length;
  const RC = typeof RARITY_CFG!=='undefined' ? RARITY_CFG : {};
  grid.innerHTML = `<div class="ach-summary">🏅 ${got}/${total} desbloqueadas</div>` +
    sorted.map(a=>{
      const isUnlocked=unlocked.includes(a.id);
      const isSecret=a.rarity==='secret'&&!isUnlocked;
      const rc=RC[a.rarity]||{label:'',color:'#888'};
      const icon=isSecret?'🔒':a.icon;
      const title=isSecret?'???':a.title;
      const desc=isSecret?(a.desc||'Conquista secreta'):a.desc;
      const pts=a.pts?`<span class="ach-pts">+${a.pts}pts</span>`:'';
      const badge=`<span class="ach-rarity" style="color:${rc.color}">${rc.label||''}</span>`;
      return `<div class="achievement-card ${isUnlocked?'unlocked':''} ach-rarity-${a.rarity||'common'}">
        <span class="ach-icon">${icon}</span>
        <div class="ach-body"><b>${title}</b><small>${desc}</small>
          <div class="ach-footer">${badge}${pts}</div>
        </div>
      </div>`;
    }).join("");
}
function updateGameBestLabels(){
  const map = { flyBest: "flies", snakeBest: "snake", memoryBest: "memory" };
  Object.entries(map).forEach(([id,key])=>{ const el=document.getElementById(id); if(el) el.textContent = getBest(key); });
  renderAchievements(); checkAchievements();
}
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
  // Expose to upgrade scripts (spider-upgrades.js, spider-pro-upgrades.js)
  window._spiderUid  = currentUid;
  window._spiderUser = currentUser;
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
  document.getElementById("tabLoginBtn").classList.add("active
