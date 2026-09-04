(function(){
  'use strict';
  if(!document.body.classList.contains('aggiornamenti-page'))return;

  const MONTHS={GENNAIO:1,FEBBRAIO:2,MARZO:3,APRILE:4,MAGGIO:5,GIUGNO:6,LUGLIO:7,AGOSTO:8,SETTEMBRE:9,OTTOBRE:10,NOVEMBRE:11,DICEMBRE:12};
  const COURSE_RE=/^(D[1-4]|BIS2?|T[12]|M1|R[1-4]|CAR1|P[1-3]|CAP1|SR1)$/i;
  const PESCHIERA_COURSE_RE=/^(P[1-3]|CAP|SR[I1]|BIS2)$/i;
  const WEEKDAY_RE=/^(?:LUN(?:EDI)?|MAR(?:TEDI)?|MER(?:COLEDI)?|GIO(?:VEDI)?|VEN(?:ERDI)?|SAB(?:ATO)?|DOM(?:ENICA)?)'?$/i;
  const MOORING_RE=/^(?:PONT\.?|PONTILE|PONTILETTO|PORTO|LIDO|DARSENA|BANCHINA|BACINO|MOLO|ORMEGGIO|BOA|LUNGOLAGO)\b/i;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const canonCourse=value=>{
    const raw=String(value||'').trim().toUpperCase();
    if(raw==='CAP')return 'CAP1';
    if(raw==='SRI')return 'SR1';
    return raw;
  };
  const visualY=item=>-Number(item.y||0);

  async function loadPages(file){
    const pdfjs=window.pdfjsLib;
    if(!pdfjs?.getDocument)throw new Error('PDF.js non disponibile');
    pdfjs.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const pages=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo),content=await page.getTextContent();
      pages.push(content.items.filter(item=>String(item.str||'').trim()).map(item=>({
        text:String(item.str||'').trim(),
        x:Number(item.transform?.[4]||0),
        y:Number(item.transform?.[5]||0),
        width:Number(item.width||0),
        page:pageNo
      })));
    }
    return pages;
  }

  function pageText(items){
    return items.slice().sort((a,b)=>visualY(a)-visualY(b)||a.x-b.x).map(item=>item.text).join(' ').replace(/\s+/g,' ');
  }

  function lineGroups(items,tolerance=3){
    const groups=[];
    items.slice().sort((a,b)=>visualY(a)-visualY(b)||a.x-b.x).forEach(item=>{
      const vy=visualY(item);
      let group=groups.find(row=>Math.abs(row.y-vy)<tolerance);
      if(!group){group={y:vy,items:[]};groups.push(group)}
      group.items.push(item);
    });
    return groups.sort((a,b)=>a.y-b.y).map(group=>group.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  }

  function mainDateInfo(items){
    const text=pageText(items).toUpperCase().replace(/[’]/g,"'");
    const names=Object.keys(MONTHS).join('|');
    const match=text.match(new RegExp(`\\bDAL\\s+(\\d{1,2})\\s+A(?:L|LL['"]?)\\s*(\\d{1,2})\\s+(${names})\\s+(20\\d{2})`));
    if(!match)return null;
    return {start:Number(match[1]),end:Number(match[2]),month:MONTHS[match[3]],year:Number(match[4])};
  }

  function mainDayCenters(items,expected){
    const candidates=items.filter(item=>WEEKDAY_RE.test(item.text.replace(/[’]/g,"'"))&&item.x>80);
    const clusters=[];
    candidates.forEach(item=>{
      const vy=visualY(item);
      let group=clusters.find(row=>Math.abs(row.y-vy)<3);
      if(!group){group={y:vy,items:[]};clusters.push(group)}
      group.items.push(item);
    });
    const best=clusters.filter(group=>group.items.length>=Math.min(7,expected)).sort((a,b)=>b.items.length-a.items.length)[0];
    return best?best.items.sort((a,b)=>a.x-b.x).slice(0,expected).map(item=>item.x+(item.width||0)/2):[];
  }

  function cellBounds(centers,index){
    const center=centers[index];
    const left=index?((centers[index-1]+center)/2):center-(centers[1]-center)/2;
    const right=index+1<centers.length?((center+centers[index+1])/2):center+(center-centers[index-1])/2;
    return {left,right};
  }

  function parseCell(lines){
    const refuel=lines.some(line=>/\bRIFORNIMENTO\b/i.test(line));
    const mooring=lines.find(line=>MOORING_RE.test(line))||'';
    let ship='';
    for(const line of lines){
      if(/\bRIFORNIMENTO\b/i.test(line)||MOORING_RE.test(line))continue;
      if(/[A-ZÀ-Ü]/i.test(line)){ship=line.trim();break}
    }
    return {ship,mooring,refuel};
  }

  function parseMainTable(items){
    const info=mainDateInfo(items);
    if(!info)return [];
    const dates=[];
    for(let day=info.start;day<=info.end;day++)dates.push(`${info.year}-${String(info.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
    const centers=mainDayCenters(items,dates.length);
    if(!centers.length||centers.length!==dates.length)return [];
    const anchors=items.filter(item=>COURSE_RE.test(item.text)&&item.x<90).sort((a,b)=>visualY(a)-visualY(b));
    const records=[];
    anchors.forEach((anchor,index)=>{
      const ay=visualY(anchor);
      const top=index?((visualY(anchors[index-1])+ay)/2):ay-15;
      const bottom=index+1<anchors.length?((ay+visualY(anchors[index+1]))/2):ay+15;
      const course=canonCourse(anchor.text);
      centers.forEach((center,dayIndex)=>{
        const {left,right}=cellBounds(centers,dayIndex);
        const cell=items.filter(item=>{
          const cx=item.x+(item.width||0)/2,vy=visualY(item);
          return cx>=left&&cx<right&&vy>=top&&vy<bottom&&item.x>90;
        });
        const parsed=parseCell(lineGroups(cell));
        if(parsed.ship||parsed.mooring||parsed.refuel)records.push({
          data:dates[dayIndex],corsa:course,nave:parsed.ship,rifornimento_mattina:parsed.refuel?'Sì':'',ormeggio_serale:parsed.mooring
        });
      });
    });
    return records;
  }

  function peschieraDateColumns(items,year){
    const dateItems=items.filter(item=>/^\d{2}\/\d{2}$/.test(item.text)).sort((a,b)=>a.x-b.x);
    return {
      centers:dateItems.map(item=>item.x+(item.width||0)/2),
      dates:dateItems.map(item=>{const [d,m]=item.text.split('/');return `${year}-${m}-${d}`;})
    };
  }

  function parsePeschieraCell(lines){
    const refuel=lines.some(line=>/\bINIZIO\b.*\bRIF/i.test(line));
    const mooring=lines.find(line=>MOORING_RE.test(line))||'';
    let ship='';
    for(const line of lines){
      if(/\bINIZIO\b.*\bRIF/i.test(line)||/\bMOTORISTA\b/i.test(line)||MOORING_RE.test(line))continue;
      if(/[A-ZÀ-Ü]/i.test(line)){ship=line.trim();break}
    }
    return {ship,mooring,refuel};
  }

  function parsePeschieraTable(items,year){
    const {centers,dates}=peschieraDateColumns(items,year);
    if(centers.length<2||centers.length!==dates.length)return [];
    const anchors=items.filter(item=>PESCHIERA_COURSE_RE.test(item.text)&&item.x<55).sort((a,b)=>visualY(a)-visualY(b));
    const records=[];
    anchors.forEach((anchor,index)=>{
      const ay=visualY(anchor);
      const top=ay-4;
      const bottom=index+1<anchors.length?visualY(anchors[index+1])-4:ay+30;
      const course=canonCourse(anchor.text);
      centers.forEach((center,dayIndex)=>{
        const {left,right}=cellBounds(centers,dayIndex);
        const cell=items.filter(item=>{
          const cx=item.x+(item.width||0)/2,vy=visualY(item);
          return cx>=left&&cx<right&&vy>=top&&vy<bottom&&item.x>45;
        });
        const parsed=parsePeschieraCell(lineGroups(cell));
        if(parsed.ship||parsed.mooring||parsed.refuel)records.push({
          data:dates[dayIndex],corsa:course,nave:parsed.ship,rifornimento_mattina:parsed.refuel?'Sì':'',ormeggio_serale:parsed.mooring
        });
      });
    });
    return records;
  }

  function mergeRecords(main,peschiera){
    const map=new Map();
    main.forEach(row=>map.set(`${row.data}|${canonCourse(row.corsa)}`,{...row,corsa:canonCourse(row.corsa)}));
    peschiera.forEach(row=>{
      const key=`${row.data}|${canonCourse(row.corsa)}`;
      const current=map.get(key)||{data:row.data,corsa:canonCourse(row.corsa),nave:'',rifornimento_mattina:'',ormeggio_serale:''};
      if(row.nave)current.nave=row.nave;
      if(row.rifornimento_mattina)current.rifornimento_mattina=row.rifornimento_mattina;
      if(row.ormeggio_serale)current.ormeggio_serale=row.ormeggio_serale;
      map.set(key,current);
    });
    return [...map.values()].sort((a,b)=>a.data.localeCompare(b.data)||a.corsa.localeCompare(b.corsa,undefined,{numeric:true}));
  }

  async function parseNavi(file){
    const pages=await loadPages(file);
    const mainPage=pages.find(items=>/\bTURNO\s+NAVI\b/i.test(pageText(items)));
    if(!mainPage)return [];
    const info=mainDateInfo(mainPage);
    const main=parseMainTable(mainPage);
    if(!info)return main;
    const peschieraPage=pages.find(items=>/PROGRAMMAZIONE\s+RIFORNIMENTO\s+GASOLIO\s+NAVI\s+DI\s+PESCHIERA/i.test(pageText(items)));
    const peschiera=peschieraPage?parsePeschieraTable(peschieraPage,info.year):[];
    return mergeRecords(main,peschiera);
  }

  function removeOldNaviPreview(result){
    const existing=[...result.querySelectorAll('[data-pending-ods-nave]')];
    if(!existing.length)return;
    const table=existing[0].closest('table');
    const heading=table?.previousElementSibling;
    if(heading?.tagName==='H3'&&/TURNI\s+NAVE/i.test(heading.textContent||''))heading.remove();
    table?.remove();
  }

  function injectPreview(records){
    const result=$('import-result');if(!result)return;
    removeOldNaviPreview(result);
    document.getElementById('ods-navi-geometry-preview')?.remove();
    const section=document.createElement('section');
    section.id='ods-navi-geometry-preview';
    section.innerHTML=`<h3>Turni nave (${records.length})</h3><p style="color:#9eb9c1;font-size:12px">Lettura geometrica dell'allegato navi; gli ormeggi di Peschiera sono completati dalla programmazione rifornimenti.</p><div class="table-wrap"><table class="pending-table"><thead><tr><th>Usa</th><th>Data</th><th>Corsa</th><th>Nave</th><th>Rifornimento</th><th>Ormeggio serale</th></tr></thead><tbody>${records.map((row,index)=>`<tr data-pending-ods-nave="${index}"><td><input type="checkbox" data-field="use" checked></td><td><input type="date" data-field="data" value="${esc(row.data)}"></td><td><input data-field="corsa" value="${esc(row.corsa)}"></td><td><input data-field="nave" value="${esc(row.nave)}"></td><td><input data-field="rifornimento_mattina" value="${esc(row.rifornimento_mattina)}"></td><td><input data-field="ormeggio_serale" value="${esc(row.ormeggio_serale)}"></td></tr>`).join('')}</tbody></table></div>`;
    result.appendChild(section);
    if(records.length)$('save-new-ods').disabled=false;
    const variations=result.querySelectorAll('[data-pending-ods]').length;
    const status=$('status');
    if(status){
      status.textContent=`✓ ${variations} variazioni e ${records.length} turni nave riconosciuti. Controlla entrambe le anteprime prima di salvare.`;
      status.className='status ok';
    }
  }

  async function waitForOriginalPreview(){
    const result=$('import-result');
    for(let i=0;i<120;i++){
      if(result&&(result.querySelector('[data-pending-ods]')||result.children.length))break;
      await new Promise(resolve=>setTimeout(resolve,75));
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }

  function install(){
    const button=$('parse-new-ods'),input=$('new-ods-file');
    if(!button||!input||button.dataset.naviGeometryRepair==='1')return;
    button.dataset.naviGeometryRepair='1';
    let token=0;
    button.addEventListener('click',()=>{
      const file=input.files?.[0];if(!file||!/\.pdf$/i.test(file.name))return;
      const mine=++token;
      setTimeout(async()=>{
        try{
          const records=await parseNavi(file);
          if(mine!==token||!records.length)return;
          await waitForOriginalPreview();
          if(mine!==token)return;
          injectPreview(records);
        }catch(error){
          console.warn('Riparazione import turni nave non riuscita',error);
        }
      },0);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();