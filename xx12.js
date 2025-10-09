/*!
 * Androzon Lampa v2 (CDN версия, кнопка гарантированно видна)
 */
(function(){
  const PLUGIN_TITLE = 'Androzon';
  const PLUGIN_NAME  = 'androzon_lampa';
  const LOG_PREFIX   = '[Androzon]';
  const DEBUG        = true;

  function log(...args){
    if(DEBUG) console.log(LOG_PREFIX, ...args);
  }

  function safeNoty(text){
    try{
      if(window.Lampa?.Noty?.show) Lampa.Noty.show(text);
      else alert(text);
    }catch(e){ console.log(LOG_PREFIX, text); }
  }

  function makePluginObject(){
    function onClick(){
      safeNoty('Плагин Androzon запущен ✅');
    }

    const ICON_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">'+
      '<circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="1.2" fill="#000"/>'+
      '<polygon points="10,8 16,12 10,16" fill="#fff"/></svg>'
    );

    return {
      title: PLUGIN_TITLE,
      name: PLUGIN_NAME,
      id: PLUGIN_NAME,
      icon: ICON_SVG,
      onClick: onClick,
      onLoad: ()=>log('onLoad executed')
    };
  }

  function safePushArray(name, obj){
    try{
      if(!window[name]) window[name] = [];
      if(!window[name].some(x => x.id === obj.id)) window[name].push(obj);
      log('Добавлен в', name);
    }catch(e){ log('safePushArray error', e); }
  }

  // ✅ Правильное место вставки кнопки
  function insertFallback(plugin){
    try{
      const selectors = ['.menu__list', '.menu__body', '.menu', '.sidebar', 'body'];
      let container = null;

      for(const sel of selectors){
        const el = document.querySelector(sel);
        if(el){ container = el; break; }
      }

      if(!container){
        log('❌ Контейнер меню не найден');
        return false;
      }

      // если кнопка уже есть — не вставляем
      if(document.querySelector('.androzon-btn')) return true;

      const item = document.createElement('div');
      item.className = 'selector selector--item androzon-btn';
      item.style.cssText = `
        cursor:pointer;
        padding:12px 16px;
        margin:8px 12px;
        background:linear-gradient(90deg,#2a2a2a,#444);
        border-radius:8px;
        color:#fff;
        font-size:16px;
        display:flex;
        align-items:center;
        gap:8px;
      `;
      item.innerHTML = `<span>🔍</span> <span>${PLUGIN_TITLE}</span>`;
      item.onclick = ()=> plugin.onClick();

      container.appendChild(item);

      log('✅ Fallback кнопка вставлена в', container.className);
      safeNoty('Кнопка Androzon добавлена в меню ✅');
      return true;
    }catch(e){
      log('insertFallback error', e);
      return false;
    }
  }

  function register(){
    const plugin = makePluginObject();

    safePushArray('plugin_list', plugin);
    safePushArray('extensions', plugin);
    safePushArray('lampa_plugins', { name: plugin.name, onLoad: plugin.onLoad });

    if(Lampa?.Plugins?.add) Lampa.Plugins.add(plugin);

    // если не получилось добавить в системное меню — добавляем вручную
    insertFallback(plugin);
  }

  function init(){
    register();

    if(Lampa?.Listener?.follow){
      Lampa.Listener.follow('app', e=>{
        if(e.type === 'ready') register();
      });
      log('Listener.follow активирован');
    }
  }

  init();
})();
