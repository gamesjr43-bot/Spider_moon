
// Polyfill for CanvasRenderingContext2D.roundRect (not available in all mobile browsers)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    if(typeof r==='number') r={tl:r,tr:r,br:r,bl:r};
    const {tl=0,tr=0,br=0,bl=0}=r;
    this.beginPath();
    this.moveTo(x+tl,y);
    this.lineTo(x+w-tr,y); this.quadraticCurveTo(x+w,y,x+w,y+tr);
    this.lineTo(x+w,y+h-br); this.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
    this.lineTo(x+bl,y+h); this.quadraticCurveTo(x,y+h,x,y+h-bl);
    this.lineTo(x,y+tl); this.quadraticCurveTo(x,y,x+tl,y);
    this.closePath();
  };
}


// Guard against double-execution (e.g. HMR, service worker reload)
if(window.__spiderBaseLoaded){ /* already loaded */ } else {
window.__spiderBaseLoaded = true;

const loadingStatusMessages = ["Preparando interface...", "Aquecendo mini games...", "Sincronizando ranking...", "Quase pronto..."];
let loadingStatusIndex = 0;
const loadingStatusTimer = setInterval(()=>{
  const el = document.getElementById("loaderStatus");
  if(el){ loadingStatusIndex = (loadingStatusIndex + 1) % loadingStatusMessages.length; el.textContent = loadingStatusMessages[loadingStatusIndex]; }
}, 650);
window.spiderHideLoader = function(){
  clearInterval(loadingStatusTimer);
  const el = document.getElementById("loadingScreen");
  if(el) setTimeout(()=>el.classList.add("hide"), 250);
};
window.addEventListener("load", ()=>setTimeout(()=>window.spiderHideLoader?.(), 2200));

let actionLoaderTimer = null;
let actionLoaderStart = 0;
window.spiderShowActionLoader = function(message = "Carregando...", icon = "🕷"){
  const box = document.getElementById("actionLoader");
  const text = document.getElementById("actionLoaderText");
  const fill = document.getElementById("actionLoaderFill");
  const ic = document.getElementById("actionLoaderIcon");
  if(!box || !text || !fill) return Date.now();
  actionLoaderStart = Date.now();
  text.textContent = message;
  if(ic) ic.textContent = icon;
  fill.style.width = "8%";
  box.classList.add("show");
  clearInterval(actionLoaderTimer);
  let progress = 8;
  actionLoaderTimer = setInterval(()=>{
    progress = Math.min(92, progress + Math.random() * 16 + 4);
    fill.style.width = progress.toFixed(0) + "%";
  }, 170);
  return actionLoaderStart;
};
window.spiderHideActionLoader = function(startedAt = actionLoaderStart, minimum = 430){
  const box = document.getElementById("actionLoader");
  const fill = document.getElementById("actionLoaderFill");
  if(!box || !fill) return;
  clearInterval(actionLoaderTimer);
  fill.style.width = "100%";
  const elapsed = Date.now() - (startedAt || Date.now());
  const wait = Math.max(160, minimum - elapsed);
  setTimeout(()=>box.classList.remove("show"), wait);
};
window.spiderWithLoading = async function(message, task, icon = "🕷", minimum = 430){
  const started = window.spiderShowActionLoader(message, icon);
  try { return await task(); }
  finally { window.spiderHideActionLoader(started, minimum); }
};
window.spiderLoadingDelay = function(message, callback, icon = "🕹", delay = 360){
  const started = window.spiderShowActionLoader(message, icon);
  setTimeout(async ()=>{
    try { await callback(); }
    finally { window.spiderHideActionLoader(started, delay + 120); }
  }, delay);
};
} // end __spiderBaseLoaded guard
