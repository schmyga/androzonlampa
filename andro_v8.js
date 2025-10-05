(function () {
    'use strict';

    // ---------- Безопасные утилиты ----------
    function safeText(s) {
        return String(s || '').replace(/[<>]/g, '');
    }

    function log(msg) {
        try { console.log('[Androzon]', msg); } catch (e) {}
    }

    // ---------- Компонент ----------
    function AndrozonComponent(movie) {
        var self = this;

        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });

        var sources = [
            { name: 'Kinoger', base: 'https://kinoger.com/index.php?do=search&subaction=search&story=', id: 'kinoger' },
            { name: 'BS.to',   base: 'https://bs.to/?q=', id: 'bs' },
            { name: 'Cine.to', base: 'https://cine.to/?q=', id: 'cine' }
        ];

        // --- Жизненный цикл ---
        this.create = function () {
            self.body = scroll.render();
        };

        this.render = function () {
            return self.body;
        };

        this.start = function () {
            try {
                showMainScreen();
            } catch (e) {
                Lampa.Noty.show('Androzon: ошибка старта');
                log(e && e.message ? e.message : e);
            }
        };

        this.destroy = function () {
            try {
                network.clear();
                scroll.destroy();
            } catch (e) {}
        };

        // --- Экран выбора источника ---
        function showMainScreen() {
            scroll.clear();

            var title = safeText(movie && (movie.title || movie.name));
            var header = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🔍 Выберите источник</div>' +
                '<div class="choice__subtitle">Поиск для: ' + title + '</div>' +
            '</div>');
            scroll.append(header);

            for (var i = 0; i < sources.length; i++) {
                (function (source) {
                    var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.08); border-radius:8px; cursor:pointer;">' +
                        '<div style="font-size:14px; font-weight:bold;">' + safeText(source.name) + '</div>' +
                        '<div style="font-size:11px; color:#aaa;">' + safeText(source.base) + '</div>' +
                    '</div>');

                    item.on('hover:enter', function () {
                        searchOnSource(source);
                    });

                    scroll.append(item);
                })(sources[i]);
            }

            addBackToClose();
        }

        // --- Поиск на источнике ---
        function searchOnSource(source) {
            var q = encodeURIComponent(safeText(movie && (movie.title || movie.name)));
            var url = source.base + q;

            Lampa.Noty.show('Поиск на ' + source.name + '...');
            log('GET ' + url);

            network.native(url, function (html) {
                try {
                    processSearchResults(html, source);
                } catch (e) {
                    Lampa.Noty.show('Androzon: ошибка обработки результатов');
                    log(e && e.message ? e.message : e);
                }
            }, function (a, c) {
                Lampa.Noty.show('Ошибка загрузки: ' + source.name);
            }, false, { dataType: 'text' });
        }

        // --- Обработка результатов: извлекаем все ссылки (балансеры) ---
        function processSearchResults(html, source) {
            var list = extractVideoUrls(html, source.id);

            if (list && list.length > 1) {
                showBalancerList(list, source);
            } else if (list && list.length === 1) {
                showSingleResult(list[0], source);
            } else {
                showPageLinksFallback(html, source);
            }
        }

        // --- Экран выбора балансера ---
        function showBalancerList(urls, source) {
            scroll.clear();

            var head = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🎛 Выберите балансер</div>' +
                '<div class="choice__subtitle">Источник: ' + safeText(source.name) + '</div>' +
            '</div>');
            scroll.append(head);

            for (var i = 0; i < urls.length; i++) {
                (function (url, idx) {
                    var label = humanizeBalancer(url, idx);
                    var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.08); border-radius:8px; cursor:pointer;">' +
                        '<div style="font-size:14px; font-weight:bold;">' + safeText(label) + '</div>' +
                        '<div style="font-size:11px; color:#aaa;">' + safeText(truncate(url, 80)) + '</div>' +
                    '</div>');

                    item.on('hover:enter', function () {
                        playUrl(url);
                    });

                    scroll.append(item);
                })(urls[i], i);
            }

            addBackToSources();
        }

        // --- Экран одиночной ссылки ---
        function showSingleResult(url, source) {
            scroll.clear();

            var item = $('<div class="selector" style="padding:20px; margin:20px; background:rgba(0,255,0,0.10); border-radius:8px; cursor:pointer;">' +
                '<div style="font-size:14px; font-weight:bold;">Видео найдено</div>' +
                '<div style="font-size:11px; color:#aaa;">Источник: ' + safeText(source.name) + '</div>' +
                '<div style="font-size:11px; color:#aaa; margin-top:6px;">' + safeText(truncate(url, 90)) + '</div>' +
            '</div>');

            item.on('hover:enter', function () {
                playUrl(url);
            });

            scroll.append(item);
            addBackToSources();
        }

        // --- Фолбэк: показать найденные href на странице ---
        function showPageLinksFallback(html, source) {
            scroll.clear();

            var head = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🔗 Найденные ссылки на странице</div>' +
                '<div class="choice__subtitle">Источник: ' + safeText(source.name) + '</div>' +
            '</div>');
            scroll.append(head);

            var links = [];
            try {
                var match;
                var re = /href="([^"]+)"/g;
                while ((match = re.exec(html)) !== null) {
                    links.push(match[1]);
                    if (links.length >= 25) break;
                }
            } catch (e) {}

            if (!links.length) {
                var empty = $('<div style="padding:15px; margin:10px; color:#aaa;">Ничего не найдено</div>');
                scroll.append(empty);
            } else {
                for (var i = 0; i < links.length; i++) {
                    (function (url) {
                        var item = $('<div class="selector" style="padding:12px; margin:8px; background:rgba(255,255,255,0.06); border-radius:6px; cursor:pointer;">' +
                            '<div style="font-size:12px;">' + safeText(truncate(url, 100)) + '</div>' +
                        '</div>');

                        item.on('hover:enter', function () {
                            Lampa.Noty.show('Ссылка: ' + truncate(url, 60));
                        });

                        scroll.append(item);
                    })(links[i]);
                }
            }

            addBackToSources();
        }

        // --- Плеер ---
        function playUrl(url) {
            try {
                var title = safeText(movie && (movie.title || movie.name));
                Lampa.Player.play({
                    url: url,
                    title: title,
                    quality: { 'Auto': url }
                });
            } catch (e) {
                Lampa.Noty.show('Не удалось запустить плеер');
                log(e && e.message ? e.message : e);
            }
        }

        // --- Навигация ---
        function addBackToClose() {
            var back = $('<div class="selector" style="padding:15px; margin:20px; background:rgba(255,0,0,0.10); border-radius:8px; cursor:pointer;">⬅ Закрыть</div>');
            back.on('hover:enter', function () {
                Lampa.Layer.back();
            });
            scroll.append(back);
        }

        function addBackToSources() {
            var back = $('<div class="selector" style="padding:15px; margin:20px; background:rgba(255,255,0,0.10); border-radius:8px; cursor:pointer;">⬅ К источникам</div>');
            back.on('hover:enter', function () {
                showMainScreen();
            });
            scroll.append(back);
        }

        // --- Извлечение всех «балансерных» ссылок ---
        function extractVideoUrls(html, sourceId) {
            var urls = [];
            // Набор безопасных паттернов, собираем ВСЕ совпадения
            var patterns = [
                /file\s*:\s*"((?:https?:\/\/)[^"]+)"/g,
                /src\s*:\s*"((?:https?:\/\/)[^"]+)"/g,
                /data-file\s*=\s*"((?:https?:\/\/)[^"]+)"/g,
                /"(https?:\/\/[^"]+\.m3u8)"/g,
                /"(https?:\/\/[^"]+\.mp4)"/g
            ];

            for (var p = 0; p < patterns.length; p++) {
                try {
                    var re = patterns[p];
                    var m;
                    while ((m = re.exec(html)) !== null) {
                        pushUnique(urls, m[1]);
                    }
                } catch (e) {}
            }

            // Базовая фильтрация мусора
            var cleaned = [];
            for (var i = 0; i < urls.length; i++) {
                var u = urls[i];
                if (!/\.jpg|\.png|\.gif|\.webp|\.css|\.js/i.test(u)) {
                    cleaned.push(u);
                }
            }

            return cleaned.length ? cleaned : null;
        }

        function pushUnique(arr, v) {
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] === v) return;
            }
            arr.push(v);
        }

        function truncate(s, n) {
            s = String(s || '');
            return s.length > n ? s.substr(0, n - 3) + '...' : s;
        }

        function humanizeBalancer(url, idx) {
            var name = 'Балансер ' + (idx + 1);
            try {
                var m = url.match(/^https?:\/\/([^\/]+)/i);
                if (m && m[1]) {
                    name = m[1].toLowerCase();
                }
            } catch (e) {}
            return name;
        }
    }

    // ---------- Кнопка ----------
    function addAndrozonButton() {
        try {
            // Не добавлять вторую кнопку
            if ($('.full-start__buttons .androzon-btn').length) return;

            var btn = $('<div class="full-start__button selector androzon-btn">⚡ Androzon</div>');

            btn.on('hover:enter', function () {
                try {
                    var activity = Lampa.Activity.active();
                    var movie = activity && activity.data ? activity.data : {};
                    var comp = new AndrozonComponent(movie);
                    comp.create();

                    // Открываем слой с нашим компонентом
                    Lampa.Layer.show(comp.render(), comp);
                    comp.start();
                } catch (e) {
                    Lampa.Noty.show('Androzon: ошибка открытия');
                    log(e && e.message ? e.message : e);
                }
            });

            $('.full-start__buttons').append(btn);
        } catch (e) {
            // Если контейнер недоступен — не падаем
            log('Не удалось добавить кнопку: ' + (e && e.message ? e.message : e));
        }
    }

    // ---------- Подписка на событие карточки ----------
    try {
        Lampa.Listener.follow('full', function (e) {
            if (e && e.type === 'complite') {
                addAndrozonButton();
            }
        });
    } catch (e) {
        // В крайнем случае — пробуем добавить кнопку сразу
        setTimeout(addAndrozonButton, 1200);
    }
})();
