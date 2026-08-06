const DIARIA_SESSION='navidiaria.activeAgent',TURNI_SESSION='naviturni_logged_agent';
const $=id=>document.getElementById(id);
async function hashPin(pin){
  if(!window.crypto?.subtle)throw new Error('Questa pagina richiede HTTPS (Web Crypto non disponibile).');
  const bytes=new TextEncoder().encode(`NaviDiaria:${pin}`);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
let agent=null;
try{agent=JSON.parse(localStorage.getItem(DIARIA_SESSION)||localStorage.getItem(TURNI_SESSION)||'null')}catch(_){ }
if(!agent)location.replace('index.html');else $('changePinTitle').textContent=`Modifica il PIN di ${agent.name||agent.agente||agent.cognome||'utente'}`;
$('cancelPinButton').addEventListener('click',()=>{if(history.length>1)history.back();else location.replace('index.html')});
$('changePinForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const current=$('currentPin').value,next=$('newPin').value,confirmation=$('confirmPin').value;
  const message=$('changePinMessage'),button=$('changePinSubmit'),localKey=`navidiaria.pin.${agent.id}`;
  if(next!==confirmation){message.textContent='I nuovi PIN non coincidono.';return}
  button.disabled=true;message.textContent='Salvataggio su Firebase…';
  try{
    const pinHash=await hashPin(current),newPinHash=await hashPin(next);
    await NaviFirebaseAuth.request('change_pin',{agentId:agent.id,pinHash,newPinHash});
    localStorage.setItem(localKey,newPinHash);
    message.style.color='#087e71';message.textContent='PIN modificato correttamente.';
    setTimeout(()=>location.replace('index.html'),650);
  }catch(error){message.textContent=error.message||'Impossibile modificare il PIN.'}
  finally{button.disabled=false}
});
