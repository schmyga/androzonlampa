(function(){
    // ========== DEBUG / REGISTRATION-READY PLUGIN ==========
    const PLUGIN_TITLE = 'Androzon Lampa (debug)';
    console.log(`[Androzon] init ${new Date().toISOString()}`);

    // --- Простейшие заглушки и состояние ---
    const BALANCERS = [
        {id:'rezka', name:'Rezka', fetchMovies: (s)=>Promise.resolve([{title:'Rezka фильм 1', year:2023}])},
        {id:'filmix', name:'Filmix', fetchMovies: (s)=>Promise.resolve([{title:'Filmix фильм 1', year:2022}])}
    ];
    const SORTS = [{id:'new', name:'Новинки'},{id:'pop', name:'Популярные'}];
    let currentBalancer = BALANCERS[0], currentSort = SORTS[0];

    // --- UI-функции (Lampa-aware с fallback) ---
    function showNoty(text){
        console.log('[Androzon] noty ->', text);
        try{
            if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function'){
                Lampa.Noty.show(text);
            } else {
                // fallback alert (на web/телефоне)
                if(typeof alert === 'function') alert(text);
            }
        }catch(e){ console.warn('[Androzon] noty error', e); }
    }

    function showMovieList(){
        currentBalancer.fetchMovies(currentSort.id).then(movies=>{
            const items = movies.map(m=>({
                title: m.title,
                subtitle: m.year ? (''+m.year) : '',
                onClick: ()=> showNoty(`Выбран: ${m.title}`)
            }));

            if(window.Lampa && Lampa.List && typeof Lampa.List.show === 'function'){
                Lampa.List.show({ items: items, title: `${currentBalancer.name} / ${currentSort.name}` });
            } else {
                console.log('[Androzon] movie list (fallback):', items);
                showNoty(items.map(i=>i.title + (i.subtitle ? ' ('+i.subtitle+')':'')).join('\n'));
            }
        }).catch(err=>{
            console.error('[Androzon] fetchMovies failed', err);
            showNoty('Ошибка получения списка фильмов');
        });
    }

    function buildButtonsForBalancers(reopenCb){
        return BALANCERS.map(b=>{
            return {
                title: b.name,
                selected: b.id === currentBalancer.id,
                onClick: ()=>{
                    currentBalancer = b;
                    showNoty('Источник: ' + b.name);
                    if(typeof reopenCb === 'function') reopenCb();
                }
            };
        });
    }
    function buildButtonsForSorts(reopenCb){
        return SORTS.map(s=>{
            return {
                title: s.name,
                selected: s.id === currentSort.id,
                onClick: ()=>{
                    currentSort = s;
                    showNoty('Сортировка: ' + s.name);
                    if(typeof reopenCb === 'function') reopenCb();
                }
            };
        });
    }

    function showMainMenu(){
        const balBtns = buildButtonsForBalancers(showMainMenu);
        const sortBtns = buildButtonsForSorts(showMainMenu);
        const buttons = [
            ...balBtns,
            ...sortBtns,
            { title: 'Показать фильмы', onClick: showMovieList }
        ];

        if(window.Lampa && Lampa.Menu && typeof Lampa.Menu.show === 'function'){
            Lampa.Menu.show({
                title: PLUGIN_TITLE,
                subtitle: `Источник: ${currentBalancer.name} | ${currentSort.name}`,
                buttons: buttons
            });
            console.log('[Androzon] showed menu via Lampa.Menu.show');
        } else {
            // fallback prompt-driven menu (for web)
            console.log('[Androzon] showing fallback menu');
            let opt = prompt(`${PLUGIN_TITLE}\n1 - Сменить источник\n2 - Сменить сортировку\n3 - Показать фильмы\nВведите 1/2/3:`);
            if(opt === '1'){
                let idx = prompt('Выбери источник:\n' + BALANCERS.map((b,i)=>`${i+1} - ${b.name}`).join('\n'));
                let i = parseInt(idx,10)-1;
                if(BALANCERS[i]) currentBalancer = BALANCERS[i];
                showMainMenu();
            } else if(opt === '2'){
                let idx = prompt('Выбери сортировку:\n' + SORTS.map((s,i)=>`${i+1} - ${s.name}`).join('\n'));
                let i = parseInt(idx,10)-1;
                if(SORTS[i]) currentSort = SORTS[i];
                showMainMenu();
            } else if(opt === '3'){
                showMovieList();
            }
        }
    }

    // --- Объект плагина для window.plugin_list ---
    const PLUGIN_OBJ = {
        title: PLUGIN_TITLE,
        subtitle: 'Источник: Rezka / Filmix',
        onClick: showMainMenu
    };

    // --- Функция регистрирации в разных вариантах ---
    function registerPlugin(){
        try{
            window.plugin_list = window.plugin_list || [];
            const exists = window.plugin_list.some(p=>p && p.title === PLUGIN_OBJ.title);
            if(!exists){
                window.plugin_list.push(PLUGIN_OBJ);
                console.log('[Androzon] pushed to window.plugin_list');
            } else {
                console.log('[Androzon] plugin already present in window.plugin_list');
            }

            // пометка обновления (некоторые Lampa-скрипты смотрят на это)
            try{ window.plugin_list_updated = Date.now(); }catch(e){}

            // Попробуем уведомить Lampa о новом плагине (если есть такой api)
            if(window.Lampa){
                console.log('[Androzon] Lampa detected, trying to notify');
                try{
                    // Если есть Listener, подпишемся (включая момент готовности app)
                    if(Lampa.Listener && typeof Lampa.Listener.follow === 'function'){
                        Lampa.Listener.follow('app', function(e){
                            if(e && e.type === 'ready'){
                                console.log('[Androzon] app ready event received');
                                // повторная регистрация при ready
                                if(!window.plugin_list.some(p=>p && p.title===PLUGIN_OBJ.title)) window.plugin_list.push(PLUGIN_OBJ);
                                if(Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(PLUGIN_TITLE + ' загружен');
                            }
                        });
                    }
                }catch(e){
                    console.warn('[Androzon] error while using Lampa.Listener', e);
                }

                // Если есть некий Plugin API - попробуем вызвать (без ошибок)
                try{
                    if(Lampa.Plugin && typeof Lampa.Plugin.add === 'function'){
                        Lampa.Plugin.add(PLUGIN_OBJ);
                        console.log('[Androzon] Lampa.Plugin.add called');
                    }
                }catch(e){ /* ignore */ }
            }

            showNoty(PLUGIN_TITLE + ' зарегистрирован');
        }catch(err){
            console.error('[Androzon] registerPlugin error', err);
        }
    }

    // --- Try register right away + on load + DOMContentLoaded + small timeout ---
    registerPlugin();
    if(document.readyState === 'complete') registerPlugin();
    window.addEventListener('load', registerPlugin);
    document.addEventListener('DOMContentLoaded', registerPlugin);
    setTimeout(registerPlugin, 1000);
    setTimeout(registerPlugin, 3000);

    // --- Debug helper to inspect runtime in console ---
    window.AndrozonDebug = function(){
        console.log('Androzon debug:');
        console.log('plugin_list length', (window.plugin_list || []).length);
        console.log(window.plugin_list);
        console.log('Lampa present?', !!window.Lampa);
        if(window.Lampa) console.log('Lampa keys', Object.keys(Lampa));
    };

    console.log('[Androzon] init finished — call AndrozonDebug() in console to inspect');
})();
