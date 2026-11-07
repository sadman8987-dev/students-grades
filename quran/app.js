'use strict';
const API='https://api.alquran.cloud/v1';
const $=id=>document.getElementById(id);
const store={get(k,d){try{return JSON.parse(localStorage.getItem('ward:'+k))??d}catch{return d}},set(k,v){localStorage.setItem('ward:'+k,JSON.stringify(v))}};
let surahs=[],activeSurah=0,activeAyahs=[],deferredInstall=null,theme=store.get('theme','dark'),fontSize=store.get('fontSize',31);
const cache=new Map();
async function api(path){const r=await fetch(API+path);if(!r.ok)throw new Error('تعذر الاتصال بمصدر البيانات القرآنية');const j=await r.json();if(j.code!==200)throw new Error(j.status||'تعذر تحميل البيانات');return j.data}
function normalize(s){return s.normalize('NFD').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه').trim()}
function arNum(n){return Number(n).toLocaleString('ar-EG')}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(name+'View').classList.add('active');document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name));$('readerView').hidden=true;window.scrollTo({top:document.querySelector('.tabs').offsetTop,behavior:'smooth'})}
function card(s){return '<button class="surah-card" data-surah="'+s.number+'"><span class="surah-number"><span>'+arNum(s.number)+'</span></span><span><strong>'+s.name+'</strong><small>'+(s.revelationType==='Meccan'?'مكية':'مدنية')+' · '+arNum(s.numberOfAyahs)+' آية</small></span></button>'}
function renderSurahs(){let q=normalize($('surahFilter').value||'');let list=surahs.filter(s=>normalize(s.name).includes(q)||String(s.number)===q);if($('surahSort').value==='desc')list.reverse();$('surahGrid').innerHTML=list.length?list.map(card).join(''):'<div class="empty-state">لا توجد نتائج مطابقة</div>';$('surahCount').textContent=arNum(list.length)+' سورة'}
async function openSurah(id,ayah=1,markTarget=true){id=Math.min(114,Math.max(1,Number(id)||1));activeSurah=id;const meta=surahs.find(s=>s.number===id);$('homeView').classList.remove('active');document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('readerView').hidden=false;$('readerName').textContent=meta?.name||'القرآن الكريم';$('readerMeta').textContent='السورة '+arNum(id);$('readerSub').textContent=(meta?.revelationType==='Meccan'?'مكية':'مدنية')+' · '+arNum(meta?.numberOfAyahs||0)+' آية';$('quranText').innerHTML='<div class="loading">جارٍ تحميل الآيات…</div>';$('surahBismillah').hidden=(id===1||id===9);$('surahFavBtn').textContent=store.get('surahs',[]).includes(id)?'♥':'♡';window.scrollTo({top:$('readerView').offsetTop-10,behavior:'smooth'});
try{let data=cache.get(id);if(!data){try{data=await api('/surah/'+id+'/quran-uthmani')}catch(networkError){try{data=await getOfflineSurah(id)}catch{}if(!data)throw networkError}cache.set(id,data);saveSurahToDB(id,data).catch(()=>{})}activeAyahs=data.ayahs||[];$('quranText').innerHTML=activeAyahs.map(a=>{const sajda=!!a.sajda&&a.sajda!==false;return '<span class="ayah" id="ayah-'+a.numberInSurah+'" tabindex="0" data-ayah="'+a.numberInSurah+'" data-surah="'+id+'" data-global="'+a.number+'">'+a.text+' <span class="ayah-end" aria-label="الآية '+a.numberInSurah+'"><b>'+arNum(a.numberInSurah)+'</b></span> '+(sajda?'<span class="sajda-label">۩ سجدة</span>':'')+'</span> '}).join('');store.set('last',{surah:id,ayah});highlightAyah(ayah,id,true,markTarget);$('prevSurah').disabled=id===1;$('nextSurah').disabled=id===114;$('audioPanel').hidden=true;$('audioPlayer').pause();$('audioPlayer').removeAttribute('src');$('audioPlayer').load();}catch(e){$('quranText').innerHTML='<div class="empty-state">'+e.message+'<br><button class="btn btn-gold" id="retrySurah">إعادة المحاولة</button></div>';$('retrySurah').onclick=()=>openSurah(id,ayah,markTarget)}}
function highlightAyah(n,sn=activeSurah,scroll=true,markTarget=true){const ayahs=[...document.querySelectorAll('.ayah')],el=ayahs.find(x=>Number(x.dataset.ayah)===Number(n)&&(!x.dataset.surah||Number(x.dataset.surah)===Number(sn)));ayahs.forEach(x=>x.classList.toggle('selected',markTarget&&x===el));if(el&&scroll)el.scrollIntoView({behavior:'smooth',block:'center'});return el}
function clearAyahSelection(){document.querySelectorAll('.ayah.selected').forEach(x=>x.classList.remove('selected'));document.getElementById('ayahActions')?.remove()}
async function openPage(n){n=Math.min(604,Math.max(1,Number(n)||1));$('pageNumber').value=n;showReader();$('readerName').textContent='صفحة '+arNum(n);$('readerMeta').textContent='مصحف المدينة المنورة';$('readerSub').textContent='الصفحة '+arNum(n)+' من ٦٠٤';$('surahBismillah').hidden=true;$('quranText').innerHTML='<div class="loading">جارٍ تحميل الصفحة…</div>';try{const d=await api('/page/'+n+'/quran-uthmani');activeSurah=d.ayahs[0].surah.number;activeAyahs=d.ayahs;$('quranText').innerHTML=activeAyahs.map(a=>'<span class="ayah" data-ayah="'+a.numberInSurah+'" data-global="'+a.number+'" data-surah="'+a.surah.number+'">'+a.text+' <span class="ayah-end"><b>'+arNum(a.numberInSurah)+'</b></span></span> ').join('');store.set('last',{surah:activeSurah,ayah:activeAyahs[0].numberInSurah,page:n});$('readerMeta').textContent=activeAyahs[0].surah.name+' · صفحة '+arNum(n);$('readerSub').textContent='من '+activeAyahs[0].surah.name+' إلى '+activeAyahs.at(-1).surah.name;}catch(e){$('quranText').textContent=e.message}}
function showReader(){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('readerView').hidden=false;window.scrollTo({top:$('readerView').offsetTop-10,behavior:'smooth'})}
async function openSegment(type,n){showReader();$('readerName').textContent=type==='juz'?'الجزء '+arNum(n):'ربع الحزب '+arNum(n);$('readerMeta').textContent='تقسيم المصحف';$('readerSub').textContent='جارٍ تحميل النص';$('quranText').innerHTML='<div class="loading">جارٍ تحميل المقطع…</div>';$('surahBismillah').hidden=true;try{const d=await api('/'+(type==='juz'?'juz':'hizbQuarter')+'/'+n+'/quran-uthmani');activeAyahs=d.ayahs;activeSurah=activeAyahs[0].surah.number;$('quranText').innerHTML=activeAyahs.map(a=>'<span class="ayah" data-ayah="'+a.numberInSurah+'" data-global="'+a.number+'" data-surah="'+a.surah.number+'">'+a.text+' <span class="ayah-end"><b>'+arNum(a.numberInSurah)+'</b></span></span> ').join('');$('readerSub').textContent=activeAyahs.length+' آية · '+activeAyahs[0].surah.name;}catch(e){$('quranText').textContent=e.message}}
const RECITERS={'ar.alafasy':'مشاري راشد العفاسي','ar.sudais':'عبدالرحمن السديس','ar.mahermuaiqly':'ماهر المعيقلي','ar.husary':'محمود خليل الحصري','ar.abdulbasit':'عبدالباسط عبدالصمد','everyayah-ghamdi':'سعد الغامدي','ar.shuraim':'سعود الشريم'};
let audioAyahs=[],audioIndex=0;
let mp3Reciters=[],selectedMp3Read=null;
async function initReciterSearch(){
 const select=$('reciterSelect');
 const search=document.createElement('input');
 search.type='search';search.id='reciterSearch';search.className='field reciter-search';
 search.placeholder='ابحث باسم القارئ…';search.setAttribute('aria-label','ابحث عن قارئ');
 select.parentNode.insertBefore(search,select);
 const hint=document.createElement('small');hint.id='reciterCount';hint.className='reciter-count';hint.textContent='جارٍ تحميل ١٠٠ قارئ…';select.insertAdjacentElement('afterend',hint);
 try{
  const response=await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar');
  if(!response.ok)throw new Error('تعذر تحميل قائمة القراء');
  const data=await response.json();
  const groups=new Map();
  (data.reciters||[]).forEach(r=>(r.moshaf||[]).forEach(m=>{
   const surahs=(m.surah_list||'').split(',').map(Number).filter(Boolean);
   if(!r.id||!m.server||surahs.length<114)return;
   const item={id:r.id,name:r.name,readId:m.id,readName:m.name||'تلاوة كاملة',server:m.server,surahs:[...new Set(surahs)]};
   const old=groups.get(String(r.id));
   // Prefer a complete Hafs/Murattal recording, then keep the first complete one.
   const score=x=>Number(/حفص|مرتّل|مرتل|مصحف كامل/i.test(x.readName||''));
   if(!old||score(item)>score(old))groups.set(String(r.id),item);
  }));
  mp3Reciters=[...groups.values()].slice(0,100);
  const render=()=>{
   const q=normalize(search.value||'');
   const filtered=mp3Reciters.filter(r=>normalize(r.name+' '+r.readName).includes(q));
   const saved=store.get('reciter','');
   select.innerHTML='';
   filtered.forEach(r=>{const value='mp3:'+r.id+':'+r.readId;const o=new Option(r.name+' — '+r.readName,value);o.dataset.server=r.server;o.dataset.surahs=r.surahs.join(',');o.dataset.reciter=r.id;o.selected=value===saved;select.add(o)});
   if(!filtered.length)select.add(new Option('لا توجد نتائج مطابقة',''));
   $('reciterCount').textContent='عرض '+arNum(filtered.length)+' من '+arNum(mp3Reciters.length)+' قارئ كامل';
   selectedMp3Read=select.selectedOptions[0]?.value.startsWith('mp3:')?select.selectedOptions[0]:null;
  };
  search.addEventListener('input',render);render();
 }catch(err){$('reciterCount').textContent='تعذر تحميل القائمة؛ تحقق من الاتصال.';search.disabled=true;}
}

