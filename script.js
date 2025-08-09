/* ===== La Roue Ultime ++ — Logic ===== */

// --- Storage keys
const LS = {
  choices: 'ru.choices.v1',
  stats: 'ru.stats.v1',
  total: 'ru.totalSpins.v1',
  duration: 'ru.spinDurationMs',
  tts: 'ru.tts',
  clicks: 'ru.clicks',
  theme: 'ru.theme',
  modeElim: 'ru.modeElim',
  multi: 'ru.multiDraw'
};

// --- State
let choices = loadChoices();
let stats = loadStats();
let totalSpins = parseInt(localStorage.getItem(LS.total) || '0', 10);
let spinDurationMs = parseInt(localStorage.getItem(LS.duration) || '4000', 10);
let modeElimination = localStorage.getItem(LS.modeElim) === '1';
let ttsOn = localStorage.getItem(LS.tts) !== '0';
let clicksOn = localStorage.getItem(LS.clicks) === '1';
let multiDraw = parseInt(localStorage.getItem(LS.multi) || '1', 10);
let currentRotation = 0;

// --- Elements
const wheelSvg = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
const durationSlider = document.getElementById('spinDuration');
const durationLabel = document.getElementById('spinDurationLabel');
const newChoice = document.getElementById('newChoice');
const addChoiceBtn = document.getElementById('addChoice');
const list = document.getElementById('choicesList');
const resultText = document.getElementById('resultText');
const totalSpinsEl = document.getElementById('totalSpins');
const activeCountEl = document.getElementById('activeCount');
const statsBody = document.getElementById('statsBody');
const pie = document.getElementById('pie');
const ttsToggle = document.getElementById('ttsToggle');
const soundToggle = document.getElementById('soundToggle');
const modeEliminationEl = document.getElementById('modeElimination');
const resetEliminationBtn = document.getElementById('resetElimination');
const clearChoicesBtn = document.getElementById('clearChoices');
const shuffleBtn = document.getElementById('shuffleChoices');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const historyEl = document.getElementById('history');
const multiDrawSel = document.getElementById('multiDraw');
const themeToggle = document.getElementById('themeToggle');
const tickAudio = document.getElementById('tickAudio');

// --- Init UI from storage
durationSlider.value = spinDurationMs;
durationLabel.textContent = (spinDurationMs/1000).toFixed(1)+'s';
ttsToggle.checked = ttsOn;
soundToggle.checked = clicksOn;
modeEliminationEl.checked = modeElimination;
multiDrawSel.value = String(multiDraw);

applyTheme(localStorage.getItem(LS.theme) || 'dark');
renderChoices();
renderWheel();
updateStatsUI();
drawPie();
renderHistory();

// --- Events
durationSlider.addEventListener('input', () => {
  spinDurationMs = parseInt(durationSlider.value, 10);
  durationLabel.textContent = (spinDurationMs/1000).toFixed(1)+'s';
  localStorage.setItem(LS.duration, String(spinDurationMs));
});

ttsToggle.addEventListener('change', () => {
  ttsOn = ttsToggle.checked;
  localStorage.setItem(LS.tts, ttsOn ? '1' : '0');
});

soundToggle.addEventListener('change', () => {
  clicksOn = soundToggle.checked;
  localStorage.setItem(LS.clicks, clicksOn ? '1' : '0');
});

modeEliminationEl.addEventListener('change', () => {
  modeElimination = modeEliminationEl.checked;
  localStorage.setItem(LS.modeElim, modeElimination ? '1':'0');
});

multiDrawSel.addEventListener('change', () => {
  multiDraw = parseInt(multiDrawSel.value, 10);
  localStorage.setItem(LS.multi, String(multiDraw));
});

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(LS.theme, next);
});

addChoiceBtn.addEventListener('click', addChoiceFromInput);
newChoice.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addChoiceFromInput() }});

resetEliminationBtn.addEventListener('click', () => {
  choices = choices.map(c => ({...c, disabled:false}));
  saveChoices();
  renderChoices(); renderWheel(); updateStatsUI();
});

