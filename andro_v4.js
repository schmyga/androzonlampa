(function() {
    'use strict';

    try {
        console.log('Androzon plugin starting...');

        if (typeof Lampa === 'undefined') {
            console.error('Lampa API not loaded');
            return;
        }

        // Простой парсер для извлечения видео ссылок
        function extractVideoUrl(html, source) {
            try {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');
                
                // Пытаемся найти iframe с видео
                var iframes = doc.querySelectorAll('iframe');
                for (var i = 0; i < iframes.length; i++) {
                    var src = iframes[i].src;
                    if (src && (src.includes('.m3u8') || src.includes('mp4') || src.includes('video') || src.includes('stream'))) {
                        return src;
                    }
                }

                // Ищем в скриптах
                var scripts = doc.querySelectorAll('script');
                for (var j = 0; j < scripts.length; j++) {
                    var scriptContent = scripts[j].textContent || scripts[j].innerHTML;
                    
                    // Ищем m3u8 ссылки
                    var m3u8Match = scriptContent.match(/(https?:\/\/[^\s'"]+\.m3u8[^\s'"]*)/);
                    if (m3u8Match) return m3u8Match[0];
                    
                    // Ищем mp4 ссылки
                    var mp4Match = scriptContent.match(/(https?:\/\/[^\s'"]+\.mp4[^\s'"]*)/);
                    if (mp4Match) return mp4Match[0];
                    
                    // Ищем общие видео ссылки
                    var videoMatch = scriptContent.match(/(https?:\/\/[^\s'"]*(?:video|stream|player)[^\s'"]*)/i);
                    if (videoMatch) return videoMatch[0];
                }

                // Для Kinoger ищем специальные структуры
                if (source === 'kinoger') {
                    var videoDivs = doc.querySelectorAll('[class*="video"], [id*="video"]');
                    for (var k = 0; k < videoDivs.length; k++) {
                        var htmlContent = videoDivs[k].innerHTML;
                        var urlMatch = htmlContent.match(/(https?:\/\/[^\s'"]+\.(?:m3u8|mp4)[^\s'"]*)/);
                        if (urlMatch) return urlMatch[0];
                    }
                }

                return null;
            } catch (e) {
                console.error('Parser error:', e);
                return null;
            }
        }

        // Основной компонент
        function component(object) {
            console.log('Androzon component created');
            
            var network = new Lampa.Request();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var movie = object.movie || {};
            var currentSource = null;

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
                console.log('Androzon initializing for movie:', movie.title || movie.name);
                
                scroll.body().addClass('torrent-list');
                this.showMainScreen();
                this.setupNavigation();
            };

            this.setupNavigation = function() {
                Lampa.Controller.add('content', {
                    toggle: () => {
                        Lampa.Controller.collectionSet(scroll.render());
                        var firstSelector = scroll.render().find('.selector').first()[0];
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
                    left: () => {
                        Lampa.Controller.toggle('menu');
                    },
                    back: () => {
                        Lampa.Activity.backward();
                    }
                });
                
                Lampa.Controller.toggle('content');
            };

            this.showMainScreen = function() {
                scroll.clear();
                
                // Заголовок
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">🎬 Androzon</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Поиск: ' + (movie.title || movie.name || 'фильм') + '</div>' +
                    '</div>');
                scroll.append(header);

                // Источники
                var sources = [
                    {
                        name: '🔍 Kinoger',
                        id: 'kinoger',
                        searchUrl: function(title) {
                            return 'https://kinoger.com/stream/search/' + encodeURIComponent(title);
                        },
                        color: '#FF6B35'
                    },
                    {
                        name: '🇩🇪 BS.to', 
                        id: 'bsto',
                        searchUrl: function(title) {
                            // BS.to требует точного названия на немецком, используем английское
                            var germanTitle = title.replace(/ /g, '-').toLowerCase();
                            return 'https://bs.to/serie/' + germanTitle;
                        },
                        color: '#4A90E2'
                    },
                    {
                        name: '🎥 Cine.to',
                        id: 'cineto', 
                        searchUrl: function(title) {
                            return 'https://cine.to/movies?q=' + encodeURIComponent(title);
                        },
                        color: '#50E3C2'
                    }
                ];

                sources.forEach(source => {
                    var sourceElement = $('<div class="selector" style="padding: 20px; margin: 15px; background: ' + source.color + '; border-radius: 12px; cursor: pointer;">' +
                        '<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">' + source.name + '</div>' +
                        '<div style="font-size: 12px; opacity: 0.9;">Нажмите для поиска</div>' +
                        '</div>');

                    sourceElement.on('hover:enter', () => {
                        this.searchOnSource(source);
                    });

                    scroll.append(sourceElement);
                });

                // Демо секция
                var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff;">📺 Тестовые потоки:</div>');
                scroll.append(demoHeader);

                var demoStreams = [
                    {
                        title: 'Тестовый HLS (Mux)',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        quality: '720p',
                        source: 'Demo'
                    },
                    {
                        title: 'Тестовый MP4 (Google)',
                        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        quality: '1080p',
                        source: 'Demo'
                    },
                    {
                        title: 'Тестовый HLS (Apple)',
                        url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
                        quality: '480p',
                        source: 'Demo'
                    }
                ];

                demoStreams.forEach(stream => {
                    var streamElement = $('<div class="selector" style="padding: 15px; margin: 10px 20px; background: rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer;">' +
                        '<div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">' + stream.title + '</div>' +
                        '<div style="font-size: 11px; color: #aaa;">' + stream.quality + ' • ' + stream.source + '</div>' +
                        '</div>');

                    streamElement.on('hover:enter', () => {
                        Lampa.Player.play({
                            url: stream.url,
                            title: stream.title,
                            quality: { [stream.quality]: stream.url }
                        });
                    });

                    scroll.append(streamElement);
                });
            };

            this.searchOnSource = function(source) {
                console.log('Searching on:', source.name);
                currentSource = source;
                
                scroll.clear();
                
                var loading = $('<div style="padding: 40px 20px; text-align: center;">' +
                    '<div class="broadcast__scan" style="margin: 20px auto;"><div></div></div>' +
                    '<div style="color: #999; font-size: 16px;">Ищем на ' + source.name + '...</div>' +
                    '</div>');
                scroll.append(loading);

                var searchTitle = movie.title || movie.name || 'film';
                var searchUrl = source.searchUrl(searchTitle);

                console.log('Search URL:', searchUrl);

                // Используем native для обхода CORS через Lampa
                network.native(searchUrl, (html) => {
                    if (html) {
                        this.processSearchResults(html, source);
                    } else {
                        this.showError('Не удалось загрузить страницу');
                    }
                }, (error) => {
                    console.error('Search error:', error);
                    this.showError('Ошибка сети: ' + error);
                });
            };

            this.processSearchResults = function(html, source) {
                console.log('Processing results from:', source.name);
                
                var videoUrl = extractVideoUrl(html, source.id);
                
                if (videoUrl) {
                    this.showVideoFound(videoUrl, source);
                } else {
                    // Если не нашли прямую ссылку, показываем найденные ссылки
                    this.showLinksFound(html, source);
                }
            };

            this.showVideoFound = function(videoUrl, source) {
                scroll.clear();
                
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">✅ Найдено!</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Источник: ' + source.name + '</div>' +
                    '</div>');
                scroll.append(header);

                var videoElement = $('<div class="selector" style="padding: 20px; margin: 20px; background: rgba(76, 175, 80, 0.2); border: 2px solid #4CAF50; border-radius: 12px; cursor: pointer;">' +
                    '<div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #4CAF50;">🎬 ' + (movie.title || movie.name) + '</div>' +
                    '<div style="font-size: 14px; color: #aaa; margin-bottom: 15px; word-break: break-all;">' + videoUrl.substring(0, 100) + '...</div>' +
                    '<div style="background: #4CAF50; color: white; padding: 10px 20px; border-radius: 6px; text-align: center; font-weight: bold;">▶ ВОСПРОИЗВЕСТИ</div>' +
                    '</div>');

                videoElement.on('hover:enter', () => {
                    Lampa.Player.play({
                        url: videoUrl,
                        title: movie.title || movie.name,
                        quality: { 'Auto': videoUrl }
                    });
                });

                scroll.append(videoElement);

                // Кнопка возврата
                var backButton = $('<div class="selector" style="padding: 15px; margin: 20px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center; font-weight: bold;">' +
                    '← Назад к источникам' +
                    '</div>');

                backButton.on('hover:enter', () => {
                    this.showMainScreen();
                });

                scroll.append(backButton);
            };

            this.showLinksFound = function(html, source) {
                scroll.clear();
                
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">🔗 Ссылки найдены</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Источник: ' + source.name + ' (нужен парсер)</div>' +
                    '</div>');
                scroll.append(header);

                var message = $('<div style="padding: 20px; text-align: center; color: #ffa726;">' +
                    '<div style="font-size: 16px; margin-bottom: 10px;">Найдены ссылки, но нужен специальный парсер</div>' +
                    '<div style="font-size: 14px; color: #aaa;">Для ' + source.name + ' требуется дополнительная обработка редиректов</div>' +
                    '</div>');
                scroll.append(message);

                // Показываем демо-потоки как альтернативу
                var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff;">🎯 Альтернатива - тестовые потоки:</div>');
                scroll.append(demoHeader);

                var demoStreams = [
                    {
                        title: 'Тестовый HLS поток',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        quality: '720p'
                    },
                    {
                        title: 'Тестовый MP4 поток', 
                        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        quality: '1080p'
                    }
                ];

                demoStreams.forEach(stream => {
                    var streamElement = $('<div class="selector" style="padding: 15px; margin: 10px 20px; background: rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer;">' +
                        '<div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">' + stream.title + '</div>' +
                        '<div style="font-size: 11px; color: #aaa;">Качество: ' + stream.quality + '</div>' +
                        '</div>');

                    streamElement.on('hover:enter', () => {
                        Lampa.Player.play({
                            url: stream.url,
                            title: stream.title,
                            quality: { [stream.quality]: stream.url }
                        });
                    });

                    scroll.append(streamElement);
                });

                var backButton = $('<div class="selector" style="padding: 15px; margin: 20px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center; font-weight: bold;">' +
                    '← Назад к источникам' +
                    '</div>');

                backButton.on('hover:enter', () => {
                    this.showMainScreen();
                });

                scroll.append(backButton);
            };

            this.showError = function(message) {
                scroll.clear();
                
                var errorElement = $('<div style="padding: 40px 20px; text-align: center; color: #f44336;">' +
                    '<div style="font-size: 24px; margin-bottom: 20px;">❌ Ошибка</div>' +
                    '<div style="font-size: 16px; margin-bottom: 30px;">' + message + '</div>' +
                    '</div>');
                scroll.append(errorElement);

                var retryButton = $('<div class="selector" style="padding: 15px; margin: 20px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center; font-weight: bold;">' +
                    '🔄 Попробовать другой источник' +
                    '</div>');

                retryButton.on('hover:enter', () => {
                    this.showMainScreen();
                });

                scroll.append(retryButton);
            };

            this.pause = function() {};
            this.stop = function() {};
            this.destroy = function() {
                network.clear();
                if (scroll && scroll.destroy) scroll.destroy();
            };
        }

        // Регистрация плагина
        function initAndrozon() {
            console.log('Initializing Androzon plugin...');

            // Регистрируем компонент
            Lampa.Component.add('androzon', component);
            console.log('Androzon component registered');

            // Добавляем кнопку в карточки фильмов
            Lampa.Listener.follow('full', function(e) {
                if (e.type === 'complite') {
                    try {
                        var render = e.object.activity.render();
                        var movie = e.data.movie;
                        
                        // Удаляем старые кнопки
                        render.find('.androzon-button').remove();
                        
                        // Создаем кнопку
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
                        var buttonsContainer = render.find('.full-start__buttons');
                        if (buttonsContainer.length) {
                            buttonsContainer.prepend(btn);
                        }

                        console.log('Androzon button added for:', movie.title);
                    } catch (error) {
                        console.error('Error adding button:', error);
                    }
                }
            });

            console.log('Androzon plugin ready!');
        }

        // Запускаем когда Lampa готова
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAndrozon);
        } else {
            initAndrozon();
        }

    } catch (error) {
        console.error('Androzon plugin fatal error:', error);
    }
})();
