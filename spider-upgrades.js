
(function(){
  'use strict';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const Sound = {
    enabled: localStorage.getItem('spider_sound') !== 'off',
    ctx: null,
    ensure(){
      if(!this.ctx){ const AC = window.AudioContext || window.webkitAudioContext; if(AC) this.ctx = new AC(); }
      if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
    },
    beep(type='click'){
      if(!this.enabled) return;
      this.ensure(); if(!this.ctx) return;
      const map = {
        click:[520,.045,'square',.035], hit:[130,.06,'sawtooth',.05], ok:[720,.08,'sine',.04], bad:[90,.12,'triangle',.055], combo:[900,.07,'square',.035], win:[660,.13,'sine',.045]
      };
      const [freq,dur,wave,gain] = map[type] || map.click;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = wave; osc.frequency.setValueAtTime(freq, t);
      if(type==='win'){ osc.frequency.exponentialRampToValueAtTime(freq*1.5, t+dur); }
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      osc.connect(g); g.connect(this.ctx.destination); osc.start(t); osc.stop(t+dur+.02);
    },
    toggle(){ this.enabled=!this.enabled; localStorage.setItem('spider_sound', this.enabled?'on':'off'); updateSoundBtn(); this.beep(this.enabled?'ok':'bad'); }
  };
  window.SpiderSound = Sound;

  function updateSoundBtn(){
    const btn = $('#soundToggleBtn'); if(!btn) return;
    btn.classList.toggle('off', !Sound.enabled); btn.textContent = Sound.enabled ? '🔊 Som' : '🔇 Som';
  }
  function addSoundButton(){
    const area = $('.topbar-actions'); if(!area || $('#soundToggleBtn')) return;
    const btn=document.createElement('button'); btn.id='soundToggleBtn'; btn.className='sound-toggle-btn'; btn.type='button'; btn.onclick=()=>Sound.toggle();
    area.insertBefore(btn, area.firstChild); updateSoundBtn();
  }

  function fireKey(code, down=true){
    const ev = new KeyboardEvent(down?'keydown':'keyup', {key:code, code:code, bubbles:true, cancelable:true});
    document.dispatchEvent(ev);
  }
  function tapKey(code){ fireKey(code,true); setTimeout(()=>fireKey(code,false),55); Sound.beep('click'); }

  function addSnakeMobileControls(){
    const modal = $('#snakeModal .game-modal-inner'); if(!modal || $('#snakeMobileDpad')) return;
    const pad = document.createElement('div'); pad.id='snakeMobileDpad'; pad.className='mobile-dpad';
    pad.innerHTML = `<div class="mobile-dpad-grid">
      <span class="empty"></span><button type="button" data-key="ArrowUp">▲</button><span class="empty"></span>
      <button type="button" data-key="ArrowLeft">◀</button><button type="button" data-key="Space">⏸</button><button type="button" data-key="ArrowRight">▶</button>
      <span class="empty"></span><button type="button" data-key="ArrowDown">▼</button><span class="empty"></span>
    </div>`;
    const hint = $('#snakeHint'); modal.insertBefore(pad, hint || null);
    pad.addEventListener('click', e=>{ const b=e.target.closest('button[data-key]'); if(!b) return; const k=b.dataset.key; if(k==='Space' && window.snakePauseToggle) { window.snakePauseToggle(); Sound.beep('ok'); } else tapKey(k); });
    const canvas=$('#snakeCanvas'); if(canvas){
      let sx=0, sy=0;
      canvas.addEventListener('touchstart', e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; }, {passive:true});
      canvas.addEventListener('touchend', e=>{ const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; if(Math.max(Math.abs(dx),Math.abs(dy))<22) return; tapKey(Math.abs(dx)>Math.abs(dy) ? (dx>0?'ArrowRight':'ArrowLeft') : (dy>0?'ArrowDown':'ArrowUp')); }, {passive:true});
    }
  }

  function addFightMobileHelp(){
    const modal = $('#fightModal .game-modal-inner'); if(!modal || $('#fightQuickMobile')) return;
    const row=document.createElement('div'); row.id='fightQuickMobile'; row.className='mobile-action-row';
    row.innerHTML = `<button type="button" data-key="KeyF">👊 Soco</button><button type="button" data-key="KeyG">🦵 Chute</button><button type="button" data-key="KeyC">🛡 Defesa</button><button type="button" class="special" data-key="KeyH">⚡ Especial</button>`;
    const canvas=$('#fightCanvas'); if(canvas) canvas.insertAdjacentElement('afterend', row);
    row.addEventListener('pointerdown', e=>{ const b=e.target.closest('button[data-key]'); if(!b) return; fireKey(b.dataset.key,true); Sound.beep(b.classList.contains('special')?'combo':'click'); });
    row.addEventListener('pointerup', e=>{ const b=e.target.closest('button[data-key]'); if(!b) return; fireKey(b.dataset.key,false); });
    row.addEventListener('pointerleave', ()=>['KeyF','KeyG','KeyC','KeyH'].forEach(k=>fireKey(k,false)));
  }

  function addForumTools(){
    const list = $('#forumTopicList'); if(!list || $('#forumToolsV2')) return;
    const box = document.createElement('div'); box.id='forumToolsV2'; box.className='forum-tools-v2';
    box.innerHTML = `<input id="forumSearchV2" placeholder="🔍 Buscar tópico nesta categoria..." autocomplete="off"><select id="forumSortV2"><option value="recent">Recentes</option><option value="likes">Mais curtidos</option><option value="pinned">Fixados</option></select>`;
    list.parentNode.insertBefore(box, list);
    box.addEventListener('input', filterTopics); box.addEventListener('change', filterTopics);
  }
  function filterTopics(){
    const q=($('#forumSearchV2')?.value||'').toLowerCase().trim();
    $$('#forumTopicList .forum-topic-item').forEach(item=>{ item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  }

  async function reportContent(kind, targetId){
    const reason = prompt('Motivo da denúncia? Ex: spam, ofensa, conteúdo impróprio');
    if(!reason) return;
    const api = window.spiderFirebase, ctx = window.spiderGetContext?.();
    if(!api || !ctx?.currentUid){ alert('Faça login para denunciar.'); return; }
    try{
      await api.addDoc(api.collection(api.db,'reports'), {kind, targetId, reason: String(reason).slice(0,200), uid: ctx.currentUid, user: ctx.currentUser?.user||'user', createdAt: api.serverTimestamp(), status:'open'});
      Sound.beep('ok'); window.showNotification ? window.showNotification('Denúncia enviada para a moderação.') : alert('Denúncia enviada.');
    }catch(e){ console.warn(e); Sound.beep('bad'); alert('Não consegui enviar a denúncia. Confira as regras do Firebase.'); }
  }
  window.spiderReportContent = reportContent;

  function addReportButtons(){
    const topicBox = $('#forumTopicBody .topic-actions');
    if(topicBox && !$('#forumReportTopicBtn') && window.forumCurrentTopic){
      const b=document.createElement('button'); b.id='forumReportTopicBtn'; b.className='report-btn'; b.textContent='🚩 Denunciar'; b.onclick=(e)=>{e.stopPropagation(); reportContent('topic', window.forumCurrentTopic?.id || 'unknown');}; topicBox.appendChild(b);
    }
    $$('#forumRepliesList .forum-reply').forEach((r,i)=>{ if(r.querySelector('.report-btn')) return; const b=document.createElement('button'); b.className='report-btn'; b.textContent='🚩 Denunciar resposta'; b.style.marginTop='8px'; b.onclick=()=>reportContent('reply', 'reply_visible_'+i); r.appendChild(b); });
  }

  function wrap(name, before, after){
    const old=window[name]; if(typeof old!=='function' || old.__spiderWrapped) return;
    const fn=function(...args){ before?.(name,args); const res=old.apply(this,args); Promise.resolve(res).then(()=>after?.(name,args)).catch(()=>after?.(name,args)); return res; };
    fn.__spiderWrapped=true; window[name]=fn;
  }

  function installWrappers(){
    ['toggleGame','toggleSnake','toggleFight','toggleMemory'].forEach(n=>wrap(n,()=>Sound.beep('ok'),()=>{addSnakeMobileControls(); addFightMobileHelp();}));
    ['forumOpenCategory','forumShowTopics'].forEach(n=>wrap(n,null,()=>setTimeout(()=>{addForumTools(); filterTopics();},250)));
    ['forumOpenTopic','forumLoadReplies'].forEach(n=>wrap(n,null,()=>setTimeout(addReportButtons,350)));
    ['sendChat','forumCreateTopic','forumSendReply','forumLikeTopic'].forEach(n=>wrap(n,()=>Sound.beep('click'),()=>{}));
  }

  function createGameOverOverlay(){
    if($('#gameOverPremium')) return;
    const div=document.createElement('div'); div.id='gameOverPremium'; div.className='game-over-premium';
    div.innerHTML = `<div class="game-over-card"><h2 id="gameOverTitle">FIM DE JOGO</h2><p id="gameOverText">Resultado da partida</p><div class="game-over-stats"><div><small>Pontos</small><b id="gameOverScore">0</b></div><div><small>Recorde</small><b id="gameOverBest">0</b></div></div><button onclick="document.getElementById('gameOverPremium').classList.remove('show')">Continuar</button></div>`;
    document.body.appendChild(div);
  }
  window.spiderShowGameOver = function(title,text,score,best){ createGameOverOverlay(); $('#gameOverTitle').textContent=title; $('#gameOverText').textContent=text; $('#gameOverScore').textContent=score||0; $('#gameOverBest').textContent=best||0; $('#gameOverPremium').classList.add('show'); Sound.beep(title.toLowerCase().includes('vit')?'win':'bad'); };

  window.addEventListener('load', ()=>{
    addSoundButton(); addSnakeMobileControls(); addFightMobileHelp(); addForumTools(); createGameOverOverlay(); installWrappers();
    document.addEventListener('click', e=>{ if(e.target.closest('button,.game-card-pro,.nav-btn,.mnav-btn')) Sound.beep('click'); }, true);
    const mo = new MutationObserver(()=>{ addForumTools(); addReportButtons(); });
    mo.observe(document.body,{childList:true,subtree:true});
  });
})();