function reciterLabel(){const s=$('reciterSelect');return s.value.startsWith('mp3:')?(s.selectedOptions[0]?.textContent||'القارئ المختار'):(RECITERS[s.value]||'القارئ المختار')}
async function loadRecitation(surahId,startIndex=0){
 const rid=$('reciterSelect').value,audio=$('audioPlayer');
 $('audioPanel').hidden=false;$('audioLabel').textContent=$('readerName').textContent+' · '+reciterLabel();$('listenBtn').textContent='جارٍ تحميل التلاوة…';
 try{
  if(rid.startsWith('mp3:')){
   const option=$('reciterSelect').selectedOptions[0],available=(option?.dataset.surahs||'').split(',').map(Number);
   if(!available.includes(Number(surahId)))throw new Error('هذه السورة غير متاحة لهذا القارئ.');
   const server=option.dataset.server;
   audioAyahs=[];audioIndex=0;audio.src=server+String(surahId).padStart(3,'0')+'.mp3';
   audio.playbackRate=Number($('playbackRate').value||1);audio.load();
   $('audioLabel').textContent=reciterLabel()+' · سورة '+$('readerName').textContent;
   await audio.play();$('listenBtn').textContent='❚❚ إيقاف / تشغيل';
   return;
  }
  const data=await api('/surah/'+surahId+'/'+rid);audioAyahs=data.ayahs||[];audioIndex=startIndex;if(!audioAyahs.length)throw Error('لا توجد ملفات صوتية');await playRecitationAyah()
 }catch(err){$('audioLabel').textContent=err.message||('تعذر تحميل صوت '+reciterLabel());$('listenBtn').textContent='▶ إعادة المحاولة'}

}
async function playRecitationAyah(){
 const audio=$('audioPlayer'),a=audioAyahs[audioIndex];if(!a)return;
 const src=(a.audioSecondary&&a.audioSecondary[0])||a.audio;if(!src)throw Error('ملف الصوت غير متاح');
 audio.src=src;audio.playbackRate=Number($('playbackRate').value||1);audio.load();
 highlightAyah(a.numberInSurah,activeSurah,true);
 $('audioLabel').textContent=reciterLabel()+' · الآية '+arNum(a.numberInSurah)+' / '+arNum(audioAyahs.length);
 await audio.play();$('listenBtn').textContent='❚❚ إيقاف / تشغيل';
}
async function playSurah(){
 if(!activeSurah)return;const audio=$('audioPlayer');
 if(audio.src&&!audio.paused){audio.pause();$('listenBtn').textContent='▶ استكمال التلاوة';return}
 if(audioAyahs.length&&audio.dataset.surah===String(activeSurah)&&audio.dataset.reciter===$('reciterSelect').value){try{await audio.play();$('listenBtn').textContent='❚❚ إيقاف / تشغيل'}catch(e){$('listenBtn').textContent='▶ إعادة المحاولة'}return}
 audio.dataset.surah=String(activeSurah);audio.dataset.reciter=$('reciterSelect').value;await loadRecitation(activeSurah,0);
}
async function advanceRecitation(){
 if($('repeatAudio').checked){audioIndex=0;try{await playRecitationAyah()}catch(e){$('listenBtn').textContent='▶ استماع'}return}
 if(audioIndex+1<audioAyahs.length){audioIndex++;try{await playRecitationAyah()}catch(e){$('audioLabel').textContent='تعذر تحميل الآية التالية';$('listenBtn').textContent='▶ استماع'}return}
 if(activeSurah<114){const next=activeSurah+1;await openSurah(next,1);$('audioPlayer').dataset.surah=String(next);$('audioPlayer').dataset.reciter=$('reciterSelect').value;await loadRecitation(next,0)}
 else{$('listenBtn').textContent='▶ استماع';$('audioLabel').textContent='انتهت تلاوة القرآن الكريم'}
}

