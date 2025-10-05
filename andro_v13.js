(function() {
    'use strict';

    console.log('🎬 Androzon plugin loading...');

    if (typeof Lampa === 'undefined') {
        console.error('Lampa not found');
        return;
    }

    // Конфигурация плагина
    var plugin = {
        id: 'androzon',
        name: 'Androzon',
        version: '1.0.0',
        type: 'video'
    };

    // Регистрируем плагин
    Lampa.Plugin.register(plugin);

    // Основной компонент
    function component(object) {
        var network = new Lampa.Request();
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var activity = object.activity;
        var movie = object.movie;
        var current_source = 'cineto';
        
        var sources = {
            'cineto': {
                name: 'Cine.to',
                icon: '🎥',
                search: function(title) {
                    return 'https://cine.to/movies?q=' + encodeURIComponent(title);
                }
            },
            'kinoger': {
                name: 'Kinoger', 
                icon: '🔍',
                search: function(title) {
                    return 'https://kinoger.com/stream/search/' + encodeURIComponent(title);
                }
            },
            'bsto': {
                name: 'BS.to',
                icon: '🇩🇪', 
                search: function(title) {
                    var clean = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                    return 'https://bs.to/serie/' + clean;
                }
            }
        };

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
            console.log('Androzon: initialize for', movie.title);
            
            scroll.body().addClass('torrent-list');
            
            this.show_header();
            this.show_loading();
            this.setup_navigation();
            
            // Автопоиск на выбранном источнике
            this.search_current_source();
        };

        this.show_header = function() {
            var header = $('<div class="choice__head" style="padding: 15px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                    '<div>' +
                        '<div class="choice__title" style="font-size: 20px; font-weight: bold;">Androzon</div>' +
                        '<div class="choice__subtitle" style="font-size: 12px; color: #aaa; margin-top: 5px;">' + (movie.title || movie.name) + '</div>' +
                    '</div>' +
                    '<div class="selector" style="padding: 8px 12px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px;">' +
                        sources[current_source].icon + ' ' + sources[current_source].name +
                    '</div>' +
                '</div>' +
            '</div>');

            header.find('.selector').on('hover:enter', this.switch_source.bind(this));
            
            scroll.append(header);
        };

        this.switch_source = function() {
            var keys = Object.keys(sources);
            var index = keys.indexOf(current_source);
            current_source = keys[(index + 1) % keys.length];
            
            scroll.clear();
            this.show_header();
            this.show_loading();
            this.search_current_source();
        };

        this.search_current_source = function() {
            var source = sources[current_source];
            var url = source.search(movie.title || movie.name);
            
            console.log('Androzon: searching on', source.name, url);
            
            network.native(url, this.parse_html.bind(this), this.show_error.bind(this));
        };

        this.parse_html = function(html) {
            console.log('Androzon: parsing HTML');
            
            // Создаем демо-результаты как в cinema.js
            var results = this.create_demo_results();
            this.display_results(results);
        };

        this.create_demo_results = function() {
            var source = sources[current_source];
            
            return [
                {
                    title: movie.title || 'Фильм',
                    year: movie.release_date ? movie.release_date.substring(0,4) : '2024',
                    voice: 'Немецкая',
                    quality: '1080p',
                    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                    source: source.name,
                    icon: source.icon,
                    info: source.name + ' • 1080p • Немецкая'
                },
                {
                    title: movie.title || 'Фильм', 
                    year: movie.release_date ? movie.release_date.substring(0,4) : '2024',
                    voice: 'Русская',
                    quality: '720p',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    source: source.name,
                    icon: source.icon,
                    info: source.name + ' • 720p • Русская'
                }
            ];
        };

        this.display_results = function(results) {
            scroll.clear();
            this.show_header();
            
            if (results.length === 0) {
                this.show_empty();
                return;
            }

            // Показываем результаты как в cinema.js
            results.forEach(function(item, index) {
                var card = this.create_result_card(item, index);
                scroll.append(card);
            }.bind(this));

            // Добавляем кнопку смены источника
            this.add_source_switch_button();
        };

        this.create_result_card = function(item, index) {
            // Создаем карточку как в cinema.js
            var card = $('<div class="online selector" style="margin: 10px 15px; padding: 0; background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">' +
                '<div style="display: flex; align-items: center; padding: 12px;">' +
                    '<div style="width: 80px; height: 60px; background: rgba(0,0,0,0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 24px;">' +
                        item.icon +
                    '</div>' +
                    '<div style="flex: 1;">' +
                        '<div style="font-size: 14px; font-weight: bold; margin-bottom: 4px; line-height: 1.2;">' + item.title + '</div>' +
                        '<div style="font-size: 11px; color: #aaa;">' + item.info + '</div>' +
                    '</div>' +
                    '<div style="background: rgba(255,107,53,0.2); padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">' + item.quality + '</div>' +
                '</div>' +
            '</div>');

            card.on('hover:enter', function() {
                this.play_video(item);
            }.bind(this));

            return card;
        };

        this.play_video = function(item) {
            console.log('Androzon: playing', item.url);
            
            Lampa.Player.play({
                url: item.url,
                title: item.title,
                source: item.source,
                quality: {'Auto': item.url}
            });
        };

        this.add_source_switch_button = function() {
            var switch_btn = $('<div class="selector" style="margin: 15px; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 14px; font-weight: bold;">' +
                '🔄 Сменить источник (' + Object.keys(sources).length + ' доступно)' +
            '</div>');

            switch_btn.on('hover:enter', this.switch_source.bind(this));
            
            scroll.append(switch_btn);
        };

        this.show_loading = function() {
            var loading = $('<div style="padding: 40px 20px; text-align: center;">' +
                '<div class="broadcast__scan" style="margin: 0 auto 20px auto;"><div></div></div>' +
                '<div style="color: #999; font-size: 14px;">Ищем на ' + sources[current_source].name + '...</div>' +
            '</div>');
            
            scroll.append(loading);
        };

        this.show_empty = function() {
            var empty = $('<div style="padding: 40px 20px; text-align: center; color: #999;">' +
                '<div style="font-size: 18px; margin-bottom: 10px;">Ничего не найдено</div>' +
                '<div style="font-size: 14px;">Попробуйте другой источник</div>' +
            '</div>');
            
            scroll.append(empty);
            this.add_source_switch_button();
        };

        this.show_error = function(error) {
            console.error('Androzon error:', error);
            
            var error_msg = $('<div style="padding: 40px 20px; text-align: center; color: #ff4444;">' +
                '<div style="font-size: 18px; margin-bottom: 10px;">Ошибка поиска</div>' +
                '<div style="font-size: 14px;">' + error + '</div>' +
            '</div>');
            
            scroll.clear();
            this.show_header();
            scroll.append(error_msg);
            this.add_source_switch_button();
        };

        this.setup_navigation = function() {
            Lampa.Controller.add('content', {
                toggle: function() {
                    Lampa.Controller.collectionSet(scroll.render());
                    var first = scroll.render().find('.selector').first()[0];
                    if (first) Lampa.Controller.collectionFocus(first, scroll.render());
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
            if (scroll.destroy) scroll.destroy();
        };
    }

    // Добавляем кнопку в карточки фильмов
    function add_androzon_button() {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite') {
                var render = e.object.activity.render();
                var movie = e.data.movie;
                
                // Удаляем старые кнопки
                render.find('.androzon-btn').remove();
                
                // Создаем кнопку как в cinema.js
                var btn = $('<div class="full-start__button selector view--online androzon-btn" style="background: linear-gradient(45deg, #FF6B35, #FF8E53); margin: 5px; border-radius: 8px;">' +
                    '<div style="display: flex; align-items: center; justify-content: center; padding: 12px 20px;">' +
                        '<span style="margin-right: 8px;">🎬</span>' +
                        '<span style="font-weight: bold;">Androzon</span>' +
                    '</div>' +
                '</div>');

                btn.on('hover:enter', function() {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Androzon',
                        component: 'androzon',
                        movie: movie,
                        page: 1
                    });
                });

                // Добавляем кнопку в стандартное место
                var buttons = render.find('.full-start__buttons');
                if (buttons.length) {
                    buttons.prepend(btn);
                }
            }
        });
    }

    // Инициализация плагина
    function init() {
        console.log('Androzon: initializing plugin');
        
        // Регистрируем компонент
        Lampa.Component.add('androzon', component);
        
        // Добавляем кнопку
        add_androzon_button();
        
        console.log('Androzon: plugin ready');
    }

    // Запускаем
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
