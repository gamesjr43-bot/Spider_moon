
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
  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const icon  = icons[type] || "✅";
  const n = document.createElement("div");
  n.className = "notification " + type;
  n.innerHTML = `<span class="notif-icon">${icon}</span><span class="notif-msg">${sanitizeHTML(String(msg))}</span>`;
  document.body.appendChild(n);
  requestAnimationFrame(()=>n.classList.add('show'));
  setTimeout(()=>{ n.classList.remove('show'); setTimeout(()=>n.remove(), 400); }, 3200);
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
function isAdmin()    { return currentUser?.role === "admin"; }

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
  // ── STREAK / LOGIN ──
  {id:"streak_3",     icon:"🔥", title:"Em Chamas",       desc:"Faça login 3 dias seguidos.",           rarity:"rare",      pts:45,  check:()=>Number(localStorage.getItem("spider_login_streak")||0)>=3},
  {id:"streak_7",     icon:"🔥", title:"Semana de Fogo",  desc:"Faça login 7 dias seguidos.",           rarity:"epic",      pts:100, check:()=>Number(localStorage.getItem("spider_login_streak")||0)>=7},
  {id:"streak_30",    icon:"💫", title:"Dedicação Total", desc:"Faça login 30 dias seguidos.",          rarity:"legendary", pts:300, check:()=>Number(localStorage.getItem("spider_login_streak")||0)>=30},
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
// ===== LEVEL / XP SYSTEM =====
const LEVELS = [
  {level:1,  xp:0,     title:"Recruta",        icon:"🕷"},
  {level:2,  xp:100,   title:"Rastreador",     icon:"🕸"},
  {level:3,  xp:250,   title:"Caçador",        icon:"🔍"},
  {level:4,  xp:500,   title:"Infiltrador",    icon:"🌑"},
  {level:5,  xp:900,   title:"Hacker",         icon:"💻"},
  {level:6,  xp:1400,  title:"Agente Neon",    icon:"⚡"},
  {level:7,  xp:2000,  title:"Venomita",       icon:"🐍"},
  {level:8,  xp:3000,  title:"Aranha Élite",   icon:"🕷"},
  {level:9,  xp:4500,  title:"Predador",       icon:"🔥"},
  {level:10, xp:6500,  title:"Lenda da Rede",  icon:"👑"},
];

function getLevel(xp){
  let lv = LEVELS[0];
  for(const l of LEVELS){ if(xp >= l.xp) lv = l; else break; }
  return lv;
}
function getNextLevel(xp){
  return LEVELS.find(l=>l.xp > xp) || null;
}
function getLevelProgress(xp){
  const cur  = getLevel(xp);
  const next = getNextLevel(xp);
  if(!next) return 100;
  return Math.round(((xp - cur.xp)/(next.xp - cur.xp))*100);
}
function renderLevelBadge(score){
  const lv   = getLevel(score||0);
  const next = getNextLevel(score||0);
  const pct  = getLevelProgress(score||0);
  const xpLeft = next ? (next.xp - (score||0)) : 0;
  return `<div class="level-badge">
    <span class="level-icon">${lv.icon}</span>
    <div class="level-info">
      <span class="level-title">${lv.title}</span>
      <span class="level-num">Nível ${lv.level}</span>
    </div>
    <div class="level-bar-wrap">
      <div class="level-bar" style="width:${pct}%"></div>
    </div>
    ${next ? `<span class="level-xp-left">${xpLeft} XP p/ ${next.title}</span>` : `<span class="level-xp-left">MAX LEVEL 🏆</span>`}
  </div>`;
}

// ── STREAK SYSTEM ──
function getDailyStreak(){
  const last  = localStorage.getItem('spider_last_login_day') || '';
  const today = new Date().toDateString();
  const yest  = new Date(Date.now()-86400000).toDateString();
  let streak  = Number(localStorage.getItem('spider_login_streak')||0);
  if(last === today) return streak;
  if(last === yest)  streak++;
  else               streak = 1;
  localStorage.setItem('spider_login_streak', String(streak));
  localStorage.setItem('spider_last_login_day', today);
  // bonus XP for streak
  if(streak > 1 && currentUid){
    const bonus = Math.min(streak * 5, 50);
    updateDoc(doc(db,"users",currentUid),{ score:increment(bonus) }).catch(()=>{});
    showNotification(`🔥 ${streak} dias seguidos! +${bonus} XP de bônus`, "success");
    checkAchievements();
  }
  return streak;
}

function renderStreakBadge(streak){
  if(!streak || streak < 1) return '';
  const fire = streak >= 7 ? '🔥🔥🔥' : streak >= 3 ? '🔥🔥' : '🔥';
  return `<div class="streak-badge">${fire} <span>${streak} dia${streak>1?'s':''} seguido${streak>1?'s':''}</span></div>`;
}

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
  // Rich achievement toast
  const toastEl = document.createElement('div');
  toastEl.className = 'achievement-toast';
  toastEl.innerHTML = `
    <div class="ach-toast-icon">${ach.rarity==='legendary'?'✨':ach.rarity==='epic'?'💫':''} ${ach.icon}</div>
    <div class="ach-toast-body">
      <span class="ach-toast-label">CONQUISTA DESBLOQUEADA</span>
      <b class="ach-toast-title">${sanitizeHTML(realTitle)}</b>
      ${pts ? `<span class="ach-toast-pts">+${pts} pts</span>` : ''}
    </div>`;
  document.body.appendChild(toastEl);
  requestAnimationFrame(()=>toastEl.classList.add('show'));
  setTimeout(()=>{ toastEl.classList.remove('show'); setTimeout(()=>toastEl.remove(), 500); }, 3500);
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
  setTimeout(()=>getDailyStreak(), 800); // daily streak + bonus XP
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
  // Keep total score cache in sync for achievement checks
  if(currentUser.score) localStorage.setItem("spider_total_score_cache", String(currentUser.score));

  // Inject level badge into profile
  const lvBadgeEl = document.getElementById("profileLevelBadge");
  if(lvBadgeEl) lvBadgeEl.innerHTML = renderLevelBadge(currentUser.score||0);

  // Inject streak into profile
  const streak = getDailyStreak();
  const streakEl = document.getElementById("profileStreak");
  if(streakEl) streakEl.innerHTML = renderStreakBadge(streak);

  // Update extended stats
  const statEls = {
    statFightWins:  currentUser.fightWins || 0,
    statBestSnake:  currentUser.bestSnake  || 0,
    statBestFlies:  currentUser.bestFlies  || 0,
    statBestMemory: currentUser.bestMemory || 0,
    statAchievements: getUnlockedAchievements().length + "/" + ACHIEVEMENTS.length,
  };
  Object.entries(statEls).forEach(([id,val])=>{ const e=document.getElementById(id); if(e) e.textContent=val; });

  checkAchievements();
  return true; // allows await carregarPerfil() callers to chain
}

