/*!
  Androzon Lampa — универсальная регистрация плагина для разных сборок Lampa
  - Надёжно добавляет плагин в популярные глобальные массивы
  - Подписывается на Lampa.Listener('app') и повторно пытается зарегистрировать при ready
  - Пробует доступные API: Lampa.Plugins.add, Lampa.Menu.render, Lampa.Extensions.render и т.п.
  - Если API не рендерит пункт, вставляет видимый fallback в реальный DOM-контейнер
  - Лёгкий, безопасный, не модифицирует остальной код
*/
(function(){
  const PLUGIN_TITLE = 'Androzon Lampa';
  const PLUGIN_NAME = 'androzon_lampa';
  const LOG_PREFIX = '[Androzon]';
  const DEBUG = true;

  function log(...args){
    try{
      if(DEBUG) console.log(LOG_PREFIX, ...args);
    }catch(e){}
  }

  function safeNoty(text, time){
    try{
      if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function'){
        Lampa.Noty.show(text, { time: time || 3000 });
      } else {
        // не мешаем интерфейсу, заменяем alert на console
        console.log(LOG_PREFIX, text);
      }
    }catch(e){ console.log(LOG_PREFIX, text); }
  }

  // Гарантированный объекt плагина — нормализуем поля
  function makePluginObject(){
    // onClick: вызывает меню плагина (попытка получить текущий заголовок фильма)
    function onClick(){
      try{
        // пытаемся получить название текущего фильма/поста
        let movieTitle = null;
        try{
          const sel = document.querySelector('.full-start-new__title, .full-start-new_title, .item__title, .title, .page-title');
          if(sel && sel.innerText) movieTitle = sel.innerText.trim();
        }catch(e){}
        const subtitle = movieTitle ? ('Трейлеры: ' + movieTitle) : 'Трейлеры / Источники';

        if(window.Lampa && Lampa.Menu && typeof Lampa.Menu.show === 'function'){
          Lampa.Menu.show({
            title: PLUGIN_TITLE,
            subtitle: subtitle,
            buttons: [
              { title: 'Трейлеры (демо)', onClick: ()=> safeNoty('Открыть: Трейлеры (демо)') },
              { title: 'Настройки источников', onClick: ()=> safeNoty('Настройки (пусто)') }
            ]
          });
          return;
        }
      }catch(e){ log('onClick Lampa.Menu.show error', e); }

      // fallback — простое окно/alert
      try{
        const choice = prompt(PLUGIN_TITLE + '\n1 — Трейлеры (демо)\n2 — Настройки источников\nВведите 1/2:','1');
        if(choice === '1') safeNoty('Открыть: Трейлеры (демо)');
        else if(choice === '2') safeNoty('Настройки (пусто)');
      }catch(e){ console.log(LOG_PREFIX, 'fallback onClick error', e); }
    }

    // минимальная иконка svg data-uri, чтобы интерфейс мог отобразить
    const ICON_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">'+
      '<circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="1.2" fill="#000"/>'+
      '<polygon points="10,8 16,12 10,16" fill="#fff"/></svg>'
    );

    // Собираем объект в "универсальном" формате (поля, которые чаще всего ожидают)
    const obj = {
      title: PLUGIN_TITLE,
      name: PLUGIN_NAME,
      id: PLUGIN_NAME,
      subtitle: 'Трейлеры / Источники',
      icon: ICON_SVG,
      page: '', // если понадобится
      // Функции обязательно должны быть функциями — Lampa может будет вызывать их
      onClick: onClick,
      onLoad: function(){ log('onLoad called for', PLUGIN_TITLE); },
      // дополнительное поле, которое иногда проверяют
      render: function(){ /* optional */ }
    };

    return obj;
  }

  // Безопасно пушим в глобальные массивы, проверяя дубликаты
  function safePushArray(prop, obj){
    try{
      if(!prop || !obj) return false;
      if(!window[prop]) window[prop] = [];
      const arr = window[prop];
      const exists = arr.some(x => x && ((x.title && x.title === obj.title) || (x.name && x.name === obj.name) || (x.id && x.id === obj.id)));
      if(!exists){
        arr.push(obj);
        log('pushed to', prop);
        return true;
      } else {
        log('already exists in', prop);
        return false;
      }
    }catch(e){
      log('safePushArray error', e);
      return false;
    }
  }

  // Основной регистрационный проход — пытаемся пушить, вызывать API и пометить обновление
  function registerOnce(){
    try{
      const plugin = makePluginObject();

      // Перед пушем убедимся, что callback-поля — функции. Если кто-то случайно положил строки, заменим.
      ['onClick','onLoad','render'].forEach(k=>{
        if(plugin[k] && typeof plugin[k] !== 'function'){
          plugin[k] = function(){ log('normalized non-function field', k); };
        }
      });

      // Пушим в популярные места
      safePushArray('plugin_list', plugin);
      safePushArray('lampa_plugins', (function(){
        // older builds may expect {name:..., onLoad:...}
        const alt = { name: plugin.title, onLoad: plugin.onLoad };
        // ensure not duplicate
        try{
          if(!window.lampa_plugins) window.lampa_plugins = [];
          if(!window.lampa_plugins.some(p => (p && (p.name === alt.name)))) window.lampa_plugins.push(alt);
          return alt;
        }catch(e){ log('lampa_plugins push err', e); return plugin; }
      })());
      safePushArray('extensions', plugin);

      // Обновим метки времени — многие сборки смотрят на это
      try{
        window.plugin_list_updated = Date.now();
        window.plugins_update_time = Date.now();
        log('set plugin_list_updated', window.plugin_list_updated);
      }catch(e){ /* ignore */ }

      // Попробуем доступные API в разном порядке — безопасно
      try{
        if(window.Lampa){
          // Lampa.Plugins.add — есть в твоей сборке, попробуем
          if(Lampa.Plugins && typeof Lampa.Plugins.add === 'function'){
            try{
              Lampa.Plugins.add(plugin);
              log('Lampa.Plugins.add called');
            }catch(e){ log('Lampa.Plugins.add error', e); }
          } else {
            log('Lampa.Plugins.add not found or not function');
          }

          // Некоторые сборки используют Lampa.Plugin (singular) — пропустим если нет
          if(Lampa.Plugin && typeof Lampa.Plugin.add === 'function'){
            try{ Lampa.Plugin.add(plugin); log('Lampa.Plugin.add called'); }catch(e){ log('Lampa.Plugin.add failed', e); }
          }

          // Попробуем отрисовать Extensions/Menu (render/init/show) — это не всегда требуется, но безопасно
          if(Lampa.Extensions){
            try{
              if(typeof Lampa.Extensions.load === 'function') { Lampa.Extensions.load(); log('Lampa.Extensions.load called'); }
              if(typeof Lampa.Extensions.init === 'function') { Lampa.Extensions.init(); log('Lampa.Extensions.init called'); }
              if(typeof Lampa.Extensions.render === 'function') { Lampa.Extensions.render(); log('Lampa.Extensions.render called'); }
              if(typeof Lampa.Extensions.show === 'function') { /* don't spam show */ log('Lampa.Extensions.show available'); }
            }catch(e){ log('Lampa.Extensions.* error', e); }
          }

          if(Lampa.Menu){
            try{
              if(typeof Lampa.Menu.render === 'function'){ Lampa.Menu.render(); log('Lampa.Menu.render called'); }
              if(typeof Lampa.Menu.init === 'function'){ Lampa.Menu.init(); log('Lampa.Menu.init called'); }
            }catch(e){ log('Lampa.Menu.* error', e); }
          }

          // Если есть специфичный API "Plugins.load/init"
          if(Lampa.Plugins){
            try{
              if(typeof Lampa.Plugins.load === 'function'){ Lampa.Plugins.load(); log('Lampa.Plugins.load called'); }
              if(typeof Lampa.Plugins.init === 'function'){ Lampa.Plugins.init(); log('Lampa.Plugins.init called'); }
            }catch(e){ log('Lampa.Plugins.* error', e); }
          }
        }
      }catch(e){ log('Lampa API calls failed', e); }

      // Попытка показать уведомление о регистрации
      try{ safeNoty(PLUGIN_TITLE + ' зарегистрирован!'); }catch(e){}

      return true;
    }catch(e){
      log('registerOnce error', e);
      return false;
    }
  }

  // Видимый fallback — вставляем кнопку в найденный контейнер, который реально отображается пользователю
  function insertVisualFallback(){
    try{
      // Попробуем список кандидатов в порядке приоритета, включая .selectbox__content (видна в твоей сборке)
      const selectors = [
        '.selectbox__content .scroll__body',
        '.selectbox__content',
        '.selectbox__body',
        '.menu_list',
        '.menu',
        '.sidebar',
        '.left',
        '#app',
        'body'
      ];
      let container = null;
      for(const s of selectors){
        try{
          const el = document.querySelector(s);
          if(el && el.offsetParent !== null){ container = el; break; } // visible
          if(el && !container) container = el; // fallback to first found
        }catch(e){}
      }

      // Если нет видимого контейнера в main document, ищем в фреймах (если интерфейс рендерится в iframe)
      if(!container && window.frames && window.frames.length){
        for(let i=0;i<window.frames.length;i++){
          try{
            const fr = window.frames[i];
            const doc = fr.document;
            if(!doc) continue;
            const el = doc.querySelector('.selectbox__content .scroll__body') || doc.querySelector('.selectbox__content') || doc.querySelector('.selectbox__body') || doc.body;
            if(el){ container = el; break; }
          }catch(e){}
        }
      }

      if(!container) {
        log('No container found to insert visual fallback');
        return false;
      }

      // Создаём плитку в стиле selectbox-item
      const item = (container.ownerDocument || document).createElement('div');
      item.className = 'selectbox-item selectbox-item--icon selector androzon-visual';
      item.style.cssText = 'cursor:pointer;padding:10px 12px;margin:6px 0;background:rgba(0,0,0,0.35);border-radius:8px;display:flex;align-items:center;gap:12px;color:#fff';
      item.innerHTML = '<div style="width:44px;height:44px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff">A</div>' +
                       '<div style="line-height:1"><div style="font-weight:700">'+PLUGIN_TITLE+'</div><div style="font-size:12px;opacity:0.8">Трейлеры / Источники</div></div>';

      item.addEventListener('click', function(e){
        e.stopPropagation();
        try{
          // вызвать основную кнопку
          const plugin = makePluginObject();
          if(plugin && typeof plugin.onClick === 'function') plugin.onClick();
        }catch(err){ log('visual onClick error', err); }
      });

      // Вставляем в начало списка, чтобы заметно
      try{
        container.insertBefore(item, container.firstChild);
      }catch(e){
        container.appendChild(item);
      }

      log('Inserted visual fallback into', container);
      return true;
    }catch(e){
      log('insertVisualFallback error', e);
      return false;
    }
  }

  // Повторяющиеся попытки и слушатель ready — чтобы справиться с таймингом загрузки Lampa
  function registerWithRetries(){
    // Первый проход
    registerOnce();
    // Вставка визуального fallback для уверенности
    insertVisualFallback();

    // Если Lampa.Listener.follow доступен — подпишемся на событие app ready
    try{
      if(window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function'){
        try{
          Lampa.Listener.follow('app', function(e){
            log('Lampa.Listener app event', e);
            if(e && e.type === 'ready'){
              // при ready — повторяем регистрацию и рендер
              registerOnce();
              try{ if(Lampa.Plugins && typeof Lampa.Plugins.add === 'function') log('Lampa.Plugins.add on ready attempt'); }catch(e){}
              try{ if(Lampa.Extensions && typeof Lampa.Extensions.render === 'function') Lampa.Extensions.render(); }catch(e){}
              try{ if(Lampa.Menu && typeof Lampa.Menu.render === 'function') Lampa.Menu.render(); }catch(e){}
              // ещё раз вставим визуальную кнопку (если нужно)
              insertVisualFallback();
            }
          });
          log('Attached Lampa.Listener.follow(\"app\")');
        }catch(e){ log('Listener.follow attach error', e); }
      } else {
        log('Lampa.Listener.follow not available');
      }
    }catch(e){ log('Listener check error', e); }

    // Попробуем повторно несколько раз через таймер (на случай поздних загрузок)
    const attempts = [800, 2000, 4000, 8000];
    attempts.forEach((t, idx) => setTimeout(() => {
      try{
        log('retry register attempt', idx, 'after', t, 'ms');
        registerOnce();
        insertVisualFallback();
      }catch(e){ log('retry error', e); }
    }, t));
  }

  // Запускаем регистрацию
  try{
    registerWithRetries();
  }catch(e){
    log('Fatal register error', e);
  }

  // Экспорт состояния для отладки (если нужно)
  try{
    window.__androzon_diag = window.__androzon_diag || {};
    window.__androzon_diag.last_register = Date.now();
  }catch(e){}

})();