function favorites(){return store.get('favorites',[])}
function saveFavorite(a){const k=a.number;let f=favorites();if(f.some(x=>x.number===k))f=f.filter(x=>x.number!==k);else f.push({number:k,surah:a.surah.number,surahName:a.surah.name,ayah:a.numberInSurah,text:a.text});store.set('favorites',f);renderSaved()}
function renderSaved(){const fav=favorites(),savs=store.get('surahs',[]),last=store.get('last',null);let html='';if(last)html+='<div class="saved-item"><div><strong>متابعة القراءة</strong><small>السورة '+arNum(last.surah)+' · الآية '+arNum(last.ayah||1)+'</small></div><div class="saved-actions"><button data-resume>متابعة</button></div></div>';savs.forEach(id=>{const s=surahs.find(x=>x.number===id);if(s)html+='<div class="saved-item"><div><strong>'+s.name+'</strong><small>سورة محفوظة</small></div><div class="saved-actions"><button data-open="'+id+'">فتح</button><button data-unfav="'+id+'">إزالة</button></div></div>'});fav.forEach(a=>html+='<div class="saved-item"><div><strong>'+a.surahName+' · الآية '+arNum(a.ayah)+'</strong><small>'+a.text.slice(0,65)+'…</small></div><div class="saved-actions"><button data-open="'+a.surah+'" data-ayah="'+a.ayah+'">فتح</button><button data-favdel="'+a.number+'">×</button></div></div>');$('savedList').innerHTML=html||'<div class="empty-state">لم تحفظ أي آية أو سورة بعد.</div>'}
async function searchQuran(){const raw=$('verseSearch').value.trim();if(!raw)return;$('searchResults').innerHTML='<div class="loading">جارٍ البحث…</div>';try{let matches=[];const terms=[...new Set([raw,normalize(raw)])];for(const term of terms){const d=await api('/search/'+encodeURIComponent(term)+'/all/ar');matches=d.matches||[];if(matches.length)break}$('searchResults').innerHTML=matches.length?matches.map(a=>'<div class="result-card"><small>'+a.surah.name+' · الآية '+arNum(a.numberInSurah)+'</small><p>'+a.text+'</p><button class="btn btn-outline" data-open="'+a.surah.number+'" data-ayah="'+a.numberInSurah+'">الانتقال إلى الآية</button></div>').join(''):'<div class="empty-state">لم يتم العثور على نتائج.</div>'}catch(e){$('searchResults').innerHTML='<div class="empty-state">تعذر تنفيذ البحث الآن. '+e.message+'</div>'}}
function applyTheme(){document.body.classList.remove('theme-cream','theme-light');if(theme!=='dark')document.body.classList.add('theme-'+theme);document.documentElement.style.setProperty('--reader-size',fontSize+'px');$('readingTheme').value=theme;$('fontRange').value=fontSize}
let dbPromise;function openDB(){if(!('indexedDB'in window))return Promise.reject();if(dbPromise)return dbPromise;dbPromise=new Promise((res,rej)=>{const req=indexedDB.open('ward-quran',1);req.onupgradeneeded=()=>req.result.createObjectStore('surahs',{keyPath:'id'});req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});return dbPromise}
async function saveSurahToDB(id,data){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction('surahs','readwrite');tx.objectStore('surahs').put({id,data,at:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function getOfflineSurah(id){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction('surahs','readonly'),r=tx.objectStore('surahs').get(id);r.onsuccess=()=>res(r.result?.data||null);r.onerror=()=>rej(r.error)})}
async function downloadAll(){const b=$('downloadQuran');b.disabled=true;for(let i=1;i<=114;i++){try{let d=cache.get(i)||await api('/surah/'+i+'/quran-uthmani');cache.set(i,d);await saveSurahToDB(i,d);$('offlineStatus').textContent='تم حفظ '+arNum(i)+' من ١١٤ سورة'}catch(e){$('offlineStatus').textContent='توقف التنزيل عند السورة '+arNum(i)+'. تحقق من الاتصال ثم أعد المحاولة.';b.disabled=false;return}}$('offlineStatus').textContent='اكتمل حفظ نص السور الـ١١٤ على هذا الجهاز. جرّب فتحها بعد فصل الإنترنت.';b.disabled=false}
document.addEventListener('click',async e=>{const s=e.target.closest('.surah-card[data-surah]');if(s){openSurah(Number(s.dataset.surah));return}const o=e.target.closest('[data-open]');if(o){openSurah(Number(o.dataset.open),Number(o.dataset.ayah)||1);return}const f=e.target.closest('[data-favdel]');if(f){store.set('favorites',favorites().filter(a=>a.number!==Number(f.dataset.favdel)));renderSaved()}const sf=e.target.closest('[data-unfav]');if(sf){store.set('surahs',store.get('surahs',[]).filter(x=>x!==Number(sf.dataset.unfav)));renderSaved()}if(e.target.closest('[data-resume]')){const l=store.get('last',{surah:1,ayah:1});openSurah(l.surah,l.ayah)}const pg=e.target.closest('[data-page]');if(pg)openPage(Number(pg.dataset.page))});
	$('quranText').addEventListener('click',async e=>{
 const el=e.target.closest('.ayah');
 if(!el){if(!e.target.closest('#ayahActions'))clearAyahSelection();return}
 const n=Number(el.dataset.ayah),sn=Number(el.dataset.surah)||activeSurah;
 const a=activeAyahs.find(x=>x.numberInSurah===n&&(x.surah?.number||sn)===sn)||activeAyahs.find(x=>x.numberInSurah===n);
 if(!a)return;
 store.set('last',{surah:sn,ayah:n});highlightAyah(n,sn,false);
 document.getElementById('ayahActions')?.remove();
 const bar=document.createElement('div');bar.id='ayahActions';bar.className='saved-item';
 bar.innerHTML='<strong>الآية '+arNum(n)+'</strong><div class="saved-actions"><button data-action="fav">♡ حفظ</button><button data-action="copy">نسخ</button><button data-action="share">مشاركة</button></div>';
 el.after(bar);
 if(audioAyahs.length&&$('audioPlayer').dataset.surah===String(sn)){
  const idx=audioAyahs.findIndex(x=>Number(x.numberInSurah)===n);
  if(idx>=0){audioIndex=idx;try{await playRecitationAyah()}catch(err){}}
 }
 bar.onclick=async ev=>{
  const act=ev.target.dataset.action;
  if(act==='fav'){saveFavorite({number:a.number||a.globalNumber,surah:{number:sn,name:a.surah?.name||surahs.find(x=>x.number===sn)?.name},numberInSurah:n,text:a.text});ev.target.textContent='تم الحفظ'}
  if(act==='copy'){await navigator.clipboard?.writeText(a.text);ev.target.textContent='تم النسخ'}
  if(act==='share'){if(navigator.share)await navigator.share({text:a.text+'\n— '+(a.surah?.name||'القرآن الكريم')+'، الآية '+n});else await navigator.clipboard?.writeText(a.text)}
 };
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.ayah')&&!e.target.closest('#ayahActions'))clearAyahSelection()},true);
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showView(t.dataset.view)));
$('surahFilter').addEventListener('input',renderSurahs);$('surahSort').addEventListener('change',renderSurahs);$('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=normalize(e.target.value);const s=surahs.find(x=>normalize(x.name).includes(q)||String(x.number)===q);if(s)openSurah(s.number);else{$('verseSearch').value=e.target.value;showView('search');searchQuran()}}});
$('continueBtn').onclick=()=>{const l=store.get('last',{surah:1,ayah:1});openSurah(l.surah,l.ayah)};$('bookmarksBtn').onclick=()=>{renderSaved();showView('saved')};$('settingsBtn').onclick=()=>$('settingsDialog').showModal();$('readingTheme').onchange=e=>{theme=e.target.value;applyTheme()};$('fontRange').oninput=e=>{fontSize=Number(e.target.value);applyTheme()};$('settingsDialog').addEventListener('close',()=>{theme=$('readingTheme').value;fontSize=Number($('fontRange').value);store.set('theme',theme);store.set('fontSize',fontSize);applyTheme()});
 $('fontUp').onclick=()=>{fontSize=Math.min(42,fontSize+2);applyTheme();store.set('fontSize',fontSize)};$('fontDown').onclick=()=>{fontSize=Math.max(22,fontSize-2);applyTheme();store.set('fontSize',fontSize)};$('themeBtn').onclick=()=>{theme=theme==='dark'?'cream':theme==='cream'?'light':'dark';store.set('theme',theme);applyTheme()};$('listenBtn').onclick=playSurah;$('closeAudio').onclick=()=>{$('audioPlayer').pause();$('audioPanel').hidden=true};$('reciterSelect').onchange=()=>{const a=$('audioPlayer');store.set('reciter',$('reciterSelect').value);a.pause();a.removeAttribute('src');a.load();audioAyahs=[];a.dataset.surah='';$('listenBtn').textContent='▶ استماع'};$('playbackRate').onchange=e=>$('audioPlayer').playbackRate=Number(e.target.value);$('audioPlayer').addEventListener('ended',()=>{const a=$('audioPlayer');advanceRecitation()});$('backBtn').onclick=()=>{ $('readerView').hidden=true;showView('home')};$('prevSurah').onclick=()=>openSurah(Math.max(1,activeSurah-1));$('nextSurah').onclick=()=>openSurah(Math.min(114,activeSurah+1));$('surahFavBtn').onclick=()=>{let s=store.get('surahs',[]);s=s.includes(activeSurah)?s.filter(x=>x!==activeSurah):[...s,activeSurah];store.set('surahs',s);$('surahFavBtn').textContent=s.includes(activeSurah)?'♥':'♡'};
$('openPage').onclick=()=>openPage($('pageNumber').value);$('pageNumber').onkeydown=e=>{if(e.key==='Enter')openPage(e.target.value)};$('openJuz').onclick=()=>openSegment('juz',$('juzNumber').value);$('openHizb').onclick=()=>openSegment('hizb',$('hizbNumber').value);$('runSearch').onclick=searchQuran;$('verseSearch').onkeydown=e=>{if(e.key==='Enter')searchQuran()};$('downloadQuran').onclick=downloadAll;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').hidden=true};
async function init(){applyTheme();for(let i=1;i<=30;i++)$('juzNumber').add(new Option('الجزء '+arNum(i),i));for(let i=1;i<=240;i++)$('hizbNumber').add(new Option('ربع الحزب '+arNum(i),i));try{surahs=await api('/surah');renderSurahs();const last=store.get('last',{surah:1,ayah:1});await openSurah(1,1,false);store.set('last',last)}catch(e){$('surahGrid').innerHTML='<div class="empty-state">تعذر تحميل فهرس السور. تحقق من الإنترنت ثم أعد تحميل الصفحة.<br>'+e.message+'</div>'}}
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('service-worker.js').catch(()=>{});
initReciterSearch();init();
