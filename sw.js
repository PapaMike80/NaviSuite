/*
 * Service Worker NaviSuite - hotfix + shell offline.
 *
 * Obiettivi:
 * - conservare una copia locale dell'involucro dell'app (Index, Oggi, Turni);
 * - lasciare i dati operativi a localStorage/IndexedDB, senza duplicarli qui;
 * - mantenere gli hotfix runtime gia' usati da NaviSuite;
 * - aggiornare gli asset in background quando la rete e' disponibile.
 */

const CACHE_VERSION = 'navisuite-v204-offline-shell';
const CORE_ASSETS = [
  './',
  './index.html',
  './oggi.html',
  './naviturni.html',
  './manifest.json',
  './assets/css/portal.css',
  './assets/css/navi-shared.css',
  './assets/css/navi-layout.css',
  './assets/css/turni-common.css',
  './assets/css/shared-menu.css',
  './assets/js/admin-firebase-rest.js',
  './assets/js/shared-data.js',
  './assets/js/firebase-auth.js',
  './assets/js/portal.js',
  './assets/js/shared-menu.js',
  './assets/js/oggi.js',
  './assets/js/announcements-recovered.js',
  './assets/images/favicon.svg',
  './assets/images/icona_192.png',
  './assets/images/icona_512.png',
  './assets/images/icona_apple_180.png'
];

async function cachePut(request, response) {
  if (!response || !response.ok) return response;
  try {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  } catch (_) {}
  return response;
}

async function cachedResponse(request) {
  const cache = await caches.open(CACHE_VERSION);
  return (await cache.match(request)) || (await cache.match(request, { ignoreSearch:true })) || null;
}

async function fetchAndCache(request, options = {}) {
  const response = await fetch(request, options);
  return cachePut(request, response);
}

