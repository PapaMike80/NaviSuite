(function(){
  const core=document.createElement('script');
  core.src='assets/js/announcements-core-20260903.js?v=1';
  core.async=false;
  document.head.appendChild(core);

  function installTurnPdfPreviewRepair(){
    if(!document.body.classList.contains('aggiornamenti-page'))return;
    const parseButton=document.getElementById('parse-new-turn');
    const fileInput=document.getElementById('new-turn-file');
    const preview=document.getElementById('turn-import-preview');
    const saveButton=document.getElementById('save-new-turn');
    const status=document.getElementById('status');
    const pdfjs=window.pdfjsLib;
    if(!parseButton||!fileInput||!preview||!pdfjs?.getDocument)return;

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
    const groupedLines=items=>{
      const lines=[];
      items.forEach(item=>{
        let line=lines.find(row=>Math.abs(row.y-item.y)<4);
        if(!line){line={y:item.y,items:[]};lines.push(line)}
        line.items.push(item);
      });
      return lines.map(line=>({...line,items:line.items.sort((a,b)=>a.x-b.x)}));
    };
    const weekdayClusters=items=>{
      const weekday=/^(?:LUN(?:EDI)?|MAR(?:TEDI)?|MER(?:COLEDI)?|GIO(?:VEDI)?|VEN(?:ERDI)?|SAB(?:ATO)?|DOM(?:ENICA)?)$/i;
      const clusters=[];
      items.filter(item=>weekday.test(String(item.text||'').replace(/[.'’]/g,'').trim())).forEach(item=>{
        let group=clusters.find(row=>Math.abs(row.y-item.y)<3);
        if(!group){group={y:item.y,items:[]};clusters.push(group)}
        group.items.push(item);
      });
      return clusters.filter(group=>group.items.length>=7)
        .map(group=>({...group,items:group.items.sort((a,b)=>a.x-b.x)}));
    };
    const rowFromPages=(pages,agentName,expected)=>{
      const target=clean(agentName);
      for(const items of pages){
        const headers=weekdayClusters(items),lines=groupedLines(items);
        for(const line of lines){
          const lineText=line.items.map(item=>item.text).join(' ');
          if(!clean(lineText).includes(target))continue;
          const header=headers.filter(group=>group.y>line.y+4)
            .sort((a,b)=>(a.y-line.y)-(b.y-line.y))[0]
            ||headers.slice().sort((a,b)=>Math.abs(a.y-line.y)-Math.abs(b.y-line.y))[0];
          if(!header)continue;
          const centers=header.items.slice(0,expected).map(item=>item.x+(item.width||0)/2);
          if(centers.length!==expected)continue;
          const spacing=centers.slice(1).reduce((sum,x,index)=>sum+x-centers[index],0)/Math.max(1,centers.length-1);
          const prefix=line.items.filter(item=>item.x<centers[0]-spacing*.45)
            .map(item=>item.text).join(' ').replace(/^\s*\d+(?:\s*[-/]\s*\d+)?\s*/,'').trim();
          if(!clean(prefix).includes(target)&&!target.includes(clean(prefix)))continue;
          const cells=centers.map(center=>{
            const item=line.items
              .filter(entry=>Math.abs((entry.x+(entry.width||0)/2)-center)<spacing*.42)
              .sort((a,b)=>Math.abs((a.x+(a.width||0)/2)-center)-Math.abs((b.x+(b.width||0)/2)-center))[0];
            return item?normalizeShift(item.text):'RIP';
          });
          if(cells.filter(value=>value!=='RIP').length)return cells;
        }
      }
      return null;
    };
    const loadPages=async file=>{
      pdfjs.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
      const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,pages=[];
      for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
        const page=await pdf.getPage(pageNumber),content=await page.getTextContent();
        pages.push(content.items.map(item=>({
          text:String(item.str||'').trim(),
          x:Number(item.transform?.[4]||0),
          y:Number(item.transform?.[5]||0),
          width:Number(item.width||0)
        })).filter(item=>item.text));
      }
      return pages;
    };
    const waitForRows=async()=>{
      for(let attempt=0;attempt<80;attempt++){
        const rows=[...preview.querySelectorAll('[data-pending-turn]')];
        if(rows.length)return rows;
        await new Promise(resolve=>setTimeout(resolve,75));
      }
      return [];
    };

    let repairToken=0;
    parseButton.addEventListener('click',()=>{
      const file=fileInput.files?.[0];
      if(!file)return;
      const token=++repairToken;
      setTimeout(async()=>{
        try{
          const [rows,pages]=await Promise.all([waitForRows(),loadPages(file)]);
          if(token!==repairToken||!rows.length)return;
          const pdfHasTibiletti=pages.some(items=>items.some(item=>clean(item.text).includes('TIBILETTI')));
          let previewHasTibiletti=false,corrected=0,verified=0;
          rows.forEach(tr=>{
            const name=tr.querySelector('td:nth-child(2) strong')?.textContent?.trim()||'';
            const inputs=[...tr.querySelectorAll('[data-turn-day]')];
            if(!name||!inputs.length)return;
            if(clean(name).includes('TIBILETTI'))previewHasTibiletti=true;
            const cells=rowFromPages(pages,name,inputs.length);
            if(!cells)return;
            verified++;
            let changed=false;
            inputs.forEach((input,index)=>{
              const next=cells[index]||'RIP';
              if(normalizeShift(input.value)!==next){input.value=next;changed=true}
            });
            if(changed)corrected++;
          });
          if(pdfHasTibiletti&&!previewHasTibiletti){
            if(saveButton)saveButton.disabled=true;
            if(status){
              status.textContent='Errore importazione: Tibiletti è presente nel PDF ma non è stato riconosciuto. Salvataggio bloccato per evitare un turno errato.';
              status.className='status bad';
            }
            return;
          }
          if(status){
            status.textContent=`✓ Importazione verificata direttamente sul PDF: ${verified} righe controllate${corrected?`, ${corrected} corrette automaticamente`:''}${previewHasTibiletti?' · Tibiletti verificato':''}.`;
            status.className='status ok';
          }
        }catch(error){
          console.warn('Verifica geometrica turno PDF non disponibile',error);
        }
      },0);
    });
  }

  installTurnPdfPreviewRepair();
})();
