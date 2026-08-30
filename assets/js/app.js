const hm=(hours,minutes=0)=>hours+minutes/60;
const DEFAULT_SHIFTS=[
  {code:'D1',hours:hm(13),allowance:true,allowanceRate:24,meal:true},{code:'D2',hours:hm(11,25),allowance:true,allowanceRate:24,meal:true},
  {code:'D3',hours:hm(13,20),allowance:true,allowanceRate:24,meal:true},{code:'D4',hours:hm(13,15),allowance:true,allowanceRate:24,meal:true},
  {code:'T1',hours:hm(13,35),allowance:true,allowanceRate:24,meal:true},{code:'T2',hours:hm(12,29),allowance:true,allowanceRate:24,meal:true},
  {code:'M1',hours:hm(13,30),allowance:true,allowanceRate:24,meal:true},{code:'R1',hours:hm(13,15),allowance:true,allowanceRate:24,meal:true},
  {code:'R2',hours:hm(13,15),allowance:true,allowanceRate:24,meal:true},{code:'R3',hours:hm(12,20),allowance:true,allowanceRate:24,meal:true},
  {code:'R4',hours:hm(12,40),allowance:true,allowanceRate:24,meal:true},{code:'CAR1',hours:hm(12,10),allowance:true,allowanceRate:24,meal:true},
  {code:'P1',hours:hm(12,45),allowance:true,allowanceRate:24,meal:true},{code:'P2',hours:hm(13,5),allowance:true,allowanceRate:24,meal:true},
  {code:'P3',hours:hm(12,55),allowance:true,allowanceRate:24,meal:true},{code:'CAP1',hours:hm(12,55),allowance:true,allowanceRate:24,meal:true},
  {code:'CAP',hours:hm(12,55),allowance:true,allowanceRate:24,meal:true},{code:'SR1',hours:hm(12,15),allowance:true,allowanceRate:24,meal:true},
  {code:'IE',hours:0,allowance:false,allowanceRate:24,meal:true},{code:'BIS',hours:hm(12,15),allowance:true,allowanceRate:24,meal:true},
  {code:'AgB',hours:hm(10,25),allowance:false,allowanceRate:24,meal:false},{code:'PonD',hours:hm(9,25),allowance:false,allowanceRate:24,meal:false},
  {code:'DT',hours:hm(9,25),allowance:false,allowanceRate:24,meal:false},{code:'PT',hours:hm(9,30),allowance:false,allowanceRate:24,meal:false},
  {code:'AgM',hours:hm(9,45),allowance:false,allowanceRate:24,meal:false},{code:'AgT',hours:hm(11,10),allowance:false,allowanceRate:24,meal:false},
  {code:'PonM',hours:hm(10,25),allowance:false,allowanceRate:24,meal:false},  {code:'LD',hours:hm(8),allowance:false,allowanceRate:24,meal:false},
  {code:'F.P.',hours:hm(8),allowance:false,allowanceRate:24,meal:false},
  {code:'TERRA',hours:hm(8),allowance:false,allowanceRate:24,meal:true},
  {code:'Malattia',hours:0,allowance:false,allowanceRate:24,meal:false},{code:'Riposo',hours:0,allowance:false,allowanceRate:24,meal:false}
];
const SESSION_KEY='navidiaria.activeAgent';
const NAVITURNI_SESSION_KEY='naviturni_logged_agent';
const ADMIN_AGENT_ID='92';
let activeAgent=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
let STORAGE=`navidiaria.entries.v1.${activeAgent?.id||'guest'}`;
const SHIFTS_STORAGE='navidiaria.shifts.v1';
const COMPETENCE_VERSION='durata-corse-2026-07-11';
let SHIFTS=localStorage.getItem('navidiaria.competenceVersion')===COMPETENCE_VERSION?JSON.parse(localStorage.getItem(SHIFTS_STORAGE)||'null'):null;
if(!SHIFTS){SHIFTS=DEFAULT_SHIFTS.map(s=>({...s}));localStorage.setItem(SHIFTS_STORAGE,JSON.stringify(SHIFTS));localStorage.setItem('navidiaria.competenceVersion',COMPETENCE_VERSION)}
DEFAULT_SHIFTS.forEach(defaultShift=>{if(!SHIFTS.some(s=>s.code===defaultShift.code))SHIFTS.push({...defaultShift})});
SHIFTS.forEach(s=>{if(Number(s.allowanceRate)===25)s.allowanceRate=24;if(![0,9,12,24].includes(Number(s.allowanceRate)))s.allowanceRate=24});
const GROUND_SHIFTS=new Set(['AGB','POND','DT','PT','AGM','AGT','PONM','LD','TERRA','MALATTIA','RIPOSO']);
SHIFTS.forEach(s=>{if(s.embark===undefined)s.embark=!GROUND_SHIFTS.has(String(s.code).toUpperCase())});
SHIFTS.forEach(s=>{const code=String(s.code).toUpperCase();if(GROUND_SHIFTS.has(code)&&!['RIPOSO','MALATTIA'].includes(code))s.meal=true});
const TURNS_URL='';
const fmt=new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',weekday:'short'});
function parseEntriesSnapshot(raw){try{const parsed=JSON.parse(raw||'[]');return Array.isArray(parsed)?parsed.filter(Boolean):[]}catch(error){console.warn('Archivio locale della diaria non leggibile',error);return []}}
const storedEntriesRaw=localStorage.getItem(STORAGE)||'[]';
let entries=parseEntriesSnapshot(storedEntriesRaw);
const ENTRIES_SCHEMA_VERSION=4,entriesSchemaKey=`navidiaria.entriesSchema.${activeAgent?.id||'guest'}`,entriesBackupKey=`navidiaria.entries.backup.${activeAgent?.id||'guest'}`,entriesHistoryKey=`navidiaria.entries.history.${activeAgent?.id||'guest'}`,entriesMetaKey=`navidiaria.entries.meta.${activeAgent?.id||'guest'}`;
const FIREBASE_DIRTY_KEY=`navidiaria.cloudDirty.${activeAgent?.id||'guest'}`;
function snapshotFingerprint(list){return JSON.stringify(list||[]) }
function recordLocalBackup(reason='salvataggio',list=entries){try{const snapshot=JSON.stringify(list||[]),fingerprint=snapshotFingerprint(list),history=parseEntriesSnapshot(localStorage.getItem(entriesHistoryKey)||'[]');const latest=history.at(-1);if(latest?.fingerprint===fingerprint)return;history.push({savedAt:new Date().toISOString(),reason,entryCount:(list||[]).length,fingerprint,entries:JSON.parse(snapshot)});localStorage.setItem(entriesHistoryKey,JSON.stringify(history.slice(-35)));localStorage.setItem(entriesBackupKey,snapshot)}catch(error){console.warn('Backup locale non disponibile',error)}}
function writeEntriesLocal(reason='salvataggio'){const snapshot=JSON.stringify(entries);recordLocalBackup(reason,entries);localStorage.setItem(STORAGE,snapshot);localStorage.setItem(entriesMetaKey,JSON.stringify({updatedAt:new Date().toISOString(),entryCount:entries.length,fingerprint:snapshotFingerprint(entries)}));return snapshot}
if(entries.length&&!localStorage.getItem(entriesBackupKey))recordLocalBackup('prima protezione',entries);
let entriesMigrated=localStorage.getItem(entriesSchemaKey)!==String(ENTRIES_SCHEMA_VERSION);
entries.forEach(entry=>{if(entry.travel===undefined){entry.travel=false;entriesMigrated=true}if(entry.refuel===undefined){entry.refuel=false;entriesMigrated=true}if(entry.note===undefined){entry.note='';entriesMigrated=true}if(entry.manualOverride===undefined){entry.manualOverride=false;entriesMigrated=true}});
if(entriesMigrated){localStorage.setItem(STORAGE,JSON.stringify(entries));localStorage.setItem(entriesSchemaKey,String(ENTRIES_SCHEMA_VERSION))}
const MEAL_DEFAULT_VERSION='used-by-default-v1';
const mealVersionKey=`navidiaria.mealDefaultVersion.${activeAgent?.id||'guest'}`;const migrateMeals=localStorage.getItem(mealVersionKey)!==MEAL_DEFAULT_VERSION;
entries.forEach(e=>{const s=SHIFTS.find(x=>x.code===e.shift);if(migrateMeals&&s?.meal)e.mealUsed=true;else if(e.mealUsed===undefined)e.mealUsed=!!s?.meal;if(Number(e.allowanceRate)===25)e.allowanceRate=24;if(e.allowanceRate===undefined)e.allowanceRate=s?.allowance?s.allowanceRate:null;if(e.manualModified===undefined&&e.imported===false&&String(e.id).startsWith('naviturni-'))e.manualModified=true});
if(migrateMeals){localStorage.setItem(mealVersionKey,MEAL_DEFAULT_VERSION);localStorage.setItem(STORAGE,JSON.stringify(entries))}
const EMBARK_VERSION='competence-based-v1',embarkVersionKey=`navidiaria.embarkVersion.${activeAgent?.id||'guest'}`;if(localStorage.getItem(embarkVersionKey)!==EMBARK_VERSION){entries.forEach(e=>{if(e.imported)e.embark=!!shiftFor(e.shift).embark});localStorage.setItem(embarkVersionKey,EMBARK_VERSION);localStorage.setItem(STORAGE,JSON.stringify(entries))}
let editingId=null;
let agentsDirectory=[];
const $=id=>document.getElementById(id);

