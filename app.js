const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected = 0, airport = 'HND', priority = 'all', map;
let done = {};
try { done = JSON.parse(localStorage.getItem('walknote-izu-checks') || '{}'); if (!done || typeof done !== 'object') done = {}; } catch { done = {}; }
const place = key => PLACES[key === 'AIRPORT' ? airport : key];
const search = key => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place(key).q);
const directions = item => 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(place(item.from).q) + '&destination=' + encodeURIComponent(place(item.place).q) + '&travelmode=' + (item.mode || 'transit');
const external = (url,label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
function resolved(item,index,dayIndex){
 const i = {...item,id:`${dayIndex}-${index}`};
 if(i.airportTransfer) Object.assign(i,AIRPORT[airport][i.airportTransfer]);
 if(airport === 'NRT' && dayIndex === 4){
  if(index === 2){ i.time='成田版取消'; i.detail='成田机场更远，取消补货，09:00 直接回酒店取行李。'; }
  if(index === 3){ i.time='09:00—09:40'; i.detail='寿司后直接乘地铁回酒店，09:40 前取好行李退房，09:45 前离店。'; }
 }
 return i;
}
function stopHTML(i){
 const needed=['transport','meal','stay'].includes(i.type);
 const hidden=priority==='core' ? i.p>0&&!needed : priority==='recommended' ? i.p>1&&!needed : false;
 if(hidden) return '';
 const label={transport:'交通 / 缓冲',meal:'用餐',visit:'景点',stay:'住宿 / 准备'}[i.type];
 return `<article class="stop ${esc(i.type)} ${done[i.id]?'done':''}" data-id="${i.id}"><div class="stop-meta"><span class="time">${esc(i.time)}</span><span class="badge p${i.p}">P${i.p}</span><span>${label}</span></div><h3>${esc(i.title)}</h3><p class="why">${esc(i.why)}</p><p class="detail">${esc(i.detail)}</p>${i.rating?`<p class="rating">★ ${esc(i.rating)}</p>`:''}${i.price?`<p class="price">${esc(i.price)}</p>`:''}<div class="stop-links">${external(i.from?directions(i):search(i.place),i.from?'查看分段导航':'地图 / 位置')}${i.type==='meal'&&i.rating?external(search(i.place),'Google 评分'):''}${i.link?external(i.link,'官网复查'):''}<label class="check"><input type="checkbox" data-check="${i.id}" ${done[i.id]?'checked':''}>完成这一步</label></div></article>`;
}
function fallbackSVG(d){
 const keys=[...new Set(d.route)], points=keys.map(k=>place(k));
 let minX=Math.min(...points.map(p=>p.ll[1])),maxX=Math.max(...points.map(p=>p.ll[1])),minY=Math.min(...points.map(p=>p.ll[0])),maxY=Math.max(...points.map(p=>p.ll[0]));
 const dx=Math.max(maxX-minX,.02),dy=Math.max(maxY-minY,.02);
 const xy=p=>[40+(p.ll[1]-minX)/dx*390,220-(p.ll[0]-minY)/dy*170];
 return `<svg class="schematic" viewBox="0 0 510 270" role="img" aria-label="当日地点位置与顺序示意，连线非真实轨道"><rect width="510" height="270" fill="#e7eee5"/><text x="20" y="22" font-size="11" fill="#66796b">北 ↑ · 经纬位置示意 · 横纵比例不同</text><polyline points="${d.route.map(k=>xy(place(k)).join(',')).join(' ')}" fill="none" stroke="#a43e2e" stroke-width="2" stroke-dasharray="5 4"/>${keys.map((k,j)=>{const [x,y]=xy(place(k));return `<circle cx="${x}" cy="${y}" r="10" fill="#a43e2e"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="10" fill="white">${j+1}</text>`;}).join('')}</svg>`;
}
function dayHTML(d,n,print=false){
 const items=d.items.map((i,j)=>resolved(i,j,n));
 const keys=[...new Set(d.route)];
 return `<div class="${print?'day-print':''}"><div class="day-header"><div><p class="eyebrow">DAY ${String(n+1).padStart(2,'0')} / ${d.date} ${d.week}</p><h2>${esc(d.title)}</h2><p>${esc(d.subtitle)}</p></div><div class="steps"><strong>${d.steps}</strong>预计步 / 天<p>${esc(d.km)}</p></div></div><div class="day-layout"><aside class="map-panel">${!print?`<div class="map-tools"><button id="show-map">地理地图</button><button id="show-local">近看景点</button><button id="show-schematic">离线示意</button></div><div class="map-box"><div class="map-fallback" id="map-fallback">${fallbackSVG(d)}<ol class="route-list">${keys.map((k,j)=>`<li>${j+1}. ${esc(place(k).name)}</li>`).join('')}</ol></div><div id="map"></div></div><p class="map-caption">红色连线为地点顺序示意，并非真实轨道或步行路径。点击数字看地点；实际交通请打开每段导航并设置出行日期 / 时间。地图底图需联网，无法加载可切换离线示意。</p>`:''}<div class="route-strip">${d.route.map((k,j)=>`<span>${j?'→ ':''}${esc(place(k).name)}</span>`).join('')}</div><div class="side-note"><h3>今晚住哪里</h3><p>${esc(d.stay)}</p></div><div class="side-note"><h3>下雨 / 停运怎么办</h3><p>${esc(d.weather)}</p></div><div class="notice">${esc(d.note)}</div></aside><div class="timeline">${items.map(stopHTML).join('')}</div></div></div>`;
}
function updateProgress(){
 const count=DAYS[selected].items.reduce((n,_,i)=>n+(done[`${selected}-${i}`]?1:0),0);
 $('#progress').textContent=`当天完成 ${count} / ${DAYS[selected].items.length}`;
}
function drawMap(){
 const d=DAYS[selected];
 if(!window.L){$('#map').hidden=true;return;}
 map=L.map('map',{scrollWheelZoom:false,attributionControl:true});
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 let failures=0;tiles.on('tileerror',()=>{if(++failures>=3){$('#map').hidden=true;}});
 const route=d.route.map(k=>place(k).ll);
 L.polyline(route,{color:'#a43e2e',weight:3,opacity:.8,dashArray:'6 6'}).addTo(map);
 [...new Set(d.route)].forEach((k,n)=>{const p=place(k);L.marker(p.ll,{icon:L.divIcon({className:'pin',html:String(n+1),iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map).bindPopup(`<b>${n+1}. ${esc(p.name)}</b><br>${external(search(k),'打开 Google Maps')}`);});
 map.fitBounds(L.latLngBounds(route).pad(.18),{maxZoom:14});
}
function render(){
 if(map){map.remove();map=null;}
 $('#days').innerHTML=DAYS.map((d,n)=>`<button data-day="${n}" aria-pressed="${n===selected}"><strong>${d.date}</strong><span>${d.week} · ${d.short}</span></button>`).join('');
 $('#day-content').innerHTML=dayHTML(DAYS[selected],selected);
 drawMap();updateProgress();
 $('#show-schematic').onclick=()=>{$('#map').hidden=true;};
 $('#show-local').onclick=()=>{if(!map)return;$('#map').hidden=false;map.invalidateSize();const groups=[['tokyo','ginza','eel'],['onsen','temple','bamboo','niji','sora'],['kogen','omuro','kira'],['kogen','jogasaki','bridge','tuna'],['tokyo','sushi']];map.fitBounds(L.latLngBounds(groups[selected].map(k=>place(k).ll)).pad(.2),{maxZoom:15});};
 $('#show-map').onclick=()=>{if(map){$('#map').hidden=false;map.invalidateSize();map.fitBounds(L.latLngBounds(DAYS[selected].route.map(k=>place(k).ll)).pad(.18),{maxZoom:14});}};
}
$('#days').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;selected=Number(b.dataset.day);render();});
$('#airport').addEventListener('change',e=>{airport=e.target.value;render();});
$('#priority').addEventListener('change',e=>{priority=e.target.value;render();});
$('#day-content').addEventListener('change',e=>{if(!e.target.matches('[data-check]'))return;done[e.target.dataset.check]=e.target.checked;try{localStorage.setItem('walknote-izu-checks',JSON.stringify(done));}catch{}e.target.closest('.stop').classList.toggle('done',e.target.checked);updateProgress();});
$('#source-links').innerHTML=SOURCES.map(([label,url])=>external(url,label)).join('');
document.querySelector('.hero-photo img').addEventListener('error',e=>{e.target.hidden=true;});
$('#print').onclick=()=>window.print();
let savedPriority;
window.addEventListener('beforeprint',()=>{savedPriority=priority;priority='all';if(map){map.remove();map=null;}$('#day-content').innerHTML=DAYS.map((d,n)=>dayHTML(d,n,true)).join('');});
window.addEventListener('afterprint',()=>{priority=savedPriority||'all';render();});
render();