clearChoicesBtn.addEventListener('click', () => {
  if(!confirm('Supprimer tous les choix ?')) return;
  choices = [];
  stats = {};
  totalSpins = 0;
  saveChoices(); saveStats(); saveTotal();
  renderChoices(); renderWheel(); updateStatsUI(); drawPie(); renderHistory();
});

shuffleBtn.addEventListener('click', () => {
  shuffleArray(choices);
  saveChoices(); renderChoices(); renderWheel();
});

exportBtn.addEventListener('click', () => {
  const data = {
    v:1, choices, stats, totalSpins, settings:{
      spinDurationMs, ttsOn, clicksOn, modeElimination, multiDraw
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roue-ultime-export.json';
  a.click();
});

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if(!file) return;
  const txt = await file.text();
  try{
    const data = JSON.parse(txt);
    if(!data || !Array.isArray(data.choices)) throw new Error('format invalide');
    choices = data.choices;
    stats = data.stats || {};
    totalSpins = data.totalSpins || 0;
    const s = data.settings || {};
    if(s.spinDurationMs) { spinDurationMs = s.spinDurationMs; durationSlider.value=spinDurationMs; durationLabel.textContent=(spinDurationMs/1000).toFixed(1)+'s'; }
    ttsOn = !!s.ttsOn; ttsToggle.checked = ttsOn;
    clicksOn = !!s.clicksOn; soundToggle.checked = clicksOn;
    modeElimination = !!s.modeElimination; modeEliminationEl.checked = modeElimination;
    multiDraw = s.multiDraw||1; multiDrawSel.value=String(multiDraw);
    saveAll();
    renderChoices(); renderWheel(); updateStatsUI(); drawPie(); renderHistory();
    alert('Import réussi ✅');
  }catch(e){
    alert('Import impossible ❌ : '+e.message);
  }
});

spinBtn.addEventListener('click', async () => {
  const actives = choices.filter(c=>!c.disabled);
  if(actives.length === 0){ alert('Ajoute au moins un choix actif.'); return; }

  // multi draw: pick n distinct choices
  const n = Math.min(multiDraw, actives.length);
  const picks = pickNDistinct(actives, n);

  // Animate to the first pick
  const first = picks[0];
  const angle = angleForChoice(first);
  await spinWheel(angle);

  // Update stats for all picks
  for(const p of picks){
    incStat(p.label);
    if(modeElimination){
      const idx = choices.findIndex(c => c.label===p.label && !c.disabled);
      if(idx>=0) choices[idx].disabled = true;
    }
  }
  totalSpins += 1;
  saveAll();

  // Show result
  resultText.textContent = picks.map(p=>p.label).join(' • ');

  // Voice
  if(ttsOn) speakResult(picks);

  // UI refresh
  renderChoices(); renderWheel(); updateStatsUI(); drawPie(); prependHistory(picks);
});

// --- Functions
function addChoiceFromInput(){
  const v = (newChoice.value||'').trim();
  if(!v) return;
  if(choices.some(c => c.label.toLowerCase() === v.toLowerCase())){
    alert('Ce choix existe déjà.'); return;
  }
  choices.push({ label:v, disabled:false });
  stats[v] = stats[v] || 0;
  newChoice.value='';
  saveChoices(); saveStats();
  renderChoices(); renderWheel(); updateStatsUI(); drawPie();
}

