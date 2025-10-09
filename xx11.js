/*!
 * Androzon Lampa v1 (CDN версия)
 * Добавляет кнопку Androzon в меню Lampa (универсально)
 * Работает в сборках yumata, schmyga, bwa, cub и др.
 * Поддерживает fallback-кнопку при отсутствии API меню
 */
(function(){
  const PLUGIN_TITLE = 'Androzon';
  const PLUGIN_NAME  = 'androzon_lampa';
  const LOG_PREFIX   = '[Androzon]';
  const DEBUG        = true;

  function log(...args){
    if(DEBUG) console.log(LOG_PREFIX, ...args);
  }

  function safeNoty(text, time){
    try{
      if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function'){
        Lampa.Noty.show(text, { time: time || 3000 });
      } else console.log(LOG_PREFIX, text);
    }catch(e){ console.log(LOG_PREFIX, text); }
  }

  // 🔹 Создаём объект плагина
  function makePluginObject(){
    function onClick(){
      try{
        const sel = document.querySelector('.full-start-new__title, .item__title, .title, .page-title');
        const movieTitle = sel ? sel.innerText.trim() : null;
        const subtitle = movieTitle ? ('Трейлеры: ' + movieTitle) : 'Источники и балансеры';

        if(Lampa && Lampa.Menu && typeof Lampa.Menu.show === 'function'){
          Lampa.Menu.show({
            title: PLUGIN_TITLE,
            subtitle: subtitle,
            buttons: [
              { title: 'Поиск по названию', onClick: ()=> safeNoty('Функция поиска пока не реализована') },
              { title: 'Настройки источников', onClick: ()=> safeNoty('Откроются настройки плагина') }
            ]
          });
        } else {
          alert(`${PLUGIN_TITLE}\n\n${subtitle}`);
        }
      }catch(e){ log('onClick error', e); }
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
      subtitle: 'Трейлеры / Источники',
      icon: ICON_SVG,
      onClick: onClick,
      onLoad: function(){ log('onLoad executed'); },
      render: function(){}
    };
  }

  // 🔹 Безопасное добавление в массив
  function safePushArray(name, obj){
    try{
      if(!window[name]) window[name] = [];
      const exists = window[name].some(x => x && x.id === obj.id);
      if(!exists){
        window[name].push(obj);
        log('Добавлен в', name);
      }
    }catch(e){ log('safePushArray error', e); }
  }

  // 🔹 Добавление кнопки в меню Lampa
  function addMenuButton(plugin){
    try{
      if(window.Lampa && Lampa.Menu && typeof Lampa.Menu.add === 'function'){
        Lampa.Menu.add({
          title: 'Androzon',
          icon: '🔍',
          onSelect: function(){
            plugin.onClick();
          }
        });
        log('✅ Кнопка добавлена через Lampa.Menu.add');
        safeNoty('Плагин Androzon активирован!');
        return true;
      }
    }catch(e){ log('addMenuButton error', e); }
    return false;
  }

  // 🔹 Резервная кнопка в DOM
  function insertFallback(plugin){
    try{
      const container = document.querySelector('.menu, .sidebar, .selectbox__content, body');
      if(!container) return false;

      const item = document.createElement('div');
      item.className = 'selector selector--and';
      item.style.cssText = 'cursor:pointer;padding:10px 14px;margin:6px;background:rgba(0,0,0,0.4);border-radius:6px;color:#fff;font-size:16px;';
      item.innerText = '🔍 Androzon';
      item.onclick = () => plugin.onClick();

      container.appendChild(item);
      log('✅ Fallback кнопка вставлена');
      return true;
    }catch(e){
      log('insertFallback error', e);
      return false;
    }
  }

  // 🔹 Основная регистрация плагина
  function register(){
    try{
      const plugin = makePluginObject();

      safePushArray('plugin_list', plugin);
      safePushArray('extensions', plugin);
      safePushArray('lampa_plugins', { name: plugin.name, onLoad: plugin.onLoad });

      // добавляем кнопку
      if(!addMenuButton(plugin)){
        insertFallback(plugin);
      }

      // пробуем зарегистрировать API Lampa
      if(Lampa && Lampa.Plugins && typeof Lampa.Plugins.add === 'function'){
        Lampa.Plugins.add(plugin);
        log('✅ Lampa.Plugins.add выполнен');
      }

      safeNoty('Androzon подключён!');
    }catch(e){
      log('register error', e);
    }
  }

  // 🔹 Слушатель событий
  function init(){
    try{
      register();
      if(Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function'){
        Lampa.Listener.follow('app', e=>{
          if(e.type === 'ready') register();
        });
        log('Listener.follow активирован');
      }
    }catch(e){
      log('init error', e);
    }
  }

  init();
})();