function minutesToText(value){const sign=value<0?'-':'';const m=Math.abs(Math.round(value));return `${sign}${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`}
function dataPill(value,className=''){return `<span class="data-pill ${className}">${value}</span>`}
function bpSummary(used,credit){const parts=[];if(used)parts.push(`${used} USATI`);if(credit)parts.push(`${credit} DA ACCR.`);return parts.join(' · ')||'—'}
function bpValueText(used,credit){const count=(Number(used)||0)+(Number(credit)||0);return count?(count*8).toLocaleString('it-IT',{style:'currency',currency:'EUR'}):'—'}
function shiftFor(code){return SHIFTS.find(s=>s.code===code)||SHIFTS.at(-1)}
const CHANGE_SERVICE_RESIDENCES={D1:'DESENZANO',D2:'DESENZANO',D3:'DESENZANO',D4:'DESENZANO',BIS:'DESENZANO',AGB:'DESENZANO',DT:'DESENZANO',POND:'DESENZANO',PT:'DESENZANO',T1:'MADERNO',T2:'MADERNO',M1:'MADERNO',AGM:'MADERNO',AGT:'MADERNO',PONM:'MADERNO',R1:'RIVA',R2:'RIVA',R3:'RIVA',R4:'RIVA',CAR1:'RIVA',P1:'PESCHIERA',P2:'PESCHIERA',P3:'PESCHIERA',CAP:'PESCHIERA',CAP1:'PESCHIERA',SR1:'PESCHIERA',IE:'PESCHIERA'};
function residenceKey(value=activeAgent?.residence){return String(value||'').trim().toUpperCase()}
const overtimeComponents=window.NaviOvertimeComponents;
function changeMinutes(entry){return overtimeComponents?.changes(entry)??Math.max(0,Math.round(Number(entry?.changeMinutes)||0))}
function sentineMinutes(entry){return overtimeComponents?.sentine(entry)??Math.max(0,Math.round(Number(entry?.sentineActivity?.minutes)||0))}
function overtimeMinutes(entry){return overtimeComponents?.total(entry)??Math.max(0,Math.round(Number(entry?.delay)||0))}
function ordinaryOvertimeMinutes(entry){return overtimeComponents?.ordinary(entry)??Math.max(0,Math.round(Number(entry?.delay)||0))}
function baseWorkedMinutes(entry){const manual=Number(entry?.workedMinutes);return Number.isFinite(manual)&&manual>=0?manual:Math.max(0,Math.round((Number(shiftFor(entry?.shift).hours)||0)*60))+(overtimeComponents?.structured(entry)?overtimeMinutes(entry):ordinaryOvertimeMinutes(entry))}
function effectiveWorkedMinutes(entry){return baseWorkedMinutes(entry)+(overtimeComponents?.structured(entry)?0:changeMinutes(entry))}
function serviceResidenceForShift(code){return CHANGE_SERVICE_RESIDENCES[String(scheduleAssignment(code).shift||code||'').trim().toUpperCase()]||''}
function changeSuggestionMinutes(entry){if(!entry||!shiftFor(entry.shift).hours||changeMinutes(entry)>0)return 0;const home=residenceKey(entry.agentResidence||activeAgent?.residence),service=residenceKey(serviceResidenceForShift(entry.shift)||entry.serviceResidence);return entry.travel===true||home&&service&&home!==service?120:0}
function refuelCredit(entry){return entry.refuel?(String(entry.shift).toUpperCase()==='DT'?60:30):0}
function travelCredit(entry){return entry.travel?120:0}
window.NaviDiariaChange={minutes:changeMinutes,baseWorkedMinutes,effectiveWorkedMinutes,serviceResidenceForShift,suggestionMinutes:changeSuggestionMinutes};
window.NaviDiariaOvertime={total:overtimeMinutes,ordinary:ordinaryOvertimeMinutes,sentine:sentineMinutes,setOrdinary:(entry,value,service)=>overtimeComponents?.setOrdinary(entry,value,service),setChanges:(entry,value,service)=>overtimeComponents?.setChanges(entry,value,service),setSentine:(entry,type,service)=>overtimeComponents?.setSentine(entry,type,service),setSentineMinutes:(entry,value,service)=>overtimeComponents?.setSentineMinutes(entry,value,service),setWorked:(entry,value,service)=>overtimeComponents?.setWorked(entry,value,service),create:()=>overtimeComponents?.create()||{ordinario:0,cambi:0,sentine:0}};
function isoWeek(dateString){const d=new Date(`${dateString}T12:00:00`);d.setDate(d.getDate()+4-(d.getDay()||7));const y=new Date(d.getFullYear(),0,1);return `${d.getFullYear()}-${Math.ceil((((d-y)/86400000)+1)/7)}`}
function weekInfo(dateString){const d=new Date(`${dateString}T12:00:00`),day=d.getDay()||7;d.setDate(d.getDate()-day+1);const start=new Date(d),end=new Date(d);end.setDate(end.getDate()+6);const short=date=>new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short'}).format(date);const payment=new Date(end.getFullYear(),end.getMonth()+1,1);return {start,end,label:`${short(start)} – ${short(end)}`,paymentLabel:new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(payment)}}
function isoDateValue(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function competencePeriod(monthValue=currentMonth()){
  const match=String(monthValue||'').match(/^(\d{4})-(\d{2})$/);if(!match)return {weeks:[],dates:[],start:null,end:null,startIso:'',endIso:''};
  const year=Number(match[1]),monthIndex=Number(match[2])-1,firstDay=new Date(year,monthIndex,1,12),lastDay=new Date(year,monthIndex+1,0,12);
  const firstSunday=new Date(firstDay);firstSunday.setDate(firstSunday.getDate()+(7-firstSunday.getDay())%7);
  const lastSunday=new Date(lastDay);lastSunday.setDate(lastSunday.getDate()-lastSunday.getDay());
  const weeks=[];
  for(let sunday=new Date(firstSunday);sunday<=lastSunday;sunday.setDate(sunday.getDate()+7)){
    const start=new Date(sunday);start.setDate(start.getDate()-6);
    const end=new Date(sunday);weeks.push({start,end});
  }
  const dates=weeks.flatMap(({start})=>Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);return date}));
  return {weeks,dates,start:dates[0]||null,end:dates.at(-1)||null,startIso:dates[0]?isoDateValue(dates[0]):'',endIso:dates.length?isoDateValue(dates.at(-1)):''};
}
function competenceEntries(monthValue=currentMonth()){const period=competencePeriod(monthValue);return entries.filter(entry=>entry.date>=period.startIso&&entry.date<=period.endIso).sort((a,b)=>a.date.localeCompare(b.date))}
window.NaviDiariaCompetence={period:competencePeriod,entries:competenceEntries};
function currentMonth(){return $('monthFilter').value}
function filtered(){return competenceEntries(currentMonth())}
function previousMonthCarryEntries(){return []}
function todayIso(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function shiftClass(code){return `shift-${String(code||'other').toLowerCase().replace(/[^a-z0-9]+/g,'')}`}
const GRADE_INFO={
  'capitano':{label:'Capitano',className:'grade-capitano'},'comandante':{label:'Capitano',className:'grade-capitano'},
  'capo timoniere':{label:'Capo Timoniere',className:'grade-capo'},'capotimoniere':{label:'Capo Timoniere',className:'grade-capo'},
  'timoniere':{label:'Timoniere',className:'grade-timoniere'},'aiuto motorista':{label:'Aiuto Motorista',className:'grade-aiuto'},
  'aiutomotorista':{label:'Aiuto Motorista',className:'grade-aiuto'},'motorista':{label:'Motorista',className:'grade-motorista'},
  'marinaio':{label:'Marinaio',className:'grade-marinaio'},'operaio':{label:'Operaio',className:'grade-operaio'},'ufficio':{label:'Ufficio',className:'grade-ufficio'}
};
function formatAgentName(name){return String(name||'').trim().split(/\s+/).map(part=>/^[A-ZÀ-ÖØ-Ý]+[.,]?$/.test(part)&&part.replace(/[.,]/g,'').length>1?part.charAt(0)+part.slice(1).toLowerCase():part).join(' ')}
function updateWelcome(){if(!activeAgent)return;const name=formatAgentName(activeAgent.name);$('welcomeName').textContent='NaviSuite Diaria';$('sidebarAgentName').textContent=name.toLocaleUpperCase('it')}
function scheduleAssignment(raw){
  const cleaned=String(raw||'').trim().replace(/\*/g,'').replace(/--/g,'');
  if(/^lav\.?$/i.test(cleaned))return {shift:'TERRA',travel:false};
  if(/^rip\.?$/i.test(cleaned)||cleaned==='----'||!cleaned)return {shift:'Riposo',travel:false};
  if(/^mal/i.test(cleaned))return {shift:'Malattia',travel:false};
  const canonical=value=>SHIFTS.find(item=>item.code.toUpperCase()===String(value).toUpperCase())?.code||null;
  const direct=canonical(cleaned);if(direct)return {shift:direct,travel:false};
  const candidates=[cleaned.slice(1),cleaned.slice(0,-1),cleaned.slice(1,-1)];
  for(const candidate of candidates){const shift=canonical(candidate);if(shift)return {shift,travel:true}}
  return {shift:cleaned,travel:false};
}
function normalizeScheduleShift(raw){return scheduleAssignment(raw).shift}
function shortShiftLabel(code){return code==='Riposo'?'Rip':code==='Malattia'?'Mal':String(code||'')}
function comparableAgentName(value){return String(value||'').toLocaleUpperCase('it').replace(/[^A-ZÀ-ÖØ-Ý\s]/g,' ').split(/\s+/).filter(part=>part.length>1).join(' ').trim()}
function variationsForAgent(data){const activeName=comparableAgentName(activeAgent?.name),variations=new Map();(data?.variazioni_ods||[]).filter(item=>item.attiva!==false&&comparableAgentName(item.agente)===activeName).forEach(item=>{if(item.data&&item.turno_nuovo)variations.set(String(item.data),String(item.turno_nuovo).replace(/\*$/,''))});return variations}
function cashHandlingDuty(data,date,shift){const code=String(shift||'').toUpperCase();if(['POND','PONM'].includes(code))return false;if(code==='DT'||/^AG[BTM]\d*$/.test(code))return true;if(!String(activeAgent?.qualifica||'marinaio').toLowerCase().includes('marinaio'))return false;const crew=Object.values(data?.residenze||{}).flat().filter(agent=>String(agent?.residence||'').toUpperCase()!=='BARISTE').filter(agent=>{const variation=(data?.variazioni_ods||[]).filter(item=>item.attiva!==false&&String(item.data)===String(date)).find(item=>String(item.id_agente||'')===String(agent.id)||comparableAgentName(item.agente)===comparableAgentName(agent.agente));return scheduleAssignment(variation?.turno_nuovo||agent?.turni?.[date]).shift===shift});const sailors=crew.filter(agent=>String(agent?.qualifica||'').toLowerCase().includes('marinaio'));return sailors.length===1}
async function getScheduledAssignment(date){const data=await NaviSharedData.load(TURNS_URL),variations=variationsForAgent(data);let agent=null;Object.values(data.residenze||{}).some(list=>{agent=(list||[]).find(a=>String(a.id)===String(activeAgent?.id));return !!agent});const baseRaw=agent?.turni?.[date];if(!baseRaw)throw new Error('Nessun turno assegnato per questa data');const base=scheduleAssignment(baseRaw),variationRaw=variations.get(date),assignment=variationRaw?scheduleAssignment(variationRaw):base;return {...assignment,travel:base.travel||assignment.travel}}
async function getScheduledShift(date){return (await getScheduledAssignment(date)).shift}
async function restoreFormFromSchedule(){const button=$('restoreFromShift');button.disabled=true;try{const assignment=await getScheduledAssignment($('entryDate').value);$('entryShift').value=assignment.shift;$('entryTravel').checked=assignment.travel;applyCompetenceDefaults();notify(`Ripristinato il turno ${assignment.shift}${assignment.travel?' · trasferta':''}`)}catch(error){notify(error.message)}finally{button.disabled=false}}
function isAdmin(){return ['91',ADMIN_AGENT_ID].includes(String(activeAgent?.id||''))||String(activeAgent?.role||'').toLowerCase()==='admin'}
function renderTodaySummary(){
  const entry=entries.find(e=>e.date===todayIso()),dateLabel=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(todayIso()+'T12:00:00')).replace(/^./,c=>c.toUpperCase());
  if(!entry){$('openToday').hidden=false;$('todaySummary').innerHTML=`<div class="today-date"><span>OGGI</span><strong>${dateLabel}</strong></div><div class="today-empty"><span>Nessun turno registrato</span></div>`;return}
  $('openToday').hidden=true;
  const shift=shiftFor(entry.shift),bp=shift.meal?(entry.mealUsed?'USATO':'DA ACCR.'):'—',diaria=entry.allowanceRate!==null&&entry.allowanceRate!==undefined?`${entry.allowanceRate}%`:'—',bankTotal=(Number(entry.bank)||0)+refuelCredit(entry)+travelCredit(entry),id=escapeHtml(String(entry.id));
  $('todaySummary').innerHTML=`<div class="today-date"><span>OGGI</span>${entry.variationFrom?`<em class="variation-badge">VAR. ${escapeHtml(shortShiftLabel(entry.variationFrom))}&gt;${escapeHtml(shortShiftLabel(entry.variationTo||entry.shift))}</em>`:''}${entry.manualModified?`<em class="manual-badge">MOD. ${escapeHtml(shortShiftLabel(entry.manualFrom))}&gt;${escapeHtml(shortShiftLabel(entry.manualTo||entry.shift))}</em>`:''}<strong>${dateLabel}</strong></div><div class="today-table-wrap"><table class="today-edit-table"><thead><tr><th>Servizio</th><th>Straordinario</th><th>Banca ore</th><th>BP</th><th>Imbarco</th><th>Diaria</th><th>Trasferta</th></tr></thead><tbody><tr><td class="inline-edit-cell" data-entry-id="${id}" data-inline="shift"><span class="shift-with-hours"><span class="shift-badge ${shiftClass(entry.shift)}">${entry.shift}</span><small>${minutesToText(Math.round(shift.hours*60)+Number(entry.delay||0))}</small></span></td><td class="inline-edit-cell" data-entry-id="${id}" data-inline="delay">${dataPill(entry.delay?entry.delay+' min':'—','pill-overtime')}</td><td class="inline-edit-cell" data-entry-id="${id}" data-inline="bank">${dataPill(bankTotal?minutesToText(bankTotal):'—','pill-bank')}</td><td class="inline-edit-cell" data-entry-id="${id}" data-inline="mealUsed">${dataPill(bp,'pill-bp')}</td><td class="inline-edit-cell" data-entry-id="${id}" data-inline="embark">${dataPill(entry.embark?'Sì':'—','pill-embark')}</td><td class="inline-edit-cell" data-entry-id="${id}" data-inline="allowanceRate">${dataPill(diaria,'pill-allowance')}</td><td class="inline-edit-cell" data-entry-id="${id}" data-inline="travel">${dataPill(entry.travel?'Sì · +2h':'—','pill-travel')}</td></tr></tbody></table></div>`;
  if(entry.travel)$('todaySummary').querySelector('.today-date strong')?.insertAdjacentHTML('beforebegin','<em class="travel-badge">TRASFERTA · +2H</em>');
  const todayHours=$('todaySummary').querySelector('.shift-with-hours small'),todayOvertime=$('todaySummary').querySelector('[data-inline="delay"]');if(todayHours)todayHours.textContent=minutesToText(effectiveWorkedMinutes(entry));if(todayOvertime)todayOvertime.innerHTML=dataPill(overtimeMinutes(entry)?minutesToText(overtimeMinutes(entry)):'—','pill-overtime');
  const todayLabels=['Servizio','Straordinario','Banca ore','BP','Imbarco','Diaria','Trasferta'];$('todaySummary').querySelectorAll('.today-edit-table tbody td').forEach((cell,index)=>cell.dataset.label=todayLabels[index]);
  $('todaySummary').onclick=event=>{const cell=event.target.closest('.inline-edit-cell');if(cell)startInlineEdit(cell)}
}
function renderWeeklyOvertime(monthEntries){
  const period=competencePeriod(currentMonth()),weekKeys=period.weeks.map(({end})=>isoWeek(isoDateValue(end)));let overtimeTotal=0;
  const rows=weekKeys.map(key=>{const weekEntries=entries.filter(e=>isoWeek(e.date)===key),worked=weekEntries.reduce((sum,e)=>sum+effectiveWorkedMinutes(e),0),changes=weekEntries.reduce((sum,e)=>sum+changeMinutes(e),0),refuel=weekEntries.reduce((sum,e)=>sum+refuelCredit(e),0),bank=weekEntries.reduce((sum,e)=>sum+(Number(e.bank)||0)+refuelCredit(e)+travelCredit(e),0),travels=weekEntries.filter(e=>e.travel).length,mealEntries=weekEntries.filter(e=>e.date<=todayIso()&&shiftFor(e.shift).meal),mealsUsed=mealEntries.filter(e=>e.mealUsed).length,mealsCredit=mealEntries.length-mealsUsed,embarks=weekEntries.filter(e=>e.embark).length,workDays=weekEntries.filter(e=>shiftFor(e.shift).hours>0).length,allowanceRates=weekEntries.filter(e=>e.allowanceRate!==null&&e.allowanceRate!==undefined).reduce((groups,e)=>{const rate=Number(e.allowanceRate);groups[rate]=(groups[rate]||0)+1;return groups},{});const overtime=Math.max(0,worked-39*60),info=weekInfo(weekEntries[0]?.date||isoDateValue(period.weeks.find(({end})=>isoWeek(isoDateValue(end))===key)?.start||period.start)),completed=info.end<=new Date(todayIso()+'T23:59:59');if(completed)overtimeTotal+=overtime;return {key,range:info.label,payment:info.paymentLabel,afterCutoff:false,completed,worked,changes,overtime,bank,refuel,travels,mealsUsed,mealsCredit,embarks,workDays,allowanceRates}});
  return {total:overtimeTotal,rows};
}
function renderTotalSummary(rows){
  const allowanceText=rates=>Object.entries(rates).map(([rate,count])=>`${count}×${rate}%`).join(' · ')||'—',included=rows.filter(row=>!row.afterCutoff),carried=rows.filter(row=>row.afterCutoff),accrued=included.filter(row=>row.completed||row.key===isoWeek(todayIso())),totals=accrued.reduce((sum,row)=>({workDays:sum.workDays+row.workDays,worked:sum.worked+row.worked,overtime:sum.overtime+row.overtime,bank:sum.bank+row.bank,mealsUsed:sum.mealsUsed+row.mealsUsed,mealsCredit:sum.mealsCredit+row.mealsCredit,embarks:sum.embarks+row.embarks,allowances:sum.allowances+Object.values(row.allowanceRates).reduce((a,b)=>a+b,0),refuel:sum.refuel+row.refuel}),{workDays:0,worked:0,overtime:0,bank:0,mealsUsed:0,mealsCredit:0,embarks:0,allowances:0,refuel:0});
  $('heroOvertime').textContent=minutesToText(totals.overtime);$('heroBank').textContent=minutesToText(totals.bank);$('heroBp').textContent=bpSummary(totals.mealsUsed,totals.mealsCredit);$('heroAllowance').textContent=totals.allowances;
  const rowHtml=(row,carriedRow=false)=>`<tr class="${row.completed?'':'forecast-total-row'} ${carriedRow?'carried-total-row':''}"><td><strong>${row.range}</strong><small>${carriedRow?`Da riportare a ${row.payment}`:row.completed?'Consuntivo':'Previsione'}</small></td><td>${dataPill(row.workDays,'pill-days')}</td><td>${dataPill(minutesToText(row.worked),'pill-hours')}</td><td>${dataPill(minutesToText(row.overtime),'pill-overtime')}</td><td>${dataPill(minutesToText(row.bank),'pill-bank')}</td><td>${dataPill(bpSummary(row.mealsUsed,row.mealsCredit),'pill-bp')}</td><td>${dataPill(row.embarks,'pill-embark')}</td><td>${dataPill(allowanceText(row.allowanceRates),'pill-allowance')}</td></tr>`;
  const body=included.map(row=>rowHtml(row)).join(''),carriedBody=carried.map(row=>rowHtml(row,true)).join('');
  const carriedSpacer=carriedBody?'<tr class="carried-spacer"><td colspan="8"></td></tr>':'';$('totalSummaryBody').innerHTML=body+`<tr class="grand-total-row"><td><strong>TOTALE MATURATO</strong></td><td>${dataPill(totals.workDays,'pill-days')}</td><td>${dataPill(minutesToText(totals.worked),'pill-hours')}</td><td>${dataPill(minutesToText(totals.overtime),'pill-overtime')}</td><td>${dataPill(minutesToText(totals.bank),'pill-bank')}</td><td>${dataPill(bpValueText(totals.mealsUsed,totals.mealsCredit),'pill-bp')}</td><td>${dataPill(totals.embarks,'pill-embark')}</td><td>${dataPill(totals.allowances,'pill-allowance')}</td></tr>`+carriedSpacer+carriedBody;
  const summaryRows=[...$('totalSummaryBody').querySelectorAll('tr:not(.grand-total-row):not(.carried-spacer)')];[...included,...carried].forEach((row,index)=>{const element=summaryRows[index];if(element){element.dataset.week=row.key;element.classList.add('summary-week-link');element.title='Vai a questa settimana nel Registro'}});
}
function previousMonthCarryRow(){
  const previous=previousMonthCarryEntries();if(!previous.length)return '';
  const previousMonthLabel=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(previous[0].date+'T12:00:00'));
  const mealEntries=previous.filter(e=>e.date<=todayIso()&&shiftFor(e.shift).meal),mealsUsed=mealEntries.filter(e=>e.mealUsed).length,mealsCredit=mealEntries.length-mealsUsed,work=previous.reduce((sum,e)=>sum+Math.round(shiftFor(e.shift).hours*60),0),extra=previous.reduce((sum,e)=>sum+(Number(e.delay)||0),0),refuel=previous.reduce((sum,e)=>sum+refuelCredit(e),0),bank=previous.reduce((sum,e)=>sum+(Number(e.bank)||0)+refuelCredit(e)+travelCredit(e),0),travels=previous.filter(e=>e.travel).length,allowanceRates=previous.filter(e=>e.allowanceRate!==null&&e.allowanceRate!==undefined).reduce((groups,e)=>{groups[e.allowanceRate]=(groups[e.allowanceRate]||0)+1;return groups},{}),embarks=previous.filter(e=>e.embark).length;
  const dateFmt=date=>new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short'}).format(new Date(date+'T12:00:00')),range=`${dateFmt(previous[0].date)} – ${dateFmt(previous.at(-1).date)}`;
  const diaria=Object.entries(allowanceRates).map(([rate,count])=>`${count}×${rate}%`).join(' · ')||'—';return `<tr class="previous-month-row"><td><small>RIPORTATO DA ${previousMonthLabel.toUpperCase()}</small><strong>${range}</strong></td><td><span class="shift-with-hours"><span class="carry-badge">RIPORTO</span><small>${minutesToText(work)}</small></span></td><td>${dataPill(minutesToText(extra),'pill-overtime')}</td><td>${dataPill(minutesToText(bank),'pill-bank')}</td><td>${dataPill(bpSummary(mealsUsed,mealsCredit),'pill-bp')}</td><td>${dataPill(embarks||'—','pill-embark')}</td><td>${dataPill(diaria,'pill-allowance')}</td><td>${dataPill(travels||'—','pill-travel')}</td><td></td></tr>`;
}
function persist(){writeEntriesLocal('modifica giornata');markCloudDirty();render()}
function notify(message){$('toast').textContent=message;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
let firebaseAuthenticated=false;
let cloudUiResetTimer=null;
let undoSnapshot=null,lastKnownEntriesSnapshot=JSON.stringify(entries);
function setUndoUi(enabled){[$('monthlyUndo'),$('weeklyUndo')].filter(Boolean).forEach(button=>{button.disabled=!enabled;button.classList.toggle('is-ready',enabled);button.setAttribute('aria-label',enabled?'Annulla l’ultima modifica':'Nessuna modifica da annullare')})}
function setCloudUi(label,state=''){
  const sidebar=$('syncStatus'),buttons=[$('monthlySync'),$('weeklySync')].filter(Boolean);
  if(sidebar)sidebar.textContent=label;
  if(!buttons.length)return;
  clearTimeout(cloudUiResetTimer);
  buttons.forEach(button=>{button.classList.remove('is-syncing','is-saved','is-error');if(state)button.classList.add(`is-${state}`);button.disabled=state==='syncing';const text=button.querySelector('b');if(text)text.textContent=state==='syncing'?'Sincronizzo…':state==='saved'?'Sincronizzato':state==='error'?'Riprova':'Sincronizza dati';button.setAttribute('aria-label',label)});
  if(state==='saved')cloudUiResetTimer=setTimeout(()=>setCloudUi('Online'),2200);
}
function setSaveUi(state='idle'){
  const buttons=[$('monthlySave'),$('weeklySave')].filter(Boolean);if(!buttons.length)return;
  const dirty=state==='dirty'||state==='error';
  const labels={idle:'Nessuna modifica da salvare',dirty:'Salva le modifiche su Firebase',saving:'Salvataggio su Firebase…',saved:'Modifiche salvate su Firebase',error:'Salvataggio non riuscito. Riprova'};
  const buttonLabels={idle:'Salva modifiche',dirty:'Salva modifiche',saving:'Salvataggio…',saved:'Salvato',error:'Riprova'};
  buttons.forEach(button=>{button.classList.remove('is-dirty','is-saving','is-saved','is-error');if(state!=='idle')button.classList.add(`is-${state}`);button.disabled=state==='saving'||state==='saved'||!dirty;const text=button.querySelector('b');if(text)text.textContent=buttonLabels[state]||buttonLabels.idle;button.setAttribute('aria-label',labels[state]||labels.idle)});
}
let firebaseSaveTimer=null;
function scheduleFirebaseSave(){if(!activeAgent||!window.NaviAdminFirebase?.saveDiaria)return;clearTimeout(firebaseSaveTimer);firebaseSaveTimer=setTimeout(()=>{firebaseSaveTimer=null;saveEntriesToFirebase().catch(error=>console.warn('Salvataggio automatico su Firebase non riuscito',error))},1400)}
function markCloudDirty(){const current=JSON.stringify(entries);if(current!==lastKnownEntriesSnapshot){undoSnapshot=lastKnownEntriesSnapshot;lastKnownEntriesSnapshot=current;recordLocalBackup('modifica da sincronizzare',entries);setUndoUi(true)}localStorage.setItem(FIREBASE_DIRTY_KEY,'1');setSaveUi('dirty');scheduleFirebaseSave()}
function undoLastDiariaChange(){if(!undoSnapshot)return;entries=parseEntriesSnapshot(undoSnapshot);lastKnownEntriesSnapshot=JSON.stringify(entries);undoSnapshot=null;writeEntriesLocal('annullamento modifica');localStorage.setItem(FIREBASE_DIRTY_KEY,'1');setUndoUi(false);setSaveUi('dirty');render();notify('Ultima modifica annullata')}
function firebaseCredentials(){return {agentId:String(activeAgent?.id||''),pinHash:localStorage.getItem(`navidiaria.pin.${activeAgent?.id}`)||''}}
async function authenticateFirebase(){const credentials=firebaseCredentials();if(!credentials.agentId||!credentials.pinHash)throw new Error('Accedi nuovamente per attivare il salvataggio online');await NaviFirebaseAuth.request('auth',credentials);firebaseAuthenticated=true;return credentials}
function mergeFirebaseEntries(localEntries,remoteEntries,preferLocal){const merged=new Map();(remoteEntries||[]).forEach(entry=>merged.set(entry.date||entry.id,entry));(localEntries||[]).forEach(entry=>{const key=entry.date||entry.id;if(preferLocal||!merged.has(key))merged.set(key,entry)});return [...merged.values()].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))}
async function saveEntriesToFirebase(){if(!activeAgent)return;const snapshot=JSON.stringify(entries);try{if(!window.NaviAdminFirebase?.saveDiaria)throw new Error('Modulo Firebase non disponibile');setSaveUi('saving');$('syncStatus').textContent='Salvataggio protetto su Firebase…';await NaviAdminFirebase.saveDiaria(String(activeAgent.id),parseEntriesSnapshot(snapshot));if(JSON.stringify(entries)===snapshot){localStorage.removeItem(FIREBASE_DIRTY_KEY);lastKnownEntriesSnapshot=snapshot;undoSnapshot=null;setUndoUi(false);setSaveUi('saved');setTimeout(()=>setSaveUi(localStorage.getItem(FIREBASE_DIRTY_KEY)==='1'?'dirty':'idle'),1800)}else markCloudDirty();$('syncStatus').textContent='Salvato con copia di sicurezza'}catch(error){console.warn(error);setSaveUi('error');$('syncStatus').textContent='Modifiche locali · salvataggio non riuscito';throw error}}
async function syncEntriesWithFirebase(){if(!window.NaviAdminFirebase?.loadDiaria)throw new Error('Modulo Firebase non disponibile');if(localStorage.getItem(FIREBASE_DIRTY_KEY)==='1'){try{await saveEntriesToFirebase()}catch(error){console.warn('Salvataggio modifiche pendenti non riuscito',error);$('syncStatus').textContent='Modifiche locali · salvataggio non riuscito';return false}if(localStorage.getItem(FIREBASE_DIRTY_KEY)==='1'){$('syncStatus').textContent='Modifiche locali · salvataggio non riuscito';return false}}const remote=await NaviAdminFirebase.loadDiaria(String(activeAgent.id)),localEntries=[...entries],localMeta=(()=>{try{return JSON.parse(localStorage.getItem(entriesMetaKey)||'{}')}catch{return {}}})();if(remote.updatedAt&&remote.entries.length===0&&localEntries.length){recordLocalBackup('bloccato ripristino remoto vuoto',localEntries);markCloudDirty();$('syncStatus').textContent='Protezione attiva · copia Firebase vuota ignorata';notify('Protezione attiva: dati locali mantenuti');return true}if(remote.entries.length){const localIsNewer=localEntries.length&&localMeta.updatedAt&&new Date(localMeta.updatedAt)>new Date(remote.updatedAt);if(localIsNewer){recordLocalBackup('copia locale più recente',localEntries);markCloudDirty();$('syncStatus').textContent='Protezione attiva · copia locale più recente';return true}const protectedEntries=mergeFirebaseEntries(localEntries,remote.entries,false);if(protectedEntries.length>remote.entries.length){entries=protectedEntries;writeEntriesLocal('unione contro perdita dati');markCloudDirty();$('syncStatus').textContent='Protezione attiva · dati locali integrati';notify('Dati locali protetti e reintegrati');return true}entries=remote.entries.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));lastKnownEntriesSnapshot=JSON.stringify(entries);undoSnapshot=null;setUndoUi(false);writeEntriesLocal('caricato da Firebase');render();$('syncStatus').textContent=`Caricato da Firebase · v${remote.version||1}`}else if(entries.length){markCloudDirty();$('syncStatus').textContent='Dati locali pronti per Firebase'}else{$('syncStatus').textContent='Firebase aggiornato'}return true}
async function syncDiariaNow(){
  const button=$('monthlySync');if(!activeAgent||button?.disabled)return;
  if(localStorage.getItem(FIREBASE_DIRTY_KEY)==='1'){
    setSaveUi('dirty');notify('Salva prima le modifiche evidenziate');$('monthlySave')?.focus();return;
  }
  setCloudUi('Sincronizzazione diaria e turni…','syncing');
  try{
    await syncEntriesWithFirebase();
    await syncCurrentAgent(true);
    await saveEntriesToFirebase();
    setCloudUi('Diaria e turni sincronizzati','saved');
    notify('Dati sincronizzati su tutti i dispositivi');
  }catch(error){
    console.error(error);setCloudUi('Sincronizzazione non riuscita','error');notify('Sincronizzazione non riuscita');
  }
}
async function syncCurrentAgent(force=false){
  if(!activeAgent)return;
  const button=$('syncShifts');button.disabled=true;$('syncStatus').textContent='Aggiornamento…';
  try{
    const previousEntries=JSON.stringify(entries),data=await NaviSharedData.load(TURNS_URL,{force});let agent=null;
    Object.values(data.residenze||{}).some(list=>{agent=(list||[]).find(a=>String(a.id)===String(activeAgent.id));return !!agent});
    if(!agent)throw new Error('Agente non trovato');const variations=variationsForAgent(data);let added=0,updated=0;
    activeAgent={...activeAgent,name:agent.agente||activeAgent.name,qualifica:agent.qualifica||'marinaio'};localStorage.setItem(SESSION_KEY,JSON.stringify(activeAgent));updateWelcome();
    Object.entries(agent.turni||{}).forEach(([date,raw])=>{
      const baseAssignment=scheduleAssignment(raw),odsRaw=variations.get(date),assignment=odsRaw?scheduleAssignment(odsRaw):baseAssignment,baseShift=baseAssignment.shift,shift=assignment.shift,travel=baseAssignment.travel||assignment.travel,variationFrom=odsRaw&&shift!==baseShift?baseShift:null,cashDuty=cashHandlingDuty(data,date,shift),existing=entries.find(e=>e.date===date);
      if(existing){if(!existing.manualOverride){const changed=existing.shift!==shift||!!existing.travel!==travel;if(changed)updated++;if(existing.imported){const competence=shiftFor(shift);existing.embark=!!competence.embark;existing.mealUsed=!!competence.meal;existing.allowanceRate=competence.allowance?competence.allowanceRate:null}if(!existing.cashHandlingManual)existing.cashHandling=cashDuty;existing.shift=shift;existing.travel=travel;existing.manualFrom=null;existing.manualTo=null;existing.manualModified=false;existing.variationFrom=variationFrom;existing.variationTo=variationFrom?shift:null}else{if(travel)existing.travel=true;existing.manualFrom=existing.manualFrom||shift;existing.manualTo=existing.shift;existing.manualModified=existing.manualFrom!==existing.manualTo;existing.variationFrom=variationFrom;existing.variationTo=variationFrom?shift:null}}
      else{const competence=shiftFor(shift);entries.push({id:`naviturni-${date}`,date,shift,travel,variationFrom,variationTo:variationFrom?shift:null,delay:0,overtimeComponents:window.NaviDiariaOvertime.create(),bank:0,embark:!!competence.embark,cashHandling:cashDuty,cashHandlingManual:false,mealUsed:!!competence.meal,allowanceRate:competence.allowance?competence.allowanceRate:null,note:'',imported:true});added++}
    });
    localStorage.setItem(`navidiaria.lastSync.${activeAgent.id}`,new Date().toISOString());if(JSON.stringify(entries)!==previousEntries)persist();else render();$('syncStatus').textContent=NaviSharedData.source()==='network'?'Aggiornato':'Locale';
  }catch(error){console.error(error);$('syncStatus').textContent='Sincronizzazione non riuscita';notify('Impossibile leggere NaviTurni')}
  finally{button.disabled=false}
}

