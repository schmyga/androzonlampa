(function() {
    'use strict';

    try {
        console.log('SerPlay plugin started at ' + new Date().toLocaleTimeString());

        if (typeof Lampa === 'undefined') {
            console.error('Lampa API not loaded at ' + new Date().toLocaleTimeString());
            return;
        }

        // Компонент для choice-view (выбор балансера: Kinoger и Cine.to)
        function component(object) {
            var network = new Lampa.Reguest();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var filter = new Lampa.Filter(object);
            var movie = object.movie; // Данные фильма из full-view
            var balanser = 'kinoger'; // Дефолтный балансер
            var choice = { source: 0 }; // 0 = Kinoger, 1 = Cine.to

            this.start = function() {
                console.log('SerPlay start at ' + new Date().toLocaleTimeString());
                filter.onSearch = function(value) {
                    Lampa.Activity.replace({ search: value, clarification: true });
                }.bind(this);
                filter.onBack = function() {
                    Lampa.Activity.back();
                }.bind(this);
                filter.onSelect = function(type, a, b) {
                    if (type == 'filter') {
                        if (a.reset) {
                            this.reset();
                        } else {
                            choice[a.stype] = b.index;
                            balanser = choice.source === 0 ? 'kinoger' : 'cine';
                            console.log('Selected balanser:', balanser);
                            this.reset(); // Перезапуск поиска с новым балансером
                        }
                    }
                }.bind(this);

                // Добавление фильтра для выбора балансера
                filter.add('source', {
                    title: 'Балансер',
                    stype: 'source',
                    data: [
                        { title: 'Kinoger', value: 0 },
                        { title: 'Cine.to', value: 1 }
                    ]
                });

                filter.render().find('.filter--sort span').text('Выбор балансера');
                scroll.body().addClass('torrent-list');
                Lampa.Controller.enable('content');
                this.searchMovie();
            }.bind(this);

            this.initialize = function() {
                console.log('SerPlay initialize at ' + new Date().toLocaleTimeString());
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));
                this.start();
            }.bind(this);

            this.searchMovie = function() {
                var search_url = balanser === 'kinoger' ? 'https://kinoger.com/stream/search/' + encodeURIComponent(movie.title) : 'https://cine.to/search/' + encodeURIComponent(movie.title);
                console.log('Searching movie on ' + balanser + ':', search_url);

                network.silent(search_url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Referer': balanser === 'kinoger' ? 'https://kinoger.com/' : 'https://cine.to/'
                    }
                }, function(html) {
                    this.extractStream(html);
                    this.append();
                }.bind(this), function(error) {
                    console.error('Search error on ' + balanser + ':', error);
                    Lampa.Noty.show('Фильм не найден на ' + balanser + ' (403 — попробуйте позже).');
                    this.reset();
                }.bind(this));
            }.bind(this);

            this.extractStream = function(html) {
                var video_url = '';
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');

                var iframe = doc.querySelector('iframe[src*=".m3u8"]');
                if (iframe) video_url = iframe.src;

                if (!video_url) {
                    var scripts = doc.querySelectorAll('script');
                    scripts.forEach(function(script) {
                        var content = script.textContent;
                        if (content.includes('.m3u8')) {
                            var match = content.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/);
                            if (match) video_url = match[0];
                        }
                    });
                }

                if (video_url) {
                    object.results = [{
                        title: movie.title,
                        url: video_url,
                        quality: 'Auto',
                        direct: true
                    }];
                } else {
                    object.results = [];
                    Lampa.Noty.show('HLS-поток не найден на ' + balanser + '.');
                }
                console.log('Stream extracted, URL:', video_url);
            }.bind(this);

            this.append = function() {
                scroll.clear();
                if (object.results && object.results.length) {
                    object.results.forEach(function(item) {
                        var elem = Lampa.Template.get('online_modal', item);
                        elem.on('hover:enter', function() {
                            Lampa.Player.play({
                                url: item.url,
                                title: item.title,
                                quality: { 'Auto': item.url }
                            });
                        });
                        scroll.append(elem);
                    });
                } else {
                    scroll.append('<div>Файл не найден</div>');
                }
            }.bind(this);

            this.reset = function() {
                console.log('SerPlay reset at ' + new Date().toLocaleTimeString());
                scroll.clear();
                if (filter && typeof filter.reset === 'function') filter.reset();
                this.searchMovie(); // Перезапуск поиска после смены балансера
            }.bind(this);

            this.destroy = function() {
                console.log('SerPlay destroyed at ' + new Date().toLocaleTimeString());
                if (scroll && typeof scroll.destroy === 'function') scroll.destroy();
                if (filter && typeof filter.destroy === 'function') filter.destroy();
                Lampa.Controller.toggle('content');
            }.bind(this);
        }

        Lampa.Component.add('serplay_kinoger', component);

        // Добавление кнопки "SerPlay" в full-view (карточка с описанием фильма)
        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                // Удаляем дефолтную кнопку "Смотреть", чтобы избежать конфликта
                e.object.activity.render().find('.full-start__button.view--online').remove();

                var btn = $('<div class="full-start__button selector view--online serplay--button"><span>SerPlay</span></div>');
                btn.on('hover:enter', function() {
                    Lampa.Activity.push({
                        url: '',
                        title: 'SerPlay Kinoger',
                        component: 'serplay_kinoger',
                        movie: e.data.movie,
                        page: 1
                    });
                });
                e.object.activity.render().find('.view--torrent').after(btn);
                console.log('SerPlay button added in full-view at ' + new Date().toLocaleTimeString());
            }
        });

        console.log('SerPlay Kinoger plugin registered at ' + new Date().toLocaleTimeString());

    } catch (e) {
        console.error('SerPlay Kinoger plugin error at ' + new Date().toLocaleTimeString() + ':', e);
    }
})();
