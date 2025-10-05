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
            localhost: 'https://your-proxy-server.com/', // Нужен прокси сервер для обхода CORS
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
                        return 'https://bs.to/search?q=' + encodeURIComponent(title);
                    },
                    parser: 'bsto'
                },
                cineto: {
                    name: 'Cine.to',
                    baseUrl: 'https://cine.to',
                    search: function(title) {
                        return 'https://cine.to/search?q=' + encodeURIComponent(title);
                    },
                    parser: 'cineto'
                }
            }
        };

        // Основной компонент балансера
        function component(object) {
            var network = new Lampa.Request();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var files = new Lampa.Explorer(object);
            var filter = new Lampa.Filter(object);
            var sources = PluginConfig.sources;
            var currentSource = 'kinoger';
            var results = [];
            var initialized = false;
            var balanser_timer;
            var images = [];
            var filter_sources = Object.keys(sources);
            var filter_find = {
                season: [],
                voice: []
            };

            this.initialize = function() {
                console.log('Androzon initialize');
                this.loading(true);
                
                filter.onSearch = function(value) {
                    Lampa.Activity.replace({
                        search: value,
                        clarification: true
                    });
                };
                
                filter.onBack = function() {
                    Lampa.Activity.back();
                };

                filter.render().find('.filter--sort span').text(Lampa.Lang.translate('androzon_balanser'));
                scroll.body().addClass('torrent-list');
                files.appendFiles(scroll.render());
                files.appendHead(filter.render());
                scroll.minus(files.render().find('.explorer__files-head'));
                scroll.body().append(Lampa.Template.get('androzon_content_loading'));
                Lampa.Controller.enable('content');
                
                this.loading(false);
                this.start();
            }.bind(this);

            this.start = function() {
                if (Lampa.Activity.active().activity !== this.activity) return;
                
                if (!initialized) {
                    initialized = true;
                    this.initialize();
                }

                Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));
                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(scroll.render(), files.render());
                        Lampa.Controller.collectionFocus(scroll.render().find('.selector').first()[0] || false, scroll.render());
                    },
                    gone: function() {
                        clearTimeout(balanser_timer);
                    },
                    up: function() {
                        if (Navigator.canmove('up')) Navigator.move('up');
                        else Lampa.Controller.toggle('head');
                    },
                    down: function() {
                        Navigator.move('down');
                    },
                    right: function() {
                        if (Navigator.canmove('right')) Navigator.move('right');
                        else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
                    },
                    left: function() {
                        if (Navigator.canmove('left')) Navigator.move('left');
                        else Lampa.Controller.toggle('menu');
                    },
                    back: this.back.bind(this)
                });
                
                Lampa.Controller.toggle('content');
                this.searchCurrentSource();
            }.bind(this);

            this.searchCurrentSource = function() {
                var source = sources[currentSource];
                var searchUrl = this.buildSearchUrl(source);
                
                console.log('Androzon searching on', source.name, ':', searchUrl);
                
                network.timeout(15000);
                network.silent(searchUrl, function(html) {
                    if (!html) {
                        this.showError('Пустой ответ от ' + source.name);
                        return;
                    }
                    
                    var streams = this.parseSource(html, source.parser);
                    if (streams && streams.length > 0) {
                        this.results = streams;
                        this.displayResults();
                    } else {
                        this.showError('Фильм не найден на ' + source.name);
                    }
                }.bind(this), function(error) {
                    console.error('Search error on', source.name, ':', error);
                    this.showError('Ошибка подключения к ' + source.name);
                }.bind(this));
            }.bind(this);

            this.buildSearchUrl = function(source) {
                var movie = object.movie;
                var searchTitle = object.clarification ? object.search : movie.title || movie.name;
                
                // Базовый URL поиска
                var url = source.search(searchTitle);
                
                // Добавляем параметры для улучшения поиска
                if (movie.year) {
                    url += (url.includes('?') ? '&' : '?') + 'year=' + movie.year;
                }
                
                return url;
            };

            this.parseSource = function(html, parserType) {
                var streams = [];
                
                try {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');

                    switch(parserType) {
                        case 'kinoger':
                            streams = this.parseKinoger(doc);
                            break;
                        case 'bsto':
                            streams = this.parseBS(doc);
                            break;
                        case 'cineto':
                            streams = this.parseCineTo(doc);
                            break;
                    }
                } catch (e) {
                    console.error('Parser error:', e);
                }
                
                return streams;
            };

            this.parseKinoger = function(doc) {
                var streams = [];
                var movie = object.movie;
                
                // Поиск iframe с видео
                var iframes = doc.querySelectorAll('iframe[src*=".m3u8"], iframe[src*="mp4"], iframe[src*="video"]');
                iframes.forEach(function(iframe, index) {
                    if (iframe.src) {
                        streams.push({
                            title: movie.title + ' (HLS ' + (index + 1) + ')',
                            url: iframe.src,
                            quality: 'Auto',
                            direct: true,
                            source: 'Kinoger'
                        });
                    }
                });

                // Поиск в скриптах для m3u8
                if (streams.length === 0) {
                    var scripts = doc.querySelectorAll('script');
                    scripts.forEach(function(script) {
                        var content = script.textContent;
                        if (content.includes('.m3u8')) {
                            var matches = content.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/g);
                            if (matches) {
                                matches.forEach(function(match, index) {
                                    streams.push({
                                        title: movie.title + ' (HLS ' + (index + 1) + ')',
                                        url: match,
                                        quality: 'Auto',
                                        direct: true,
                                        source: 'Kinoger'
                                    });
                                });
                            }
                        }
                    });
                }

                // Поиск ссылок на видео
                var videoLinks = doc.querySelectorAll('a[href*="watch"], a[href*="video"], a[href*="stream"]');
                videoLinks.forEach(function(link, index) {
                    if (link.href && streams.length < 10) {
                        streams.push({
                            title: link.textContent.trim() || movie.title + ' (Link ' + (index + 1) + ')',
                            url: link.href,
                            quality: 'HD',
                            direct: false,
                            source: 'Kinoger'
                        });
                    }
                });

                return streams.slice(0, 5); // Ограничиваем количество результатов
            };

            this.parseBS = function(doc) {
                var streams = [];
                var movie = object.movie;
                
                // Поиск серий для сериалов
                var episodes = doc.querySelectorAll('.episode-list li a, .season-episodes a, [href*="/serie/"]');
                episodes.forEach(function(episode, index) {
                    if (episode.href) {
                        var title = episode.textContent.trim() || 
                                   episode.getAttribute('title') || 
                                   movie.title + ' (BS ' + (index + 1) + ')';
                        
                        streams.push({
                            title: title,
                            url: episode.href,
                            quality: 'HD',
                            direct: false,
                            source: 'BS.to'
                        });
                    }
                });

                // Поиск фильмов
                var movies = doc.querySelectorAll('.movie-item a, .film-link, [href*="/film/"]');
                movies.forEach(function(movieLink, index) {
                    if (movieLink.href && streams.length < 10) {
                        streams.push({
                            title: movieLink.textContent.trim() || movie.title + ' (Movie ' + (index + 1) + ')',
                            url: movieLink.href,
                            quality: 'HD',
                            direct: false,
                            source: 'BS.to'
                        });
                    }
                });

                return streams.slice(0, 5);
            };

            this.parseCineTo = function(doc) {
                var streams = [];
                var movie = object.movie;
                
                // Поиск карточек фильмов/сериалов
                var cards = doc.querySelectorAll('.movie-item, .film-card, .item, [data-id]');
                cards.forEach(function(card, index) {
                    var link = card.querySelector('a');
                    var titleElem = card.querySelector('.title, .name, h3, h4') || link;
                    
                    if (link && link.href) {
                        var title = titleElem ? titleElem.textContent.trim() : movie.title + ' (Cine ' + (index + 1) + ')';
                        
                        streams.push({
                            title: title,
                            url: link.href,
                            quality: 'HD',
                            direct: false,
                            source: 'Cine.to'
                        });
                    }
                });

                // Поиск прямых ссылок на видео
                var videoPlayers = doc.querySelectorAll('[data-player], [data-url], [data-src]');
                videoPlayers.forEach(function(player, index) {
                    var url = player.getAttribute('data-url') || 
                              player.getAttribute('data-src') || 
                              player.getAttribute('data-player');
                    
                    if (url && (url.includes('.m3u8') || url.includes('mp4') || url.includes('video'))) {
                        streams.push({
                            title: movie.title + ' (Direct ' + (index + 1) + ')',
                            url: url,
                            quality: 'Auto',
                            direct: true,
                            source: 'Cine.to'
                        });
                    }
                });

                return streams.slice(0, 5);
            };

            this.displayResults = function() {
                scroll.clear();
                
                if (this.results.length > 0) {
                    // Добавляем заголовок с переключателем источников
                    this.addSourceHeader();
                    
                    this.results.forEach(function(item, index) {
                        var templateData = {
                            title: item.title,
                            url: item.url,
                            quality: item.quality,
                            description: 'Источник: ' + item.source
                        };
                        
                        var elem = Lampa.Template.get('online', templateData);
                        if (elem) {
                            // Добавляем бейдж с источником
                            var sourceBadge = $('<div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; z-index: 10;">' + item.source + '</div>');
                            elem.find('.online__poster').append(sourceBadge);
                            
                            elem.on('hover:enter', function() {
                                console.log('Androzon playing from', item.source, ':', item.url);
                                
                                if (item.direct) {
                                    // Прямой запуск для HLS/m3u8
                                    Lampa.Player.play({
                                        url: item.url,
                                        title: object.movie.title,
                                        quality: { 
                                            [item.quality]: item.url 
                                        }
                                    });
                                } else {
                                    // Для ссылок открываем детальную страницу
                                    Lampa.Activity.push({
                                        url: item.url,
                                        title: item.title,
                                        component: 'androzon',
                                        movie: object.movie,
                                        page: 1,
                                        source: item.source
                                    });
                                }
                            });
                            
                            scroll.append(elem);
                        }
                    });
                } else {
                    this.showError('Нет доступных потоков');
                }
                
                Lampa.Controller.enable('content');
            }.bind(this);

            this.addSourceHeader = function() {
                var header = $('<div class="choice__head" style="padding: 15px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px;">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">' +
                    '<div style="flex: 1;">' +
                    '<div class="choice__title" style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">Androzon Балансер</div>' +
                    '<div class="choice__subtitle" style="font-size: 12px; color: #aaa;">Текущий источник: ' + sources[currentSource].name + '</div>' +
                    '</div>' +
                    '<div class="source-selector" style="display: flex; align-items: center; gap: 10px;">' +
                    '<div class="selector source-switch" style="padding: 8px 12px; background: rgba(255,255,255,0.1); border-radius: 6px; min-width: 120px; text-align: center;">' +
                    'Сменить источник' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>');

                // Обработчик переключения источников
                header.find('.source-switch').on('hover:enter', function() {
                    var sourceKeys = Object.keys(sources);
                    var currentIndex = sourceKeys.indexOf(currentSource);
                    currentSource = sourceKeys[(currentIndex + 1) % sourceKeys.length];
                    
                    header.find('.choice__subtitle').text('Текущий источник: ' + sources[currentSource].name);
                    console.log('Androzon switched to source:', sources[currentSource].name);
                    
                    // Показываем загрузку и ищем заново
                    scroll.body().html(Lampa.Template.get('androzon_content_loading'));
                    this.searchCurrentSource();
                }.bind(this));

                scroll.body().before(header);
            }.bind(this);

            this.showError = function(message) {
                scroll.clear();
                var errorElem = $('<div class="selector" style="padding: 40px 20px; text-align: center; color: #ff4444;">' +
                    '<div>❌ ' + message + '</div>' +
                    '<div style="font-size: 12px; margin-top: 10px;">Попробуйте сменить источник</div>' +
                    '</div>');
                scroll.append(errorElem);
                Lampa.Noty.show(message);
            }.bind(this);

            this.loading = function(status) {
                if (status) this.activity.loader(true);
                else {
                    this.activity.loader(false);
                    this.activity.toggle();
                }
            }.bind(this);

            this.reset = function() {
                clearTimeout(balanser_timer);
                network.clear();
                this.clearImages();
                scroll.clear();
                scroll.body().append(Lampa.Template.get('androzon_content_loading'));
            }.bind(this);

            this.clearImages = function() {
                images.forEach(function(img) {
                    img.onerror = function() {};
                    img.onload = function() {};
                    img.src = '';
                });
                images = [];
            };

            this.back = function() {
                Lampa.Activity.backward();
            };

            this.destroy = function() {
                console.log('Androzon destroyed');
                network.clear();
                this.clearImages();
                files.destroy();
                scroll.destroy();
                clearTimeout(balanser_timer);
            };

            // Автоматический старт
            this.start();
        }

        // Функция для добавления поискового источника
        function addSearchSource(sourceName, sourceConfig) {
            var network = new Lampa.Request();

            var source = {
                title: sourceName,
                search: function(params, oncomplite) {
                    var searchUrl = sourceConfig.search(params.query);
                    
                    network.timeout(10000);
                    network.silent(searchUrl, function(html) {
                        try {
                            var parser = new DOMParser();
                            var doc = parser.parseFromString(html, 'text/html');
                            var results = [];

                            // Парсим результаты поиска
                            var items = doc.querySelectorAll('.movie-item, .film-card, .search-result, [data-id]');
                            items.forEach(function(item) {
                                var link = item.querySelector('a');
                                var titleElem = item.querySelector('.title, .name, h3') || link;
                                var imgElem = item.querySelector('img');
                                
                                if (link && link.href) {
                                    var card = {
                                        title: titleElem ? titleElem.textContent.trim() : 'Неизвестно',
                                        url: link.href,
                                        release_date: '0000',
                                        balanser: sourceConfig.parser,
                                        source: sourceName
                                    };

                                    if (imgElem && imgElem.src) {
                                        card.img = imgElem.src;
                                    }

                                    results.push(card);
                                }
                            });

                            if (results.length > 0) {
                                oncomplite([{
                                    title: sourceName + ' - ' + params.query,
                                    results: results.slice(0, 10) // Ограничиваем результаты
                                }]);
                            } else {
                                oncomplite([]);
                            }
                        } catch (e) {
                            console.error('Search parse error:', e);
                            oncomplite([]);
                        }
                    }, function() {
                        oncomplite([]);
                    });
                },
                onCancel: function() {
                    network.clear();
                },
                params: {
                    lazy: true,
                    align_left: true
                },
                onSelect: function(params, close) {
                    close();
                    Lampa.Activity.push({
                        url: params.element.url,
                        title: 'Androzon - ' + params.element.title,
                        component: 'androzon',
                        movie: params.element,
                        page: 1,
                        search: params.element.title,
                        clarification: true,
                        source: sourceName
                    });
                }
            };

            Lampa.Search.addSource(source);
        }

        // Запуск плагина
        function startPlugin() {
            window.androzon_plugin = true;

            // Регистрируем компонент
            Lampa.Component.add('androzon', component);

            // Добавляем поисковые источники
            addSearchSource('Kinoger', PluginConfig.sources.kinoger);
            addSearchSource('BS.to', PluginConfig.sources.bsto);
            addSearchSource('Cine.to', PluginConfig.sources.cineto);

            // Добавляем переводы
            Lampa.Lang.add({
                androzon_watch: {
                    ru: 'Смотреть в Androzon',
                    en: 'Watch in Androzon',
                    uk: 'Дивитися в Androzon'
                },
                androzon_balanser: {
                    ru: 'Балансер Androzon',
                    en: 'Androzon Balancer',
                    uk: 'Балансер Androzon'
                },
                androzon_title: {
                    ru: 'Androzon - Онлайн',
                    en: 'Androzon - Online',
                    uk: 'Androzon - Онлайн'
                }
            });

            // Добавляем CSS стили
            Lampa.Template.add('androzon_css', `
                <style>
                .androzon-source-badge {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0,0,0,0.8);
                    color: #fff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    z-index: 10;
                }
                .androzon-header {
                    padding: 15px;
                    background: rgba(0,0,0,0.3);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    margin-bottom: 15px;
                }
                .androzon-button {
                    background: linear-gradient(45deg, #FF6B35, #FF8E53);
                    margin: 5px;
                    border-radius: 8px;
                }
                </style>
            `);
            $('body').append(Lampa.Template.get('androzon_css', {}, true));

            // Шаблон загрузки
            Lampa.Template.add('androzon_content_loading', `
                <div class="online-empty">
                    <div class="broadcast__scan"><div></div></div>
                    <div style="text-align: center; padding: 40px 20px; color: #999;">
                        <div>Androzon ищет на ${PluginConfig.sources.kinoger.name}, ${PluginConfig.sources.bsto.name}, ${PluginConfig.sources.cineto.name}...</div>
                    </div>
                </div>
            `);

            // Добавляем кнопку в карточку фильма
            function addButtonToCard(render, movie) {
                if (render.find('.androzon-button').length) return;

                var btn = $(`
                    <div class="full-start__button selector view--online androzon-button">
                        <div style="display: flex; align-items: center; justify-content: center; padding: 12px 20px;">
                            <span style="margin-right: 8px;">🎬</span>
                            <span style="font-weight: bold;">Androzon</span>
                        </div>
                    </div>
                `);

                btn.on('hover:enter', function() {
                    if (!movie) {
                        Lampa.Noty.show('Ошибка: данные фильма не загружены');
                        return;
                    }

                    Lampa.Activity.push({
                        url: '',
                        title: 'Androzon - ' + (movie.title || 'Фильм'),
                        component: 'androzon',
                        movie: movie,
                        page: 1
                    });
                });

                // Добавляем кнопку в контейнер
                var buttonsContainer = render.find('.full-start__buttons');
                if (buttonsContainer.length) {
                    buttonsContainer.prepend(btn);
                }
            }

            // Слушатель для добавления кнопки в карточки
            Lampa.Listener.follow('full', function(e) {
                if (e.type == 'complite') {
                    try {
                        var activityRender = e.object.activity.render();
                        
                        if (Lampa.Storage.get('card_interfice_type') === 'new') {
                            addButtonToCard(activityRender.find('.button--play'), e.data.movie);
                        } else {
                            addButtonToCard(activityRender.find('.view--torrent'), e.data.movie);
                        }
                    } catch (error) {
                        console.error('Error adding Androzon button:', error);
                    }
                }
            });

            console.log('Androzon plugin successfully registered');
        }

        // Запускаем плагин
        if (!window.androzon_plugin) startPlugin();

    } catch (e) {
        console.error('Androzon plugin fatal error:', e);
    }
})();