window.salvarPerfil = async function(){
  if(!requireLogin()) return;
  const bio = document.getElementById("bioInput").value;
  try {
    await updateDoc(doc(db,"users",currentUid),{bio});
    currentUser.bio = bio;
    if(bio && bio.trim().length > 0) localStorage.setItem("spider_has_bio","1");
    showMessage("profileMsg","✅ Perfil salvo!","success");
    setTimeout(()=>showMessage("profileMsg",""),2500);
    checkAchievements();
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
      localStorage.setItem("spider_has_avatar","1");
      showMessage("profileMsg","✅ Avatar atualizado!","success");
      checkAchievements();
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
      const lv = getLevel(u.score||0);
      return `
        <div class="rank-item ${i<3?"rank-"+(i+1):""} ${isMe?"rank-me":""}" style="animation-delay:${i*0.05}s">
          ${pos}
          <div class="rank-avatar-wrap">
            <img src="${avatarSrc}" class="rank-avatar">
            <span class="rank-level-pip" title="${lv.title}">${lv.icon}</span>
          </div>
          <div class="rank-name-block">
            <span class="rank-name" style="${isMe?"color:var(--primary)":""}">
              ${sanitizeHTML(u.user)} ${isMe?"<span class='rank-me-tag'>(você)</span>":""}
            </span>
            <span class="rank-title-tag">${lv.title} · Nv${lv.level}</span>
          </div>
          <div class="rank-stats">
            <span class="rank-score">${value.toLocaleString('pt-BR')}</span>
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
    const isAdmin = msg.role==="admin";
    const isMod   = msg.role==="mod";
    const roleIcon = isAdmin?"👑": isMod?"🛡":"";
    const roleCls  = isAdmin?"adminUser": isMod?"modUser":"";
    // Highlight @mentions
    const content = sanitizeHTML(msg.content)
      .replace(/@(\w+)/g,'<span class="chat-mention">@$1</span>');
    return `
      <div class="chat-msg ${own?"own":""} ${isAdmin?"admin":""} ${isMod?"mod":""}">
        <div class="chat-msg-header">
          <span class="chat-msg-user ${roleCls}">${roleIcon} ${sanitizeHTML(msg.user)}</span>
          <span class="chat-msg-time">${formatDate(msg.createdAt)}</span>
          ${!own?`<button class="chat-reply-btn" onclick="chatMention('${sanitizeHTML(msg.user)}')">@</button>`:''}
        </div>
        <div class="chat-msg-content">${content}</div>
        <div class="chat-reactions" id="cr-${msg.id||''}">
          ${renderChatReactions(msg.reactions||{})}
        </div>
      </div>`;
  }).join("");
  div.scrollTop = div.scrollHeight;
}

function renderChatReactions(reactions){
  const emojis = ['👍','❤️','😂','😮','🔥','🕷'];
  return emojis.map(e=>{
    const count = reactions[e] || 0;
    return `<button class="chat-react-btn ${count>0?'active':''}" onclick="addChatReaction('${e}')">${e}${count>0?` <span>${count}</span>`:''}</button>`;
  }).join('');
}

window.chatMention = function(username){
  const input = document.getElementById("chatInput");
  if(input){ input.value = `@${username} ${input.value}`; input.focus(); }
};

// Quick emoji picker for chat
window.toggleChatEmoji = function(){
  const picker = document.getElementById("chatEmojiPicker");
  if(picker) picker.classList.toggle("show");
};
window.insertChatEmoji = function(e){
  const input = document.getElementById("chatInput");
  if(input){ input.value += e; input.focus(); }
  const picker = document.getElementById("chatEmojiPicker");
  if(picker) picker.classList.remove("show");
};
window.addChatReaction = function(emoji){
  showNotification("Reações chegam em breve! 🔜","info");
};

window.sendChat = async function(){
  if(!requireLogin()) return;
  const input = document.getElementById("chatInput");
  const content = input.value.trim(); if(!content) return;
  try {
    await addDoc(collection(db,"chat"),{ uid:currentUid, user:currentUser.user,
      role:currentUser.role||"user", content, createdAt:serverTimestamp() });
    input.value = "";
    const chatCount = Number(localStorage.getItem("spider_chat_sent")||0)+1;
    localStorage.setItem("spider_chat_sent", String(chatCount));
    checkAchievements();
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
  adminHideAll();
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
  adminHideAll();
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
  adminHideAll();
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
  adminHideAll();
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
  _lastFlyCombo = 0;
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
        if(combo > _lastFlyCombo) _lastFlyCombo = combo; // expose for stopGame
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

// lastFlyCombo is set inside startGame loop to expose combo value for stopGame
let _lastFlyCombo = 0;

async function stopGame(saveScore=true){
  clearInterval(gameInterval);
  clearInterval(flyTimerInterval);
  if(saveScore && score>0){
    const isNew = setBest("flies", score);
    updateGameBestLabels();
    if(isNew) showNotification("🏆 Novo recorde nas moscas: " + score);
    // Track best combo (captured via _lastFlyCombo since combo is scoped inside startGame)
    if(_lastFlyCombo > 0){
      const prev = Number(localStorage.getItem("spider_best_combo")||0);
      if(_lastFlyCombo > prev) localStorage.setItem("spider_best_combo", String(_lastFlyCombo));
    }
    checkAchievements();
  }
  if(saveScore && score>0 && currentUid){
    try{
      await updateDoc(doc(db,"users",currentUid),{ score:increment(score), flies:increment(Math.floor(score/10)) });
      await carregarPerfil();
      carregarRanking();
      // Update score cache AFTER profile reload so it reflects actual Firestore value
      if(currentUser?.score) localStorage.setItem("spider_total_score_cache", String(currentUser.score));
      checkAchievements();
    }catch(e){ console.warn("stopGame save error:", e); }
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
  let foodEaten = 0;
  let running   = false;
  let powerUp   = null;   // {x,y,type,timer}
  let activePowerUp  = null;
  let powerUpTimer   = 0;
  const POWER_UPS = ['double','speed','shrink'];
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
      const multiplier = activePowerUp === 'double' ? 2 : 1;
      pts += 10 * level * multiplier;
      foodEaten++;
      document.getElementById("snakeScore").textContent = pts;
      showScorePopup(10*level*multiplier, multiplier>1?'#ffd700':null);
      spawnFood();
      // 20% chance to spawn power-up
      if(!powerUp && Math.random()<0.20) spawnPowerUp();
      /* level up every 5 foods eaten */
      if(foodEaten > 0 && foodEaten % 5 === 0){
        level++;
        document.getElementById("snakeLevelStat").textContent = String(level);
        document.getElementById("snakeHint").textContent="⬆ LEVEL "+level+"!";
        setTimeout(()=>{ if(!dead) document.getElementById("snakeHint").textContent=""; },1200);
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

    /* eat power-up */
    if(powerUp && nh.x===powerUp.x && nh.y===powerUp.y){
      activatePowerUp(powerUp.type);
      powerUp=null;
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
    // Save max level reached for achievement
    const prevMaxLevel = Number(localStorage.getItem("spider_snake_maxlevel")||0);
    if(level > prevMaxLevel) localStorage.setItem("spider_snake_maxlevel", String(level));
    if(currentUid && pts>0){
      updateDoc(doc(db,"users",currentUid),{ score:increment(pts), bestSnake:Math.max(pts, Number(currentUser?.bestSnake||0)) })
        .then(async ()=>{
          carregarRanking();
          await carregarPerfil();
          // Update score cache AFTER profile reload
          if(currentUser?.score) localStorage.setItem("spider_total_score_cache", String(currentUser.score));
          checkAchievements();
        }).catch(e=>{ console.warn("snake save error:", e); checkAchievements(); });
    } else {
      checkAchievements();
    }
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
  // Support both ID conventions: fightDiffNormal/Hard/Nightmare
  ["Normal","Hard","Nightmare"].forEach(n=>{
    const el = document.getElementById("fightDiff"+n);
    if(el) el.classList.toggle("active", level === n.toLowerCase());
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
  if(modal.classList.contains("open")){ modal.classList.remove("open"); stopFight(); return; }
  stopFight();
  modal.classList.add("open");
  startFight();
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
window.carregarChat    = carregarChat;

// ===== MORTAL SPIDER V5 moved inside initApp scope =====
// ===== MORTAL SPIDER V5 - jogabilidade refinada, personagens e controles premium =====
// Upgrade focado no mini game de luta: personagens com silhueta melhor, botões mais claros,
// IA menos previsível, golpes com alcance/tempo diferentes, air kick, uppercut, parry simples,
// impacto visual, som leve via WebAudio e tela de round/K.O. mais legível.
(function(){
  const FIGHT_V5 = true;
  let audioCtxFight = null;
  function fightBeep(type){
    try{
      if(localStorage.getItem('spider_sound_muted') === '1') return;
      audioCtxFight = audioCtxFight || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxFight;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const map = {
        tap:[520,.018,.035], punch:[150,.032,.07], kick:[95,.04,.08], block:[360,.02,.045], special:[720,.08,.12], ko:[70,.20,.16], round:[440,.06,.10]
      }[type] || [260,.025,.05];
      osc.type = type==='special' ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(map[0], now);
      if(type==='special') osc.frequency.exponentialRampToValueAtTime(180, now+map[2]);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(map[1], now+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now+map[2]);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now+map[2]+.02);
    }catch(e){}
  }

  const oldFbDown = window.fbDown;
  window.fbDown = function(e, player, action){
    try{ if(e){ e.preventDefault(); e.stopPropagation(); } }catch(_){ }
    fbState[player+'_'+action] = true;
    try{
      const btn = e && e.currentTarget;
      if(btn) btn.classList.add('pressed');
      if(navigator.vibrate) navigator.vibrate(action==='special' ? 18 : 8);
      fightBeep('tap');
    }catch(_){ }
  };
  window.fbUp = function(e, player, action){
    try{ if(e){ e.preventDefault(); e.stopPropagation(); } }catch(_){ }
    fbState[player+'_'+action] = false;
    try{ const btn = e && e.currentTarget; if(btn) btn.classList.remove('pressed'); }catch(_){ }
  };

  function installFightV5UI(){
    const hint = document.querySelector('#fightModal .game-hint');
    if(hint) hint.innerHTML = 'Mortal Spider V5: controles mais confortáveis, personagens melhores, air kick, uppercut, parry, impacto, IA refinada e K.O. premium.';
    const canvas = document.getElementById('fightCanvas');
    if(canvas && !document.getElementById('fightMoveAssist')){
      const assist = document.createElement('div');
      assist.id = 'fightMoveAssist';
      assist.className = 'fight-v5-assist';
      assist.innerHTML = '<span>PC: A/D mover · W pular · C defender · E dash · F soco · G chute · H/ESPAÇO especial</span><span>Mobile: segure defesa no tempo certo para aparar</span>';
      canvas.insertAdjacentElement('afterend', assist);
    }
  }

  window.startFight = function(){
    installFightV5UI();
    const canvas = document.getElementById('fightCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width || 500, H = canvas.height || 240;
    const GROUND = H - 32, GRAV = .78, BEST = 2;

    if(typeof setFightDifficulty === 'function') setFightDifficulty(fightDifficulty || 'hard');
    document.removeEventListener('keydown', fightKeyDown);
    document.removeEventListener('keyup', fightKeyUp);
    document.addEventListener('keydown', fightKeyDown);
    document.addEventListener('keyup', fightKeyUp);
    Object.keys(fbState).forEach(k=>fbState[k]=false);

    const DIFF = {
      normal:{timer:99, react:24, aggro:.45, block:.16, dash:.08, special:.10, damage:.92, speed:2.12},
      hard:{timer:90, react:17, aggro:.62, block:.28, dash:.18, special:.22, damage:1.00, speed:2.34},
      nightmare:{timer:80, react:10, aggro:.82, block:.42, dash:.33, special:.40, damage:1.12, speed:2.58}
    }[fightDifficulty] || {timer:90, react:17, aggro:.62, block:.28, dash:.18, special:.22, damage:1, speed:2.34};

    const PAL = {
      spider:{main:'#00ffc8', light:'#7dffe9', dark:'#032c2a', suit:'#071717', glow:'rgba(0,255,200,.85)', eye:'#eaffff'},
      venom:{main:'#ff3c6e', light:'#ff8aa6', dark:'#2a0610', suit:'#17060d', glow:'rgba(255,60,110,.86)', eye:'#ffd6df'},
      gold:{main:'#ffd700', light:'#fff2a0', dark:'#3a2d00', suit:'#1e1904', glow:'rgba(255,215,0,.86)', eye:'#fff8d0'}
    };
    const MOVES = {
      punch:{name:'Soco', start:3, end:9, total:18, range:47, dmg:6, stun:13, push:4.5, cost:8, gain:7, col:'#00ffc8'},
      kick:{name:'Chute', start:7, end:16, total:29, range:67, dmg:11, stun:18, push:8.2, cost:15, gain:10, col:'#ff7a3c'},
      air:{name:'Air Kick', start:5, end:18, total:31, range:60, dmg:9, stun:16, push:7.4, cost:12, gain:10, col:'#8df0ff'},
      upper:{name:'Uppercut', start:6, end:15, total:34, range:45, dmg:13, stun:22, push:6.5, cost:20, gain:12, col:'#ffd700'},
      special:{name:'Especial', start:14, end:28, total:50, range:92, dmg:24, stun:30, push:13, cost:0, gain:0, col:'#ffd700'}
    };

    let tick=0, timer=DIFF.timer*60, round=1, p1R=0, p2R=0, intro=82, roundOver=false, matchOver=false, overTimer=0;
    let hitStop=0, shake=0, particles=[], texts=[], waves=[], afterImages=[], cpuClock=0;

    function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
    function q(id){ return document.getElementById(id); }
    function btnClear(p){ ['left','right','jump','dash','block','punch','kick','special'].forEach(a=>fbState[p+'_'+a]=false); }
    function status(txt,col){ const el=q('fightStatus'); if(el){ el.textContent=txt; el.style.color=col || ''; } }
    function makeFighter(x,pal,name,face,cpu=false){
      return {x,y:GROUND,vx:0,vy:0,face,cpu,pal,name,hp:100,st:100,sp:0,guard:100,onGround:true,coyote:0,
        action:null,af:0,hitDone:false,buffer:null,block:false,blockAge:0,parry:0,inv:0,hurt:0,stun:0,guardBreak:0,dashCd:0,cool:0,
        combo:0,comboT:0,walk:0,lastDir:0,ko:false};
    }
    let p1 = makeFighter(86,PAL.spider,'SPIDER',1,false);
    let p2 = makeFighter(W-86,PAL.venom,'VENOM',-1,true);
    fightState = {players:[p1,p2], version:'V5'};

    function resetBtnVisual(){
      document.querySelectorAll('.fight-btn').forEach(b=>b.classList.remove('pressed','special-ready','cooldown'));
    }
    function updateHud(){
      [['p1',p1],['p2',p2]].forEach(([id,p])=>{
        const hp=q(id+'Hp'), hpN=q(id+'HpNum'), sp=q(id+'Sp'), st=q(id+'St');
        if(hp) hp.style.width=clamp(p.hp,0,100)+'%'; if(hpN) hpN.textContent=Math.ceil(clamp(p.hp,0,100));
        if(sp) sp.style.width=clamp(p.sp,0,100)+'%'; if(st) st.style.width=clamp(p.st,0,100)+'%';
      });
      const tm=q('fightTimerDisplay'); if(tm){ tm.textContent=Math.max(0,Math.ceil(timer/60)); tm.style.color=timer<15*60?'#ff3c6e':'#ffd700'; }
      const rd=q('fightRoundLabel'); if(rd) rd.textContent='ROUND '+round;
      document.querySelectorAll('.fight-btn-special').forEach(b=>b.classList.toggle('special-ready', p1.sp>=100));
      document.querySelectorAll('.fight-btn').forEach(b=>{
        const label=(b.getAttribute('aria-label')||'').toLowerCase();
        const active = (label.includes('soco') && p1.action==='punch') || (label.includes('chute') && (p1.action==='kick'||p1.action==='air')) || (label.includes('especial') && p1.action==='special') || (label.includes('defender') && p1.block) || (label.includes('dash') && p1.dashCd>28);
        b.classList.toggle('pressed', !!active);
      });
    }
    function addText(txt,x,y,col){ texts.push({txt,x,y,col,life:42}); }
    function burst(x,y,col,n=10,power=1){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, s=(1+Math.random()*3.6)*power; particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.2,size:2+Math.random()*3.5,col,life:26+Math.random()*22}); } }
    function wave(x,y,col){ waves.push({x,y,r:5,col,life:22}); }
    function trail(p){ afterImages.push({x:p.x,y:p.y,face:p.face,pal:p.pal,life:12}); }
    function vibrate(n){ try{ if(navigator.vibrate) navigator.vibrate(n); }catch(e){} }

    function readInput(){
      const key=k=>!!fightKeys[k];
      fbState.p1_left    = !!(key('a')||key('A')||fbState.p1_left);
      fbState.p1_right   = !!(key('d')||key('D')||fbState.p1_right);
      fbState.p1_jump    = !!(key('w')||key('W')||fbState.p1_jump);
      fbState.p1_dash    = !!(key('e')||key('E')||fbState.p1_dash);
      fbState.p1_block   = !!(key('c')||key('C')||key('s')||key('S')||fbState.p1_block);
      fbState.p1_punch   = !!(key('f')||key('F')||fbState.p1_punch);
      fbState.p1_kick    = !!(key('g')||key('G')||fbState.p1_kick);
      fbState.p1_special = !!(key('h')||key('H')||key(' ')||fbState.p1_special);
      fbState.p2_left    = !!(key('ArrowLeft') || fbState.p2_left);
      fbState.p2_right   = !!(key('ArrowRight')|| fbState.p2_right);
      fbState.p2_jump    = !!(key('ArrowUp')   || fbState.p2_jump);
      fbState.p2_block   = !!(key('ArrowDown') || fbState.p2_block);
      fbState.p2_dash    = !!(key('Shift')     || fbState.p2_dash);
      fbState.p2_punch   = !!(key('j')||key('J')||fbState.p2_punch);
      fbState.p2_kick    = !!(key('k')||key('K')||fbState.p2_kick);
      fbState.p2_special = !!(key('l')||key('L')||fbState.p2_special);
    }
    function releaseTapActions(prefix){ ['jump','dash','punch','kick','special'].forEach(a=>fbState[prefix+'_'+a]=false); }
    function startMove(p,move){
      if(p.stun>0 || p.guardBreak>0) return false;
      if(p.action){ p.buffer=move; return false; }
      const m=MOVES[move]; if(!m) return false;
      if(move==='special' && p.sp<100) return false;
      if(move!=='special' && p.st<m.cost) return false;
      p.action=move; p.af=0; p.hitDone=false; p.cool=m.total; p.block=false; p.st=Math.max(0,p.st-m.cost); if(move==='special') p.sp=0;
      if(move==='upper') p.vy=-3.4; if(move==='air') p.vy=Math.min(p.vy,1.8);
      fightBeep(move==='kick'||move==='air'?'kick':move==='special'?'special':'punch');
      return true;
    }
    function applyInput(p,pre){
      if(p.stun>0 || p.ko){ releaseTapActions(pre); return; }
      const L=fbState[pre+'_left'], R=fbState[pre+'_right'];
      const J=fbState[pre+'_jump'], D=fbState[pre+'_dash'], B=fbState[pre+'_block'];
      const P=fbState[pre+'_punch'], K=fbState[pre+'_kick'], S=fbState[pre+'_special'];
      if(B && !p.action && p.guardBreak<=0 && p.st>3){ p.block=true; p.blockAge++; p.st=Math.max(0,p.st-.28); p.vx*=.72; if(p.blockAge<9) p.parry=7; }
      else { p.block=false; p.blockAge=0; p.parry=Math.max(0,p.parry-1); }
      if(!p.block && !p.action){
        if(L){ p.vx-=.62; p.face=-1; p.lastDir=-1; }
        if(R){ p.vx+=.62; p.face=1; p.lastDir=1; }
        p.vx=clamp(p.vx,-3.6,3.6); if(Math.abs(p.vx)>.3) p.walk++;
      }
      if(J && (p.onGround || p.coyote>0) && p.st>=10){ p.vy=-11.8; p.onGround=false; p.coyote=0; p.st-=10; }
      if(D && p.dashCd<=0 && p.st>=18){ const dir=(R?1:L?-1:p.face); p.vx=dir*9.2; p.face=dir; p.dashCd=42; p.st-=18; p.inv=8; trail(p); burst(p.x,p.y-38,p.pal.main,6,.45); }
      if(S) startMove(p,'special');
      else if(P && J) startMove(p,'upper');
      else if(K && !p.onGround) startMove(p,'air');
      else if(P) startMove(p,'punch');
      else if(K) startMove(p,'kick');
      releaseTapActions(pre);
    }
    function cpuAI(){
      cpuClock++; if(cpuClock%DIFF.react!==0 || roundOver || matchOver) return;
      const dist=Math.abs(p1.x-p2.x), dir=p1.x<p2.x?-1:1;
      btnClear('p2');
      p2.face=dir;
      const dangerous = p1.action && Math.abs(p1.x-p2.x)<95 && Math.random()<DIFF.block;
      if(dangerous){ fbState.p2_block=true; return; }
      if(dist>88){ fbState.p2_left=dir<0; fbState.p2_right=dir>0; if(Math.random()<DIFF.dash) fbState.p2_dash=true; }
      else if(dist<42){ fbState.p2_left=dir>0; fbState.p2_right=dir<0; if(Math.random()<.18) fbState.p2_dash=true; }
      if(dist<108 && Math.random()<DIFF.aggro){
        const r=Math.random();
        if(p2.sp>=100 && r<DIFF.special) fbState.p2_special=true;
        else if(r<.47) fbState.p2_punch=true;
        else if(r<.84) fbState.p2_kick=true;
        else fbState.p2_jump=true;
      }
    }
    function damageTarget(t,a,move){
      if(t.inv>0 || t.ko) return;
      const m=MOVES[move]; let dmg=m.dmg*(a.cpu?DIFF.damage:1);
      if(t.block && t.guardBreak<=0){
        if(t.parry>0){ a.stun=18; a.vx=-a.face*4; addText('PARRY!',t.x,t.y-100,'#8df0ff'); burst(t.x+t.face*22,t.y-54,'#8df0ff',14,.9); wave(t.x,t.y-54,'#8df0ff'); fightBeep('block'); return; }
        t.guard-=move==='special'?36:move==='kick'?22:13; dmg*= move==='special'?.42:.23; t.vx+=a.face*m.push*.38; addText('BLOCK',t.x,t.y-93,'#bfe8ff'); burst(t.x,t.y-55,'#bfe8ff',5,.35); fightBeep('block');
        if(t.guard<=0){ t.guardBreak=52; t.block=false; t.stun=20; t.guard=42; addText('GUARDA QUEBRADA!',t.x,t.y-108,'#ffd700'); burst(t.x,t.y-55,'#ffd700',22,1); shake=7; }
      } else {
        t.hp=clamp(t.hp-dmg,0,100); t.stun=m.stun; t.hurt=18; t.inv=move==='special'?4:2; t.vx+=a.face*m.push; t.vy-=move==='upper'?5.3:move==='special'?3.2:1.6;
        a.combo++; a.comboT=95; a.sp=clamp(a.sp+m.gain+(a.combo>2?4:0),0,100);
        addText('-'+Math.round(dmg),t.x,t.y-96,m.col); if(a.combo>1) addText(a.combo+' HIT',a.x,a.y-116,'#ffd700');
        burst(t.x,t.y-55,m.col,move==='special'?30:move==='upper'?20:14,move==='special'?1.25:.82); wave(t.x,t.y-55,m.col);
        hitStop=move==='special'?9:move==='kick'||move==='upper'?6:4; shake=move==='special'?11:move==='kick'||move==='upper'?7:4;
        fightBeep(move==='special'?'special':move==='kick'||move==='air'?'kick':'punch'); vibrate(move==='special'?38:18);
      }
      if(t.hp<=0){ t.ko=true; fightBeep('ko'); }
    }
    function hitCheck(a,t){
      if(!a.action || a.hitDone) return;
      const m=MOVES[a.action]; if(!m || a.af<m.start || a.af>m.end) return;
      const dx=(t.x-a.x)*a.face, dy=Math.abs((t.y-50)-(a.y-50));
      const ok = dx>2 && dx<m.range && dy<(a.action==='upper'?82:72);
      if(ok){ a.hitDone=true; damageTarget(t,a,a.action); }
    }
    function step(p){
      p.inv=Math.max(0,p.inv-1); p.hurt=Math.max(0,p.hurt-1); p.dashCd=Math.max(0,p.dashCd-1); p.guardBreak=Math.max(0,p.guardBreak-1); p.parry=Math.max(0,p.parry-1); p.stun=Math.max(0,p.stun-1);
      p.comboT=Math.max(0,p.comboT-1); if(p.comboT<=0) p.combo=0;
      if(!p.block && !p.action) p.st=clamp(p.st+(p.onGround?.74:.38),0,100);
      if(!p.block) p.guard=clamp(p.guard+.38,0,100);
      p.vy+=GRAV; p.x+=p.vx; p.y+=p.vy; p.vx*=p.onGround?.80:.93;
      if(p.y>=GROUND){ p.y=GROUND; p.vy=0; p.onGround=true; p.coyote=7; } else { p.onGround=false; p.coyote=Math.max(0,p.coyote-1); }
      p.x=clamp(p.x,27,W-27);
      if(p.action){ p.af++; if(p.action==='special' && p.af%3===0) burst(p.x+p.face*54,p.y-52,p.pal.main,2,.4); if(p.af>=MOVES[p.action].total){ const next=p.buffer; p.action=null; p.af=0; p.hitDone=false; p.buffer=null; if(next) startMove(p,next); } }
    }
    function endRound(winner){
      if(roundOver || matchOver) return;
      roundOver=true; overTimer=128; if(winner===p1) p1R++; else p2R++; status(winner.name+' venceu',winner.pal.main);
      burst(winner.x,winner.y-55,winner.pal.main,28,1.15); wave(winner.x,winner.y-55,winner.pal.main);
      if(p1R>=BEST || p2R>=BEST){
        matchOver=true; overTimer=999999; const p1Win=p1R>p2R; status(p1Win?'SPIDER CAMPEÃO':'VENOM CAMPEÃO',p1Win?p1.pal.main:p2.pal.main);
        if(p1Win){
          const wins=Number(localStorage.getItem('spider_fight_wins')||0)+1;
          localStorage.setItem('spider_fight_wins',String(wins));
          // Track nightmare wins for achievement
          if((fightDifficulty||'hard')==='nightmare'){
            const nm=Number(localStorage.getItem('spider_fight_nightmare_wins')||0)+1;
            localStorage.setItem('spider_fight_nightmare_wins',String(nm));
          }
          // Update score cache for milestone achievements
          if(currentUser?.score) localStorage.setItem("spider_total_score_cache", String(currentUser.score+180));
          try{ if(typeof checkAchievements==='function') checkAchievements(); }catch(e){}
          try{ if(currentUid && typeof updateDoc==='function') updateDoc(doc(db,'users',currentUid),{fightWins:increment(1),score:increment(180)}).then(()=>{carregarRanking();carregarPerfil();}).catch(()=>{}); }catch(e){}
        }
      }
    }
    function nextRound(){
      round++; timer=DIFF.timer*60; intro=78; roundOver=false; particles=[]; texts=[]; waves=[]; afterImages=[];
      p1=makeFighter(86,PAL.spider,'SPIDER',1,false); p2=makeFighter(W-86,PAL.venom,'VENOM',-1,true); fightState.players=[p1,p2]; btnClear('p1'); btnClear('p2'); status(p1R+' - '+p2R,''); fightBeep('round');
    }
    function drawBG(){
      ctx.save();
      const sx=shake>0?(Math.random()-.5)*shake:0, sy=shake>0?(Math.random()-.5)*shake:0; if(shake>0) shake*=.84; ctx.translate(sx,sy);
      const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#090916'); g.addColorStop(.6,'#05070b'); g.addColorStop(1,'#010102'); ctx.fillStyle=g; ctx.fillRect(-30,-30,W+60,H+60);
      ctx.strokeStyle='rgba(0,255,200,.10)'; ctx.lineWidth=1;
      for(let x=-60;x<W+80;x+=36){ ctx.beginPath(); ctx.moveTo(x,GROUND+18); ctx.lineTo(W/2+(x-W/2)*.22,H-2); ctx.stroke(); }
      for(let y=GROUND+16;y<H;y+=10){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.fillStyle='rgba(255,255,255,.035)'; ctx.font="900 58px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('MORTAL',W/2,68); ctx.fillText('SPIDER',W/2,126);
      ctx.fillStyle='rgba(0,255,200,.11)'; ctx.fillRect(0,GROUND+3,W,3); ctx.fillStyle='rgba(255,60,110,.11)'; ctx.fillRect(0,GROUND+10,W,2); ctx.restore();
    }
    function limb(x1,y1,x2,y2,col,w=6){ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
    function fighterSilhouette(x,y,face,pal,alpha=.28){ ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=pal.main; ctx.beginPath(); ctx.ellipse(x,y-45,20,42,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    function drawFighter(p){
      const f=p.face, bob=Math.sin(tick*.12+p.x*.03)*2, walk=(Math.sin(p.walk*.55)*6)*(Math.abs(p.vx)>.35?1:0), x=p.x, y=p.y, pal=p.pal;
      ctx.save(); if(p.hurt>0) ctx.globalAlpha=.65+.35*Math.sin(tick*1.5); if(p.ko) ctx.globalAlpha=.55;
      ctx.shadowColor=pal.main; ctx.shadowBlur=18; fighterSilhouette(x,y,f,pal,.10);
      // cape/aura
      ctx.fillStyle=pal.dark; ctx.globalAlpha*=1; ctx.beginPath(); ctx.moveTo(x-f*15,y-62+bob); ctx.quadraticCurveTo(x-f*42,y-35,x-f*18,y-15); ctx.quadraticCurveTo(x-f*4,y-30,x-f*10,y-62+bob); ctx.fill();
      // legs
      limb(x-10,y-27,x-17+walk,y-2,pal.light,8); limb(x+10,y-27,x+17-walk,y-2,pal.light,8);
      limb(x-17+walk,y-2,x-24+walk*.5,y+5,pal.main,5); limb(x+17-walk,y-2,x+24-walk*.5,y+5,pal.main,5);
      // torso
      ctx.fillStyle=pal.suit; ctx.beginPath(); ctx.roundRect(x-20,y-69+bob,40,48,11); ctx.fill();
      ctx.strokeStyle=pal.main; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-13,y-58+bob); ctx.lineTo(x,y-38+bob); ctx.lineTo(x+13,y-58+bob); ctx.stroke();
      // head/mask
      ctx.fillStyle='#0e0e14'; ctx.beginPath(); ctx.roundRect(x-17,y-92+bob,34,29,11); ctx.fill();
      ctx.fillStyle=pal.eye; ctx.shadowColor=pal.eye; ctx.shadowBlur=10; ctx.beginPath(); ctx.ellipse(x+f*7,y-80+bob,6,3.1,0,0,Math.PI*2); ctx.ellipse(x-f*7,y-80+bob,6,3.1,0,0,Math.PI*2); ctx.fill();
      // arms with attack poses
      let armF=f*24, armB=-f*19, ay=y-54+bob;
      if(p.action==='punch'){ const r=Math.sin((p.af/MOVES.punch.total)*Math.PI); armF=f*(28+38*r); }
      if(p.action==='upper'){ const r=Math.sin((p.af/MOVES.upper.total)*Math.PI); armF=f*(22+18*r); ay=y-72-r*12; }
      if(p.action==='kick' || p.action==='air'){ const r=Math.sin((p.af/MOVES[p.action].total)*Math.PI); limb(x+f*9,y-29,x+f*(30+48*r),y-18-r*12,pal.light,9); }
      if(p.action==='special'){
        const r=Math.sin((p.af/MOVES.special.total)*Math.PI); armF=f*(32+46*r);
        ctx.strokeStyle='#ffd700'; ctx.lineWidth=4; ctx.shadowColor='#ffd700'; ctx.shadowBlur=22; ctx.beginPath(); ctx.arc(x+f*(50+42*r),y-53,12+20*r,0,Math.PI*2); ctx.stroke();
      }
      limb(x-13,y-58+bob,x+(f<0?armF:armB),ay+9,pal.main,7); limb(x+13,y-58+bob,x+(f>0?armF:armB),ay+9,pal.main,7);
      if(p.block){ ctx.strokeStyle=p.parry>0?'#8df0ff':'#bfe8ff'; ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=24; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(x+f*28,y-53,25,-1.1*f,1.1*f,f<0); ctx.stroke(); }
      if(p.guardBreak>0){ ctx.fillStyle='#ffd700'; ctx.font="900 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText('BREAK',x,y-103); }
      ctx.shadowBlur=0; ctx.fillStyle=pal.main; ctx.font="900 10px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(p.name,x,y-100);
      if(p.combo>1 && p.comboT>0){ ctx.fillStyle='#ffd700'; ctx.font="900 12px 'Orbitron',monospace"; ctx.fillText(p.combo+'x COMBO',x,y-116); }
      ctx.restore();
    }
    function drawFX(){
      afterImages.forEach(a=>{ fighterSilhouette(a.x,a.y,a.face,a.pal,a.life/45); a.life--; }); afterImages=afterImages.filter(a=>a.life>0);
      waves.forEach(w=>{ ctx.save(); ctx.globalAlpha=w.life/22; ctx.strokeStyle=w.col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(w.x,w.y,w.r,0,Math.PI*2); ctx.stroke(); ctx.restore(); w.r+=4.1; w.life--; }); waves=waves.filter(w=>w.life>0);
      particles.forEach(p=>{ ctx.save(); ctx.globalAlpha=p.life/44; ctx.fillStyle=p.col; ctx.shadowColor=p.col; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore(); p.x+=p.vx; p.y+=p.vy; p.vy+=.24; p.life--; p.size*=.965; }); particles=particles.filter(p=>p.life>0);
      texts.forEach(ft=>{ ctx.save(); ctx.globalAlpha=ft.life/42; ctx.fillStyle=ft.col; ctx.shadowColor=ft.col; ctx.shadowBlur=11; ctx.font="900 13px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(ft.txt,ft.x,ft.y); ctx.restore(); ft.y-=.75; ft.life--; }); texts=texts.filter(ft=>ft.life>0);
    }
    function overlay(){
      if(intro>0){ ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=intro>31?'#ffd700':'#00ffc8'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=28; ctx.font="900 37px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(intro>31?'ROUND '+round:'FIGHT!',W/2,H/2+10); ctx.shadowBlur=0; }
      if(roundOver && !matchOver){ const w=p1.hp>=p2.hp?p1:p2; ctx.fillStyle='rgba(0,0,0,.52)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=w.pal.main; ctx.shadowColor=w.pal.main; ctx.shadowBlur=22; ctx.font="900 30px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(w.name+' WINS!',W/2,H/2+4); ctx.shadowBlur=0; }
      if(matchOver){ const win=p1R>p2R; ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=win?'#00ffc8':'#ff3c6e'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=28; ctx.font="900 34px 'Orbitron',monospace"; ctx.textAlign='center'; ctx.fillText(win?'VITÓRIA!':'K.O.',W/2,H/2-14); ctx.shadowBlur=0; ctx.fillStyle='#ffd700'; ctx.font="900 14px 'Orbitron',monospace"; ctx.fillText('PLACAR '+p1R+' - '+p2R,W/2,H/2+17); ctx.fillStyle='#e8e8f0'; ctx.font="12px 'Exo 2',sans-serif"; ctx.fillText('toque em REVANCHE para jogar novamente',W/2,H/2+40); }
    }
    function loop(){
      fightRAF=requestAnimationFrame(loop); if(!fightState) return;
      tick++; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H); drawBG();
      if(intro>0){ intro--; drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateHud(); return; }
      if(matchOver){ drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateHud(); return; }
      if(roundOver){ drawFighter(p1); drawFighter(p2); drawFX(); overlay(); updateHud(); overTimer--; if(overTimer<=0) nextRound(); return; }
      readInput(); cpuAI(); applyInput(p1,'p1'); applyInput(p2,'p2');
      if(hitStop>0) hitStop--; else { timer--; step(p1); step(p2); }
      hitCheck(p1,p2); hitCheck(p2,p1);
      if(timer<=0) endRound(p1.hp>=p2.hp?p1:p2); if(p1.hp<=0) endRound(p2); if(p2.hp<=0) endRound(p1);
      drawFighter(p1); drawFighter(p2); drawFX(); updateHud();
    }
    status('0 - 0',''); updateHud(); fightBeep('round'); loop();
  };
})();


// ===== FORUM HELPERS =====
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
  const now = Date.now();
  const docs = snap.docs.sort((a,b)=>Number(!!b.data().pinned)-Number(!!a.data().pinned) || toMillis(b.data().createdAt)-toMillis(a.data().createdAt));

  docs.forEach(docu=>{
    const t=docu.data();
    if(t.category!==forumCurrentCategory.id) return;
    if(forumSearchTerm && !t.title?.toLowerCase().includes(forumSearchTerm) && !t.content?.toLowerCase().includes(forumSearchTerm)) return;
    const isNew = (now - toMillis(t.createdAt)) < 24*60*60*1000;
    found=true;
    list.innerHTML+=`
      <div class="forum-topic-item" onclick="forumOpenTopic('${docu.id}')" style="${t.pinned?'border-color:rgba(255,215,0,.35);':''}${t.locked?'opacity:.75;':''}">
        <div class="forum-topic-title">${t.pinned?'📌 ':''}${t.locked?'🔒 ':''}${sanitizeHTML(t.title)}${isNew?'<span class="forum-new-tag">NOVO</span>':''}</div>
        <div class="forum-topic-meta">
          <span>por <strong style="color:var(--primary)">${sanitizeHTML(t.author)}</strong></span>
          <span>❤️ ${Number(t.likes||0)}</span>
          <span>${formatDate(t.createdAt)}</span>
        </div>
      </div>`;
  });
  if(!found) list.innerHTML=`<div class="empty-state"><span class="empty-icon">📝</span>Nenhum tópico encontrado.</div>`;
}

window.forumShowCategories = function(){ forumCurrentCategory=null; forumCurrentTopic=null; carregarForum(); };
window.forumShowTopics = function(){
  forumCurrentTopic=null;
  forumSearchTerm="";
  const si=document.getElementById("forumSearchInput"); if(si) si.value="";
  forumShowView('topics'); forumLoadTopics();
};
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
  const tc = Number(localStorage.getItem("spider_topics_created")||0)+1;
  localStorage.setItem("spider_topics_created", String(tc));
  checkAchievements();
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
        ${isModAdmin()?`<button class="tiny-action" onclick="forumToggleLock(event,'${id}',${!topic.locked})">${topic.locked?'🔓 Destrancar':'🔒 Trancar'}</button>`:''}
        ${requireLogin&&!isModAdmin()?`<button class="tiny-action report-btn" onclick="forumReportTopic(event,'${id}')">⚠️ Denunciar</button>`:''}
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
        ${(isModAdmin() || r.authorId===currentUid)?`<div style="text-align:right;margin-top:6px"><button class="tiny-action danger" onclick="forumDeleteReply(event,'${docu.id}','${r.authorId}')">🗑 Apagar</button></div>`:''}
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

window.forumDeleteReply = async function(ev,id,authorId){
  ev?.stopPropagation?.();
  if(!isModAdmin() && authorId!==currentUid) return showNotification("Sem permissão.","error");
  if(!confirm("Apagar esta resposta?")) return;
  await deleteDoc(doc(db,"forumReplies",id));
  showNotification("Resposta apagada.");
  await forumLoadReplies(forumCurrentTopic.id);
};

window.forumToggleLock = async function(ev,id,value){
  ev?.stopPropagation?.(); if(!isModAdmin()) return showNotification("Só mod/admin.","error");
  await updateDoc(doc(db,"forumTopics",id),{ locked:!!value });
  showNotification(value?"Tópico trancado":"Tópico destrancado");
  forumOpenTopic(id);
};

window.forumReportTopic = async function(ev,id){
  ev?.stopPropagation?.(); if(!requireLogin()) return;
  const reason = prompt("Motivo do report (max 200 chars):");
  if(!reason||!reason.trim()) return;
  if(reason.length>200){ showNotification("Motivo muito longo.","warning"); return; }
  await addDoc(collection(db,"reports"),{ type:"topic", refId:id, reason:reason.trim(),
    reporter:currentUser.user, reporterId:currentUid, createdAt:serverTimestamp() });
  showNotification("Denúncia enviada.");
};

let forumSearchTerm = "";
let forumFilterCat  = null;
window.forumApplySearch = function(){
  forumSearchTerm = (document.getElementById("forumSearchInput")?.value||"").toLowerCase().trim();
  forumLoadTopics();
};

// ── FORUM REPORTS ADMIN PANEL ──
window.adminShowReports = async function(){
  if(!isModAdmin()) return;
  adminHideAll();
  const sec = document.getElementById("adminReportsSection");
  if(sec) sec.style.display="block";
  const list = document.getElementById("adminReportsList");
  if(!list) return;
  list.innerHTML = `<div style="color:var(--text-dim);font-size:13px">Carregando...</div>`;
  const q = query(collection(db,"reports"),orderBy("createdAt","desc"),limit(40));
  const snap = await getDocs(q);
  if(snap.empty){ list.innerHTML=`<div class="empty-state"><span class="empty-icon">✅</span>Nenhuma denúncia.</div>`; return; }
  list.innerHTML = snap.docs.map(d=>{ const r=d.data(); return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">
        Tipo: <b>${sanitizeHTML(r.type||"topic")}</b> · ID: <code>${sanitizeHTML(r.refId||"")}</code> · por <b>${sanitizeHTML(r.reporter||"?")}</b> · ${formatDate(r.createdAt)}
      </div>
      <div style="font-size:13px;color:var(--text);margin-bottom:8px">${sanitizeHTML(r.reason)}</div>
      <button onclick="adminDismissReport('${d.id}')" class="danger" style="font-size:11px;padding:5px 10px">🗑 Dispensar</button>
    </div>`; }).join("");
};