async function networkFirst(request, fallbackUrl = '') {
  try {
    return await fetchAndCache(request);
  } catch (error) {
    const cached = await cachedResponse(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const cache = await caches.open(CACHE_VERSION);
      const fallback = await cache.match(fallbackUrl, { ignoreSearch:true });
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_VERSION);
  const exact = await cache.match(request);
  const fallback = exact || await cache.match(request, { ignoreSearch:true });
  const refresh = fetch(request, { cache:'reload' })
    .then(response => cachePut(request, response))
    .catch(() => null);
  if (fallback) {
    event.waitUntil(refresh);
    return fallback;
  }
  const fresh = await refresh;
  if (fresh) return fresh;
  throw new Error('Risorsa non disponibile offline');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Un singolo asset momentaneamente non disponibile non deve impedire
    // l'installazione del Service Worker. Salviamo tutto cio' che risponde.
    await Promise.allSettled(CORE_ASSETS.map(async asset => {
      const request = new Request(asset, { cache:'reload' });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('navisuite-') && name !== CACHE_VERSION)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function js(text) {
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

async function transformedScript(request, transform) {
  let sourceResponse = null;
  try {
    sourceResponse = await fetch(request, { cache:'reload' });
    if (!sourceResponse.ok) throw new Error(`HTTP ${sourceResponse.status}`);
  } catch (error) {
    sourceResponse = await cachedResponse(request);
    if (!sourceResponse) throw error;
  }
  const text = transform(await sourceResponse.text());
  const response = js(text);
  await cachePut(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/assets/css/shared-menu.css')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.endsWith('/assets/js/orario-lucide-init.js')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.endsWith('/assets/js/navidiaria-monthly.js')) {
    event.respondWith(transformedScript(event.request, text => {
      text = text.replace(
        "new MutationObserver(fix).observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(fix,0)",
        "document.addEventListener('navidiaria:render',()=>setTimeout(fix,0));setTimeout(fix,0)"
      );
      text = text.replace(
        "function baseWorkedMinutes(e){const manual=Number(e?.workedMinutes);return Number.isFinite(manual)&&manual>=0?manual:serviceMinutes(e)+(overtime?.structured(e)?overtimeTotal(e):ordinaryOvertime(e))}",
        "function baseWorkedMinutes(e){const manual=Number(e?.workedMinutes),manualWorked=overtime?.isWorkedManual?.(e);if(manualWorked&&Number.isFinite(manual)&&manual>=0)return manual;if(overtime?.structured(e))return serviceMinutes(e)+overtimeTotal(e);return Number.isFinite(manual)&&manual>=0?manual:serviceMinutes(e)+ordinaryOvertime(e)}"
      );
      return text;
    }));
    return;
  }

  if (url.pathname.endsWith('/assets/js/portal.js')) {
    event.respondWith(transformedScript(event.request, text => text.replace(
      "if(preferred&&preferred!=='index.html'){location.href=preferred;return;}",
      "const explicitHome=new URLSearchParams(location.search).get('home')==='1';if(!explicitHome&&preferred&&preferred!=='index.html'){location.href=preferred;return;}"
    )));
    return;
  }

  if (url.pathname.endsWith('/assets/js/shared-menu.js')) {
    event.respondWith(transformedScript(event.request, text => {
      text = text.replace(
        "const palette=type==='residence'\n        ? residenceColors[raw]\n        : shiftColors[raw] || ['#94a3b8','rgba(148,163,184,.13)'];",
        "const palette=(type==='residence'\n        ? residenceColors[raw]\n        : shiftColors[raw]) || ['#2dd4bf','rgba(45,212,191,.13)'];"
      );
      text = text.replace(
        "links.forEach(link=>{const clone=link.cloneNode(true);clone.innerHTML=clone.innerHTML.replace(/NaviDiaria/g,'Distinta');if(/navidiaria\\.html/.test(clone.getAttribute('href')||''))clone.setAttribute('aria-label','Apri Distinta');target.appendChild(clone);});",
        "links.forEach(link=>{const clone=link.cloneNode(true);clone.className=link.classList.contains('active')?'active':'';clone.removeAttribute('id');clone.removeAttribute('style');clone.innerHTML=clone.innerHTML.replace(/NaviDiaria/g,'Distinta');if(/navidiaria\\.html/.test(clone.getAttribute('href')||''))clone.setAttribute('aria-label','Apri Distinta');target.appendChild(clone);});"
      );
      text = text.replace(
        "item('index.html','⌂','Home')",
        "item('index.html?home=1','⌂','Home')"
      );
      text += `
;(()=>{
  if(!/(?:^|\\/)(?:naviturni|cambi_turno)\\.html$/i.test(location.pathname)) return;

  const ensureTurniPastButton=()=>{
    if(!/(?:^|\\/)naviturni\\.html$/i.test(location.pathname)) return true;
    const popup=document.getElementById('navisuite-popup');
    const target=popup?.querySelector('.ns-menu-links');
    if(!target) return false;

    popup.querySelectorAll('.mobile-menu-actions [data-mobile-past]').forEach(el=>el.remove());

    let link=target.querySelector('[data-turni-main-past]');
    if(!link){
      link=document.createElement('a');
      link.href='#';
      link.setAttribute('data-turni-main-past','');
      link.innerHTML='<span>◷</span><b>Mostra passato</b>';
      link.addEventListener('click',event=>{
        event.preventDefault();
        if(typeof window.togglePastColumns==='function') window.togglePastColumns();
        const source=document.getElementById('togglePastBtn');
        const label=link.querySelector('b');
        if(label) label.textContent=source?.textContent?.replace(/^[^A-Za-zÀ-ÿ]+/,'').trim()||'Mostra passato';
      });

      const turniLink=[...target.querySelectorAll('a')].find(item=>{
        const href=(item.getAttribute('href')||'').toLowerCase();
        return href.endsWith('naviturni.html')||/naviturni/i.test(item.textContent||'');
      });
      if(turniLink) turniLink.insertAdjacentElement('afterend',link);
      else target.prepend(link);
    }

    const source=document.getElementById('togglePastBtn');
    const label=link.querySelector('b');
    if(label) label.textContent=source?.textContent?.replace(/^[^A-Za-zÀ-ÿ]+/,'').trim()||'Mostra passato';
    return true;
  };

  const installVisualViewportFix=()=>{
    const popup=document.getElementById('navisuite-popup');
    if(!popup || popup.dataset.visualViewportFix==='1') return;
    popup.dataset.visualViewportFix='1';

    const fit=()=>{
      if(popup.hidden) return;
      const dialog=popup.querySelector('.ns-menu-dialog');
      if(!dialog) return;
      const vv=window.visualViewport;
      const vw=Math.max(240,Math.floor(vv?.width || document.documentElement.clientWidth || window.innerWidth));
      const vh=Math.max(320,Math.floor(vv?.height || document.documentElement.clientHeight || window.innerHeight));
      const ox=Math.max(0,Math.floor(vv?.offsetLeft || 0));
      const oy=Math.max(0,Math.floor(vv?.offsetTop || 0));
      const margin=12;
      const width=Math.max(216,vw-(margin*2));
      const height=Math.max(296,vh-(margin*2));

      dialog.style.setProperty('position','fixed','important');
      dialog.style.setProperty('left',(ox+margin)+'px','important');
      dialog.style.setProperty('right','auto','important');
      dialog.style.setProperty('top',(oy+margin)+'px','important');
      dialog.style.setProperty('bottom','auto','important');
      dialog.style.setProperty('width',width+'px','important');
      dialog.style.setProperty('min-width','0','important');
      dialog.style.setProperty('max-width',width+'px','important');
      dialog.style.setProperty('height',height+'px','important');
      dialog.style.setProperty('max-height',height+'px','important');
      dialog.style.setProperty('margin','0','important');
      dialog.style.setProperty('transform','none','important');
      dialog.style.setProperty('box-sizing','border-box','important');
      dialog.style.setProperty('overflow','hidden','important');

      const head=dialog.querySelector('.ns-menu-head');
      const links=dialog.querySelector('.ns-menu-links');
      const foot=dialog.querySelector('.ns-menu-foot');
      [head,links,foot].forEach(el=>{
        if(!el) return;
        el.style.setProperty('width','100%','important');
        el.style.setProperty('max-width','100%','important');
        el.style.setProperty('min-width','0','important');
        el.style.setProperty('box-sizing','border-box','important');
      });
      if(links){
        links.style.setProperty('flex','1 1 auto','important');
        links.style.setProperty('min-height','0','important');
        links.style.setProperty('overflow-y','auto','important');
        links.style.setProperty('overflow-x','hidden','important');
      }
      if(head) head.style.setProperty('flex','0 0 auto','important');
      if(foot) foot.style.setProperty('flex','0 0 auto','important');
    };

    const observer=new MutationObserver(()=>{
      if(!popup.hidden){
        ensureTurniPastButton();
        fit();
        requestAnimationFrame(fit);
        setTimeout(()=>{ensureTurniPastButton();fit();},60);
      }
    });
    observer.observe(popup,{attributes:true,attributeFilter:['hidden']});

    const refit=()=>{ if(!popup.hidden) fit(); };
    window.addEventListener('resize',refit,{passive:true});
    window.visualViewport?.addEventListener('resize',refit,{passive:true});
    window.visualViewport?.addEventListener('scroll',refit,{passive:true});
  };

  const install=()=>{
    ensureTurniPastButton();
    installVisualViewportFix();
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  }else{
    setTimeout(install,0);
  }
  setTimeout(ensureTurniPastButton,250);
  setTimeout(ensureTurniPastButton,1000);
})();
`;
      return text;
    }));
    return;
  }

  // Le pagine HTML provano prima la rete per ricevere subito gli aggiornamenti;
  // se manca la connessione, usano la copia locale. Se la pagina richiesta non
  // e' mai stata aperta, torniamo almeno all'Index gia' precaricato.
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  // CSS, JS, immagini e font: risposta locale immediata e aggiornamento silenzioso.
  if (['script','style','image','font','manifest'].includes(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // Altre risorse same-origin: rete con fallback locale se gia' viste.
  event.respondWith(networkFirst(event.request));
});
