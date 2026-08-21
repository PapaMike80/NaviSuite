/* NaviSuite Diaria loader: restore stable logic and apply FP embark fix. */
(async()=>{
  const source='https://raw.githubusercontent.com/PapaMike80/NaviSuite/1aa4cd7e9daeba2d251b89a5d33a83f9842a2f10/assets/js/app.js';
  try{
    let code=await fetch(source,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()});
    code=code.replace("const GROUND_SHIFTS=new Set(['AGB','POND','DT','PT','AGM','AGT','PONM','LD','TERRA','MALATTIA','RIPOSO']);","const GROUND_SHIFTS=new Set(['AGB','POND','DT','PT','AGM','AGT','PONM','LD','F.P.','FP','TERRA','MALATTIA','RIPOSO']);");
    code=code.replace("const EMBARK_VERSION='competence-based-v1'","const EMBARK_VERSION='competence-based-v2-fp'");
    (0,eval)(code);
  }catch(error){
    console.error('Impossibile caricare NaviDiaria',error);
    const toast=document.getElementById('toast');if(toast){toast.textContent='Errore caricamento Diaria';toast.classList.add('show')}
  }
})();
