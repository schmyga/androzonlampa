(function() {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    console.log('Androzon plugin start');

    // Точная копия структуры из andro_v15
    let plugin = {
        name: 'androzon',
        version: '15.0'
    };

    function init() {
        console.log('Androzon init');

        // Добавляем кнопку в главное меню
        addMainButton();

        // Добавляем кнопку в плеер
        addPlayerButton();

        // Настройка автопоиска
        setupAutoSearch();

        return true;
    }

    function addMainButton() {
        // Постоянная проверка как в andro_v15
        setInterval(() => {
            let menu = document.querySelector('.main-menu');
            if (menu && !document.querySelector('.androzon-button-main')) {
                let button = document.createElement('div');
                button.className = 'main-menu__item androzon-button-main';
                button.innerHTML = `
                    <div class="main-menu__ico">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="main-menu__title">Androzon</div>
                `;
                
                button.addEventListener('click', function() {
                    Lampa.Modal.prompt('Поиск фильмов и сериалов', '', (query) => {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                });

                menu.appendChild(button);
                console.log('Androzon main button added');
            }
        }, 1000);
    }

    function addPlayerButton() {
        // Постоянная проверка плеера
        setInterval(() => {
            let panel = document.querySelector('.player-panel--center');
            if (panel && !document.querySelector('.androzon-button-player')) {
                let button = document.createElement('div');
                button.className = 'player-button androzon-button-player';
                button.innerHTML = `
                    <div class="player-button__icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="player-button__title">Поиск</div>
                `;
                
                button.addEventListener('click', function() {
                    let title = document.querySelector('.player-panel--title')?.textContent || '';
                    let clean = title.replace(/\(\d{4}\)/, '').trim();
                    
                    Lampa.Modal.prompt('Поиск похожего', clean, (query) => {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                });

                panel.appendChild(button);
                console.log('Androzon player button added');
            }
        }, 1000);
    }

    function startSearch(query) {
        console.log('Searching:', query);
        
        // Простой модальный поиск как в andro_v15
        Lampa.Modal.open({
            title: 'Androzon Поиск',
            html: `
                <div style="padding:20px;text-align:center;">
                    <div style="font-size:16px;margin-bottom:20px;">Поиск: "${query}"</div>
                    <div class="search-results">
                        <div class="selector" data-result="rezka">
                            <div class="selector__title">Rezka AG</div>
                            <div class="selector__choose">HD</div>
                        </div>
                        <div class="selector" data-result="filmix">
                            <div class="selector__title">Filmix</div>
                            <div class="selector__choose">FHD</div>
                        </div>
                        <div class="selector" data-result="kodik">
                            <div class="selector__title">Kodik</div>
                            <div class="selector__choose">4K</div>
                        </div>
                    </div>
                </div>
            `,
            onBack: function() {
                Lampa.Modal.close();
            }
        });

        // Обработка выбора результата
        setTimeout(() => {
            document.querySelectorAll('.selector[data-result]').forEach(item => {
                item.addEventListener('click', function() {
                    let source = this.getAttribute('data-result');
                    Lampa.Noty.show(`Выбран источник: ${source}`);
                    Lampa.Modal.close();
                });
            });
        }, 100);
    }

    function setupAutoSearch() {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                let title = e.object.movie.title;
                let clean = title.replace(/\(\d{4}\)/, '').trim();
                
                setTimeout(() => {
                    Lampa.Modal.prompt('Найти похожее?', clean, (query) => {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                }, 3000);
            }
        });
    }

    // Регистрация плагина КАК В andro_v15
    if (Lampa.plugins) {
        Lampa.plugins.androzon = plugin;
        
        if (Lampa.ready) {
            init();
        } else {
            Lampa.on('ready', init);
        }
    } else {
        let wait = setInterval(() => {
            if (Lampa.plugins) {
                clearInterval(wait);
                Lampa.plugins.androzon = plugin;
                
                if (Lampa.ready) {
                    init();
                } else {
                    Lampa.on('ready', init);
                }
            }
        }, 100);
    }

})();
