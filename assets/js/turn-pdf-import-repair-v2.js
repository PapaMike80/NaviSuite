(function(){
  if(!document.body.classList.contains('aggiornamenti-page'))return;

  const clean=value=>String(value||'').toLocaleUpperCase('it').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[Ɓɓ]/g,'B').replace(/[^A-Z0-9]+/g,'').trim();
  const normalizeShift=value=>{
    const raw=String(value??'').trim().toUpperCase().replace(/[‐‑–—]/g,'-');
    if(!raw||/^(?:RIP(?:\.|-*)?|RIPOSO|-{2,}|={2,})$/.test(raw))return 'RIP';
    if(/^(?:CONG?\.?|CON;|CONC\.?|C\.)$/.test(raw))return 'CON';
    if(/^(?:LAV\.?|TERRA)$/.test(raw))return 'TERRA';
    if(/^F\.?P\.?-*$/.test(raw))return 'F.P.';
    return raw.replace(/\.{2,}$/g,'.').replace(/-+$/g,'');
  };
  const escDate=value=>String(value||'').slice(0,10);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function loadPdfPages(file){
    const pdfjs=window.pdfjsLib;
    if(!pdfjs?.getDocument)throw new Error('PDF.js non disponibile');
    pdfjs.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const pages=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo),content=await page.getTextContent();
      pages.push(content.items.map(item=>({
        text:String(item.str||'').trim(),
        x:Number(item.transform?.[4]||0),
        y:Number(item.transform?.[5]||0),
        width:Number(item.width||0)
      })).filter(item=>item.text));
    }
    return pages;
  }

  function dayCenters(items,expected){
    const candidates=items.filter(item=>/^\d{1,2}$/.test(String(item.text||'').trim())&&item.x>120);
    const clusters=[];
    candidates.forEach(item=>{
      let group=clusters.find(row=>Math.abs(row.y-item.y)<3);
      if(!group){group={y:item.y,items:[]};clusters.push(group)}
      group.items.push(item);
    });
    const best=clusters
      .filter(group=>group.items.length>=Math.min(7,expected))
      .sort((a,b)=>Math.min(expected,b.items.length)-Math.min(expected,a.items.length))[0];
    if(!best)return [];
    return best.items.sort((a,b)=>a.x-b.x).slice(0,expected).map(item=>item.x+(item.width||0)/2);
  }

  function tibilettiCellsFromPages(pages,expected){
    for(const items of pages){
      const marker=items.find(item=>clean(item.text)==='TIBILETTI');
      if(!marker)continue;
      const centers=dayCenters(items,expected);
      if(centers.length!==expected)continue;
      const spacing=centers.length>1?centers.slice(1).reduce((sum,x,index)=>sum+x-centers[index],0)/(centers.length-1):31;
      const rowItems=items.filter(item=>Math.abs(item.y-marker.y)<5.5);
      const cells=centers.map(center=>{
        const found=rowItems.filter(item=>{
          const itemCenter=item.x+(item.width||0)/2;
          return Math.abs(itemCenter-center)<spacing*.43;
        }).sort((a,b)=>{
          const ac=Math.abs((a.x+(a.width||0)/2)-center),bc=Math.abs((b.x+(b.width||0)/2)-center);
          return ac-bc;
        })[0];
        return found?normalizeShift(found.text):'RIP';
      });
      if(cells.some(value=>value!=='RIP'))return cells;
    }
    return null;
  }

  async function waitForPreview(){
    const preview=document.getElementById('turn-import-preview');
    for(let i=0;i<100;i++){
      const rows=[...preview.querySelectorAll('[data-pending-turn]')];
      if(rows.length)return rows;
      await sleep(60);
    }
    return [];
  }

  function installPreviewRepair(){
    const parseButton=document.getElementById('parse-new-turn');
    const fileInput=document.getElementById('new-turn-file');
    const saveButton=document.getElementById('save-new-turn');
    const status=document.getElementById('status');
    if(!parseButton||!fileInput)return;
    let token=0;
    parseButton.addEventListener('click',()=>{
      const file=fileInput.files?.[0];if(!file)return;
      const mine=++token;
      setTimeout(async()=>{
        try{
          const [rows,pages]=await Promise.all([waitForPreview(),loadPdfPages(file)]);
          if(mine!==token||!rows.length)return;
          const tr=rows.find(row=>clean(row.querySelector('td:nth-child(2) strong')?.textContent).includes('TIBILETTI'));
          const pdfHasTibiletti=pages.some(items=>items.some(item=>clean(item.text)==='TIBILETTI'));
          if(pdfHasTibiletti&&!tr){
            if(saveButton)saveButton.disabled=true;
            if(status){status.textContent='Errore: Tibiletti è nel PDF ma non è stato riconosciuto. Salvataggio bloccato.';status.className='status bad'}
            return;
          }
          if(!tr)return;
          const inputs=[...tr.querySelectorAll('[data-turn-day]')];
          const cells=tibilettiCellsFromPages(pages,inputs.length);
          if(!cells){
            if(saveButton)saveButton.disabled=true;
            if(status){status.textContent='Errore: non riesco a verificare geometricamente la riga di Tibiletti. Salvataggio bloccato.';status.className='status bad'}
            return;
          }
          let corrected=0;
          inputs.forEach((input,index)=>{
            const next=cells[index]||'RIP';
            if(normalizeShift(input.value)!==next){input.value=next;corrected++}
          });
          if(status){
            status.textContent=`✓ Tibiletti verificato direttamente sulle 14 colonne del PDF${corrected?` · ${corrected} celle corrette`:''}.`;
            status.className='status ok';
          }
        }catch(error){
          console.warn('Verifica Tibiletti PDF non riuscita',error);
        }
      },0);
    });
  }

  const FIXES={
    '2026-09-07|2026-09-20':{
      officialOnly:true,
      shifts:{
        '2026-09-07':'D2','2026-09-08':'RIP','2026-09-09':'D1','2026-09-10':'RIP','2026-09-11':'RIP','2026-09-12':'D2','2026-09-13':'D3',
        '2026-09-14':'D2','2026-09-15':'D3','2026-09-16':'RIP','2026-09-17':'BIS','2026-09-18':'RIP','2026-09-19':'D3','2026-09-20':'RIP'
      }
    },
    '2026-09-21|2026-10-04':{
      draftOnly:true,
      shifts:{
        '2026-09-21':'RIP','2026-09-22':'D3','2026-09-23':'RIP','2026-09-24':'D2','2026-09-25':'D3','2026-09-26':'RIP','2026-09-27':'D2',
        '2026-09-28':'RIP','2026-09-29':'D3','2026-09-30':'D2','2026-10-01':'D1','2026-10-02':'D2','2026-10-03':'RIP','2026-10-04':'F.P.'
      }
    }
  };

  async function repairStoredBatches(){
    if(!window.NaviAdminFirebase?.getAdminUpdates)return;
    try{
      await window.NaviAdminFirebase.ready;
      const saved=await window.NaviAdminFirebase.getAdminUpdates();
      let changed=false,changedPeriods=[];
      const scheduleImports=(saved.scheduleImports||[]).map(batch=>{
        const key=`${escDate(batch?.inizio)}|${escDate(batch?.fine)}`,fix=FIXES[key];
        if(!fix)return batch;
        const filename=String(batch?.filename||batch?.titolo||'').toUpperCase();
        if(fix.officialOnly&&filename.includes('BOZZA'))return batch;
        if(fix.draftOnly&&!filename.includes('BOZZA'))return batch;
        let batchChanged=false;
        const dates=Array.isArray(batch.dates)?batch.dates:[];
        const rows=(batch.rows||[]).map(row=>{
          if(!clean(row?.agente).includes('TIBILETTI'))return row;
          const current=Array.isArray(row.turni)?row.turni:[];
          const next=dates.map((iso,index)=>fix.shifts[iso]||normalizeShift(current[index]));
          if(next.some((value,index)=>normalizeShift(current[index])!==value)){
            batchChanged=true;changed=true;
          }
          return {...row,turni:next};
        });
        if(batchChanged)changedPeriods.push(key);
        return batchChanged?{...batch,rows,identityVersion:Math.max(4,Number(batch.identityVersion||0))}:batch;
      });
      if(!changed)return;
      await window.NaviAdminFirebase.saveAdminUpdates({...saved,scheduleImports});
      window.NaviSharedData?.clear?.();
      const status=document.getElementById('status');
      if(status){
        status.textContent=changedPeriods.includes('2026-09-21|2026-10-04')
          ?'✓ Tibiletti corretto nella bozza 21/09–04/10 e salvato su Firebase.'
          :'✓ Correzione Tibiletti applicata ai turni salvati.';
        status.className='status ok';
      }
    }catch(error){
      console.warn('Correzione automatica Tibiletti non applicata',error);
    }
  }

  installPreviewRepair();
  setTimeout(repairStoredBatches,1700);
})();
