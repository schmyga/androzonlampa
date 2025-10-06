(function(lampa) {
    'use strict';

    if (!window.lampa) return;

    console.log('Andro31 plugin start');

    let plugin = {
        name: 'andro31',
        version: '31.0'
    };

    function init() {
        console.log('Andro31 init');

        // Добавляем кнопку в главное меню
        addMainButton();

        // Добавляем кнопку в плеер
        addPlayerButton();

        // Настройка автопоиска
        setupAutoSearch();

        return true;
    }

    function addMainButton() {
        setInterval(() => {
            let menu = document.querySelector('.main-menu');
            if (menu && !document.querySelector('.andro31-button-main')) {
                let button = document.createElement('div');
                button.className = 'main-menu__item andro31-button-main';
                button.innerHTML = `
                    <div class="main-menu__ico">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="main-menu__title">Andro31</div>
                `;
                
                button.addEventListener('click', function() {
                    lampa.Modal.prompt('Поиск фильмов и сериалов', '', (query) => {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                });

                menu.appendChild(button);
                console.log('Andro31 main button added');
            }
        }, 1000);
    }

    function addPlayerButton() {
        setInterval(() => {
            let panel = document.querySelector('.player-panel--center');
            if (panel && !document.querySelector('.andro31-button-player')) {
                let button = document.createElement('div');
                button.className = 'player-button andro31-button-player';
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
                    
                    lampa.Modal.prompt('Поиск похожего', clean, (query) => {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                });

                panel.appendChild(button);
                console.log('Andro31 player button added');
            }
        }, 1000);
    }

    function startSearch(query) {
        console.log('Searching:', query);
        
        lampa.Modal.open({
            title: 'Andro31 Поиск',
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
                        <div class="selector" data-result="cdnvideo">
                            <div class="selector__title">CDNVideo</div>
                            <div class="selector__choose">1080p</div>
                        </div>
                    </div>
                </div>
            `,
            onBack: function() {
                lampa.Modal.close();
            }
        });

        setTimeout(() => {
            document.querySelectorAll('.selector[data-result]').forEach(item => {
                item.addEventListener('click', function() {
                    let source = this.getAttribute('data-result');
                    lampa.Noty.show(`Выбран источник: ${source}`);
                    lampa.Modal.close();
                });
            });
        }, 100);
    }

    function setupAutoSearch() {
        lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                let title = e.object.movie.title;
                let clean = title.replace(/\(\d{4}\)/, '').trim();
                
                setTimeout(() => {
                    lampa.Modal.prompt('Найти похожее?', clean, (query) => {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                }, 3000);
            }
        });
    }

    // Регистрация плагина
    if (lampa.plugins) {
        lampa.plugins.andro31 = plugin;
        
        if (lampa.ready) {
            init();
        } else {
            lampa.on('ready', init);
        }
    } else {
        let wait = setInterval(() => {
            if (lampa.plugins) {
                clearInterval(wait);
                lampa.plugins.andro31 = plugin;
                
                if (lampa.ready) {
                    init();
                } else {
                    lampa.on('ready', init);
                }
            }
        }, 100);
    }

})(window.lampa);
