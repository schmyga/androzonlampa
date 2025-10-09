(function(){
  const PLUGIN_TITLE = 'Androzon Lampa';
  const PLUGIN_ID = 'androzon_lampa';
  const LOG = (...a) => { try{ console.log('[Androzon]', ...a); } catch(e){} };

  // --------- helper: show noty or alert ----------
  function showNoty(text, time){
    try{
      if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function'){
        Lampa.Noty.show(text, { time: time || 4000 });
      } else alert(text);
    }catch(e){ try{ alert(text); }catch(_){} }
  }

  // --------- play helper: try Lampa player or fallback iframe/window ----------
  function playUrl(url, title){
    LOG('playUrl', url);
    try{
      if(window.Lampa && Lampa.Player && typeof Lampa.Player.open === 'function'){
        Lampa.Player.open({
          title: title || PLUGIN_TITLE,
          url: url
        });
        return;
      }
    }catch(e){ LOG('Lampa.Player open failed', e); }

    // If Lampa.Player not available — open modal with iframe
    try{
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center';
      container.innerHTML = '<div style="width:90%;height:80%;background:#000;border-radius:6px;overflow:hidden;position:relative">' +
                            '<button id="androzon_close" style="position:absolute;right:8px;top:8px;z-index:3;padding:8px 10px;border-radius:4px;border:none;background:#fff;color:#000;cursor:pointer">Закрыть</button>' +
                            '<iframe src="'+url+'" style="width:100%;height:100%;border:0;"></iframe>' +
                            '</div>';
      document.body.appendChild(container);
      container.querySelector('#androzon_close').onclick = function(){ container.remove(); };
    }catch(e){
      // fallback window.open
      window.open(url,'_blank');
    }
  }

  // --------- generate Rutube embed URL from ID or direct link ----------
  function rutubeEmbedUrlFromId(id){
    // Rutube embed path: https://rutube.ru/play/embed/<ID>/
    return 'https://rutube.ru/play/embed/' + id + '/';
  }

  // --------- Demo/static list builder (replace with real fetch/parser) ----------
  function getRutubeTrailersByTitle(title){
    // Placeholder demo data. Replace with real Rutube search/parsing here.
    // Example of embed URL: https://rutube.ru/play/embed/VIDEO_ID/
    // If you implement real parser, return Promise.resolve(arrayOfItems)
    // Each item: { id: 'VIDEO_ID', title: '...', subtitle: '...', thumb: 'https://...' }
    return new Promise(resolve => {
      const items = [
        { id: 'VIDEO_ID_1', title: title + ' — Трейлер (Demo 1)', subtitle: 'Rutube Demo', thumb: '' },
        { id: 'VIDEO_ID_2', title: title + ' — Трейлер (Demo 2)', subtitle: 'Rutube Demo', thumb: '' }
      ];
      resolve(items);
    });
  }

  // --------- UI: show list of trailers as Lampa.List or selectbox fallback ----------
  function showRutubeTrailers(titleForSearch){
    const titleSearch = titleForSearch || 'Трейлер';
    getRutubeTrailersByTitle(titleSearch).then(list => {
      const items = list.map(item => ({
        title: item.title,
        subtitle: item.subtitle || '',
        icon: item.thumb || '',
        onClick: () => {
          const url = rutubeEmbedUrlFromId(item.id);
          playUrl(url, item.title);
        }
      }));

      if(window.Lampa && Lampa.List && typeof Lampa.List.show === 'function'){
        Lampa.List.show({
          title: 'Трейлеры — ' + titleSearch,
          items: items,
          noselect: false
        });
      } else {
        // fallback: build selectbox-like modal with thumbnails
        try{
          const wrapper = document.createElement('div');
          wrapper.className = 'androzon-selectbox';
          wrapper.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center';
          const box = document.createElement('div');
          box.style.cssText = 'width:90%;max-width:800px;height:80%;background:#222;color:#fff;border-radius:6px;overflow:auto;padding:12px';
          box.innerHTML = '<div style="font-size:18px;margin-bottom:10px">Трейлеры — ' + titleSearch + '</div>';
          items.forEach(it => {
            const el = document.createElement('div');
            el.style.cssText = 'display:flex;gap:12px;padding:10px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer';
            el.innerHTML = '<div style="width:80px;height:45px;background:#111"></div><div><div style="font-weight:600">'+it.title+'</div><div style="opacity:0.7;font-size:12px">'+it.subtitle+'</div></div>';
            el.onclick = () => { playUrl(rutubeEmbedUrlFromId(list[items.indexOf(it)].id), it.title); };
            box.appendChild(el);
          });
          const close = document.createElement('button');
          close.textContent = 'Закрыть';
          close.style.cssText = 'position:absolute;right:14px;top:14px;padding:8px 12px;border-radius:4px';
          close.onclick = () => wrapper.remove();
          wrapper.appendChild(box);
          wrapper.appendChild(close);
          document.body.appendChild(wrapper);
        }catch(e){ alert('Невозможно показать трейлеры'); }
      }
    }).catch(err => {
      LOG('getRutubeTrailersByTitle error', err);
      showNoty('Ошибка получения трейлеров', 3000);
    });
  }

  // --------- Main menu renderer ----------
  function showMainMenu(){
    const buttons = [
      {
        title: 'Трейлеры (Rutube)',
        onClick: function(){
          // Try to get current movie title from page, else ask user
          let movieTitle = null;
          try{
            // try common selectors used on Lampa pages
            movieTitle = document.querySelector('.full-start-new__title, .full-start-new_title, .item__title, .title') ?
                         (document.querySelector('.full-start-new__title, .full-start-new_title, .item__title, .title').innerText || '').trim() : null;
          }catch(e){ movieTitle = null; }
          if(!movieTitle) movieTitle = prompt('Введите название для поиска трейлера', '') || 'Трейлер';
          showRutubeTrailers(movieTitle);
        }
      },
      {
        title: 'Настройки источников',
        onClick: function(){
          showNoty('Здесь будут настройки балансеров (Rezka/Filmix) — позже', 3000);
        }
      }
    ];

    if(window.Lampa && Lampa.Menu && typeof Lampa.Menu.show === 'function'){
      Lampa.Menu.show({
        title: PLUGIN_TITLE,
        subtitle: 'Источник: Rezka / Filmix / Rutube',
        buttons: buttons
      });
      return;
    }

    // fallback simple menu
    const choice = prompt(PLUGIN_TITLE + '\n1 - Трейлеры (Rutube)\n2 - Настройки источников\nВведите 1/2:');
    if(choice === '1') buttons[0].onClick();
    else if(choice === '2') buttons[1].onClick();
  }

  // --------- Registration helpers ----------
  const PLUGIN_OBJ_A = { title: PLUGIN_TITLE, subtitle: 'Трейлеры / Источники', onClick: showMainMenu };
  const PLUGIN_OBJ_B = { name: PLUGIN_TITLE, onLoad: showMainMenu };

  function safePushArray(prop, obj){
    try{
      if(!window[prop]) window[prop] = [];
      const arr = window[prop];
      const exists = arr.some(x => x && (x.title === obj.title || x.name === obj.name));
      if(!exists) arr.push(obj);
      LOG('safePushArray', prop, 'exists?', exists);
    }catch(e){ LOG('safePushArray error', prop, e); }
  }

  function tryLampaApiNotify(){
    try{
      if(window.Lampa){
        if(Lampa.Plugin && typeof Lampa.Plugin.add === 'function'){
          try{ Lampa.Plugin.add(PLUGIN_OBJ_A); LOG('Lampa.Plugin.add called'); }catch(e){ LOG('Lampa.Plugin.add failed', e); }
        }
        // try to notify menu update
        try{ window.plugin_list_updated = Date.now(); window.plugins_update_time = Date.now(); }catch(e){}
        if(Lampa.Listener && typeof Lampa.Listener.follow === 'function'){
          Lampa.Listener.follow('app', function(e){
            try{
              if(e && e.type === 'ready'){
                LOG('app ready: ensure plugin present');
                safePushArray('plugin_list', PLUGIN_OBJ_A);
                safePushArray('lampa_plugins', PLUGIN_OBJ_B);
                try{ if(Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(PLUGIN_TITLE + ' загружен'); }catch(e){}
              }
            }catch(err){ LOG('Listener callback error', err); }
          });
        }
      }
    }catch(e){ LOG('tryLampaApiNotify failed', e); }
  }

  function insertVisualButtonNearTrailers(){
    try{
      // find node with text 'Трейлеры' (russian)
      const node = Array.from(document.querySelectorAll('*')).find(n => {
        try{ return n.innerText && n.innerText.trim().indexOf('Трейлеры') !== -1; }catch(e){ return false; }
      });
      if(!node) {
        LOG('node with "Трейлеры" not found');
        return false;
      }
      const container = node.closest('.selectbox__body, .selectbox__content, .selectbox__right, .sidebar, .left') || node.parentElement || document.body;
      const item = document.createElement('div');
      item.className = 'selectbox-item selectbox-item--icon selector androzon-inserted';
      item.style.cssText = 'cursor:pointer;padding:8px 12px;margin:6px 0;background:rgba(0,0,0,0.35);border-radius:6px;display:flex;align-items:center;gap:10px';
      item.innerHTML = '<div style="width:44px;height:44px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff">A</div><div><div style="font-weight:600;color:#fff">'+PLUGIN_TITLE+'</div><div style="font-size:12px;opacity:0.8">Трейлеры (Rutube)</div></div>';
      item.addEventListener('click', function(e){ e.stopPropagation(); showRutubeTrailers(); });
      // insert at top of scroll__body if exists
      const maybe = container.querySelector && (container.querySelector('.scroll__body') || container.querySelector('.selectbox__body') || container);
      if(maybe && maybe.insertBefore) maybe.insertBefore(item, maybe.firstChild);
      else container.appendChild(item);
      LOG('insertVisualButtonNearTrailers inserted');
      return true;
    }catch(e){ LOG('insertVisualButtonNearTrailers error', e); return false; }
  }

  function registerPlugin(){
    safePushArray('plugin_list', PLUGIN_OBJ_A);
    safePushArray('lampa_plugins', PLUGIN_OBJ_B);
    try{
      window.extensions = window.extensions || [];
      const existsExt = window.extensions.some(x => x && (x.title === PLUGIN_TITLE || x.name === PLUGIN_TITLE));
      if(!existsExt) window.extensions.push( { title: PLUGIN_TITLE, onClick: showMainMenu } );
    }catch(e){ LOG('extensions push failed', e); }

    // mark update
    try{ window.plugin_list_updated = Date.now(); window.plugins_update_time = Date.now(); }catch(e){}

    tryLampaApiNotify();

    // Try to add via Lampa API directly
    try{
      if(window.Lampa){
        if(Lampa.Plugin && typeof Lampa.Plugin.add === 'function'){
          try{ Lampa.Plugin.add(PLUGIN_OBJ_A); LOG('Lampa.Plugin.add used'); }catch(e){ LOG('Lampa.Plugin.add error', e); }
        }
        if(Lampa.Menu && typeof Lampa.Menu.add === 'function'){
          try{ Lampa.Menu.add(PLUGIN_OBJ_A); LOG('Lampa.Menu.add called'); }catch(e){ LOG('Lampa.Menu.add error', e); }
        }
      }
    }catch(e){ LOG('direct Lampa API calls failed', e); }

    // Visual fallback insertion
    const inserted = insertVisualButtonNearTrailers();
    if(!inserted){
      // try other insertion heuristics
      const selectors = ['.extensions', '.sidebar', '.menu', '.left', '#app'];
      for(const sel of selectors){
        const root = document.querySelector(sel);
        if(root){
          try{
            const btn = document.createElement('div');
            btn.textContent = PLUGIN_TITLE;
            btn.style.cssText = 'padding:10px 12px;margin:6px;background:#333;color:#fff;border-radius:6px;cursor:pointer';
            btn.onclick = showMainMenu;
            root.insertBefore(btn, root.firstChild);
            LOG('Inserted button into', sel);
            break;
          }catch(e){ LOG('insert into', sel, 'failed', e); }
        }
      }
    }

    // notify user
    try{ if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(PLUGIN_TITLE + ' зарегистрирован!'); }catch(e){}
    LOG('registerPlugin finished');
  }

  // multiple attempts and listeners to cope with load timing
  registerPlugin();
  window.addEventListener('load', registerPlugin);
  document.addEventListener('DOMContentLoaded', registerPlugin);
  setTimeout(registerPlugin, 800);
  setTimeout(registerPlugin, 2500);
  setTimeout(registerPlugin, 5000);
})();
