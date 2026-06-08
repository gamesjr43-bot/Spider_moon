/* Spider Network PRO Upgrades: missões diárias, loja de skins, moedas, temas e polimento de som */
(function(){
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const today = () => new Date().toISOString().slice(0,10);
  const STORE = {
    coins: 'spider_coins_v2',
    owned: 'spider_owned_skins_v2',
    active: 'spider_active_skin_v2',
    missions: 'spider_missions_v2',
    day: 'spider_mission_day_v2',
    statsDay: 'spider_stats_day_v2',
    theme: 'spider_theme_v2'
  };

  const SKINS = [
    {id:'neon', name:'Neon Original', price:0, icon:'🟢', desc:'Visual clássico da Spider Network.', vars:{primary:'#00ffc8', accent:'#ff3c6e', gold:'#ffd700'}},
    {id:'venom', name:'Venom Roxo', price:160, icon:'🟣', desc:'Tema roxo com energia sombria.', vars:{primary:'#a855f7', accent:'#ff2e88', gold:'#facc15'}},
    {id:'blood', name:'Spider Vermelho', price:220, icon:'🔴', desc:'Visual agressivo para Mortal Spider.', vars:{primary:'#ff3c6e', accent:'#00ffc8', gold:'#ffd700'}},
    {id:'cyber', name:'Cyber Azul', price:260, icon:'🔵', desc:'Neon azul limpo e futurista.', vars:{primary:'#38bdf8', accent:'#00ffc8', gold:'#fbbf24'}},
    {id:'champion', name:'Campeão Dourado', price:420, icon:'🏆', desc:'Skin de jogador lendário.', vars:{primary:'#ffd700', accent:'#ff3c6e', gold:'#fff3a3'}}
  ];

  function readJSON(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function coins(){ return Number(localStorage.getItem(STORE.coins) || 0); }
  function setCoins(v){ localStorage.setItem(STORE.coins, String(Math.max(0, Number(v)||0))); renderWallet(); renderShop(); }
  function addCoins(v, why=''){ setCoins(coins()+Number(v||0)); toast(`+${v} moedas${why?` · ${why}`:''}`, 'success'); sound('ok'); }
  function owned(){ const arr = readJSON(STORE.owned, ['neon']); return arr.includes('neon') ? arr : ['neon', ...arr]; }
  function setOwned(arr){ writeJSON(STORE.owned, Array.from(new Set(['neon', ...arr]))); }
  function activeSkin(){ return localStorage.getItem(STORE.active) || 'neon'; }
  function sound(type='click'){ try { window.SpiderSound?.beep(type); } catch {} }
  function toast(msg, type='success'){ if(window.showNotification) window.showNotification(msg,type); else console.log(msg); }

  function initDailyStats(){
    const d = today();
    if(localStorage.getItem(STORE.day) !== d){
      localStorage.setItem(STORE.day, d);
      writeJSON(STORE.statsDay, {games:0, topics:0, replies:0, claims:[]});
    }
  }
  function dayStats(){ initDailyStats(); return readJSON(STORE.statsDay, {games:0, topics:0, replies:0, claims:[]}); }
  function saveDayStats(s){ writeJSON(STORE.statsDay, s); renderMissions(); }
  function incStat(k){ const s=dayStats(); s[k]=Number(s[k]||0)+1; saveDayStats(s); }
  function getBest(key){ return Number(localStorage.getItem('spider_best_'+key) || 0); }
  function fightWins(){ return Math.max(Number(localStorage.getItem('spider_fight_wins') || 0), Number(localStorage.getItem('spider_best_fight') || 0)); }

  const MISSIONS = [
    // ── Diárias de jogos ──
    {id:'play3',     icon:'🎮', title:'Aquecimento Spider',  desc:'Abra 3 mini games hoje.',                    reward:60,  progress:()=>[dayStats().games,3]},
    {id:'play5',     icon:'🕹', title:'Maratona de Games',   desc:'Abra 5 mini games hoje.',                    reward:90,  progress:()=>[dayStats().games,5]},
    // ── Moscas ──
    {id:'flies150',  icon:'🪰', title:'Caçada Difícil',      desc:'Tenha recorde de 150+ nas moscas.',          reward:90,  progress:()=>[Math.max(getBest('flies'),Number(localStorage.getItem('flyHi_facil')||0),Number(localStorage.getItem('flyHi_medio')||0),Number(localStorage.getItem('flyHi_dificil')||0)),150]},
    {id:'flies500',  icon:'🔥', title:'Infestação',           desc:'Tenha recorde de 500+ nas moscas.',          reward:160, progress:()=>[Math.max(getBest('flies'),Number(localStorage.getItem('flyHi_facil')||0),Number(localStorage.getItem('flyHi_medio')||0),Number(localStorage.getItem('flyHi_dificil')||0)),500]},
    {id:'combo5',    icon:'💥', title:'Combo Master',         desc:'Alcance combo x5 nas moscas.',               reward:120, progress:()=>[Number(localStorage.getItem('spider_best_combo')||0),5]},
    // ── Snake ──
    {id:'snake200',  icon:'🐍', title:'Cobra Nervosa',        desc:'Tenha recorde de 200+ no Snake.',            reward:100, progress:()=>[Math.max(getBest('snake'),Number(localStorage.getItem('snakeHi')||0)),200]},
    {id:'snake600',  icon:'🌀', title:'Anaconda Digital',     desc:'Tenha recorde de 600+ no Snake.',            reward:180, progress:()=>[Math.max(getBest('snake'),Number(localStorage.getItem('snakeHi')||0)),600]},
    {id:'snakelvl5', icon:'⬆', title:'Sobe de Fase',         desc:'Chegue ao level 5 no Snake.',                reward:110, progress:()=>[Number(localStorage.getItem('spider_snake_maxlevel')||0),5]},
    // ── Memória ──
    {id:'memory180', icon:'🧠', title:'Memória Afiada',       desc:'Tenha recorde de 180+ na memória.',          reward:100, progress:()=>[getBest('memory'),180]},
    {id:'memory400', icon:'🔮', title:'Mente de Cristal',     desc:'Tenha recorde de 400+ na memória.',          reward:170, progress:()=>[getBest('memory'),400]},
    // ── Luta ──
    {id:'fight1',    icon:'🥊', title:'Vitória no Ringue',    desc:'Ganhe pelo menos 1 luta no Mortal Spider.',  reward:140, progress:()=>[fightWins(),1]},
    {id:'fight5',    icon:'🏅', title:'Guerreiro da Rede',    desc:'Ganhe 5 lutas no Mortal Spider.',            reward:200, progress:()=>[fightWins(),5]},
    {id:'nightmare', icon:'💀', title:'Nível Pesadelo',       desc:'Ganhe 1 luta no modo Nightmare.',            reward:250, progress:()=>[Number(localStorage.getItem('spider_fight_nightmare_wins')||0),1]},
    // ── Social ──
    {id:'forum1',    icon:'💬', title:'Movimente a Comunidade',desc:'Crie 1 tópico ou responda hoje.',           reward:70,  progress:()=>[dayStats().topics+dayStats().replies,1]},
    {id:'chat3',     icon:'👋', title:'Papo de Rede',         desc:'Envie 3 mensagens no chat hoje.',            reward:60,  progress:()=>[dayStats().chats||0,3]},
    // ── Progressão ──
    {id:'score500',  icon:'⭐', title:'Pontuador',             desc:'Acumule 500+ pontos totais.',                reward:100, progress:()=>[Number(localStorage.getItem('spider_total_score_cache')||0),500]},
    {id:'score2000', icon:'💎', title:'Lenda da Rede',         desc:'Acumule 2000+ pontos totais.',               reward:200, progress:()=>[Number(localStorage.getItem('spider_total_score_cache')||0),2000]},
  ];

  function claimed(id){ return (dayStats().claims||[]).includes(id); }
  function canClaim(m){ const [a,b] = m.progress(); return a >= b && !claimed(m.id); }
  function claimMission(id){
    const m = MISSIONS.find(x=>x.id===id); if(!m) return;
    const s = dayStats();
    if(claimed(id)){ toast('Essa missão já foi resgatada hoje.', 'warning'); return; }
    const [a,b] = m.progress();
    if(a < b){ toast('Missão ainda incompleta.', 'warning'); sound('bad'); return; }
    s.claims = s.claims || []; s.claims.push(id); saveDayStats(s); addCoins(m.reward, m.title); renderMissions();
  }
  window.spiderClaimMission = claimMission;

  function applySkin(id=activeSkin()){
    const skin = SKINS.find(s=>s.id===id) || SKINS[0];
    const root = document.documentElement;
    Object.entries(skin.vars).forEach(([k,v])=>root.style.setProperty('--'+k, v));
    root.style.setProperty('--primary-dim', hexToRgba(skin.vars.primary, .15));
    root.style.setProperty('--primary-glow', `0 0 22px ${hexToRgba(skin.vars.primary, .42)}`);
    document.body.dataset.spiderSkin = skin.id;
    localStorage.setItem(STORE.active, skin.id);
    renderShop(); renderWallet();
  }
  function hexToRgba(hex, a){
    const h = hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }
  window.spiderApplySkin = applySkin;

  function buySkin(id){
    const skin = SKINS.find(s=>s.id===id); if(!skin) return;
    const own = owned();
    if(own.includes(id)){ applySkin(id); toast(`Skin ativada: ${skin.name}`); sound('ok'); return; }
    if(coins() < skin.price){ toast('Moedas insuficientes. Complete missões diárias.', 'warning'); sound('bad'); return; }
    setCoins(coins() - skin.price); own.push(id); setOwned(own); applySkin(id); toast(`Skin comprada: ${skin.name}`); sound('win');
  }
  window.spiderBuySkin = buySkin;

  function renderWallet(){
    let box = $('#spiderWallet');
    if(!box){
      box = document.createElement('div'); box.id='spiderWallet'; box.className='spider-wallet';
      box.innerHTML = `<span>🪙</span><b id="spiderCoinCount">0</b><button type="button" id="openShopBtn">Loja</button>`;
      document.body.appendChild(box);
      box.querySelector('button').onclick = () => { document.getElementById('spiderShopSection')?.scrollIntoView({behavior:'smooth', block:'center'}); sound('click'); };
    }
    const count = $('#spiderCoinCount'); if(count) count.textContent = coins();
  }

  function injectHomeSections(){
    const home = $('#home'); if(!home || $('#spiderMissionSection')) return;
    const html = document.createElement('div');
    html.innerHTML = `
      <div id="spiderMissionSection" class="pro-section mission-section">
        <div class="pro-section-head"><h3>🎯 MISSÕES DIÁRIAS</h3><span>Ganhe moedas para comprar skins</span></div>
        <div id="spiderMissionGrid" class="mission-grid"></div>
      </div>
      <div id="spiderShopSection" class="pro-section shop-section">
        <div class="pro-section-head"><h3>🛒 LOJA DE SKINS</h3><span>Temas visuais para a Spider Network</span></div>
        <div id="spiderShopGrid" class="shop-grid"></div>
      </div>`;
    home.appendChild(html);
    renderMissions(); renderShop();
  }

  function renderMissions(){
    const grid = $('#spiderMissionGrid'); if(!grid) return;
    grid.innerHTML = MISSIONS.map(m=>{
      const [a,b]=m.progress(); const pct=Math.max(0,Math.min(100,(a/b)*100)); const done=a>=b; const got=claimed(m.id);
      return `<div class="mission-card ${done?'done':''} ${got?'claimed':''}">
        <div class="mission-icon">${m.icon}</div>
        <div class="mission-body"><b>${m.title}</b><small>${m.desc}</small><div class="mission-bar"><span style="width:${pct}%"></span></div><em>${Math.min(a,b)}/${b}</em></div>
        <button type="button" onclick="spiderClaimMission('${m.id}')" ${!done||got?'disabled':''}>${got?'OK':`+${m.reward}`}</button>
      </div>`;
    }).join('');
  }

  function renderShop(){
    const grid = $('#spiderShopGrid'); if(!grid) return;
    const own = owned(); const active = activeSkin();
    grid.innerHTML = SKINS.map(s=>{
      const has = own.includes(s.id); const isActive = active===s.id;
      return `<div class="shop-card ${isActive?'active':''}">
        <div class="shop-preview" style="--skinColor:${s.vars.primary};--skinAccent:${s.vars.accent}"><span>${s.icon}</span></div>
        <b>${s.name}</b><small>${s.desc}</small>
        <button type="button" onclick="spiderBuySkin('${s.id}')">${isActive?'Ativa':has?'Usar':`Comprar · ${s.price} 🪙`}</button>
      </div>`;
    }).join('');
  }

  function wrap(name, before, after){
    const old = window[name];
    if(typeof old !== 'function' || old.__proWrapped) return false;
    const fn = function(...args){
      before?.(args);
      const res = old.apply(this,args);
      Promise.resolve(res).then(v=>{ after?.(args, v); return v; }).catch(err=>{ after?.(args); throw err; });
      return res;
    };
    fn.__proWrapped = true; window[name]=fn; return true;
  }

  function installHooks(){
    ['toggleGame','toggleSnake','toggleFight','toggleMemory'].forEach(n=>wrap(n,()=>{ incStat('games'); sound('ok'); },()=>renderMissions()));
    wrap('sendChat', null, ()=>{ incStat('chats'); });
    wrap('forumCreateTopic', null, ()=>{ incStat('topics'); sound('ok'); });
    wrap('forumSendReply', null, ()=>{ incStat('replies'); sound('ok'); });
    wrap('abrirPainel', null, (args)=>{ if(args?.[0]==='home') setTimeout(()=>{injectHomeSections(); renderMissions(); renderShop();},250); });
    // Listen for mission-relevant localStorage changes via CustomEvent (safe, no monkey-patch)
    if(!window.__spiderProWatched){
      window.__spiderProWatched = true;
      window.addEventListener('spider:statChanged', ()=>setTimeout(renderMissions, 80));
      // Poll every 5s as fallback (covers changes from app.js module context)
      setInterval(renderMissions, 5000);
    }
  }

  function addStyles(){
    if($('#spiderProStyles')) return;
    const st = document.createElement('style'); st.id='spiderProStyles'; st.textContent = `
      .spider-wallet{position:fixed;right:18px;top:70px;z-index:90;display:flex;align-items:center;gap:8px;background:rgba(18,18,24,.92);border:1px solid var(--border);border-radius:999px;padding:8px 10px;box-shadow:0 8px 28px rgba(0,0,0,.35);backdrop-filter:blur(10px)}
      .spider-wallet b{font-family:var(--font-display);color:var(--gold)} .spider-wallet button{padding:5px 10px;font-size:11px;border-radius:999px}
      .pro-section{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-top:18px;position:relative;overflow:hidden}.pro-section:before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--primary),transparent)}
      .pro-section-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:14px}.pro-section-head h3{font-family:var(--font-display);font-size:13px;letter-spacing:2px;color:var(--primary)}.pro-section-head span{font-size:12px;color:var(--text-dim)}
      .mission-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.mission-card{display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--border);border-radius:13px;padding:12px;transition:.2s}.mission-card.done{border-color:rgba(0,255,200,.35)}.mission-card.claimed{opacity:.72}.mission-icon{font-size:26px;width:38px;text-align:center}.mission-body{flex:1;min-width:0}.mission-body b{display:block;font-size:13px}.mission-body small{display:block;color:var(--text-dim);font-size:11px;margin:3px 0 7px}.mission-body em{font-style:normal;color:var(--text-dim);font-size:10px}.mission-bar{height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}.mission-bar span{display:block;height:100%;background:linear-gradient(90deg,var(--primary),var(--gold));border-radius:99px;transition:width .3s}.mission-card button{width:58px;padding:8px 6px;font-size:11px}
      .shop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.shop-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:13px;text-align:center;transition:.2s}.shop-card.active{border-color:var(--primary);box-shadow:0 0 24px rgba(0,255,200,.12)}.shop-preview{height:70px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,var(--skinColor),transparent 55%),linear-gradient(135deg,rgba(255,255,255,.08),rgba(0,0,0,.2));border:1px solid color-mix(in srgb,var(--skinColor),transparent 55%);margin-bottom:10px}.shop-preview span{font-size:30px;filter:drop-shadow(0 0 12px var(--skinColor))}.shop-card b{display:block;font-size:13px}.shop-card small{display:block;color:var(--text-dim);font-size:11px;min-height:34px;margin:6px 0}.shop-card button{width:100%;font-size:11px;padding:8px 6px}
      body[data-spider-skin="champion"] .rank-item.rank-1, body[data-spider-skin="champion"] .profile-header{box-shadow:0 0 28px rgba(255,215,0,.12)}
      body[data-spider-skin="venom"] #spider{filter:drop-shadow(0 0 12px rgba(168,85,247,.65))} body[data-spider-skin="blood"] #spider{filter:drop-shadow(0 0 12px rgba(255,60,110,.65))}
      @media(max-width:680px){.spider-wallet{top:auto;bottom:142px;right:10px;padding:7px 9px}.pro-section-head{align-items:start;flex-direction:column}.mission-grid{grid-template-columns:1fr}.shop-grid{grid-template-columns:repeat(2,1fr)}.shop-card small{min-height:46px}}
    `; document.head.appendChild(st);
  }

  function boot(){ initDailyStats(); addStyles(); applySkin(activeSkin()); renderWallet(); injectHomeSections(); installHooks(); setInterval(()=>{renderMissions(); renderWallet();}, 4000); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
})();
