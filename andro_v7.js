(function () {
    'use strict';

    function AndrozonComponent(movie) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var sources = [
            { name: 'Kinoger', url: 'https://kinoger.com/index.php?do=search&subaction=search&story=', id: 'kinoger' },
            { name: 'BS.to', url: 'https://bs.to/?q=', id: 'bs' },
            { name: 'Cine.to', url: 'https://cine.to/?q=', id: 'cine' }
        ];

        this.start = function () {
            this.initialize();
        };

        this.initialize = function () {
            this.showMainScreen();
        };

        this.showMainScreen = function () {
            scroll.clear();

            var header = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🔍 Выберите источник</div>' +
                '<div class="choice__subtitle">Поиск для: ' + (movie.title || movie.name) + '</div>' +
                '</div>');
            scroll.append(header);

            sources.forEach(source => {
                var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.1); border-radius:8px; cursor:pointer;">' +
                    '<div style="font-size:14px; font-weight:bold;">' + source.name + '</div>' +
                    '<div style="font-size:11px; color:#aaa;">' + source.url + '</div>' +
                    '</div>');

                item.on('hover:enter', () => {
                    this.searchOnSource(source);
                });

                scroll.append(item);
            });

            this.addBackButton();
        };

        this.searchOnSource = function (source) {
            var query = encodeURIComponent(movie.title || movie.name);
            var searchUrl = source.url + query;

            Lampa.Noty.show('Поиск на ' + source.name + '...');

            network.native(searchUrl, (html) => {
                this.processSearchResults(html, source);
            }, (a, c) => {
                Lampa.Noty.show('Ошибка загрузки: ' + source.name);
            }, false, { dataType: 'text' });
        };

        this.processSearchResults = function (html, source) {
            var videoUrls = extractVideoUrls(html, source.id);

            if (Array.isArray(videoUrls) && videoUrls.length > 1) {
                this.showBalancerList(videoUrls, source);
            } else if (Array.isArray(videoUrls) && videoUrls.length === 1) {
                this.showVideoResult(videoUrls[0], source);
            } else {
                this.showLinksFromPage(html, source);
            }
        };

        this.showBalancerList = function (videoUrls, source) {
            scroll.clear();

            var header = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🎛 Выберите балансер</div>' +
                '<div class="choice__subtitle">' + source.name + '</div>' +
                '</div>');
            scroll.append(header);

            videoUrls.forEach((url, i) => {
                var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.1); border-radius:8px; cursor:pointer;">' +
                    '<div style="font-size:14px; font-weight:bold;">Балансер ' + (i + 1) + '</div>' +
                    '<div style="font-size:11px; color:#aaa;">' + url.substring(0, 60) + '...</div>' +
                    '</div>');

                item.on('hover:enter', () => {
                    Lampa.Player.play({
                        url: url,
                        title: movie.title || movie.name,
                        quality: { 'Auto': url }
                    });
                });

                scroll.append(item);
            });

            this.addBackButton();
        };

        this.showVideoResult = function (videoUrl, source) {
            scroll.clear();

            var item = $('<div class="selector" style="padding:20px; margin:20px; background:rgba(0,255,0,0.1); border-radius:8px; cursor:pointer;">' +
                '<div style="font-size:14px; font-weight:bold;">Видео найдено</div>' +
                '<div style="font-size:11px; color:#aaa;">Источник: ' + source.name + '</div>' +
                '</div>');

            item.on('hover:enter', () => {
                Lampa.Player.play({
                    url: videoUrl,
                    title: movie.title || movie.name,
                    quality: { 'Auto': videoUrl }
                });
            });

            scroll.append(item);
            this.addBackButton();
        };

        this.showLinksFromPage = function (html, source) {
            scroll.clear();

            var header = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🔗 Найденные ссылки</div>' +
                '<div class="choice__subtitle">' + source.name + '</div>' +
                '</div>');
            scroll.append(header);

            var links = html.match(/href="([^"]+)"/g) || [];
            links.slice(0, 10).forEach(link => {
                var url = link.replace(/href="|"/g, '');
                var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.1); border-radius:8px; cursor:pointer;">' +
                    '<div style="font-size:12px;">' + url + '</div>' +
                    '</div>');

                item.on('hover:enter', () => {
                    Lampa.Noty.show('Открыть ссылку: ' + url);
                });

                scroll.append(item);
            });

            this.addBackButton();
        };

        this.addBackButton = function () {
            var back = $('<div class="selector" style="padding:15px; margin:20px; background:rgba(255,0,0,0.1); border-radius:8px; cursor:pointer;">⬅ Назад</div>');
            back.on('hover:enter', () => {
                this.showMainScreen();
            });
            scroll.append(back);
        };

        this.render = function () {
            return scroll.render();
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
        };

        // --- Вспомогательная функция ---
        function extractVideoUrls(html, sourceId) {
            var urls = [];
            var patterns = [
                /file:\s*"(https?:\/\/[^"]+)"/g,
                /src:\s*"(https?:\/\/[^"]+)"/g,
                /"(https?:\/\/[^"]+\.mp4)"/g
            ];

            patterns.forEach(pattern => {
                var match;
                while ((match = pattern.exec(html)) !== null) {
                    urls.push(match[1]);
                }
            });

            return urls.length ? urls : null;
        }
    }

    function addAndrozonButton() {
        var button = $('<div class="full-start__button selector">⚡ Androzon</div>');
        button.on('hover:enter', function () {
            var movie = Lampa.Activity.active().data;
            var component = new AndrozonComponent(movie);
            Lampa.Controller.add('content', component);
            Lampa.Controller.toggle('content');
            Lampa.Layer.show(component.render(), component);
            component.start();
        });
        $('.full-start__buttons').append(button);
    }

    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite') {
            addAndrozonButton();
        }
    });
})();
