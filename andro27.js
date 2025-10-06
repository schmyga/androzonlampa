(function() {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    console.log('Androzon plugin loading...');

    // Конфигурация как в andro_v15
    const plugin = {
        name: 'androzon',
        version: '3.0'
    };

    // Основная функция инициализации
    function init() {
        console.log('Androzon plugin init');

        // Добавляем кнопку в меню как в andro_v15
        addMenuButton();

        // Добавляем кнопку в плеер
        addPlayerButton();

        return true;
    }

    // Функция добавления кнопки в меню (как в andro_v15)
    function addMenuButton() {
        let checkMenu = setInterval(function() {
            let menu = document.querySelector('.main-menu');
            if (menu && !document.querySelector('.androzon-menu-btn')) {
                clearInterval(checkMenu);
                
                // Создаем кнопку как в andro_v15
                let button = document.createElement('div');
                button.className = 'main-menu__item androzon-menu-btn';
                button.innerHTML = `
                    <div class="main-menu__ico">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="main-menu__title">Androzon</div>
                `;
                
                // Обработчик клика как в andro_v15
                button.addEventListener('click', function() {
                    Lampa.Modal.prompt('Поиск фильмов и сериалов', '', function(query) {
                        if (query && query.length > 1) {
                            searchContent(query);
                        }
                    });
                });
                
                menu.appendChild(button);
                console.log('Androzon menu button added');
            }
        }, 100);
    }

    // Функция добавления кнопки в плеер (как в andro_v15)
    function addPlayerButton() {
        let checkPlayer = setInterval(function() {
            let panel = document.querySelector('.player-panel--center');
            if (panel && !document.querySelector('.androzon-player-btn')) {
                clearInterval(checkPlayer);
                
                // Создаем кнопку плеера как в andro_v15
                let button = document.createElement('div');
                button.className = 'player-button androzon-player-btn';
                button.innerHTML = `
                    <div class="player-button__icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="player-button__title">Поиск</div>
                `;
                
                // Обработчик клика
                button.addEventListener('click', function() {
                    let title = document.querySelector('.player-panel--title')?.textContent || '';
                    let cleanTitle = title.replace(/\(\d{4}\)/, '').trim();
                    
                    Lampa.Modal.prompt('Поиск похожего', cleanTitle, function(query) {
                        if (query && query.length > 1) {
                            searchContent(query);
                        }
                    });
                });
                
                panel.appendChild(button);
                console.log('Androzon player button added');
            }
        }, 100);
    }

    // Функция поиска контента (упрощенная версия)
    function searchContent(query) {
        console.log('Searching for:', query);
        
        // Показываем модальное окно как в andro_v15
        let html = `
            <div class="search-modal">
                <div class="search-loading">Идет поиск "${query}"...</div>
                <div class="search-results" style="display:none"></div>
            </div>
        `;
        
        Lampa.Modal.open({
            title: 'Androzon Поиск',
            html: html,
            size: 'large',
            onBack: function() {
                Lampa.Modal.close();
            }
        });

        // Имитируем поиск (заглушка)
        setTimeout(function() {
            let results = [
                { title: 'Пример результата 1', year: '2023', source: 'Rezka' },
                { title: 'Пример результата 2', year: '2022', source: 'Filmix' },
                { title: 'Пример результата 3', year: '2021', source: 'Kodik' }
            ];
            
            showSearchResults(results);
        }, 2000);
    }

    // Показ результатов поиска
    function showSearchResults(results) {
        let loading = document.querySelector('.search-loading');
        let resultsContainer = document.querySelector('.search-results');
        
        if (loading) loading.style.display = 'none';
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = results.map(result => `
                <div class="search-result selector">
                    <div class="selector__title">${result.title} (${result.year})</div>
                    <div class="selector__choose">${result.source}</div>
                </div>
            `).join('');
            
            // Добавляем обработчики для результатов
            document.querySelectorAll('.search-result').forEach((result, index) => {
                result.addEventListener('click', function() {
                    Lampa.Noty.show(`Выбран: ${results[index].title}`);
                    // Здесь будет логика воспроизведения
                });
            });
        }
    }

    // Автопоиск при завершении просмотра (как в andro_v15)
    function setupAutoSearch() {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                let title = e.object.movie.title;
                let cleanTitle = title.replace(/\(\d{4}\)/, '').trim();
                
                console.log('Auto search after completion:', cleanTitle);
                
                // Автопоиск через 3 секунды
                setTimeout(function() {
                    Lampa.Modal.prompt('Найти похожее?', cleanTitle, function(query) {
                        if (query && query.length > 1) {
                            searchContent(query);
                        }
                    });
                }, 3000);
            }
        });
    }

    // Инициализация плагина (как в andro_v15)
    if (Lampa.plugins) {
        Lampa.plugins.androzon = plugin;
        
        if (Lampa.ready) {
            init();
            setupAutoSearch();
        } else {
            Lampa.on('ready', function() {
                init();
                setupAutoSearch();
            });
        }
    } else {
        // Ждем инициализации плагинов
        let waitPlugins = setInterval(function() {
            if (Lampa.plugins) {
                clearInterval(waitPlugins);
                Lampa.plugins.androzon = plugin;
                
                if (Lampa.ready) {
                    init();
                    setupAutoSearch();
                } else {
                    Lampa.on('ready', function() {
                        init();
                        setupAutoSearch();
                    });
                }
            }
        }, 100);
    }

    console.log('Androzon plugin loaded successfully');

})();
