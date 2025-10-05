(function() {
    'use strict';

    try {
        console.log('Androzon plugin starting...');

        if (typeof Lampa === 'undefined') {
            console.error('Lampa API not loaded');
            return;
        }

        // Улучшенный парсер для извлечения видео ссылок
        function extractVideoUrl(html, source) {
            try {
                console.log('Extracting video from:', source);
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');
                
                // 1. Ищем iframe с видео
                var iframes = doc.querySelectorAll('iframe');
                for (var i = 0; i < iframes.length; i++) {
                    var src = iframes[i].src;
                    if (src && (src.includes('.m3u8') || src.includes('mp4') || src.includes('video') || src.includes('stream'))) {
                        console.log('Found video iframe:', src);
                        return src;
                    }
                }

                // 2. Ищем в скриптах - основные шаблоны
                var scripts = doc.querySelectorAll('script');
                for (var j = 0; j < scripts.length; j++) {
                    var scriptContent = scripts[j].textContent || scripts[j].innerHTML;
                    
                    // Ищем различные паттерны видео ссылок
                    var patterns = [
                        /(https?:\/\/[^\s'"]+\.m3u8[^\s'"]*)/g,
                        /(https?:\/\/[^\s'"]+\.mp4[^\s'"]*)/g,
                        /(https?:\/\/[^\s'"]*\/video[^\s'"]*)/gi,
                        /(https?:\/\/[^\s'"]*\/stream[^\s'"]*)/gi,
                        /(https?:\/\/[^\s'"]*\/hls[^\s'"]*)/gi,
                        /file:\s*["'](https?:\/\/[^"']+)["']/g,
                        /src:\s*["'](https?:\/\/[^"']+)["']/g,
                        /url:\s*["'](https?:\/\/[^"']+)["']/g
                    ];

                    for (var p = 0; p < patterns.length; p++) {
                        var matches = scriptContent.match(patterns[p]);
                        if (matches) {
                            console.log('Found video in script:', matches[0]);
                            return matches[0];
                        }
                    }
                }

                // 3. Ищем в data-атрибутах
                var elementsWithData = doc.querySelectorAll('[data-url], [data-src], [data-file]');
                for (var k = 0; k < elementsWithData.length; k++) {
                    var url = elementsWithData[k].getAttribute('data-url') || 
                              elementsWithData[k].getAttribute('data-src') || 
                              elementsWithData[k].getAttribute('data-file');
                    if (url && url.includes('http')) {
                        console.log('Found video in data attribute:', url);
                        return url;
                    }
                }

                // 4. Для Kinoger - специальный поиск
                if (source === 'kinoger') {
                    var videoPlayers = doc.querySelectorAll('.video-player, [class*="player"], [id*="player"]');
                    for (var v = 0; v < videoPlayers.length; v++) {
                        var playerHtml = videoPlayers[v].innerHTML;
                        var urlMatch = playerHtml.match(/(https?:\/\/[^\s'"]+\.(?:m3u8|mp4)[^\s'"]*)/);
                        if (urlMatch) return urlMatch[0];
                    }
                }

                console.log('No video URL found');
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

            this.create = function() {
                console.log('Androzon create called');
                return this.render();
            };

            this.render = function() {
                console.log('Androzon render called');
                return scroll.render();
            };

            this.start = function() {
                console.log('Androzon start called');
                this.initialize();
            };

            this.initialize = function() {
                console.log('Androzon initializing...');
                
                scroll.body().addClass('torrent-list');
                this.showMainScreen();
                this.setupNavigation();
            };

            this.setupNavigation = function() {
                Lampa.Controller.add('content', {
                    toggle: () => {
                        console.log('Androzon toggle content');
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
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Выберите источник для поиска</div>' +
                    '</div>');
                scroll.append(header);

                // Источники
                var sources = [
                    {
                        name: '🔍 Kinoger.com',
                        id: 'kinoger',
                        searchUrl: function(title) {
                            return 'https://kinoger.com/stream/search/' + encodeURIComponent(title);
                        },
                        color: '#FF6B35',
                        description: 'Прямой поиск фильмов'
                    },
                    {
                        name: '🇩🇪 BS.to', 
                        id: 'bsto',
                        searchUrl: function(title) {
                            // BS.to работает лучше с английскими названиями
                            var cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                            return 'https://bs.to/serie/' + cleanTitle;
                        },
                        color: '#4A90E2',
                        description: 'Немецкие сериалы'
                    },
                    {
                        name: '🎥 Cine.to',
                        id: 'cineto', 
                        searchUrl: function(title) {
                            return 'https://cine.to/movies?q=' + encodeURIComponent(title);
                        },
                        color: '#50E3C2',
                        description: 'Фильмы и сериалы'
                    }
                ];

                sources.forEach(source => {
                    var sourceElement = $('<div class="selector" style="padding: 20px; margin: 15px; background: ' + source.color + '; border-radius: 12px; cursor: pointer;">' +
                        '<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">' + source.name + '</div>' +
                        '<div style="font-size: 12px; opacity: 0.9;">' + source.description + '</div>' +
                        '</div>');

                    sourceElement.on('hover:enter', () => {
                        this.searchOnSource(source);
                    });

                    scroll.append(sourceElement);
                });

                // Демо потоки
                var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff;">📺 Тестовые видео (гарантированно работают):</div>');
                scroll.append(demoHeader);

                var demoStreams = [
                    {
                        title: 'Тестовый HLS поток 720p',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        quality: '720p',
                        source: 'Mux Dev'
                    },
                    {
                        title: 'Big Buck Bunny (MP4)',
                        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        quality: '1080p',
                        source: 'Google'
                    },
                    {
                        title: 'Apple HLS пример',
                        url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
                        quality: '480p', 
                        source: 'Apple'
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
                console.log('Searching on source:', source.name);
                
                scroll.clear();
                
                var loading = $('<div style="padding: 40px 20px; text-align: center;">' +
                    '<div class="broadcast__scan" style="margin: 20px auto;"><div></div></div>' +
                    '<div style="color: #999; font-size: 16px;">Ищем "' + (movie.title || movie.name) + '" на ' + source.name + '...</div>' +
                    '</div>');
                scroll.append(loading);

                var searchTitle = movie.title || movie.name || 'film';
                var searchUrl = source.searchUrl(searchTitle);

                console.log('Fetching:', searchUrl);

                // Используем native для запроса
                network.native(searchUrl, (html) => {
                    console.log('Received HTML, length:', html.length);
                    if (html && html.length > 1000) {
                        this.processSearchResults(html, source);
                    } else {
                        this.showError('Страница не загрузилась или пустая');
                    }
                }, (error) => {
                    console.error('Network error:', error);
                    this.showError('Ошибка сети: ' + error);
                });
            };

            this.processSearchResults = function(html, source) {
                console.log('Processing HTML from', source.name);
                
                var videoUrl = extractVideoUrl(html, source.id);
                
                if (videoUrl) {
                    console.log('Video URL found:', videoUrl);
                    this.showVideoResult(videoUrl, source);
                } else {
                    console.log('No direct video URL found, showing links');
                    this.showLinksFromPage(html, source);
                }
            };

            this.showVideoResult = function(videoUrl, source) {
                scroll.clear();
                
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #4CAF50;">✅ Видео найдено!</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Источник: ' + source.name + '</div>' +
                    '</div>');
                scroll.append(header);

                var videoCard = $('<div class="selector" style="padding: 25px; margin: 20px; background: rgba(76, 175, 80, 0.2); border: 2px solid #4CAF50; border-radius: 12px; cursor: pointer;">' +
                    '<div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;">🎬 ' + (movie.title || movie.name) + '</div>' +
                    '<div style="font-size: 14px; color: #aaa; margin-bottom: 10px; word-break: break-all;">Ссылка: ' + videoUrl.substring(0, 80) + '...</div>' +
                    '<div style="font-size: 12px; color: #888; margin-bottom: 20px;">Качество: Auto • Источник: ' + source.name + '</div>' +
                    '<div style="background: #4CAF50; color: white; padding: 12px 25px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 16px;">▶ ЗАПУСТИТЬ ВИДЕО</div>' +
                    '</div>');

                videoCard.on('hover:enter', () => {
                    console.log('Playing video:', videoUrl);
                    Lampa.Player.play({
                        url: videoUrl,
                        title: movie.title || movie.name,
                        quality: { 'Auto': videoUrl }
                    });
                });

                scroll.append(videoCard);

                this.addBackButton();
            };

            this.showLinksFromPage = function(html, source) {
                scroll.clear();
                
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">🔗 Найдены ссылки</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">' + source.name + ' - требуется обработка редиректов</div>' +
                    '</div>');
                scroll.append(header);

                var info = $('<div style="padding: 20px; text-align: center; color: #ffa726;">' +
                    '<div style="font-size: 16px; margin-bottom: 10px;">Страница загружена успешно!</div>' +
                    '<div style="font-size: 14px; color: #aaa;">Для ' + source.name + ' нужен специальный парсер для обработки редиректов</div>' +
                    '</div>');
                scroll.append(info);

                // Всегда показываем демо потоки
                this.addDemoStreams();
                this.addBackButton();
            };

            this.addDemoStreams = function() {
                var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff;">🎯 Попробуйте тестовые видео:</div>');
                scroll.append(demoHeader);

                var demoStreams = [
                    {
                        title: 'HLS пример 720p',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        quality: '720p'
                    },
                    {
                        title: 'MP4 пример 1080p',
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
            };

            this.addBackButton = function() {
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

                this.addDemoStreams();
                this.addBackButton();
            };

            this.pause = function() {};
            this.stop = function() {};
            this.destroy = function() {
                network.clear();
                if (scroll && scroll.destroy) scroll.destroy();
            };
        }

        // Регистрация плагина с улучшенным добавлением кнопки
        function initAndrozon() {
            console.log('🚀 Initializing Androzon plugin...');

            // Регистрируем компонент
            Lampa.Component.add('androzon', component);
            console.log('✅ Androzon component registered');

            // Функция добавления кнопки в карточку
            function addAndrozonButton() {
                Lampa.Listener.follow('full', function(e) {
                    if (e.type === 'complite') {
                        try {
                            var activity = e.object.activity;
                            var render = activity.render();
                            var movie = e.data.movie;
                            
                            console.log('🎯 Adding button for movie:', movie.title);
                            
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
                                console.log('🎬 Androzon button clicked for:', movie.title);
                                Lampa.Activity.push({
                                    url: '',
                                    title: 'Androzon - ' + (movie.title || movie.name),
                                    component: 'androzon',
                                    movie: movie,
                                    page: 1
                                });
                            });

                            // Пробуем разные места для добавления кнопки
                            var torrentBtn = render.find('.view--torrent');
                            var playBtn = render.find('.button--play');
                            var buttonsContainer = render.find('.full-start__buttons');
                            
                            if (torrentBtn.length) {
                                torrentBtn.after(btn);
                                console.log('✅ Button added after torrent button');
                            } else if (playBtn.length) {
                                playBtn.after(btn);
                                console.log('✅ Button added after play button');
                            } else if (buttonsContainer.length) {
                                buttonsContainer.prepend(btn);
                                console.log('✅ Button added to buttons container');
                            } else {
                                // Если ничего не нашли, добавляем вручную
                                var cardActions = render.find('.full-actions, .full-start');
                                if (cardActions.length) {
                                    cardActions.prepend(btn);
                                    console.log('✅ Button added to card actions');
                                } else {
                                    console.log('❌ No suitable container found for button');
                                }
                            }

                        } catch (error) {
                            console.error('❌ Error adding button:', error);
                        }
                    }
                });
            }

            // Запускаем добавление кнопки
            addAndrozonButton();
            console.log('✅ Androzon plugin fully initialized');
        }

        // Запускаем когда страница загружена
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAndrozon);
        } else {
            initAndrozon();
        }

    } catch (error) {
        console.error('💥 Androzon plugin fatal error:', error);
    }
})();
