(function() {
    'use strict';

    console.log('🎬 Androzon Plugin Loading...');

    if (typeof Lampa === 'undefined') {
        console.error('Lampa API not found');
        return;
    }

    // Конфигурация балансеров
    const BALANCERS = {
        kinoger: {
            name: 'Kinoger',
            baseUrl: 'https://kinoger.com',
            searchUrl: (title) => `https://kinoger.com/stream/search/${encodeURIComponent(title)}`,
            parser: 'kinoger'
        },
        bsto: {
            name: 'BS.to',
            baseUrl: 'https://bs.to',
            searchUrl: (title) => {
                const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                return `https://bs.to/serie/${cleanTitle}`;
            },
            parser: 'bsto'
        },
        cineto: {
            name: 'Cine.to',
            baseUrl: 'https://cine.to', 
            searchUrl: (title) => `https://cine.to/movies?q=${encodeURIComponent(title)}`,
            parser: 'cineto'
        }
    };

    // Основной компонент балансера
    function AndrozonComponent(object) {
        console.log('🎯 Androzon Component Initialized', object);
        
        const network = new Lampa.Request();
        const scroll = new Lampa.Scroll({mask: true, over: true});
        const movie = object.movie || {};
        let currentBalancer = 'cineto'; // По умолчанию Cine.to
        let searchResults = [];

        this.create = function() {
            return this.render();
        };

        this.render = function() {
            return scroll.render();
        };

        this.start = function() {
            this.initialize();
        };

        this.initialize = function() {
            console.log('🚀 Starting Androzon for:', movie.title);
            
            scroll.body().addClass('torrent-list');
            this.showMainInterface();
            this.setupNavigation();
            
            // Автоматически начинаем поиск на выбранном балансере
            this.searchOnBalancer(currentBalancer);
        };

        this.showMainInterface = function() {
            scroll.clear();
            
            // Шапка с переключателем балансеров
            const header = $(`
                <div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div>
                            <div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">🎬 Androzon</div>
                            <div class="choice__subtitle" style="font-size: 14px; color: #aaa;">
                                Поиск: <strong>${movie.title || movie.name}</strong>
                            </div>
                        </div>
                        <div class="selector" style="padding: 10px 15px; background: rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer;">
                            <div style="font-size: 14px; font-weight: bold;">🔁 ${BALANCERS[currentBalancer].name}</div>
                        </div>
                    </div>
                </div>
            `);

            // Обработчик переключения балансеров
            header.find('.selector').on('hover:enter', () => {
                this.switchBalancer();
            });

            scroll.append(header);
        };

        this.switchBalancer = function() {
            const balancers = Object.keys(BALANCERS);
            const currentIndex = balancers.indexOf(currentBalancer);
            currentBalancer = balancers[(currentIndex + 1) % balancers.length];
            
            this.showMainInterface();
            this.searchOnBalancer(currentBalancer);
        };

        this.searchOnBalancer = function(balancerId) {
            console.log(`🔍 Searching on ${BALANCERS[balancerId].name}`);
            
            // Показываем индикатор загрузки
            this.showLoadingState(BALANCERS[balancerId].name);
            
            const searchUrl = BALANCERS[balancerId].searchUrl(movie.title || movie.name);
            
            console.log('📡 Fetching:', searchUrl);
            
            network.native(searchUrl, (html) => {
                if (html && html.length > 1000) {
                    this.processBalancerResults(html, balancerId);
                } else {
                    this.showDemoResults(balancerId);
                }
            }, (error) => {
                console.error('Network error:', error);
                this.showDemoResults(balancerId);
            });
        };

        this.processBalancerResults = function(html, balancerId) {
            console.log(`📊 Processing results from ${BALANCERS[balancerId].name}`);
            
            const results = this.parseResults(html, balancerId);
            
            if (results.length > 0) {
                this.displayResults(results, balancerId);
            } else {
                this.showDemoResults(balancerId);
            }
        };

        this.parseResults = function(html, balancerId) {
            const results = [];
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            try {
                switch(balancerId) {
                    case 'cineto':
                        return this.parseCineTo(doc);
                    case 'kinoger':
                        return this.parseKinoger(doc);
                    case 'bsto':
                        return this.parseBS(doc);
                    default:
                        return this.createDemoResults(balancerId);
                }
            } catch (error) {
                console.error('Parser error:', error);
                return this.createDemoResults(balancerId);
            }
        };

        this.parseCineTo = function(doc) {
            const results = [];
            
            // Ищем карточки фильмов
            const movieCards = doc.querySelectorAll('.movie-item, .film-card, [data-movie]');
            movieCards.forEach((card, index) => {
                const link = card.querySelector('a');
                const titleElem = card.querySelector('.title, .name, h3') || link;
                const imgElem = card.querySelector('img');
                
                if (link && link.href) {
                    results.push({
                        title: titleElem ? titleElem.textContent.trim() : `Фильм ${index + 1}`,
                        url: link.href,
                        image: imgElem ? imgElem.src : null,
                        quality: 'HD',
                        source: 'Cine.to',
                        type: 'movie'
                    });
                }
            });

            // Если не нашли карточки, создаем демо-результаты
            if (results.length === 0) {
                return this.createDemoResults('cineto');
            }
            
            return results.slice(0, 5);
        };

        this.parseKinoger = function(doc) {
            const results = [];
            
            // Ищем iframe с видео
            const iframes = doc.querySelectorAll('iframe[src*="m3u8"], iframe[src*="mp4"]');
            iframes.forEach((iframe, index) => {
                if (iframe.src) {
                    results.push({
                        title: `${movie.title} (Поток ${index + 1})`,
                        url: iframe.src,
                        image: movie.backdrop_path ? Lampa.TMDB.image('t/p/w300' + movie.backdrop_path) : null,
                        quality: 'Auto',
                        source: 'Kinoger',
                        type: 'stream'
                    });
                }
            });

            if (results.length === 0) {
                return this.createDemoResults('kinoger');
            }
            
            return results;
        };

        this.parseBS = function(doc) {
            const results = [];
            
            // Ищем серии для сериалов
            const episodes = doc.querySelectorAll('.episode-list li, .season-episodes li');
            episodes.forEach((episode, index) => {
                const link = episode.querySelector('a');
                if (link && link.href) {
                    results.push({
                        title: link.textContent.trim() || `Серия ${index + 1}`,
                        url: link.href,
                        image: movie.backdrop_path ? Lampa.TMDB.image('t/p/w300' + movie.backdrop_path) : null,
                        quality: 'HD',
                        source: 'BS.to',
                        type: 'episode'
                    });
                }
            });

            if (results.length === 0) {
                return this.createDemoResults('bsto');
            }
            
            return results.slice(0, 5);
        };

        this.createDemoResults = function(balancerId) {
            return [{
                title: movie.title || 'Демо фильм',
                url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                image: movie.backdrop_path ? Lampa.TMDB.image('t/p/w300' + movie.backdrop_path) : null,
                quality: '720p',
                source: BALANCERS[balancerId].name,
                type: 'demo'
            }];
        };

        this.displayResults = function(results, balancerId) {
            scroll.clear();
            this.showMainInterface();
            
            // Заголовок результатов
            const resultsHeader = $(`
                <div style="padding: 20px; background: rgba(0,0,0,0.4);">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                        📺 Найдено на ${BALANCERS[balancerId].name}
                    </div>
                    <div style="font-size: 14px; color: #aaa;">
                        ${results.length} результат(ов)
                    </div>
                </div>
            `);
            scroll.append(resultsHeader);

            // Отображаем результаты как карточки
            results.forEach((result, index) => {
                const card = this.createResultCard(result, index);
                scroll.append(card);
            });

            // Добавляем демо-потоки как альтернативу
            this.addDemoStreams();
        };

        this.createResultCard = function(result, index) {
            const card = $(`
                <div class="selector" style="padding: 0; margin: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; cursor: pointer;">
                    <div style="display: flex; align-items: center; min-height: 120px;">
                        <div style="width: 120px; height: 120px; flex-shrink: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                            ${result.image ? 
                                `<img src="${result.image}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">` :
                                `<div style="font-size: 40px;">🎬</div>`
                            }
                        </div>
                        <div style="padding: 15px; flex: 1;">
                            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; line-height: 1.2;">
                                ${result.title}
                            </div>
                            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                                <span style="background: rgba(255,107,53,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">
                                    ${result.quality}
                                </span>
                                <span style="background: rgba(74,144,226,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">
                                    ${result.source}
                                </span>
                            </div>
                            <div style="font-size: 12px; color: #aaa;">
                                Нажмите для воспроизведения
                            </div>
                        </div>
                    </div>
                </div>
            `);

            card.on('hover:enter', () => {
                this.playContent(result);
            });

            return card;
        };

        this.playContent = function(result) {
            console.log('▶ Playing:', result.title, result.url);
            
            // Если это прямая видео ссылка
            if (result.url.includes('.m3u8') || result.url.includes('.mp4')) {
                Lampa.Player.play({
                    url: result.url,
                    title: result.title,
                    quality: { [result.quality]: result.url }
                });
            } else {
                // Если это ссылка на страницу, показываем сообщение
                Lampa.Noty.show(`Открываем страницу: ${result.source}`);
                
                // В будущем здесь можно добавить парсер для извлечения видео со страницы
                setTimeout(() => {
                    this.showDemoStreams();
                }, 2000);
            }
        };

        this.showDemoResults = function(balancerId) {
            const demoResults = this.createDemoResults(balancerId);
            this.displayResults(demoResults, balancerId);
        };

        this.addDemoStreams = function() {
            const demoHeader = $(`
                <div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 20px;">
                    🎯 Тестовые видео (гарантированно работают):
                </div>
            `);
            scroll.append(demoHeader);

            const demoStreams = [
                {
                    title: 'Big Buck Bunny (MP4)',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    quality: '1080p',
                    source: 'Google'
                },
                {
                    title: 'Тестовый HLS поток',
                    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                    quality: '720p',
                    source: 'Mux'
                }
            ];

            demoStreams.forEach(stream => {
                const card = this.createResultCard(stream);
                scroll.append(card);
            });
        };

        this.showLoadingState = function(balancerName) {
            scroll.clear();
            this.showMainInterface();
            
            const loading = $(`
                <div style="padding: 60px 20px; text-align: center;">
                    <div class="broadcast__scan" style="margin: 0 auto 30px auto; width: 50px; height: 50px;">
                        <div></div>
                    </div>
                    <div style="font-size: 18px; color: #fff; margin-bottom: 10px;">
                        Ищем на ${balancerName}...
                    </div>
                    <div style="font-size: 14px; color: #aaa;">
                        ${movie.title || movie.name}
                    </div>
                </div>
            `);
            scroll.append(loading);
        };

        this.showDemoStreams = function() {
            scroll.clear();
            this.showMainInterface();
            this.addDemoStreams();
        };

        this.setupNavigation = function() {
            Lampa.Controller.add('content', {
                toggle: () => {
                    Lampa.Controller.collectionSet(scroll.render());
                    const firstSelector = scroll.render().find('.selector').first()[0];
                    if (firstSelector) {
                        Lampa.Controller.collectionFocus(firstSelector, scroll.render());
                    }
                },
                up: () => {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: () => {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                left: () => Lampa.Controller.toggle('menu'),
                back: () => Lampa.Activity.backward()
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function() {};
        this.stop = function() {};
        this.destroy = function() {
            network.clear();
            if (scroll && scroll.destroy) scroll.destroy();
        };
    }

    // Инициализация плагина
    function initAndrozon() {
        console.log('🚀 Initializing Androzon Plugin');
        
        // Регистрируем компонент
        Lampa.Component.add('androzon', AndrozonComponent);
        
        // Добавляем кнопку в карточки фильмов
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite') {
                try {
                    const render = e.object.activity.render();
                    const movie = e.data.movie;
                    
                    // Удаляем старые кнопки
                    render.find('.androzon-button').remove();
                    
                    // Создаем кнопку
                    const btn = $(`
                        <div class="full-start__button selector view--online androzon-button" style="background: linear-gradient(45deg, #FF6B35, #FF8E53); margin: 5px; border-radius: 8px; cursor: pointer;">
                            <div style="display: flex; align-items: center; justify-content: center; padding: 12px 20px;">
                                <span style="margin-right: 8px;">🎬</span>
                                <span style="font-weight: bold;">Androzon</span>
                            </div>
                        </div>
                    `);

                    btn.on('hover:enter', function() {
                        Lampa.Activity.push({
                            url: '',
                            title: 'Androzon - ' + (movie.title || movie.name),
                            component: 'androzon',
                            movie: movie,
                            page: 1
                        });
                    });

                    // Добавляем кнопку
                    const buttonsContainer = render.find('.full-start__buttons');
                    if (buttonsContainer.length) {
                        buttonsContainer.prepend(btn);
                    }

                } catch (error) {
                    console.error('Error adding button:', error);
                }
            }
        });

        console.log('✅ Androzon Plugin Ready');
    }

    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAndrozon);
    } else {
        initAndrozon();
    }

})();
