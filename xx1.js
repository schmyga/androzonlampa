(function(){
    // Название плагина
    const PLUGIN_NAME = 'Androzon Lampa';

    // Список балансеров (источников)
    const BALANCERS = [
        {
            name: 'Rezka',
            id: 'rezka',
            // Тут можно сразу прописать методы, специфичные для балансера
            fetchMovies: function(sortType){
                // Заглушка — тут будет парсинг Rezka
                return Promise.resolve([
                    { title: 'Фильм Rezka 1', year: 2022 },
                    { title: 'Фильм Rezka 2', year: 2023 },
                ]);
            }
        },
        {
            name: 'Filmix',
            id: 'filmix',
            fetchMovies: function(sortType){
                // Заглушка — тут будет парсинг Filmix
                return Promise.resolve([
                    { title: 'Фильм Filmix 1', year: 2021 },
                    { title: 'Фильм Filmix 2', year: 2024 },
                ]);
            }
        }
        // Добавить новый балансер — просто добавить объект сюда
    ];

    // Сортировки
    const SORT_TYPES = [
        {id: 'new', name: 'Новинки'},
        {id: 'popular', name: 'Популярные'},
        {id: 'year', name: 'По году'},
    ];

    // Текущее состояние
    let currentBalancer = BALANCERS[0]; // по умолчанию Rezka
    let currentSort = SORT_TYPES[0];    // по умолчанию Новинки

    // Рендерит меню выбора балансера
    function renderBalancerMenu(){
        let buttons = BALANCERS.map(balancer => {
            return {
                title: balancer.name,
                selected: balancer.id === currentBalancer.id,
                onClick: () => {
                    currentBalancer = balancer;
                    renderMainMenu();
                }
            };
        });
        return buttons;
    }

    // Рендерит меню сортировки
    function renderSortMenu(){
        let buttons = SORT_TYPES.map(sort => {
            return {
                title: sort.name,
                selected: sort.id === currentSort.id,
                onClick: () => {
                    currentSort = sort;
                    renderMainMenu();
                }
            };
        });
        return buttons;
    }

    // Основное меню — показывает фильмы из текущего балансера по текущей сортировке
    function renderMainMenu(){
        // Заголовок меню
        Lampa.Menu.show({
            title: PLUGIN_NAME,
            // Кнопки выбора балансера и сортировки
            subtitle: `Источник: ${currentBalancer.name} | Сортировка: ${currentSort.name}`,
            // Кнопки для выбора балансера
            buttons: [
                ...renderBalancerMenu(),
                ...renderSortMenu(),
            ],
            // Список фильмов
            onShow: function(){
                // Получаем фильмы
                currentBalancer.fetchMovies(currentSort.id).then(movies => {
                    // Рендерим фильмы
                    let items = movies.map(movie => ({
                        title: movie.title,
                        subtitle: movie.year,
                        onClick: () => {
                            // Здесь — действие при выборе фильма (например, открыть детали или плеер)
                            Lampa.Noty.show(`Выбран фильм: ${movie.title}`);
                        }
                    }));
                    // Показываем список
                    Lampa.List.show({
                        items: items,
                        title: `${currentBalancer.name} - ${currentSort.name}`,
                    });
                });
            }
        });
    }

    // Точка входа — добавляем пункт в главное меню Lampa
    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready'){
            // Добавляем пункт меню
            Lampa.Menu.add({
                title: PLUGIN_NAME,
                onClick: function(){
                    renderMainMenu();
                }
            });
        }
    });

    // Для отладки — сразу показываем меню
    // renderMainMenu();
})();
