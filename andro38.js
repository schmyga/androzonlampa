// Androzon Lampa Plugin v17 (2025)
// Полный рабочий плагин: исправленная кнопка (robust insert), автопоиск по завершению,
// парсеры-балансеры (Rezka, Filmix, Kodik, VideoCDN) — шаблон для дальнейшей доработки.
// Основан на изучении: cub.rip, bwa.to/rc, yumata/lampa, lampa-app/LAMPA

(function() {
    'use strict';

    if (typeof Lampa === 'undefined') {
        console.warn('[ANDROZON] Lampa not found, abort');
        return;
    }

    const PLUGIN = {
        id: 'androzon',
        version: '17.0',
        timeout: 8000,
        maxResults: 12,
        debug: true  // true = расширенное логирование (выключи в проде)
    };

    // Балансировщики (шаблоны). Для каждого — parser key.
    const BALANCERS = [
        { id: 'rezka', title: 'Rezka', parser: 'rezka', active: true, weight: 3 },
        { id: 'filmix', title: 'Filmix', parser: 'filmix', active: true, weight: 2 },
        { id: 'kodik', title: 'Kodik', parser: 'kodik', active: true, weight: 2 },
        { id: 'videocdn', title: 'VideoCDN', parser: 'videocdn', active: true, weight: 1 }
    ];

    /* ---------- УТИЛИТЫ ---------- */
    function log() {
        if (!PLUGIN.debug) return;
        try { console.log('[ANDROZON]', ...arguments); } catch(e) {}
    }

    function err() {
        try { console.error('[ANDROZON]', ...arguments); } catch(e) {}
    }

    function cleanTitle(title) {
        if (!title) return '';
        return title.replace(/\s*\(\d{4}\)/g, '').replace(/\s*(S\d+E\d+|сезон\s*\d+|эпизод\s*\d+)/gi, '').trim();
    }

    function storageGet(key, def) {
        try {
            return Lampa.Storage.get(key, def);
        } catch(e) { return def; }
    }

    function storageSet(key, val) {
        try { Lampa.Storage.set(key, val); } catch(e) {}
    }

    function isEnabled() {
        return storageGet(PLUGIN.id + '_enabled', 'true') === 'true' || storageGet(PLUGIN.id + '_enabled', true) === true;
    }

    function safeRequest(opts) {
        // opts: { url, success(str), error(err) }
        if (!opts || !opts.url) {
            if (opts && opts.error) opts.error('no_url');
            return;
        }

        // Lampa может иметь Lampa.Reguest или Lampa.Utils.request — используем доступный
        const params = {
            url: opts.url,
            timeout: PLUGIN.timeout,
            success: opts.success || function(){},
            error: opts.error || function(){}
        };

        try {
            if (typeof Lampa.Reguest === 'function') {
                Lampa.Reguest(params);
            } else if (Lampa.Utils && typeof Lampa.Utils.request === 'function') {
                Lampa.Utils.request(params);
            } else {
                // fallback fetch (может не работать из-за CORS внутри Lampa)
                fetch(opts.url, { method: 'GET' }).then(r => r.text()).then(opts.success).catch(opts.error);
            }
        } catch(errr) {
            err('safeRequest failure', errr);
            try { if (opts.error) opts.error(errr); } catch(e){}
        }
    }

    /* ---------- ПАРСЕРЫ (шаблоны) ---------- */
    // Внимание: реальная структура ответов сайтов может отличаться; эти функции — шаблоны,
    // которые можно расширять под конкретные API / html-структуру.
    const Parsers = {
        rezka: {
            search(query, cb, eb) {
                // HTML-страница поиска Rezka
                const url = 'https://rezka.ag/search/?do=search&subaction=search&q=' + encodeURIComponent(query);
                safeRequest({
                    url: url,
                    success: function(html) {
                        try {
                            const list = [];
                            const blocks = (html.match(/<div class="b-search-result__card[\s\S]*?<\/div>\s*<\/div>/g) || []);
                            blocks.slice(0, PLUGIN.maxResults).forEach(block => {
                                const title = (block.match(/<a[^>]*>([^<]+)<\/a>/) || [null, null])[1];
                                const link = (block.match(/href="([^"]+)"/) || [null, null])[1];
                                const img = (block.match(/src="([^"]+)"/) || [null, null])[1];
                                if (title && link) list.push({ title: title.trim(), img: img || '', id: link.split('/').pop(), url: link });
                            });
                            cb(list);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                const url = 'https://rezka.ag/' + id;
                safeRequest({
                    url: url,
                    success: function(html) {
                        try {
                            const arr = [];
                            const matches = html.match(/data-frame="([^"]+)"/g) || [];
                            matches.forEach(m => {
                                const s = m.replace(/data-frame="/, '').replace(/"/g, '');
                                arr.push({ title: 'Rezka', url: s, quality: 'HD' });
                            });
                            cb(arr);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            }
        },
        filmix: {
            search(query, cb, eb) {
                const url = 'https://filmixapp.vip/api/v2/search?story=' + encodeURIComponent(query);
                safeRequest({
                    url: url,
                    success: function(str) {
                        try {
                            const json = JSON.parse(str);
                            const list = (json.list || []).slice(0, PLUGIN.maxResults).map(it => ({
                                title: (it.title_ru || it.title || 'No title') + (it.year ? ' ('+it.year+')' : ''),
                                img: it.poster_url || '',
                                id: it.id,
                                url: it.id
                            }));
                            cb(list);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                const url = 'https://filmixapp.vip/api/v2/get-film-by-id?id=' + id;
                safeRequest({
                    url: url,
                    success: function(str) {
                        try {
                            const json = JSON.parse(str);
                            const arr = [];
                            if (json.playlist) json.playlist.forEach(p => arr.push({ title: p.title || 'Filmix', url: p.url, quality: p.quality || 'HD' }));
                            cb(arr);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            }
        },
        kodik: {
            search(query, cb, eb) {
                // Примитивный вызов к публичному поиску (может требовать токен)
                const url = 'https://kodik.info/search/?q=' + encodeURIComponent(query);
                safeRequest({
                    url: url,
                    success: function(html) {
                        try {
                            // kodik может отдавать HTML — ищем шаблон ссылок
                            const list = [];
                            const matches = html.match(/<a[^>]*class="poster"[\s\S]*?href="([^"]+)"[\s\S]*?alt="([^"]+)"/g) || [];
                            matches.slice(0, PLUGIN.maxResults).forEach(m => {
                                const link = (m.match(/href="([^"]+)"/) || [])[1];
                                const title = (m.match(/alt="([^"]+)"/) || [])[1];
                                if (link && title) list.push({ title: title, url: link, id: (link.split('/').pop()) });
                            });
                            cb(list);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                // Embed link pattern
                cb([ { title: 'Kodik', url: 'https://kodik.info/embed/' + id, quality: 'Auto' } ]);
            }
        },
        videocdn: {
            search(query, cb, eb) {
                // Используем публичный endpoint /api/short (шаблон)
                const url = 'https://api.videocdn.tv/api/short/' + encodeURIComponent(query) + '?api_token=3i4UbLuF';
                safeRequest({
                    url: url,
                    success: function(str) {
                        try {
                            const json = JSON.parse(str);
                            const list = (json.data || []).slice(0, PLUGIN.maxResults).map(it => ({
                                title: it.title || it.name,
                                img: it.poster || '',
                                id: it.id,
                                url: it.id
                            }));
                            cb(list);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                const url = 'https://api.videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF';
                safeRequest({
                    url: url,
                    success: function(str) {
                        try {
                            const json = JSON.parse(str);
                            const arr = [];
                            if (json.embed && json.embed.playlist) {
                                json.embed.playlist.forEach(p => arr.push({ title: p.name || 'VideoCDN', url: p.file, quality: p.source || 'HD' }));
                            }
                            cb(arr);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error: function(e) { eb && eb(e); }
                });
            }
        }
    };

    /* ---------- Модал поиска ---------- */
    function createSearchModal(query, balancer) {
        const bal = balancer || BALANCERS.find(b => b.active) || BALANCERS[0];
        log('createSearchModal', query, bal && bal.title);

        Lampa.Modal.open({
            title: 'Androzon — ' + (bal ? bal.title : 'Search'),
            html: '<div class="search-body"><div class="loading">Поиск: ' + Lampa.Utils.textToHtml(query) + '...</div></div>',
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            }
        });

        if (!bal || !Parsers[bal.parser]) {
            $('.modal .search-body').html('<div class="empty">Ошибка: нет парсера</div>');
            return;
        }

        Parsers[bal.parser].search(query, function(results) {
            const body = $('.modal .search-body');
            if (!results || !results.length) {
                body.html('<div class="empty">Ничего не найдено</div>');
                return;
            }

            const html = results.map(r => {
                const data = encodeURIComponent(JSON.stringify(r));
                return '<div class="selector selector--small" data-item="' + data + '">' +
                    '<div class="selector__img"><img src="' + (r.img || '') + '"/></div>' +
                    '<div class="selector__title">' + Lampa.Utils.textToHtml(r.title) + '</div>' +
                '</div>';
            }).join('');

            body.html(html);

            $('.modal .selector').on('hover:enter', function() {
                const item = JSON.parse(decodeURIComponent($(this).attr('data-item')));
                loadLinks(item, bal);
            });
        }, function(err) {
            $('.modal .search-body').html('<div class="empty">Ошибка: ' + String(err) + '</div>');
        });
    }

    function loadLinks(item, balancer) {
        if (!balancer || !Parsers[balancer.parser]) {
            Lampa.Noty.show('Нет парсера для источника');
            return;
        }

        Parsers[balancer.parser].links(item.id || item.url || item.link, function(links) {
            if (!links || !links.length) {
                Lampa.Noty.show('Ссылки не найдены');
                return;
            }

            // Преобразуем в формат Lampa.Player
            const playlist = links.map(l => ({
                title: l.title || '',
                url: l.url || l.file || '',
                subtitles: l.subtitles || []
            })).filter(p => p.url);

            if (!playlist.length) {
                Lampa.Noty.show('Плейлист пуст');
                return;
            }

            Lampa.Player.play(playlist, { title: item.title || '' });
            Lampa.Modal.close();
        }, function(e) {
            Lampa.Noty.show('Ошибка получения ссылок');
            err('links error', e);
        });
    }

    /* ---------- Надёжная вставка кнопки (несколько попыток) ---------- */
    const MENU_SELECTORS = ['.catalog__menu', '.content__menu', '.menu', '.sidebar', '.catalog__sidebar'];

    function tryInsertButtonOnce(root) {
        if (!root || !root.length) return false;

        // Ищем первый подходящий контейнер
        for (let s of MENU_SELECTORS) {
            const menu = root.find(s);
            if (menu && menu.length) {
                // уже добавлена?
                if (menu.find('.androzon-search').length) {
                    log('button already present in', s);
                    return true;
                }

                const btn = Lampa.Dom.create('div', {
                    class: 'selector selector--hover androzon-search',
                    html: '<div class="selector__ico">🔍</div><div class="selector__title">Androzon</div>'
                });

                menu.append(btn);

                btn.on('hover:enter', function() {
                    Lampa.Modal.prompt('Введите название для поиска', '', function(query) {
                        if (!query || String(query).length < 2) return;
                        // Попробуем выбрать активный по весу балансер
                        const sorted = BALANCERS.filter(b => b.active).sort((a,b) => (b.weight||0)-(a.weight||0));
                        createSearchModal(query, sorted[0] || BALANCERS[0]);
                    });
                });

                log('Inserted button into', s);
                return true;
            }
        }

        return false;
    }

    function insertButtonWithRetries(attempts, intervalMs) {
        let tries = 0;
        const timer = setInterval(function() {
            tries++;
            try {
                const activity = Lampa.Activity.active();
                if (!activity || !activity.render) {
                    log('insertButton: no active activity yet (try ' + tries + ')');
                    if (tries >= attempts) {
                        clearInterval(timer);
                        log('insertButton: giving up');
                    }
                    return;
                }

                const root = activity.render();
                const ok = tryInsertButtonOnce(root);

                if (ok) {
                    clearInterval(timer);
                    log('insertButton: success on try', tries);
                } else {
                    log('insertButton: not inserted on try', tries);
                    if (tries >= attempts) {
                        clearInterval(timer);
                        log('insertButton: attempts exhausted');
                        // Отправим диагностический лог в modal, чтобы пользователь увидел DOM подсказку
                        if (PLUGIN.debug) {
                            const elems = [];
                            MENU_SELECTORS.forEach(s => {
                                const found = root.find(s);
                                elems.push({ selector: s, found: !!found.length, count: found.length || 0 });
                            });
                            console.warn('[ANDROZON] menu diagnostics:', elems);
                        }
                    }
                }
            } catch(e) {
                err('insertButtonWithRetries exception', e);
            }
        }, intervalMs || 700);
    }

    /* ---------- Встраивание в настройки Lampa.Params ---------- */
    function registerParams() {
        try {
            const opts = Lampa.Params.options;
            if (opts && typeof opts === 'object') {
                opts[PLUGIN.id] = 'Androzon';
                storageSet('plugins', Object.keys(opts).join(','));
            }

            Lampa.Params.select(PLUGIN.id, '', {
                'enabled': {
                    title: 'Включить Androzon',
                    html: '<div class="settings-folder__value">' + (isEnabled() ? 'Вкл' : 'Выкл') + '</div>',
                    value: isEnabled(),
                    toggle: function() {
                        const val = !isEnabled();
                        storageSet(PLUGIN.id + '_enabled', val);
                        Lampa.Noty.show(val ? 'Androzon включен' : 'Androzon выключен');
                        Lampa.Params.update();
                    }
                },
                'debug': {
                    title: 'Debug (логи)',
                    html: '<div class="settings-folder__value">' + (PLUGIN.debug ? 'Вкл' : 'Выкл') + '</div>',
                    value: PLUGIN.debug,
                    toggle: function() {
                        PLUGIN.debug = !PLUGIN.debug;
                        Lampa.Noty.show(PLUGIN.debug ? 'Androzon: debug on' : 'Androzon: debug off');
                        Lampa.Params.update();
                    }
                }
            });
        } catch(e) {
            err('registerParams error', e);
        }
    }

    /* ---------- Автопоиск при завершении просмотра ---------- */
    function registerAutoSearch() {
        if (!isEnabled()) {
            log('AutoSearch disabled by params');
            return;
        }

        try {
            Lampa.Listener.follow('full', function(e) {
                try {
                    if (e && e.type === 'complite' && e.object && e.object.movie && e.object.movie.title) {
                        const title = cleanTitle(e.object.movie.title || e.object.title || '');
                        if (!title || title.length < 2) return;
                        // берём первый активный балансер по весу
                        const sorted = BALANCERS.filter(b => b.active).sort((a,b) => (b.weight||0)-(a.weight||0));
                        const top = sorted[0] || BALANCERS[0];
                        log('AutoSearch triggered for', title, '->', top && top.title);
                        setTimeout(() => createSearchModal(title, top), 1200);
                    }
                } catch(inner) { err('full event handler error', inner); }
            });
        } catch(e) { err('registerAutoSearch error', e); }
    }

    /* ---------- Инициализация плагина ---------- */
    function init() {
        log('Initializing Androzon v' + PLUGIN.version);
        registerParams();
        registerAutoSearch();

        // Попытки вставки кнопки: 12 попыток каждые 700ms => ~8.4s суммарно
        insertButtonWithRetries(12, 700);

        // Также слушаем activity ready для немедленной вставки
        Lampa.Listener.follow('activity', function(e) {
            if (e.type === 'ready') {
                try {
                    const act = Lampa.Activity.active();
                    if (act && act.render) {
                        tryInsertButtonOnce(act.render());
                    }
                } catch(e) { err('activity ready handler err', e); }
            }
        });

        // Небольшой отложенный вызов — если меню появится позже
        setTimeout(() => {
            const act = Lampa.Activity.active();
            if (act && act.render) tryInsertButtonOnce(act.render());
        }, 3000);

        log('Androzon initialized');
    }

    // Запуск
    try {
        init();
    } catch(e) {
        err('Androzon initialization failed', e);
    }

})();
