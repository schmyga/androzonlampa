(function(){
  // Настройки
  const PLUGIN_TITLE = 'Androzon Lampa';
  const PLUGIN_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><polygon points="10,8 16,12 10,16" fill="#fff"/></svg>'
  );

  // Функция меню (простая, для теста)
  function showMainMenu(){
    const msg = PLUGIN_TITLE + ' — тестовое меню';
    console.log(msg);
    try{
      if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(msg);
      if(window.Lampa && Lampa.Menu && typeof Lampa.Menu.show === 'function'){
        Lampa.Menu.show({
          title: PLUGIN_TITLE,
          subtitle: 'Источник: Rezka / Filmix',
          buttons: [
            { title: 'Режим теста', onClick: ()=>{ if(window.Lampa && Lampa.Noty) Lampa.Noty.show('Тестовый пункт выбран'); else alert('Тестовый пункт выбран'); } }
          ]
        });
      } else {
        alert(msg);
      }
    }catch(e){
      console.error(e);
      alert(msg);
    }
  }

  // 1) Добавляем в глобальные массивы плагинов
  try{
    window.plugin_list = window.plugin_list || [];
    if(!window.plugin_list.some(p => p && (p.title === PLUGIN_TITLE || p.name === PLUGIN_TITLE))){
      window.plugin_list.push({ title: PLUGIN_TITLE, onClick: showMainMenu });
      console.log('pushed to window.plugin_list');
    } else console.log('already in window.plugin_list');
  }catch(e){ console.warn('plugin_list push error', e); }

  try{
    window.lampa_plugins = window.lampa_plugins || [];
    if(!window.lampa_plugins.some(p => p && (p.title === PLUGIN_TITLE || p.name === PLUGIN_TITLE))){
      window.lampa_plugins.push({ name: PLUGIN_TITLE, onLoad: showMainMenu });
      console.log('pushed to window.lampa_plugins');
    } else console.log('already in window.lampa_plugins');
  }catch(e){ console.warn('lampa_plugins push error', e); }

  try{
    window.extensions = window.extensions || [];
    if(!window.extensions.some(p => p && (p.title === PLUGIN_TITLE || p.name === PLUGIN_TITLE))){
      window.extensions.push({ title: PLUGIN_TITLE, onClick: showMainMenu });
      console.log('pushed to window.extensions');
    } else console.log('already in window.extensions');
  }catch(e){ console.warn('extensions push error', e); }

  // Пометить время обновления (некоторые сборки на это смотрят)
  try{ window.plugin_list_updated = Date.now(); }catch(e){}

  // 2) Вставляем визуальную кнопку рядом с элементом, содержащим текст "Трейлеры"
  try{
    // Найдём ноду с текстом "Трейлеры" (русск. меню)
    const node = Array.from(document.querySelectorAll('*')).find(n => {
      try{ return n.innerText && n.innerText.trim().includes('Трейлеры'); } catch(e){ return false; }
    });

    if(node){
      // Нужно найти контейнер, в который добавляются элементы меню рядом с этим узлом
      // Это может быть ближайший родитель с большим списком (например, sidebar, selectbox__body, etc.)
      let container = node.closest('.selectbox__body, .sidebar, .menu, .extensions, .selectbox__right, .selectbox__content, .left') || node.parentElement || document.body;

      // Построим элемент в стиле selectbox-item (максимально совместимо)
      const item = document.createElement('div');
      item.className = 'selectbox-item selectbox-item--icon selector androzon-test-item';
      item.style.cssText = 'cursor:pointer; padding:10px 12px; display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.35); margin:6px 0; border-radius:6px;';
      item.innerHTML = '<div class="selectbox-item__icon"><img src="'+PLUGIN_ICON+'" style="width:40px;height:40px;border-radius:4px;"/></div>' +
                       '<div><div class="selectbox-item__title" style="font-size:15px;color:#fff">' + PLUGIN_TITLE + '</div>' +
                       '<div class="selectbox-item__subtitle" style="font-size:12px;color:#ddd">Тестовая кнопка</div></div>';

      item.addEventListener('click', function(e){ e.stopPropagation(); showMainMenu(); });

      // Вставляем после найденного узла (или в контейнер)
      try{
        // если найден список, вставим внутри scroll__body в начало
        const maybeList = container.querySelector && (container.querySelector('.scroll__body') || container.querySelector('.selectbox__body') || container);
        if(maybeList && maybeList.appendChild) maybeList.insertBefore(item, maybeList.firstChild);
        else container.appendChild(item);
        console.log('Inserted visual test button near node:', node, 'into container:', container);
      }catch(err){
        container.appendChild(item);
        console.log('Fallback insert of visual button', err);
      }
    } else {
      console.warn('Не найден узел с текстом "Трейлеры"');
    }
  }catch(e){
    console.error('Error inserting visual button', e);
  }

  // Вывод статуса для копирования
  console.log('Androzon diag snapshot: plugin_list len=', window.plugin_list && window.plugin_list.length, 'lampa_plugins len=', window.lampa_plugins && window.lampa_plugins.length, 'extensions len=', window.extensions && window.extensions.length);
  window._androzon_diag = {
    time: new Date().toISOString(),
    plugin_list: (window.plugin_list || []).map(p => p && (p.title || p.name)),
    lampa_plugins: (window.lampa_plugins || []).map(p => p && (p.title || p.name)),
    extensions: (window.extensions || []).map(p => p && (p.title || p.name))
  };
  console.log('Done. window._androzon_diag created.');
})();
