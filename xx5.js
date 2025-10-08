(function() {
    // Настройки — легко расширяемые
    const PLUGIN_TITLE = "Androzon Lampa";
    const BALANCERS = [
        { id: "rezka", name: "Rezka", fetch: () => Promise.resolve([{title:"Rezka: Фильм 1", year:2023}]) },
        { id: "filmix", name: "Filmix", fetch: () => Promise.resolve([{title:"Filmix: Фильм 1", year:2022}]) }
    ];
    const SORTS = [
        { id: "new", name: "Новинки" },
        { id: "pop", name: "Популярные" }
    ];
    let currentBalancer = BALANCERS[0], currentSort = SORTS[0];

    // Основное меню
    function showMainMenu() {
        const balancerButtons = BALANCERS.map(b => ({
            title: b.name,
            selected: b.id === currentBalancer.id,
            onClick: () => { currentBalancer = b; showMainMenu(); }
        }));
        const sortButtons = SORTS.map(s => ({
            title: s.name,
            selected: s.id === currentSort.id,
            onClick: () => { currentSort = s; showMainMenu(); }
        }));

        const buttons = [
            ...balancerButtons,
            ...sortButtons,
            {
                title: "Показать фильмы",
                onClick: showMovieList
            }
        ];

        if (window.Lampa && Lampa.Menu && typeof Lampa.Menu.show === "function") {
            Lampa.Menu.show({
                title: PLUGIN_TITLE,
                subtitle: `Источник: ${currentBalancer.name} | ${currentSort.name}`,
                buttons: buttons
            });
        } else {
            // fallback для web/телефона
            let opt = prompt(`${PLUGIN_TITLE}\n1 - Сменить источник\n2 - Сменить сортировку\n3 - Показать фильмы\nВведите 1/2/3:`);
            if(opt==="1"){
                let idx = prompt('Выбери источник:\n' + BALANCERS.map((b,i)=>`${i+1} - ${b.name}`).join('\n')); 
                let i = parseInt(idx,10)-1;
                if(BALANCERS[i]) currentBalancer = BALANCERS[i];
                showMainMenu();
            } else if(opt==="2"){
                let idx = prompt('Выбери сортировку:\n' + SORTS.map((s,i)=>`${i+1} - ${s.name}`).join('\n'));
                let i = parseInt(idx,10)-1;
                if(SORTS[i]) currentSort = SORTS[i];
                showMainMenu();
            } else if(opt==="3"){
                showMovieList();
            }
        }
    }

    // Список фильмов
    function showMovieList() {
        currentBalancer.fetch(currentSort.id).then(movies => {
            const items = movies.map(m => ({
                title: m.title,
                subtitle: m.year ? (''+m.year) : '',
                onClick: () => {
                    if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show==="function")
                        Lampa.Noty.show(`Выбран: ${m.title}`);
                    else
                        alert(`Выбран: ${m.title}`);
                }
            }));

            if(window.Lampa && Lampa.List && typeof Lampa.List.show==="function") {
                Lampa.List.show({ items: items, title: `${currentBalancer.name} / ${currentSort.name}` });
            } else {
                alert(items.map(i=>`${i.title}${i.subtitle?' ('+i.subtitle+')':''}`).join('\n'));
            }
        });
    }

    // Регистрация (именно как рабочие плагины!)
    function register() {
        if (window.plugin_list) {
            window.plugin_list.push({
                title: PLUGIN_TITLE,
                onClick: showMainMenu
            });
        } else if (window.lampa_plugins) {
            window.lampa_plugins.push({
                name: PLUGIN_TITLE,
                onLoad: showMainMenu
            });
        } else {
            // fallback — если приложение сигналит событием
            document.addEventListener("lampa_loaded", showMainMenu);
        }
        // Можно добавить уведомление при регистрации
        if(window.Lampa && Lampa.Noty && typeof Lampa.Noty.show==="function")
            Lampa.Noty.show(PLUGIN_TITLE + " зарегистрирован!");
    }

    // Попытка регистрации при разных стадиях загрузки
    register();
    window.addEventListener("load", register);
    document.addEventListener("DOMContentLoaded", register);
    setTimeout(register, 1000);
    setTimeout(register, 2500);
})();