window.adminDismissReport = async function(id){
  if(!isModAdmin()) return;
  await deleteDoc(doc(db,"reports",id));
  showNotification("Denúncia dispensada.");
  adminShowReports();
};

// ===== MEMORY GAME =====
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
  grid.innerHTML = cards.map((c,idx)=>`
    <div class="memory-card-wrap" onclick="flipMemoryCard(this.querySelector('.memory-card'))">
      <button class="memory-card" data-icon="${c.icon}" data-id="${c.id}" data-index="${idx}">
        <span class="card-front">?</span>
        <span class="card-back">${c.icon}</span>
      </button>
    </div>`).join("");
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
function adminHideAll(){ ["adminUsersSection","adminAnnouncementSection","adminAuditSection","adminCategorySection","adminSecuritySection","adminReportsSection"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; }); }
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


} // end V5 IIFE

// ===== EXPOSE INTERNAL FUNCTIONS TO GLOBAL SCOPE =====
window.abrirSistema       = abrirSistema;
window.checkAchievements  = checkAchievements;
window.renderAchievements = renderAchievements;
window.unlockAchievement  = unlockAchievement;
window.showNotification   = showNotification;
window.carregarPerfil     = carregarPerfil;
window.forumShowView      = forumShowView;
// expose currentUser/currentUid for upgrade scripts
Object.defineProperty(window, 'currentUid',  { get: ()=>currentUid,  configurable:true });
Object.defineProperty(window, 'currentUser', { get: ()=>currentUser, configurable:true });

} // end initApp()
initApp();
