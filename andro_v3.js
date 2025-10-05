(function() {
    'use strict';

    try {
        console.log('Androzon plugin initialization started');

        if (typeof Lampa === 'undefined') {
            console.error('Lampa API not loaded');
            return;
        }

        // Конфигурация плагина
        var PluginConfig = {
            id: 'androzon',
            name: 'Androzon',
            version: '1.0.0',
            sources: ['kinoger', 'bsto', 'cineto']
        };

        // Основной компонент
        function component(object) {
            console.log('Androzon component created with object:', object);
            
            var network = new Lampa.Request();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var activity = object.activity;
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
                console.log('Androzon initialize called with movie:', movie);
                
                // Очищаем скролл
                scroll.clear();
                
                // Добавляем заголовок
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">Androzon Балансер</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Поиск на Kinoger, BS.to, Cine.to</div>' +
                    '</div>');
                
                scroll.append(header);
                
                // Добавляем индикатор загрузки
                var loading = $('<div style="padding: 40px 20px; text-align: center;">' +
                    '<div class="broadcast__scan" style="margin: 20px auto;"><div></div></div>' +
                    '<div style="color: #999; font-size: 16px;">Ищем "' + (movie.title || movie.name || 'фильм') + '"...</div>' +
                    '</div>');
                
                scroll.append(loading);
                
                // Настраиваем навигацию
                this.setupNavigation();
                
                // Запускаем поиск
                setTimeout(() => {
                    this.showSourcesSelection();
                }, 1000);
            };

            this.setupNavigation = function() {
                Lampa.Controller.add('content', {
                    toggle: () => {
                        console.log('Androzon content toggle');
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(scroll.render().find('.selector').first()[0] || scroll.render()[0], scroll.render());
                    },
                    up: () => {
                        if (Navigator.canmove('up')) {
                            Navigator.move('up');
                        } else {
                            Lampa.Controller.toggle('head');
                        }
                    },
                    down: () => {
                        if (Navigator.canmove('down')) {
                            Navigator.move('down');
                        }
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

            this.showSourcesSelection = function() {
                console.log('Showing sources selection');
                
                scroll.clear();
                
                // Заголовок
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">Androzon</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Выберите источник для поиска</div>' +
                    '</div>');
                
                scroll.append(header);
                
                // Источники
                var sources = [
                    {
                        name: 'Kinoger',
                        id: 'kinoger',
                        description: 'Фильмы и сериалы в HD качестве',
                        color: '#FF6B35'
                    },
                    {
                        name: 'BS.to', 
                        id: 'bsto',
                        description: 'Немецкий источник с сериалами',
                        color: '#4A90E2'
                    },
                    {
                        name: 'Cine.to',
                        id: 'cineto',
                        description: 'Фильмы и сериалы онлайн',
                        color: '#50E3C2'
                    }
                ];
                
                sources.forEach((source, index) => {
                    var sourceElement = $('<div class="selector" style="padding: 20px; margin: 15px; background: ' + source.color + '; border-radius: 12px; display: flex; align-items: center; cursor: pointer;">' +
                        '<div style="flex: 1;">' +
                        '<div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">' + source.name + '</div>' +
                        '<div style="font-size: 12px; opacity: 0.9;">' + source.description + '</div>' +
                        '</div>' +
                        '<div style="font-size: 24px;">→</div>' +
                        '</div>');
                    
                    sourceElement.on('hover:enter', () => {
                        console.log('Source selected:', source.name);
                        this.searchOnSource(source);
                    });
                    
                    scroll.append(sourceElement);
                });
                
                // Демо-потоки
                var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff;">Или выберите демо-поток:</div>');
                scroll.append(demoHeader);
                
                var demoStreams = [
                    {
                        title: 'Тестовый HLS поток (Mux)',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        quality: '720p',
                        source: 'Demo'
                    },
                    {
                        title: 'Тестовый MP4 поток',
                        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        quality: '1080p', 
                        source: 'Demo'
                    }
                ];
                
                demoStreams.forEach((stream, index) => {
                    var streamElement = $('<div class="selector" style="padding: 15px; margin: 10px 20px; background: rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center;">' +
                        '<div style="flex: 1;">' +
                        '<div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">' + stream.title + '</div>' +
                        '<div style="font-size: 11px; color: #aaa;">Качество: ' + stream.quality + ' • Источник: ' + stream.source + '</div>' +
                        '</div>' +
                        '<div style="background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px; font-size: 12px;">▶</div>' +
                        '</div>');
                    
                    streamElement.on('hover:enter', () => {
                        console.log('Playing demo stream:', stream.url);
                        Lampa.Player.play({
                            url: stream.url,
                            title: stream.title,
                            quality: { [stream.quality]: stream.url }
                        });
                    });
                    
                    scroll.append(streamElement);
                });
                
                Lampa.Controller.toggle('content');
            };

            this.searchOnSource = function(source) {
                console.log('Searching on source:', source.name);
                
                scroll.clear();
                
                var loading = $('<div style="padding: 40px 20px; text-align: center;">' +
                    '<div class="broadcast__scan" style="margin: 20px auto;"><div></div></div>' +
                    '<div style="color: #999; font-size: 16px;">Ищем на ' + source.name + '...</div>' +
                    '</div>');
                
                scroll.append(loading);
                
                // Имитируем поиск
                setTimeout(() => {
                    this.showSearchResults(source);
                }, 2000);
            };

            this.showSearchResults = function(source) {
                console.log('Showing results for:', source.name);
                
                scroll.clear();
                
                var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                    '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">' + source.name + '</div>' +
                    '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Найдено для: ' + (movie.title || movie.name || 'фильм') + '</div>' +
                    '</div>');
                
                scroll.append(header);
                
                // Демо-результаты
                var results = [
                    {
                        title: movie.title || movie.name || 'Фильм',
                        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                        quality: '720p',
                        source: source.name,
                        description: 'Основной поток'
                    },
                    {
                        title: (movie.title || movie.name || 'Фильм') + ' (Зеркало)',
                        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        quality: '1080p',
                        source: source.name,
                        description: 'Резервный поток'
                    }
                ];
                
                results.forEach((result, index) => {
                    var resultElement = $('<div class="selector" style="padding: 15px; margin: 15px; background: rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center;">' +
                        '<div style="width: 60px; height: 40px; background: ' + source.color + '; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 12px; font-weight: bold;">' + 
                        source.name.substring(0, 3) + 
                        '</div>' +
                        '<div style="flex: 1;">' +
                        '<div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">' + result.title + '</div>' +
                        '<div style="font-size: 12px; color: #aaa;">' + result.description + ' • ' + result.quality + '</div>' +
                        '</div>' +
                        '<div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: bold;">▶ Воспр.</div>' +
                        '</div>');
                    
                    resultElement.on('hover:enter', () => {
                        console.log('Playing:', result.url);
                        Lampa.Player.play({
                            url: result.url,
                            title: result.title,
                            quality: { [result.quality]: result.url }
                        });
                    });
                    
                    scroll.append(resultElement);
                });
                
                // Кнопка возврата
                var backButton = $('<div class="selector" style="padding: 15px; margin: 20px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center; font-weight: bold;">' +
                    '← Вернуться к выбору источников' +
                    '</div>');
                
                backButton.on('hover:enter', () => {
                    this.showSourcesSelection();
                });
                
                scroll.append(backButton);
                
                Lampa.Controller.toggle('content');
            };

            this.pause = function() {
                console.log('Androzon pause');
            };

            this.stop = function() {
                console.log('Androzon stop');
            };

            this.destroy = function() {
                console.log('Androzon destroy');
                network.clear();
                if (scroll && scroll.destroy) scroll.destroy();
            };
        }

        // Регистрация плагина
        function initPlugin() {
            console.log('Initializing Androzon plugin...');
            
            // Регистрируем компонент
            Lampa.Component.add('androzon', component);
            console.log('Androzon component registered');
            
            // Добавляем кнопку в карточки
            function addAndrozonButton() {
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
                                console.log('Androzon button pressed for movie:', movie);
                                Lampa.Activity.push({
                                    url: '',
                                    title: 'Androzon - ' + (movie.title || movie.name),
                                    component: 'androzon',
                                    movie: movie,
                                    page: 1
                                });
                            });
                            
                            // Добавляем кнопку рядом с другими
                            var torrentBtn = render.find('.view--torrent');
                            if (torrentBtn.length) {
                                torrentBtn.after(btn);
                            } else {
                                var buttonsContainer = render.find('.full-start__buttons');
                                if (buttonsContainer.length) {
                                    buttonsContainer.append(btn);
                                }
                            }
                            
                            console.log('Androzon button added to movie card');
                        } catch (error) {
                            console.error('Error adding Androzon button:', error);
                        }
                    }
                });
            }
            
            addAndrozonButton();
            console.log('Androzon plugin fully initialized');
        }

        // Запускаем инициализацию
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPlugin);
        } else {
            initPlugin();
        }

    } catch (error) {
        console.error('Androzon plugin error:', error);
    }
})();