function render(){
  const list=filtered(),actualEntries=list.filter(e=>e.date<=todayIso());let total=0,bank=0,embark=0,meals=0,mealsUsed=0,allowances=0;
  const weeks={};
  actualEntries.forEach(e=>{const s=shiftFor(e.shift),mins=effectiveWorkedMinutes(e);total+=mins;bank+=(Number(e.bank)||0)+refuelCredit(e)+travelCredit(e);embark+=e.embark?1:0;if(s.meal){e.mealUsed?mealsUsed++:meals++}allowances+=e.allowanceRate!==null&&e.allowanceRate!==undefined?1:0;const w=isoWeek(e.date);weeks[w]=(weeks[w]||0)+mins});
  const weeklyOvertime=renderWeeklyOvertime(list),overtime=weeklyOvertime.total;renderTotalSummary(weeklyOvertime.rows);
  const [y,m]=currentMonth().split('-');$('heroMonth').textContent=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(y,m-1,1)).replace(/^./,c=>c.toUpperCase());
  renderTodaySummary();
  $('entriesBody').innerHTML=list.map(e=>{const s=shiftFor(e.shift),isPastOrToday=e.date<=todayIso(),bp=s.meal&&isPastOrToday?(e.mealUsed?'USATO':'DA ACCREDITARE'):'—',diaria=e.allowanceRate!==null&&e.allowanceRate!==undefined?`${e.allowanceRate}%`:'—',bankTotal=(Number(e.bank)||0)+refuelCredit(e)+travelCredit(e);const dayRow=`<tr class="${e.date===todayIso()?'today-row':''}"><td><strong>${fmt.format(new Date(e.date+'T12:00:00'))}${e.date===todayIso()?'<span class="today-label">OGGI</span>':''}${e.variationFrom?`<span class="variation-badge">VAR. ${escapeHtml(shortShiftLabel(e.variationFrom))}&gt;${escapeHtml(shortShiftLabel(e.variationTo||e.shift))}</span>`:''}${e.manualModified?`<span class="manual-badge">MOD.${e.manualFrom&&e.manualFrom!==e.manualTo?` ${escapeHtml(shortShiftLabel(e.manualFrom))}&gt;${escapeHtml(shortShiftLabel(e.manualTo||e.shift))}`:''}</span>`:''}</strong>${e.note?`<small>${escapeHtml(e.note)}</small>`:''}</td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="shift" title="Clicca per modificare"><span class="shift-with-hours"><span class="shift-badge ${shiftClass(e.shift)}">${e.shift}</span><small>${minutesToText(Math.round(s.hours*60)+Number(e.delay||0))}</small></span></td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="delay" title="Clicca per modificare">${dataPill(e.delay?e.delay+' min':'—','pill-overtime')}</td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="bank" title="Clicca per modificare">${dataPill(bankTotal?minutesToText(bankTotal):'—','pill-bank')}</td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="mealUsed" title="Clicca per modificare">${dataPill(bp,'pill-bp')}</td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="embark" title="Clicca per modificare">${dataPill(e.embark?'Sì':'—','pill-embark')}</td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="allowanceRate" title="Clicca per modificare">${dataPill(diaria,'pill-allowance')}</td><td class="inline-edit-cell" data-entry-id="${escapeHtml(String(e.id))}" data-inline="travel" title="Clicca per modificare">${dataPill(e.travel?'Sì · +2h':'—','pill-travel')}</td><td><div class="row-actions"><button class="edit-button icon-only-button" data-edit="${e.id}" aria-label="Modifica giornata" title="Modifica giornata">✎</button></div></td></tr>`;const isSunday=new Date(e.date+'T12:00:00').getDay()===0;if(!isSunday)return dayRow;const week=weeklyOvertime.rows.find(row=>row.key===isoWeek(e.date)),allowanceSummary=week?Object.entries(week.allowanceRates).map(([rate,count])=>`${count}×${rate}%`).join(' · ')||'—':'—';const summary=week?`<tr class="week-summary-table ${week.completed?'':'future-week'}"><td><small>RIEPILOGO SETTIMANA ${week.completed?'':'· PREVISIONE'}</small><strong>${week.range}</strong></td><td><span class="summary-hours-stack">${dataPill(minutesToText(week.worked),'pill-hours')}<small>SOGLIA 39h</small></span></td><td>${dataPill(minutesToText(week.overtime),'pill-overtime')}</td><td>${dataPill(minutesToText(week.bank),'pill-bank')}</td><td>${dataPill(bpSummary(week.mealsUsed,week.mealsCredit),'pill-bp')}</td><td>${dataPill(week.embarks||'—','pill-embark')}</td><td>${dataPill(allowanceSummary,'pill-allowance')}</td><td>${dataPill(week.travels||'—','pill-travel')}</td><td></td></tr>`:'';return dayRow+summary}).join('');
  list.filter(entry=>entry.travel).forEach(entry=>{$('entriesBody').querySelector(`[data-entry-id="${CSS.escape(String(entry.id))}"]`)?.closest('tr')?.querySelector('td:first-child strong')?.insertAdjacentHTML('beforeend','<span class="travel-badge">TRASFERTA · +2H</span>')});
  $('entriesBody').querySelectorAll('.pill-bp').forEach(pill=>{pill.textContent=pill.textContent.replace(/DA ACCREDITARE/g,'DA ACCR.')});
  list.forEach(entry=>{const row=$('entriesBody').querySelector(`[data-entry-id="${CSS.escape(String(entry.id))}"]`)?.closest('tr');if(!row)return;const hours=row.querySelector('.shift-with-hours small'),overtimeCell=row.querySelector('[data-inline="delay"]');if(hours)hours.textContent=minutesToText(effectiveWorkedMinutes(entry));if(overtimeCell)overtimeCell.innerHTML=dataPill(overtimeMinutes(entry)?minutesToText(overtimeMinutes(entry)):'—','pill-overtime')});
  $('emptyState').style.display=list.length?'none':'block';
  $('entriesBody').querySelectorAll('tr').forEach(row=>{const editable=row.querySelector('[data-entry-id]'),entry=editable&&entries.find(item=>String(item.id)===editable.dataset.entryId);if(entry){row.dataset.week=isoWeek(entry.date);row.dataset.date=entry.date}else if(row.classList.contains('week-summary-table')){row.dataset.week=row.previousElementSibling?.dataset.week||'';row.classList.add('registry-week-link');row.title='Torna a questa settimana nel Consultivo'}});
  document.dispatchEvent(new CustomEvent('navidiaria:render'));
}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function hoursToClock(hours){const mins=Math.round((Number(hours)||0)*60);return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}
function clockToHours(value){const [h,m]=String(value||'0:0').split(':').map(Number);return (h||0)+(m||0)/60}
function renderShiftSettings(){
  $('shiftCards').innerHTML=SHIFTS.filter(s=>s.code!=='Riposo').map(s=>`<div class="shift-card" data-shift="${s.code}"><strong>${s.code}</strong><label>Durata<input class="shift-hours" type="time" value="${hoursToClock(s.hours)}"></label><div class="shift-options"><label><input class="shift-embark" type="checkbox" ${s.embark?'checked':''}> Imbarco</label><label><input class="shift-allowance" type="checkbox" ${s.allowance?'checked':''}> Diaria</label><label class="rate-label">Aliquota <select class="shift-rate">${[0,9,12,24].map(rate=>`<option value="${rate}" ${Number(s.allowanceRate)===rate?'selected':''}>${rate}%</option>`).join('')}</select></label><label><input class="shift-meal" type="checkbox" ${s.meal?'checked':''}> Diritto al buono</label></div></div>`).join('');
}
function refreshShiftSelect(){const selected=$('entryShift').value;$('entryShift').innerHTML=SHIFTS.map(s=>`<option value="${s.code}">${s.code}${s.hours?' · '+minutesToText(s.hours*60):''}</option>`).join('');if(SHIFTS.some(s=>s.code===selected))$('entryShift').value=selected}
function applyCompetenceDefaults(){const shift=shiftFor($('entryShift').value),working=!['RIPOSO','MALATTIA'].includes(String(shift.code).toUpperCase());$('entryEmbark').checked=!!shift.embark;$('entryAllowanceRate').value=shift.allowance?String(shift.allowanceRate):'';$('entryMeal').checked=working;$('entryMeal').disabled=!working;$('entryMeal').closest('label').title=working?'Usato per impostazione predefinita; deseleziona se non lo utilizzi':'Nessun buono pasto per questa giornata';$('refuelLabel').textContent=String(shift.code).toUpperCase()==='DT'?'Rifornimento (+60 min)':'Rifornimento (+30 min)'}
function resetEntryForm(){editingId=null;$('entryForm').reset();$('entryTravel').dataset.manual='false';$('entryDate').value=todayIso();$('entryEmbark').checked=true;applyCompetenceDefaults();$('submitEntry').textContent='Aggiungi giornata';$('cancelEdit').hidden=true}
function closeEntryForm(){const form=$('entryForm');form.hidden=true;form.style.display='none';$('dayEditor').hidden=true}
function startEdit(id){const entry=entries.find(e=>e.id===id);if(!entry)return;editingId=id;$('entryDate').value=entry.date;$('entryShift').value=entry.shift;applyCompetenceDefaults();$('entryDelay').value=ordinaryOvertimeMinutes(entry)||0;$('entryBank').value=entry.bank||0;$('entryHydrofoil').value=entry.hydrofoil||0;$('entryMissedRest').value=entry.missedRest||0;$('entrySecondMeal').value=entry.secondMeal||0;$('entryAllowanceRate').value=entry.allowanceRate??'';$('entryEmbark').checked=!!entry.embark;$('entryCashHandling').checked=!!entry.cashHandling;$('entryRefuel').checked=!!entry.refuel;$('entryTravel').checked=!!entry.travel;$('entryTravel').dataset.manual=entry.travel?'true':'false';$('entryMeal').checked=!!entry.mealUsed;$('entryNote').value=entry.note||'';$('submitEntry').textContent='Salva modifiche';$('cancelEdit').hidden=false;$('dayEditorTitle').textContent=`Modifica ${fmt.format(new Date(entry.date+'T12:00:00'))}`;$('dayEditor').hidden=false;$('entryForm').hidden=false;$('entryForm').style.display='grid';document.querySelector('.quick-entry').scrollIntoView({behavior:'smooth',block:'start'})}
function saveInlineEntry(entry,field,value,restoreSchedule=false){
  if(field==='shift'){const original=entry.manualFrom||entry.shift;entry.shift=value;entry.manualFrom=restoreSchedule?null:original;entry.manualTo=restoreSchedule?null:value;entry.manualModified=!restoreSchedule&&original!==value;entry.manualOverride=!restoreSchedule&&original!==value;const competence=shiftFor(value);entry.embark=!!competence.embark;entry.mealUsed=!!competence.meal;entry.allowanceRate=competence.allowance?competence.allowanceRate:null}
  else if(field==='delay')window.NaviDiariaOvertime.setOrdinary(entry,value,Math.round((Number(shiftFor(entry.shift).hours)||0)*60));else if(field==='bank')entry.bank=Number(value)||0;else if(field==='travel')entry.travel=value==='true';else if(field==='mealUsed')entry.mealUsed=value==='true';else if(field==='embark')entry.embark=value==='true';else if(field==='allowanceRate')entry.allowanceRate=value===''?null:Number(value);
  entry.imported=false;persist();notify('Modifica salvata')
}
function startInlineEdit(cell){
  const entry=entries.find(item=>item.id===cell.dataset.entryId),field=cell.dataset.inline;if(!entry||cell.querySelector('input,select'))return;
  if(field==='delay'&&window.NaviOvertimeEditor?.open){window.NaviOvertimeEditor.open({entry,title:new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long'}).format(new Date(`${entry.date}T12:00:00`)),onSave:()=>{entry.imported=false;persist()}});return}
  let editor;if(field==='shift'){editor=document.createElement('select');editor.add(new Option('↻ Ripristina da turno','__restore__'));SHIFTS.forEach(shift=>editor.add(new Option(shift.code,shift.code,shift.code===entry.shift,shift.code===entry.shift)))}
  else if(field==='delay'||field==='bank'){editor=document.createElement('input');editor.type='number';editor.step='1';if(field==='delay')editor.min='0';editor.value=String(Number(entry[field])||0)}
  else{editor=document.createElement('select');const options=field==='mealUsed'?[['true','USATO'],['false','DA ACCR.']]:field==='embark'?[['true','Sì'],['false','No']]:field==='travel'?[['true','Sì · +2h'],['false','No']]:[['','Nessuna'],['0','0%'],['9','9%'],['12','12%'],['24','24%']];options.forEach(([value,label])=>editor.add(new Option(label,value,false,String(field==='allowanceRate'?(entry.allowanceRate??''):entry[field])===value)))}
  editor.className='inline-cell-editor';cell.replaceChildren(editor);editor.focus();if(editor.select)editor.select();let saved=false;const commit=async()=>{if(saved)return;saved=true;let value=editor.value,restoreSchedule=false;if(field==='shift'&&value==='__restore__'){restoreSchedule=true;editor.disabled=true;try{const assignment=await getScheduledAssignment(entry.date);value=assignment.shift;entry.travel=assignment.travel}catch(error){notify(error.message);render();return}}saveInlineEntry(entry,field,value,restoreSchedule)};editor.addEventListener('change',commit);editor.addEventListener('blur',commit);editor.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit()}if(event.key==='Escape'){saved=true;render()}})
}
function openDayEditorForDate(date){if(window.NaviDiariaDayEditor?.open){window.NaviDiariaDayEditor.open(date);return}const existing=entries.find(e=>e.date===date);if(existing){startEdit(existing.id);return}resetEntryForm();$('entryDate').value=date;$('dayEditorTitle').textContent=`Aggiungi giornata · ${fmt.format(new Date(date+'T12:00:00'))}`;$('dayEditor').hidden=false;$('entryForm').hidden=false;$('entryForm').style.display='grid';document.querySelector('.quick-entry').scrollIntoView({behavior:'smooth',block:'start'})}
function openTodayEditor(){openDayEditorForDate(todayIso())}
function hasSecureCrypto(){return typeof window!=='undefined'&&!!(window.crypto&&window.crypto.subtle&&typeof window.crypto.subtle.digest==='function')}
async function hashPin(pin){if(hasSecureCrypto()){const bytes=new TextEncoder().encode(`NaviDiaria:${pin}`),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}throw new Error('Questo login richiede HTTPS (Web Crypto non disponibile).')}
function showLoginMessage(message){$('loginMessage').textContent=message}
async function loadAgentDirectory(){
  const data=await NaviSharedData.load(TURNS_URL);agentsDirectory=[];
  Object.entries(data.residenze||{}).forEach(([residence,list])=>(list||[]).forEach(agent=>agentsDirectory.push({id:String(agent.id),name:String(agent.agente||'').trim(),qualifica:String(agent.qualifica||'marinaio').trim(),residence})));
  agentsDirectory.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  renderAgentChoices();
}
function renderAgentChoices(){const query=$('loginAgentSearch').value.trim().toLocaleLowerCase('it'),matches=agentsDirectory.filter(agent=>agent.name.toLocaleLowerCase('it').includes(query));$('loginAgentSuggestions').innerHTML=matches.map(agent=>`<option value="${escapeHtml(agent.name)}">${escapeHtml(agent.residence)}</option>`).join('')}
function selectedLoginAgent(){const query=$('loginAgentSearch').value.trim().toLocaleLowerCase('it');if(!query)return null;const exact=agentsDirectory.find(agent=>agent.name.toLocaleLowerCase('it')===query);if(exact)return exact;const matches=agentsDirectory.filter(agent=>agent.name.toLocaleLowerCase('it').includes(query));return matches.length===1?matches[0]:null}
async function renderAdminPinList(){
  if(!isAdmin())return;$('adminPinList').innerHTML='<div class="weekly-empty">Caricamento utenti online…</div>';try{const result=await NaviFirebaseAuth.request('list_users',firebaseCredentials()),registered=result.users.map(user=>({...user,...agentsDirectory.find(item=>item.id===user.id)})).sort((a,b)=>a.name.localeCompare(b.name,'it'));
  $('adminPinList').innerHTML=registered.length?registered.map(agent=>{const grade=GRADE_INFO[String(agent.qualifica||'marinaio').toLowerCase()]||GRADE_INFO.marinaio;return `<div class="admin-agent-row"><div class="admin-agent-avatar">${escapeHtml(formatAgentName(agent.name).charAt(0))}</div><div class="admin-agent-info"><strong>${escapeHtml(formatAgentName(agent.name))}</strong><span class="${grade.className}">${grade.label}${agent.residence?` · ${escapeHtml(agent.residence)}`:''}${agent.lastAccess?` · ultimo accesso ${escapeHtml(agent.lastAccess.replace('T',' '))}`:''}</span></div><span class="pin-active-badge">PIN ATTIVO</span><button class="reset-agent-pin" data-agent-id="${escapeHtml(agent.id)}" data-agent-name="${escapeHtml(formatAgentName(agent.name))}" type="button">Resetta PIN</button></div>`}).join(''):'<div class="weekly-empty">Nessun agente registrato online.</div>'}catch(error){$('adminPinList').innerHTML=`<div class="weekly-empty">${escapeHtml(error.message)}</div>`}
}
async function loginAgent(agentId,pin){
  const agent=agentsDirectory.find(item=>item.id===String(agentId));if(!agent)throw new Error('Seleziona un agente dalla lista');
  const pinKey=`navidiaria.pin.${agent.id}`,digest=await hashPin(pin);
  await NaviFirebaseAuth.request('auth',{agentId:agent.id,pinHash:digest});localStorage.setItem(pinKey,digest);
  const personalKey=`navidiaria.entries.v1.${agent.id}`;if(agent.id==='92'&&!localStorage.getItem(personalKey)&&localStorage.getItem('navidiaria.entries.v1'))localStorage.setItem(personalKey,localStorage.getItem('navidiaria.entries.v1'));
  localStorage.setItem(SESSION_KEY,JSON.stringify(agent));localStorage.setItem(NAVITURNI_SESSION_KEY,JSON.stringify({id:agent.id,name:agent.name,residence:agent.residence}));location.reload();
}
async function initializeAccess(){
  if(!activeAgent&&!localStorage.getItem(NAVITURNI_SESSION_KEY)){location.replace('index.html');return}
  if(activeAgent){updateWelcome();$('pinSettingsButton').hidden=false;$('logoutButton').hidden=false;$('syncStatus').textContent='Sincronizzazione…';$('competenze').hidden=!isAdmin();$('competencyNav').hidden=!isAdmin();$('adminPanel').hidden=true;$('adminNav').hidden=true;await NaviFirebaseAuth.migrateStoredPin(activeAgent.id).catch(error=>console.warn('Migrazione PIN Firebase non completata',error));try{await syncEntriesWithFirebase()}catch(error){console.warn(error);$('syncStatus').textContent='Locale · da sincronizzare'}syncCurrentAgent()}
  else{try{await loadAgentDirectory();const turniProfile=JSON.parse(localStorage.getItem(NAVITURNI_SESSION_KEY)||'null'),matched=turniProfile&&agentsDirectory.find(agent=>String(agent.id)===String(turniProfile.id));if(matched){localStorage.setItem(SESSION_KEY,JSON.stringify(matched));location.reload();return}$('loginOverlay').hidden=false;document.body.classList.add('login-open');$('loginAgentSearch').focus()}catch(error){$('loginOverlay').hidden=false;document.body.classList.add('login-open');showLoginMessage('Impossibile caricare gli agenti. Ricarica la pagina.');$('loginAgentSearch').placeholder='Elenco non disponibile';$('loginAgentSearch').disabled=true}}
}

