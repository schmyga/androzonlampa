(function(){
  try{
    console.log('--- Androzon DIAG START ---');

    // 1) Выводим глобальные массивы плагинов
    const names = ['plugin_list','lampa_plugins','extensions','plugins','plugins_list','window.plugins'];
    const arrays = {};
    names.forEach(n=>{
      try{
        const v = window[n];
        if(Array.isArray(v)) arrays[n] = v.map(p => (p && (p.title || p.name)) || p);
        else arrays[n] = v;
      }catch(e){ arrays[n] = 'ERROR: ' + e.toString(); }
    });
    console.log('GLOBAL ARRAYS:', arrays);

    // 2) Найдём DOM контейнеры по классам содержащим "extension"/"plugin"
    const containers = [];
    document.querySelectorAll('*').forEach(el=>{
      try{
        const cls = (el.className || '').toString().toLowerCase();
        if(cls && (cls.includes('extension') || cls.includes('extensions') || cls.includes('plugin') || cls.includes('plugins') || cls.includes('addon') || cls.includes('addons'))){
          containers.push(el);
        }
      }catch(e){}
    });
    console.log('DOM containers with class names containing plugin/extension (count):', containers.length);
    containers.slice(0,20).forEach((el,i)=>{
      console.log('container['+i+']:', el, el.outerHTML.slice(0,400));
      try{ el.style.outline = '3px solid #1ec200'; }catch(e){}
    });

    // 3) Найдём DOM элементы по видимым текстам (поможет локализовать меню)
    const labels = ['Онлайн','Трейлеры','Торренты','Источники','Источник','Расширения','Extensions','Plugins'];
    const found = [];
    labels.forEach(lbl=>{
      document.querySelectorAll('body *').forEach(n=>{
        try{
          if(n.innerText && n.innerText.indexOf(lbl) !== -1){
            found.push({label: lbl, tag: n.tagName, outer: n.outerHTML.slice(0,400)});
          }
        }catch(e){}
      });
    });
    console.log('Found DOM nodes by labels:', found.slice(0,40));

    // 4) Список первых подходящих родительских цепочек (для копирования селектора)
    const selectors = [];
    const uniq = new Set();
    containers.slice(0,10).forEach(el=>{
      try{
        // build path
        let path = '';
        let cur = el;
        while(cur && cur.tagName && path.length < 1000){
          let part = cur.tagName.toLowerCase();
          if(cur.id) part += '#' + cur.id;
          else if(cur.className) part += '.' + cur.className.toString().trim().split(/\s+/).join('.');
          path = part + (path ? ' > ' + path : '');
          cur = cur.parentElement;
        }
        if(!uniq.has(path)){
          uniq.add(path);
          selectors.push(path);
        }
      }catch(e){}
    });
    console.log('Top container selector candidates (copy one):', selectors.slice(0,10));

    // 5) Создаём диалог и сохраняем снимок в window._androzon_diag
    window._androzon_diag = {
      timestamp: new Date().toISOString(),
      arrays: arrays,
      containers_snippets: containers.slice(0,20).map(el => el.outerHTML.slice(0,400)),
      found_labels: found.slice(0,40),
      selector_candidates: selectors.slice(0,10)
    };

    console.log('Diag placed in window._androzon_diag — copy it or paste here.');
    console.log('--- Androzon DIAG END ---');
    alert('Диагностика выполнена: см. консоль. Скопируй output (window._androzon_diag) и пришли сюда.');

  }catch(e){
    console.error('DIAG ERROR', e);
    alert('Ошибка при диагностике: ' + e.toString());
  }
})();