function renderChoices(){
  list.innerHTML = '';
  for(const c of choices){
    const li = document.createElement('li');
    li.className='choice';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHtml(c.label)}</strong> ${c.disabled?'<span class="badge">désactivé</span>':''}`;
    const actions = document.createElement('div');
    actions.className='actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className='btn ghost';
    toggleBtn.textContent = c.disabled ? 'Activer' : 'Désactiver';
    toggleBtn.addEventListener('click', ()=>{
      c.disabled = !c.disabled; saveChoices(); renderChoices(); renderWheel(); updateStatsUI();
    });

    const delBtn = document.createElement('button');
    delBtn.className='btn danger';
    delBtn.textContent = 'Suppr';
    delBtn.addEventListener('click', ()=>{
      if(!confirm('Supprimer ce choix ?')) return;
      const i = choices.indexOf(c);
      if(i>=0) choices.splice(i,1);
      delete stats[c.label];
      saveChoices(); saveStats(); renderChoices(); renderWheel(); updateStatsUI(); drawPie();
    });

    actions.append(toggleBtn, delBtn);
    li.append(left, actions);
    list.appendChild(li);
  }
  activeCountEl.textContent = String(choices.filter(c=>!c.disabled).length);
}

function renderWheel(){
  const actives = choices.filter(c=>!c.disabled);
  const N = Math.max(actives.length, 1);
  wheelSvg.innerHTML = '';

  const colors = palette50s(N);
  let startAngle = 0;
  for(let i=0;i<N;i++){
    const a0 = (startAngle) * Math.PI/180;
    const a1 = (startAngle + 360/N) * Math.PI/180;
    const largeArc = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = 0 + 48*Math.cos(a0), y0 = 0 + 48*Math.sin(a0);
    const x1 = 0 + 48*Math.cos(a1), y1 = 0 + 48*Math.sin(a1);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M 0 0 L ${x0} ${y0} A 48 48 0 ${largeArc} 1 ${x1} ${y1} Z`);
    path.setAttribute('fill', colors[i%colors.length]);
    wheelSvg.appendChild(path);

    // Label
    const mid = (startAngle + 180/N) * Math.PI/180;
    const tx = 0 + 28*Math.cos(mid), ty = 0 + 28*Math.sin(mid);
    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x', tx); text.setAttribute('y', ty);
    text.setAttribute('text-anchor','middle');
    text.setAttribute('dominant-baseline','middle');
    text.setAttribute('class','seg-text');
    text.textContent = actives[i]?.label || '—';
    wheelSvg.appendChild(text);

    startAngle += 360/N;
  }
}

function angleForChoice(choice){
  const actives = choices.filter(c=>!c.disabled);
  const idx = actives.findIndex(c => c.label === choice.label);
  const N = actives.length;
  if(idx<0 || N===0) return 0;
  const segAngle = 360/N;
  // pointer is at 0deg (top). We want the segment center to align with 0deg after rotation.
  const target = (idx * segAngle) + segAngle/2;
  // Since we rotate the wheel clockwise, to bring segment to top, rotate so that its center goes to 360.
  const toAngle = 360 - target;
  return toAngle;
}

function easeOutCubicBezier(){ return 'cubic-bezier(0.05, 0.8, 0.2, 1)'; }

function spinWheel(toChoiceAngleDeg){
  return new Promise(resolve => {
    const baseTurns = Math.max(4, Math.min(10, Math.round(spinDurationMs / 800)));
    const totalRotation = 360 * baseTurns + toChoiceAngleDeg;
    currentRotation = (currentRotation + totalRotation) % 360000;
    wheelSvg.style.transition = `transform ${spinDurationMs}ms ${easeOutCubicBezier()}`;
    wheelSvg.style.transform = `rotate(${currentRotation}deg)`;

    // tick sound (optional)
    if(clicksOn){
      let ticks = Math.min(30, Math.max(12, Math.round(spinDurationMs/120)));
      let i=0;
      const iv = setInterval(()=>{
        tickAudio.currentTime=0; tickAudio.play().catch(()=>{});
        if(++i>=ticks) clearInterval(iv);
      }, Math.max(40, Math.round(spinDurationMs/ticks)));
    }

    const onEnd = () => {
      wheelSvg.removeEventListener('transitionend', onEnd);
      resolve();
    };
    wheelSvg.addEventListener('transitionend', onEnd, {once:true});
  });
}

function incStat(label){
  stats[label] = (stats[label] || 0) + 1;
}

