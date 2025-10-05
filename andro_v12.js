(function() {
    'use strict';

    console.log('🎬 Androzon Plugin Loading...');

    if (typeof Lampa === 'undefined') {
        console.error('Lampa API not found');
        return;
    }

    // Конфигурация балансеров
    var BALANCERS = {
        kinoger: {
            name: 'Kinoger',
            baseUrl: 'https://kinoger.com',
            searchUrl: function(title) {
                return 'https://kinoger.com/stream/search/' + encodeURIComponent(title);
            }
        },
        bsto: {
            name: 'BS.to', 
            baseUrl: 'https://bs.to',
            searchUrl: function(title) {
                var cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                return 'https://bs.to/serie/' + cleanTitle;
            }
        },
        cineto: {
            name: 'Cine.to',
            baseUrl: 'https://cine.to',
            searchUrl: function(title) {
                return 'https://cine.to/movies?q=' + encodeURIComponent(title);
            }
        }
    };

    // Основной компонент балансера
    function AndrozonComponent(object) {
        console.log('🎯 Androzon Component Initialized');
        
        var network = new Lampa.Request();
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var movie = object.movie || {};
        var currentBalancer = 'cineto';

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
            
            // Автоматически начинаем поиск
            this.searchOnBalancer(currentBalancer);
        };

        this.showMainInterface = function() {
            scroll.clear();
            
            // Шапка с переключателем балансеров
            var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">' +
                    '<div>' +
                        '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">🎬 Androzon</div>' +
                        '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">' +
                            'Поиск: <strong>' + (movie.title || movie.name) + '</strong>' +
                        '</div>' +
                    '</div>' +
                    '<div class="selector" style="padding: 10px 15px; background: rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer;">' +
                        '<div style="font-size: 14px; font-weight: bold;">🔁 ' + BALANCERS[currentBalancer].name + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>');

            // Обработчик переключения балансеров
            header.find('.selector').on('hover:enter', (function() {
                this.switchBalancer();
            }).bind(this));

            scroll.append(header);
        };

        this.switchBalancer = function() {
            var balancers = Object.keys(BALANCERS);
            var currentIndex = balancers.indexOf(currentBalancer);
            currentBalancer = balancers[(currentIndex + 1) % balancers.length];
            
            this.showMainInterface();
            this.searchOnBalancer(currentBalancer);
        };

        this.searchOnBalancer = function(balancerId) {
            console.log('🔍 Searching on ' + BALANCERS[balancerId].name);
            
            this.showLoadingState(BALANCERS[balancerId].name);
            
            var searchUrl = BALANCERS[balancerId].searchUrl(movie.title || movie.name);
            
            console.log('📡 Fetching:', searchUrl);
            
            var self = this;
            network.native(searchUrl, function(html) {
                if (html && html.length > 1000) {
                    self.processBalancerResults(html, balancerId);
                } else {
                    self.showDemoResults(balancerId);
                }
            }, function(error) {
                console.error('Network error:', error);
                self.showDemoResults(balancerId);
            });
        };

        this.processBalancerResults = function(html, balancerId) {
            console.log('📊 Processing results from ' + BALANCERS[balancerId].name);
            
            var results = this.parseResults(html, balancerId);
            
            if (results && results.length > 0) {
                this.displayResults(results, balancerId);
            } else {
                this.showDemoResults(balancerId);
            }
        };

        this.parseResults = function(html, balancerId) {
            try {
                switch(balancerId) {
                    case 'cineto':
                        return this.parseCineTo(html);
                    case 'kinoger':
                        return this.parseKinoger(html);
                    case 'bsto':
                        return this.parseBS(html);
                    default:
                        return this.createDemoResults(balancerId);
                }
            } catch (error) {
                console.error('Parser error:', error);
                return this.createDemoResults(balancerId);
            }
        };

        this.parseCineTo = function(html) {
            var results = [];
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            
            // Создаем демо-результаты для Cine.to
            results.push({
                title: movie.title || 'Фильм на Cine.to',
                url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                image: this.getMovieImage(),
                quality: 'HD',
                source: 'Cine.to',
                description: 'Демо поток с Cine.to'
            });
            
            return results;
        };

        this.parseKinoger = function(html) {
            var results = [];
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            
            // Создаем демо-результаты для Kinoger
            results.push({
                title: movie.title || 'Фильм на Kinoger',
                url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                image: this.getMovieImage(),
                quality: '720p',
                source: 'Kinoger', 
                description: 'Демо поток с Kinoger'
            });
            
            return results;
        };

        this.parseBS = function(html) {
            var results = [];
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            
            // Создаем демо-результаты для BS.to
            results.push({
                title: movie.title || 'Сериал на BS.to',
                url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                image: this.getMovieImage(),
                quality: '1080p',
                source: 'BS.to',
                description: 'Демо поток с BS.to'
            });
            
            return results;
        };

        this.getMovieImage = function() {
            if (movie.backdrop_path) {
                return Lampa.TMDB.image('t/p/w300' + movie.backdrop_path);
            }
            return null;
        };

        this.createDemoResults = function(balancerId) {
            return [{
                title: movie.title || 'Демо фильм',
                url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                image: this.getMovieImage(),
                quality: '720p',
                source: BALANCERS[balancerId].name,
                description: 'Демонстрационный поток'
            }];
        };

        this.displayResults = function(results, balancerId) {
            scroll.clear();
            this.showMainInterface();
            
            // Заголовок результатов
            var resultsHeader = $('<div style="padding: 20px; background: rgba(0,0,0,0.4);">' +
                '<div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">' +
                    '📺 Найдено на ' + BALANCERS[balancerId].name +
                '</div>' +
                '<div style="font-size: 14px; color: #aaa;">' +
                    results.length + ' результат(ов)' +
                '</div>' +
            '</div>');
            scroll.append(resultsHeader);

            // Отображаем результаты
            for (var i = 0; i < results.length; i++) {
                var card = this.createResultCard(results[i], i);
                scroll.append(card);
            }

            // Добавляем демо-потоки
            this.addDemoStreams();
        };

        this.createResultCard = function(result, index) {
            var imageHtml = result.image ? 
                '<img src="' + result.image + '" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display=\'none\'">' :
                '<div style="font-size: 40px;">🎬</div>';
            
            var card = $('<div class="selector" style="padding: 0; margin: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; cursor: pointer;">' +
                '<div style="display: flex; align-items: center; min-height: 120px;">' +
                    '<div style="width: 120px; height: 120px; flex-shrink: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">' +
                        imageHtml +
                    '</div>' +
                    '<div style="padding: 15px; flex: 1;">' +
                        '<div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; line-height: 1.2;">' +
                            result.title +
                        '</div>' +
                        '<div style="display: flex; gap: 10px; margin-bottom: 8px;">' +
                            '<span style="background: rgba(255,107,53,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">' +
                                result.quality +
                            '</span>' +
                            '<span style="background: rgba(74,144,226,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;">' +
                                result.source +
                            '</span>' +
                        '</div>' +
                        '<div style="font-size: 12px; color: #aaa;">' +
                            'Нажмите для воспроизведения' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>');

            var self = this;
            card.on('hover:enter', function() {
                self.playContent(result);
            });

            return card;
        };

        this.playContent = function(result) {
            console.log('▶ Playing:', result.title, result.url);
            
            Lampa.Player.play({
                url: result.url,
                title: result.title,
                quality: { 'Auto': result.url }
            });
        };

        this.showDemoResults = function(balancerId) {
            var demoResults = this.createDemoResults(balancerId);
            this.displayResults(demoResults, balancerId);
        };

        this.addDemoStreams = function() {
            var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 20px;">' +
                '🎯 Тестовые видео:' +
            '</div>');
            scroll.append(demoHeader);

            var demoStreams = [
                {
                    title: 'Big Buck Bunny',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    quality: '1080p',
                    source: 'Google',
                    image: null
                },
                {
                    title: 'Тестовый HLS',
                    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                    quality: '720p', 
                    source: 'Mux',
                    image: null
                }
            ];

            for (var i = 0; i < demoStreams.length; i++) {
                var card = this.createResultCard(demoStreams[i], i);
                scroll.append(card);
            }
        };

        this.showLoadingState = function(balancerName) {
            scroll.clear();
            this.showMainInterface();
            
            var loading = $('<div style="padding: 60px 20px; text-align: center;">' +
                '<div class="broadcast__scan" style="margin: 0 auto 30px auto; width: 50px; height: 50px;">' +
                    '<div></div>' +
                '</div>' +
                '<div style="font-size: 18px; color: #fff; margin-bottom: 10px;">' +
                    'Ищем на ' + balancerName + '...' +
                '</div>' +
                '<div style="font-size: 14px; color: #aaa;">' +
                    (movie.title || movie.name) +
                '</div>' +
            '</div>');
            scroll.append(loading);
        };

        this.setupNavigation = function() {
            var self = this;
            Lampa.Controller.add('content', {
                toggle: function() {
                    Lampa.Controller.collectionSet(scroll.render());
                    var firstSelector = scroll.render().find('.selector').first()[0];
                    if (firstSelector) {
                        Lampa.Controller.collectionFocus(firstSelector, scroll.render());
                    }
                },
                up: function() {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function() {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                left: function() {
                    Lampa.Controller.toggle('menu');
                },
                back: function() {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function() {};
        this.stop = function() {};
        this.destroy = function() {
            network.clear();
            if (scroll && typeof scroll.destroy === 'function') {
                scroll.destroy();
            }
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
                    var render = e.object.activity.render();
                    var movie = e.data.movie;
                    
                    // Удаляем старые кнопки
                    render.find('.androzon-button').remove();
                    
                    // Создаем кнопку
                    var btn = $('<div class="full-start__button selector view--online androzon-button" style="background: linear-gradient(45deg, #FF6B35, #FF8E53); margin: 5px; border-radius: 8px; cursor: pointer;">' +
                        '<div style="display: flex; align-items: center; justify-content: center; padding: 12px 20px;">' +
                            '<span style="margin-right: 8px;">🎬</span>' +
                            '<span style="font-weight: bold;">Androzon</span>' +
                        '</div>' +
                    '</div>');

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
                    var buttonsContainer = render.find('.full-start__buttons');
                    if (buttonsContainer.length) {
                        buttonsContainer.prepend(btn);
                        console.log('✅ Androzon button added');
                    } else {
                        console.log('❌ Buttons container not found');
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