refreshShiftSelect();renderShiftSettings();
const today=new Date();$('monthFilter').value=todayIso().slice(0,7);$('entryDate').value=todayIso();
document.addEventListener('gesturestart',event=>event.preventDefault());document.addEventListener('touchmove',event=>{if(event.touches.length>1)event.preventDefault()},{passive:false});
applyCompetenceDefaults();
$('entryShift').addEventListener('change',applyCompetenceDefaults);
$('entryDate').addEventListener('change',()=>{const existing=entries.find(e=>e.date===$('entryDate').value);if(existing&&existing.id!==editingId)startEdit(existing.id)});
$('entryForm').addEventListener('submit',e=>{e.preventDefault();const rate=$('entryAllowanceRate').value;const values={date:$('entryDate').value,shift:$('entryShift').value,delay:Number($('entryDelay').value),bank:Number($('entryBank').value),hydrofoil:Number($('entryHydrofoil').value),missedRest:Number($('entryMissedRest').value),secondMeal:Number($('entrySecondMeal').value),refuel:$('entryRefuel').checked,travel:$('entryTravel').checked,allowanceRate:rate===''?null:Number(rate),embark:$('entryEmbark').checked,cashHandling:$('entryCashHandling').checked,cashHandlingManual:true,mealUsed:$('entryMeal').checked,note:$('entryNote').value.trim()};const duplicate=entries.find(x=>x.date===values.date&&x.id!==editingId);if(duplicate){notify('Questa giornata esiste già');startEdit(duplicate.id);return}const serviceMinutes=Math.round((Number(shiftFor(values.shift).hours)||0)*60);if(editingId){const entry=entries.find(x=>x.id===editingId);if(entry){const manualFrom=entry.manualFrom||entry.shift,manualModified=manualFrom!==values.shift;Object.assign(entry,values,{imported:false,manualModified,manualOverride:manualModified,manualFrom,manualTo:values.shift});window.NaviDiariaOvertime.setOrdinary(entry,values.delay,serviceMinutes)}}else{const entry={id:crypto.randomUUID(),...values,overtimeComponents:window.NaviDiariaOvertime.create(),manualOverride:true};window.NaviDiariaOvertime.setOrdinary(entry,values.delay,serviceMinutes);entries.push(entry)}persist();notify(editingId?'Giornata aggiornata':'Giornata aggiunta');resetEntryForm();closeEntryForm()});
$('entriesBody').addEventListener('click',e=>{const editButton=e.target.closest('[data-edit]');if(editButton){startEdit(editButton.dataset.edit);return}const cell=e.target.closest('.inline-edit-cell');if(cell)startInlineEdit(cell)});
$('entriesBody').addEventListener('click',event=>{const dateCell=event.target.closest('tr:not(.week-summary-table):not(.previous-month-row)[data-date] > td:first-child');if(!dateCell)return;const date=dateCell.parentElement.dataset.date;if(window.NaviDiariaDayEditor?.open){window.NaviDiariaDayEditor.open(date);return}const entry=entries.find(item=>item.date===date);if(entry)startEdit(entry.id)});
$('cancelEdit').addEventListener('click',()=>{resetEntryForm();closeEntryForm()});
$('restoreFromShift').addEventListener('click',restoreFormFromSchedule);
$('toggleCompetencies').addEventListener('click',()=>{if(!isAdmin())return;const body=$('competencyBody');const opening=body.hidden;body.hidden=!opening;$('toggleCompetencies').setAttribute('aria-expanded',String(opening));$('competencyChevron').textContent=opening?'⌃':'⌄'});
$('saveAllShifts').addEventListener('click',()=>{if(!isAdmin()){notify('Operazione riservata all’amministratore');return}document.querySelectorAll('#shiftCards .shift-card').forEach(card=>{const shift=shiftFor(card.dataset.shift);shift.hours=clockToHours(card.querySelector('.shift-hours').value);shift.embark=card.querySelector('.shift-embark').checked;shift.allowance=card.querySelector('.shift-allowance').checked;shift.allowanceRate=Number(card.querySelector('.shift-rate').value)||0;shift.meal=card.querySelector('.shift-meal').checked});localStorage.setItem(SHIFTS_STORAGE,JSON.stringify(SHIFTS));refreshShiftSelect();render();notify('Tutte le competenze sono state salvate')});
$('resetShifts').addEventListener('click',()=>{if(!isAdmin()){notify('Operazione riservata all’amministratore');return}SHIFTS=DEFAULT_SHIFTS.map(s=>({...s,embark:!GROUND_SHIFTS.has(String(s.code).toUpperCase())}));localStorage.setItem(SHIFTS_STORAGE,JSON.stringify(SHIFTS));refreshShiftSelect();renderShiftSettings();render();notify('Competenze ripristinate')});
$('monthFilter').addEventListener('change',render);
function moveMonth(offset){const [year,month]=currentMonth().split('-').map(Number),target=new Date(year,month-1+offset,1);$('monthFilter').value=`${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}`;render()}
$('previousMonth').addEventListener('click',()=>moveMonth(-1));$('nextMonth').addEventListener('click',()=>moveMonth(1));
$('totalSummaryBody').addEventListener('click',event=>{const summaryRow=event.target.closest('.summary-week-link');if(!summaryRow)return;const registerBody=$('registroBody');if(registerBody.hidden)document.querySelector('.section-collapse[data-collapse-target="registroBody"]').click();const weekRows=[...$('entriesBody').querySelectorAll('tr[data-week]')].filter(row=>row.dataset.week===summaryRow.dataset.week),target=weekRows.find(row=>row.classList.contains('previous-month-row'))||weekRows.find(row=>new Date(row.dataset.date+'T12:00:00').getDay()===1)||weekRows[0];if(target){target.classList.add('week-scroll-target');target.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>target.classList.remove('week-scroll-target'),1800)}});
$('entriesBody').addEventListener('click',event=>{const weekRow=event.target.closest('.registry-week-link');if(!weekRow)return;const consultivoBody=$('consultivoBody');if(consultivoBody.hidden)document.querySelector('.section-collapse[data-collapse-target="consultivoBody"]').click();$('consultivo').scrollIntoView({behavior:'smooth',block:'start'})});
$('syncShifts').addEventListener('click',()=>syncCurrentAgent(true));
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('loginSubmit'),agent=selectedLoginAgent();if(!agent){showLoginMessage('Scegli il tuo nominativo tra i suggerimenti');return}button.disabled=true;showLoginMessage('Verifica in corso…');try{await loginAgent(agent.id,$('loginPin').value)}catch(error){showLoginMessage(error.message);button.disabled=false}});
$('loginAgentSearch').addEventListener('input',()=>{if(agentsDirectory.length)renderAgentChoices()});
$('pinSettingsButton').addEventListener('click',()=>{$('pinForm').reset();$('pinMessage').textContent='';$('pinOverlay').hidden=false;document.body.classList.add('login-open')});
$('closePinSettings').addEventListener('click',()=>{$('pinOverlay').hidden=true;document.body.classList.remove('login-open')});
$('pinForm').addEventListener('submit',async e=>{e.preventDefault();const current=$('currentPin').value,next=$('newPin').value,confirmation=$('confirmPin').value,key=`navidiaria.pin.${activeAgent.id}`;if(next!==confirmation){$('pinMessage').textContent='I nuovi PIN non coincidono';return}const currentHash=await hashPin(current);if(currentHash!==localStorage.getItem(key)){$('pinMessage').textContent='Il PIN attuale non è corretto';return}try{const newPinHash=await hashPin(next);await NaviFirebaseAuth.request('change_pin',{...firebaseCredentials(),newPinHash});localStorage.setItem(key,newPinHash);$('pinOverlay').hidden=true;document.body.classList.remove('login-open');notify('PIN modificato su Firebase')}catch(error){$('pinMessage').textContent=error.message}});
$('resetOwnPin').addEventListener('click',async()=>{if(!confirm('Vuoi resettare il PIN? Verrai disconnesso e potrai sceglierne uno nuovo al prossimo accesso.'))return;try{await NaviFirebaseAuth.request('reset_own_pin',firebaseCredentials());localStorage.removeItem(`navidiaria.pin.${activeAgent.id}`);localStorage.removeItem(SESSION_KEY);localStorage.removeItem(NAVITURNI_SESSION_KEY);location.href='index.html'}catch(error){$('pinMessage').textContent=error.message}});
$('refreshPinList').addEventListener('click',renderAdminPinList);
$('adminPinList').addEventListener('click',async e=>{const button=e.target.closest('.reset-agent-pin');if(!button||!isAdmin())return;const name=button.dataset.agentName,id=button.dataset.agentId;if(!confirm(`Resettare il PIN di ${name}? I suoi dati resteranno invariati.`))return;button.disabled=true;try{await NaviFirebaseAuth.request('reset_pin',{...firebaseCredentials(),targetAgentId:id});localStorage.removeItem(`navidiaria.pin.${id}`);await renderAdminPinList();notify(`PIN di ${name} resettato online`)}catch(error){notify(error.message);button.disabled=false}});
$('logoutButton').addEventListener('click',()=>{localStorage.removeItem(SESSION_KEY);localStorage.removeItem(NAVITURNI_SESSION_KEY);location.href='index.html'});
$('openToday').addEventListener('click',openTodayEditor);
$('toggleForm').addEventListener('click',()=>{resetEntryForm();closeEntryForm()});
const sidebar=document.querySelector('.sidebar'),menuButton=document.querySelector('.menu-button');function setSidebar(open){if(!sidebar)return;sidebar.classList.toggle('open',open);document.body.classList.toggle('sidebar-open',open);if(menuButton){menuButton.textContent=open?'‹':'›';menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Chiudi menu':'Apri menu')}}if(menuButton&&sidebar)menuButton.addEventListener('click',()=>setSidebar(!sidebar.classList.contains('open')));
document.querySelectorAll('.section-collapse').forEach(button=>button.addEventListener('click',()=>{const target=$(button.dataset.collapseTarget),opening=target.hidden;target.hidden=!opening;button.textContent=opening?'⌃':'⌄';button.setAttribute('aria-expanded',String(opening))}));
document.querySelectorAll('.section-title-toggle').forEach(title=>{const toggle=()=>document.querySelector(`.section-collapse[data-collapse-target="${title.dataset.collapseTarget}"]`).click();title.addEventListener('click',toggle);title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})});
document.querySelectorAll('.sidebar a.nav-link').forEach(link=>link.addEventListener('click',event=>{const href=link.getAttribute('href')||'';if(!href.startsWith('#'))return;event.preventDefault();const section=document.querySelector(href);if(!section)return;const alreadySelected=link.classList.contains('active');if(section.id!=='oggi'){if(section.id==='competenze'){const body=$('competencyBody');if(alreadySelected||body.hidden)$('toggleCompetencies').click()}else{const collapseButton=section.querySelector('.section-collapse'),body=collapseButton&&$(collapseButton.dataset.collapseTarget);if(collapseButton&&(alreadySelected||body.hidden))collapseButton.click()}}document.querySelectorAll('.sidebar a.nav-link').forEach(item=>item.classList.toggle('active',item===link));section.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',href)}));
async function saveEntriesNow(){
  if(firebaseSaveTimer){clearTimeout(firebaseSaveTimer);firebaseSaveTimer=null}
  if(localStorage.getItem(FIREBASE_DIRTY_KEY)!=='1')return;
  await saveEntriesToFirebase();
}
window.NaviDiariaRuntime={version:'96',ready:true,saveNow:saveEntriesNow};
render();
function flushFirebaseSave(){saveEntriesNow().catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushFirebaseSave()});
window.addEventListener('pagehide',flushFirebaseSave);
initializeAccess().then(()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('pin')==='1'&&activeAgent)$('pinSettingsButton').click();
  const editDate=params.get('editDate');
  if(activeAgent&&/^\d{4}-\d{2}-\d{2}$/.test(String(editDate||''))){
    $('monthFilter').value=editDate.slice(0,7);
    render();
    requestAnimationFrame(()=>openDayEditorForDate(editDate));
  }
});
