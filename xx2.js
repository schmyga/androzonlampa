// ==UserScript==
// @name         Androzon Lampa
// @description  Плагин для Lampa TV: меню с выбором балансера Rezka/Filmix и сортировкой
// @version      0.1
// @author       schmyga
// @match        *://*.lampa.tv/*
// @match        *://*.yumata.github.io/*
// ==/UserScript==

(function() {
    // --- Конфиг ---
    const PLUGIN_NAME = 'Androzon Lampa';
    const BALANCERS = [
        {
            id: 'rezka',
            name: 'Rezka',
            fetchMovies: function(sortType){
                // Заглушка: данные для примера
                return Promise.resolve([
                    { title: 'Rezka: Фильм 1', year: 2022 },
                    { title: 'Rezka: Фильм 2', year: 2023 }
                ]);
            }
        },
        {
            id: 'filmix',
            name: 'Filmix',
            fetchMovies: function(sortType){
                // Заглушка: данные для примера
                return Promise.resolve([
                    { title: 'Filmix: Фильм 1', year: 2021 },
                    { title: 'Filmix: Фильм 2', year: 2024 }
                ]);
            }
        }
    ];
    const SORT_TYPES = [
        {id: 'new', name: 'Новинки'},
        {id: 'popular', name: 'Популярные'},
        {id: 'year', name: 'По году'}
    ];

    // --- Стейт ---
    let currentBalancer = BALANCERS[0];
    let currentSort = SORT_TYPES[0];

    // --- Рендер кнопок балансеров ---
    function renderBalancerButtons(cb){
        return BALANCERS.map(balancer => {
            return {
                title: balancer.name,
                selected: balancer.id === currentBalancer.id,
                onClick: () => {
                    currentBalancer = balancer;
                    cb && cb();
                }
            };
        });
    }

    // --- Рендер кнопок сортировки ---
    function renderSortButtons(cb){
        return SORT_TYPES.map(sort => {
            return {
                title: sort.name,
                selected: sort.id === currentSort.id,
                onClick: () => {
                    currentSort = sort;
                    cb && cb();
                }
            };
        });
    }

    // --- Рендер фильмов ---
    function showMovieList(){
        currentBalancer.fetchMovies(currentSort.id).then(movies => {
            let items = movies.map(movie => ({
                title: movie.title,
                subtitle: movie.year + '',
                onClick: () => {
                    // Заглушка: обработка выбора фильма
                    if (window.Lampa && Lampa.Noty) {
                        Lampa.Noty.show(`Выбран: ${movie.title}`);
                    } else {
                        alert(`Выбран: ${movie.title}`);
                    }
                }
            }));
            if (window.Lampa && Lampa.List) {
                Lampa.List.show({
                    items: items,
                    title: `Фильмы (${currentBalancer.name} / ${currentSort.name})`
                });
            } else {
                // fallback для web — вывести alert со списком
                alert(items.map(i=>`${i.title} (${i.subtitle})`).join('\n'));
            }
        });
    }

    // --- Главное меню ---
    function showMainMenu(){
        // Отрисовка кнопок
        let balancerBtns = renderBalancerButtons(showMainMenu);
        let sortBtns = renderSortButtons(showMainMenu);

        if (window.Lampa && Lampa.Menu) {
            Lampa.Menu.show({
                title: PLUGIN_NAME,
                subtitle: `Источник: ${currentBalancer.name} | Сортировка: ${currentSort.name}`,
                buttons: [
                    ...balancerBtns,
                    ...sortBtns,
                    {
                        title: 'Показать фильмы',
                        onClick: showMovieList
                    }
                ]
            });
        } else {
            // fallback для web — простое меню через prompt
            let choice = prompt(
                `Меню ${PLUGIN_NAME}\n\nБалансер: ${currentBalancer.name}\nСортировка: ${currentSort.name}\n\nВыбери:\n1 - Сменить балансер\n2 - Сменить сортировку\n3 - Показать фильмы`
            );
            if (choice === '1') {
                let idx = prompt('Выбери балансер:\n' + BALANCERS.map((b,i)=>`${i+1} - ${b.name}`).join('\n'));
                let i = parseInt(idx,10)-1;
                if (BALANCERS[i]) currentBalancer = BALANCERS[i];
                showMainMenu();
            } else if (choice === '2') {
                let idx = prompt('Выбери сортировку:\n' + SORT_TYPES.map((s,i)=>`${i+1} - ${s.name}`).join('\n'));
                let i = parseInt(idx,10)-1;
                if (SORT_TYPES[i]) currentSort = SORT_TYPES[i];
                showMainMenu();
            } else if (choice === '3') {
                showMovieList();
            }
        }
    }

    // --- Интеграция в Lampa TV ---
    // В примерах используется window.plugin_list
    window.plugin_list = window.plugin_list || [];
    window.plugin_list.push({
        title: PLUGIN_NAME,
        subtitle: 'Выбор источника и сортировки',
        onClick: showMainMenu
    });

    // Можно добавить автостарт для теста на web/телефоне:
    // setTimeout(showMainMenu, 1500);

    // --- Готово ---
    // Чтобы добавить новый балансер: добавь объект в BALANCERS
    // Чтобы добавить новую сортировку: добавь объект в SORT_TYPES

    // Для реального парсинга Rezka/Filmix — замени fetchMovies на вызовы API или парсинг.
})();