function updateStatsUI(){
  totalSpinsEl.textContent = String(totalSpins);
  // table
  const rows = Object.entries(stats).sort((a,b)=>b[1]-a[1]);
  statsBody.innerHTML = '';
  for(const [label, count] of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(label)}</td><td>${count}</td>`;
    statsBody.appendChild(tr);
  }
}

function drawPie(){
  const ctx = pie.getContext('2d');
  ctx.clearRect(0,0,pie.width, pie.height);
  const rows = Object.entries(stats).filter(([,v])=>v>0);
  const total = rows.reduce((s,[,v])=>s+v,0);
  if(total===0 || rows.length===0){ 
    // draw placeholder circle
    ctx.beginPath(); ctx.arc(120,120,80,0,2*Math.PI); ctx.strokeStyle = '#555'; ctx.stroke();
    ctx.fillStyle = '#888'; ctx.fillText('Aucun tirage', 80, 125);
    return; 
  }
  let start= -Math.PI/2;
  const colors = palette50s(rows.length);
  rows.forEach(([label,value],i)=>{
    const angle = (value/total)*2*Math.PI;
    ctx.beginPath();
    ctx.moveTo(120,120);
    ctx.arc(120,120,100,start,start+angle);
    ctx.closePath();
    ctx.fillStyle = colors[i%colors.length];
    ctx.fill();
    start += angle;
  });
  // legend
  ctx.font = '12px system-ui';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg') || '#fff';
  let y = 18; let x = 250;
  rows.slice(0,8).forEach(([label,value],i)=>{
    ctx.fillStyle = colors[i%colors.length];
    ctx.fillRect(x, y-10, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg') || '#fff';
    ctx.fillText(`${label} (${value})`, x+16, y);
    y += 18;
  });
}

function speakResult(picks){
  const utter = new SpeechSynthesisUtterance();
  if(picks.length===1){
    utter.text = `Résultat : ${picks[0].label}`;
  }else{
    utter.text = `Résultats : ` + picks.map(p=>p.label).join(', ');
  }
  utter.lang = 'fr-FR';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function pickNDistinct(list, n){
  const arr = [...list];
  shuffleArray(arr);
  return arr.slice(0,n);
}

function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
}

function prependHistory(picks){
  const time = new Date();
  const item = document.createElement('li');
  item.textContent = `[${time.toLocaleTimeString()}] ` + picks.map(p=>p.label).join(' • ');
  historyEl.prepend(item);
  // limit to 10
  while(historyEl.children.length>10) historyEl.removeChild(historyEl.lastChild);
}

function renderHistory(){
  historyEl.innerHTML='';
  // No persisted history in this simple version
}

function saveChoices(){ localStorage.setItem(LS.choices, JSON.stringify(choices)); }
function saveStats(){ localStorage.setItem(LS.stats, JSON.stringify(stats)); }
function saveTotal(){ localStorage.setItem(LS.total, String(totalSpins)); }
function saveAll(){ saveChoices(); saveStats(); saveTotal(); }

function loadChoices(){
  const raw = localStorage.getItem(LS.choices);
  if(raw){
    try{ 
      const arr = JSON.parse(raw); 
      if(Array.isArray(arr)) return arr;
    }catch(e){}
  }
  // seed example
  return [
    {label:'🍝 Cuisine', disabled:false},
    {label:'🏃‍♂️ Sport', disabled:false},
    {label:'🎬 Film', disabled:false},
    {label:'🎮 Jeu vidéo', disabled:false},
    {label:'📚 Lecture', disabled:false},
  ];
}

function loadStats(){
  const raw = localStorage.getItem(LS.stats);
  if(raw){ try{ const obj = JSON.parse(raw); if(obj && typeof obj==='object') return obj; }catch(e){} }
  // initialize from choices
  const map = {};
  loadChoices().forEach(c => map[c.label]=0);
  return map;
}

function palette50s(n){
  const base = ['#ff6b6b','#ffd166','#06d6a0','#4cc9f0','#f72585','#b5179e','#4895ef','#00b4d8','#90be6d','#f9c74f'];
  const arr = [];
  for(let i=0;i<n;i++) arr.push(base[i % base.length]);
  return arr;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function applyTheme(mode){
  if(mode==='light'){ document.documentElement.classList.add('light'); }
  else { document.documentElement.classList.remove('light'); }
}

// Accessibility: reduce motion respect
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  spinDurationMs = Math.min(spinDurationMs, 3000);
}
