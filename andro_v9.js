(function () {
    'use strict';

    // ---------------- Утилиты ----------------
    function safe(s) {
        return String(s || '').replace(/[<>]/g, '');
    }
    function log(msg) {
        try { console.log('[Androzon]', msg); } catch (e) {}
    }
    function truncate(s, n) {
        s = String(s || '');
        return s.length > n ? s.substr(0, n - 3) + '...' : s;
    }
    function pushUnique(arr, v) {
        for (var i = 0; i < arr.length; i++) if (arr[i] === v) return;
        arr.push(v);
    }
    function humanDomain(url, idx) {
        var name = 'Балансер ' + (idx + 1);
        try {
            var m = url.match(/^https?:\/\/([^\/]+)/i);
            if (m && m[1]) name = m[1].toLowerCase();
        } catch (e) {}
        return name;
    }

    // ---------------- Компонент ----------------
    function AndrozonComponent(movie) {
        var self = this;
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });

        var sources = [
            { id: 'kinoger', name: 'Kinoger', base: 'https://kinoger.com/index.php?do=search&subaction=search&story=' },
            { id: 'bs',      name: 'BS.to',   base: 'https://bs.to/?q=' },
            { id: 'cine',    name: 'Cine.to', base: 'https://cine.to/?q=' }
        ];

        this.create = function () {
            self.body = scroll.render();
        };

        this.render = function () {
            return self.body;
        };

        this.start = function () {
            try {
                showSources();
            } catch (e) {
                Lampa.Noty.show('Androzon: ошибка запуска');
                log(e && e.message ? e.message : e);
            }
        };

        this.destroy = function () {
            try {
                network.clear();
                scroll.destroy();
            } catch (e) {}
        };

        // ---------- Экран: выбор источника ----------
        function showSources() {
            scroll.clear();

            var title = safe(movie && (movie.title || movie.name));
            var head = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🔍 Выберите источник</div>' +
                '<div class="choice__subtitle">Поиск для: ' + title + '</div>' +
            '</div>');
            scroll.append(head);

            for (var i = 0; i < sources.length; i++) {
                (function (src) {
                    var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.08); border-radius:8px; cursor:pointer;">' +
                        '<div style="font-size:14px; font-weight:bold;">' + safe(src.name) + '</div>' +
                        '<div style="font-size:11px; color:#aaa;">' + safe(src.base) + '</div>' +
                    '</div>');
                    item.on('hover:enter', function () {
                        searchOnSource(src);
                    });
                    scroll.append(item);
                })(sources[i]);
            }

            addCloseButton();
        }

        // ---------- Поиск на источнике ----------
        function searchOnSource(src) {
            var q = encodeURIComponent(safe(movie && (movie.title || movie.name)));
            var url = src.base + q;

            Lampa.Noty.show('Поиск на ' + src.name + '...');
            log('GET ' + url);

            network.native(url, function (html) {
                try {
                    handleSearchResults(html, src);
                } catch (e) {
                    Lampa.Noty.show('Ошибка обработки результатов');
                    log(e && e.message ? e.message : e);
                    showFallback(html, src);
                }
            }, function () {
                Lampa.Noty.show('Ошибка загрузки: ' + src.name);
            }, false, { dataType: 'text' });
        }

        // ---------- Обработка результатов ----------
        function handleSearchResults(html, src) {
            var urls = extractVideoUrls(html, src.id);

            if (urls && urls.length > 1) {
                showBalancers(urls, src);
            } else if (urls && urls.length === 1) {
                showSingle(urls[0], src);
            } else {
                showFallback(html, src);
            }
        }

        // ---------- Экран: выбор балансера ----------
        function showBalancers(urls, src) {
            scroll.clear();

            var head = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🎛 Выберите балансер</div>' +
                '<div class="choice__subtitle">Источник: ' + safe(src.name) + '</div>' +
            '</div>');
            scroll.append(head);

            for (var i = 0; i < urls.length; i++) {
                (function (url, idx) {
                    var label = humanDomain(url, idx);
                    var item = $('<div class="selector" style="padding:15px; margin:10px; background:rgba(255,255,255,0.08); border-radius:8px; cursor:pointer;">' +
                        '<div style="font-size:14px; font-weight:bold;">' + safe(label) + '</div>' +
                        '<div style="font-size:11px; color:#aaa;">' + safe(truncate(url, 90)) + '</div>' +
                    '</div>');
                    item.on('hover:enter', function () {
                        play(url);
                    });
                    scroll.append(item);
                })(urls[i], i);
            }

            addBackToSources();
        }

        // ---------- Экран: одна ссылка ----------
        function showSingle(url, src) {
            scroll.clear();

            var box = $('<div class="selector" style="padding:20px; margin:20px; background:rgba(0,255,0,0.10); border-radius:8px; cursor:pointer;">' +
                '<div style="font-size:14px; font-weight:bold;">Видео найдено</div>' +
                '<div style="font-size:11px; color:#aaa;">Источник: ' + safe(src.name) + '</div>' +
                '<div style="font-size:11px; color:#aaa; margin-top:6px;">' + safe(truncate(url, 100)) + '</div>' +
            '</div>');
            box.on('hover:enter', function () { play(url); });
            scroll.append(box);

            addBackToSources();
        }

        // ---------- Фолбэк: показать href-ы ----------
        function showFallback(html, src) {
            scroll.clear();

            var head = $('<div class="choice__head" style="padding:20px;">' +
                '<div class="choice__title">🔗 Найденные ссылки на странице</div>' +
                '<div class="choice__subtitle">Источник: ' + safe(src.name) + '</div>' +
            '</div>');
            scroll.append(head);

            var links = [];
            try {
                var re = /href="([^"]+)"/g, m, max = 30;
                while ((m = re.exec(html)) !== null) {
                    pushUnique(links, m[1]);
                    if (links.length >= max) break;
                }
            } catch (e) {}

            if (!links.length) {
                scroll.append($('<div style="padding:15px; margin:10px; color:#aaa;">Ничего не найдено</div>'));
            } else {
                for (var i = 0; i < links.length; i++) {
                    (function (url) {
                        var item = $('<div class="selector" style="padding:12px; margin:8px; background:rgba(255,255,255,0.06); border-radius:6px; cursor:pointer;">' +
                            '<div style="font-size:12px;">' + safe(truncate(url, 100)) + '</div>' +
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

        // ---------- Плеер ----------
        function play(url) {
            try {
                var title = safe(movie && (movie.title || movie.name));
                Lampa.Player.play({
                    url: url,
                    title: title,
                    quality: { 'Auto': url }
                });
            } catch (e) {
                Lampa.Noty.show('Не удалось запустить видео');
                log(e && e.message ? e.message : e);
            }
        }

        // ---------- Навигация ----------
        function addCloseButton() {
            var btn = $('<div class="selector" style="padding:15px; margin:20px; background:rgba(255,0,0,0.10); border-radius:8px; cursor:pointer;">⬅ Закрыть</div>');
            btn.on('hover:enter', function () { Lampa.Layer.back(); });
            scroll.append(btn);
        }

        function addBackToSources() {
            var btn = $('<div class="selector" style="padding:15px; margin:20px; background:rgba(255,255,0,0.10); border-radius:8px; cursor:pointer;">⬅ К источникам</div>');
            btn.on('hover:enter', function () { showSources(); });
            scroll.append(btn);
        }

        // ---------- Извлечение всех ссылок (балансеров) ----------
        function extractVideoUrls(html, sourceId) {
            var urls = [];

            // Общие шаблоны для встраиваемых плееров и прямых ссылок
            var patterns = [
                /file\s*:\s*"((?:https?:\/\/)[^"]+)"/g,
                /src\s*:\s*"((?:https?:\/\/)[^"]+)"/g,
                /data-file\s*=\s*"((?:https?:\/\/)[^"]+)"/g,
                /url\s*=\s*"((?:https?:\/\/)[^"]+)"/g,
                /"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
                /"(https?:\/\/[^"]+\.mp4[^"]*)"/g,
                /"(https?:\/\/(?:[^"]*streamtape\.com|[^"]*vidcloud\.co|[^"]*voe\.sx|[^"]*sibnet\.ru)[^"]+)"/g
            ];

            // Специфика некоторых источников (можешь расширить)
            if (sourceId === 'bs') {
                pushUnique(patterns, /data-url\s*=\s*"((?:https?:\/\/)[^"]+)"/g);
            }
            if (sourceId === 'kinoger') {
                pushUnique(patterns, /player\s*src\s*=\s*"((?:https?:\/\/)[^"]+)"/g);
            }

            for (var p = 0; p < patterns.length; p++) {
                try {
                    var re = patterns[p], m;
                    while ((m = re.exec(html)) !== null) {
                        pushUnique(urls, m[1]);
                    }
                } catch (e) {}
            }

            // Фильтруем мусор
            var cleaned = [];
            for (var i = 0; i < urls.length; i++) {
                var u = urls[i];
                if (!/\.jpg|\.png|\.gif|\.webp|\.svg|\.css|\.js(\?|$)/i.test(u)) {
                    cleaned.push(u);
                }
            }

            return cleaned.length ? cleaned : null;
        }
    }

    // ---------------- Кнопка ----------------
    function addAndrozonButton() {
        try {
            var container = $('.full-start__buttons');
            if (!container || !container.length) {
                // если контейнер ещё не готов — пробуем позже
                setTimeout(addAndrozonButton, 800);
                return;
            }

            if (container.find('.androzon-btn').length) return;

            var btn = $('<div class="full-start__button selector androzon-btn">⚡ Androzon</div>');
            btn.on('hover:enter', function () {
                try {
                    var activity = Lampa.Activity.active();
                    var movie = activity && activity.data ? activity.data : {};
                    var comp = new AndrozonComponent(movie);
                    comp.create();
                    Lampa.Layer.show(comp.render(), comp);
                    comp.start();
                } catch (e) {
                    Lampa.Noty.show('Androzon: ошибка открытия');
                    log(e && e.message ? e.message : e);
                }
            });

            container.append(btn);
        } catch (e) {
            log('Не удалось добавить кнопку: ' + (e && e.message ? e.message : e));
        }
    }

    // ---------------- Инициализация ----------------
    try {
        Lampa.Listener.follow('full', function (e) {
            if (e && e.type === 'complite') addAndrozonButton();
        });
    } catch (e) {
        setTimeout(addAndrozonButton, 1000);
    }
})();
