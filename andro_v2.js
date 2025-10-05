(function() {
    'use strict';

    try {
        console.log('Androzon plugin started');

        if (typeof Lampa === 'undefined') {
            console.error('Lampa API not loaded');
            return;
        }

        // Конфигурация плагина
        var PluginConfig = {
            id: 'androzon',
            name: 'Androzon',
            version: '1.0.0',
            sources: {
                kinoger: {
                    name: 'Kinoger',
                    baseUrl: 'https://kinoger.com',
                    search: function(title) {
                        return 'https://kinoger.com/stream/search/' + encodeURIComponent(title);
                    },
                    parser: 'kinoger'
                },
                bsto: {
                    name: 'BS.to', 
                    baseUrl: 'https://bs.to',
                    search: function(title) {
                        return 'https://bs.to/serie/' + encodeURIComponent(title.toLowerCase().replace(/ /g, '-'));
                    },
                    parser: 'bsto'
                },
                cineto: {
                    name: 'Cine.to',
                    baseUrl: 'https://cine.to',
                    search: function(title) {
                        return 'https://cine.to/movies?q=' + encodeURIComponent(title);
                    },
                    parser: 'cineto'
                }
            }
        };

        // Основной компонент балансера
        function component(object) {
            var network = new Lampa.Request();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var activity = object.activity;
            var movie = object.movie;
            var currentSource = 'kinoger';
            var results = [];
            var sources = PluginConfig.sources;

            this.create = function() {
                console.log('Androzon component create');
                return this.render();
            };

            this.render = function() {
                console.log('Androzon component render');
                return scroll.render();
            };

            this.start = function() {
                console.log('Androzon component start');
                this.initialize();
            };

            this.initialize = function() {
                console.log('Androzon initialize');
                
                scroll.body().addClass('torrent-list');
                scroll.body().append(this.createLoadingTemplate());
                Lampa.Controller.enable('content');
                
                this.setupNavigation();
                this.searchCurrentSource();
            };

            this.setupNavigation = function() {
                Lampa.Controller.add('content', {
                    toggle: () => {
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(scroll.render().find('.selector').first()[0] || false, scroll.render());
                    },
                    up: () => {
                        if (Navigator.canmove('up')) Navigator.move('up');
                        else Lampa.Controller.toggle('head');
                    },
                    down: () => Navigator.move('down'),
                    left: () => Lampa.Controller.toggle('menu'),
                    back: () => Lampa.Activity.backward()
                });
            };

            this.createLoadingTemplate = function() {
                return $('<div style="padding: 40px 20px; text-align: center; color: #999;">' +
                    '<div style="margin-bottom: 20px;">Androzon ищет...</div>' +
                    '<div class="broadcast__scan"><div></div></div>' +
                    '</div>');
            };

            this.searchCurrentSource = function() {
                var source = sources[currentSource];
                var searchUrl = source.search(movie.title || movie.name);
                
                console.log('Androzon searching on', source.name, ':', searchUrl);
                
                network.timeout(10000);
                network.native(searchUrl, (html) => {
                    if (html) {
                        this.parseAndDisplay(html, source);
                    } else {
                        this.showError('Пустой ответ от ' + source.name);
                    }
                }, (error) => {
                    console.error('Search error:', error);
                    this.showError('Ошибка подключения к ' + source.name);
                });
            };

            this.parseAndDisplay = function(html, source) {
                var streams = this.parseSource(html, source.parser);
                
                if (streams && streams.length > 0) {
                    this.displayStreams(streams, source.name);
                } else {
                    this.showError('Ничего не найдено на ' + source.name);
                }
            };

            this.parseSource = function(html, parserType) {
                try {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var streams = [];

                    // Простой парсер для демонстрации
                    var links = doc.querySelectorAll('a[href*="watch"], a[href*="video"], a[href*="stream"], iframe[src*="m3u8"]');
                    
                    links.forEach((link, index) => {
                        var url = link.src || link.href;
                        if (url && (url.includes('m3u8') || url.includes('mp4') || url.includes('video'))) {
                            streams.push({
                                title: movie.title + ' (' + parserType + ' ' + (index + 1) + ')',
                                url: url,
                                quality: 'HD',
                                direct: true,
                                source: parserType
                            });
                        }
                    });

                    // Если не нашли прямых ссылок, создаем демо-данные
                    if (streams.length === 0) {
                        streams = this.createDemoStreams(parserType);
                    }

                    return streams.slice(0, 3);
                } catch (e) {
                    console.error('Parse error:', e);
                    return this.createDemoStreams(parserType);
                }
            };

            this.createDemoStreams = function(sourceType) {
                return [{
                    title: movie.title + ' (Demo Stream)',
                    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Тестовый HLS поток
                    quality: 'HD',
                    direct: true,
                    source: sourceType
                }];
            };

            this.displayStreams = function(streams, sourceName) {
                scroll.clear();
                
                // Заголовок
                var header = $('<div class="choice__head" style="padding: 15px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px;">' +
                    '<div style="font-size: 18px; font-weight: bold;">Androzon</div>' +
                    '<div style="font-size: 12px; color: #aaa;">Источник: ' + sourceName + '</div>' +
                    '</div>');
                scroll.append(header);

                // Стримы
                streams.forEach((stream, index) => {
                    var elem = $('<div class="online selector" style="padding: 15px; margin: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center;">' +
                        '<div style="flex: 1;">' +
                        '<div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">' + stream.title + '</div>' +
                        '<div style="font-size: 12px; color: #aaa;">Качество: ' + stream.quality + '</div>' +
                        '</div>' +
                        '<div style="background: rgba(0,0,0,0.5); padding: 5px 10px; border-radius: 4px; font-size: 12px;">' + stream.source + '</div>' +
                        '</div>');

                    elem.on('hover:enter', () => {
                        console.log('Playing:', stream.url);
                        Lampa.Player.play({
                            url: stream.url,
                            title: stream.title,
                            quality: { [stream.quality]: stream.url }
                        });
                    });

                    scroll.append(elem);
                });

                // Кнопка смены источника
                var switchBtn = $('<div class="selector" style="padding: 15px; margin: 10px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center; font-weight: bold;">' +
                    'Сменить источник (' + Object.keys(sources).length + ' доступно)' +
                    '</div>');

                switchBtn.on('hover:enter', () => {
                    this.switchSource();
                });

                scroll.append(switchBtn);
            };

            this.switchSource = function() {
                var sourceKeys = Object.keys(sources);
                var currentIndex = sourceKeys.indexOf(currentSource);
                currentSource = sourceKeys[(currentIndex + 1) % sourceKeys.length];
                
                console.log('Switching to source:', sources[currentSource].name);
                scroll.body().html(this.createLoadingTemplate());
                this.searchCurrentSource();
            };

            this.showError = function(message) {
                scroll.clear();
                var errorElem = $('<div style="padding: 40px 20px; text-align: center; color: #ff4444;">' +
                    '<div style="font-size: 18px; margin-bottom: 10px;">❌ ' + message + '</div>' +
                    '<div style="font-size: 14px;">Попробуйте сменить источник</div>' +
                    '</div>');
                
                var retryBtn = $('<div class="selector" style="padding: 15px; margin: 20px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center;">Попробовать другой источник</div>');
                retryBtn.on('hover:enter', () => {
                    this.switchSource();
                });

                scroll.append(errorElem);
                scroll.append(retryBtn);
            };

            this.pause = function() {};
            this.stop = function() {};
            
            this.destroy = function() {
                console.log('Androzon destroy');
                network.clear();
                scroll.destroy();
            };
        }

        // Регистрация плагина
        function registerPlugin() {
            console.log('Registering Androzon plugin...');

            // Регистрируем компонент
            Lampa.Component.add('androzon', component);

            // Создаем манифест плагина
            var manifest = {
                id: PluginConfig.id,
                name: PluginConfig.name,
                version: PluginConfig.version,
                type: 'video',
                component: 'androzon'
            };

            // Регистрируем плагин
            if (Lampa.Plugin && Lampa.Plugin.register) {
                Lampa.Plugin.register(manifest);
                console.log('Androzon plugin registered with Lampa.Plugin');
            }

            // Добавляем кнопку в карточки фильмов
            Lampa.Listener.follow('full', function(e) {
                if (e.type === 'complite') {
                    try {
                        var render = e.object.activity.render();
                        var movie = e.data.movie;
                        
                        // Удаляем старые кнопки
                        render.find('.androzon-button').remove();
                        
                        // Создаем новую кнопку
                        var btn = $('<div class="full-start__button selector view--online androzon-button" style="background: linear-gradient(45deg, #FF6B35, #FF8E53); margin: 5px; border-radius: 8px;">' +
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
                        var torrentBtn = render.find('.view--torrent');
                        if (torrentBtn.length) {
                            torrentBtn.after(btn);
                        } else {
                            render.find('.full-start__buttons').append(btn);
                        }

                        console.log('Androzon button added to card');
                    } catch (error) {
                        console.error('Error adding button:', error);
                    }
                }
            });

            console.log('Androzon plugin fully registered');
        }

        // Запускаем регистрацию когда Lampa готова
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', registerPlugin);
        } else {
            registerPlugin();
        }

    } catch (e) {
        console.error('Androzon plugin fatal error:', e);
    }
})();
