// plag_v1_cdn.js
// Androzon / Plag v1 (CDN-ready) — версия для размещения на jsDelivr
// Особенности: robust button insert, auto-search on complete, simple parsers for Rezka/Filmix/Kodik/VideoCDN,
// debug mode, Lampa API usage (Lampa.Modal, Lampa.Player, Lampa.Listener, Lampa.Dom, Lampa.Params, Lampa.Storage).
// Помести этот файл в репозиторий schmyga/androzonlampa@main и подключай через jsdelivr:
// https://cdn.jsdelivr.net/gh/schmyga/androzonlampa@main/plag_v1_cdn.js

(function() {
    'use strict';

    if (typeof Lampa === 'undefined') {
        console.warn('[ANDROZON] Lampa not found -> abort');
        return;
    }

    const PLUGIN = {
        id: 'plag_v1',
        name: 'Androzon (plag_v1_cdn)',
        version: '1.0.0-cdn',
        timeout: 8000,
        maxResults: 12,
        debug: true  // true - логирование включено
    };

    const BALANCERS = [
        { id: 'rezka', title: 'Rezka', parser: 'rezka', active: true, weight: 3 },
        { id: 'filmix', title: 'Filmix', parser: 'filmix', active: true, weight: 2 },
        { id: 'kodik', title: 'Kodik', parser: 'kodik', active: true, weight: 2 },
        { id: 'videocdn', title: 'VideoCDN', parser: 'videocdn', active: true, weight: 1 }
    ];

    /* ---------------- utils ---------------- */
    function log() {
        if (!PLUGIN.debug) return;
        try { console.log('[ANDROZON]', ...arguments); } catch(e) {}
    }
    function err() { try { console.error('[ANDROZON]', ...arguments); } catch(e) {} }

    function storageGet(key, def) {
        try { return Lampa.Storage.get(key, def); } catch(e) { return def; }
    }
    function storageSet(key, val) {
        try { Lampa.Storage.set(key, val); } catch(e) {}
    }
    function isEnabled() {
        const v = storageGet(PLUGIN.id + '_enabled', 'true');
        return v === true || v === 'true';
    }

    function safeRequest(options) {
        // options: { url, success(str), error(err) }
        if (!options || !options.url) {
            if (options && options.error) options.error('no_url');
            return;
        }

        const params = {
            url: options.url,
            timeout: PLUGIN.timeout,
            success: options.success || function() {},
            error: options.error || function() {}
        };

        try {
            if (typeof Lampa.Reguest === 'function') {
                Lampa.Reguest(params);
            } else if (Lampa.Utils && typeof Lampa.Utils.request === 'function') {
                Lampa.Utils.request(params);
            } else {
                // fallback fetch
                fetch(options.url).then(r => r.text()).then(params.success).catch(params.error);
            }
        } catch(e) {
            err('safeRequest error', e);
            try { params.error(e); } catch(_) {}
        }
    }

    function cleanTitle(t) {
        if (!t) return '';
        return String(t).replace(/\s*\(\d{4}\)/g, '').replace(/\s*(S\d+E\d+|сезон\s*\d+|эпизод\s*\d+)/gi, '').trim();
    }

    /* ---------------- Parsers (templates) ---------------- */
    const Parsers = {
        rezka: {
            search(query, cb, eb) {
                const url = 'https://rezka.ag/search/?do=search&subaction=search&q=' + encodeURIComponent(query);
                safeRequest({
                    url: url,
                    success(html) {
                        try {
                            const res = [];
                            const blocks = (html.match(/<div class="b-search-result__card[\s\S]*?<\/div>/g) || []);
                            blocks.slice(0, PLUGIN.maxResults).forEach(block => {
                                const t = (block.match(/<a[^>]*>([^<]+)<\/a>/) || [null, null])[1];
                                const l = (block.match(/href="([^"]+)"/) || [null, null])[1];
                                const img = (block.match(/src="([^"]+)"/) || [null, null])[1];
                                if (t && l) res.push({ title: t.trim(), img: img || '', id: l.split('/').pop(), url: l });
                            });
                            cb(res);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                const url = 'https://rezka.ag/' + id;
                safeRequest({
                    url: url,
                    success(html) {
                        try {
                            const out = [];
                            const matches = html.match(/data-frame="([^"]+)"/g) || [];
                            matches.forEach(m => {
                                const src = m.replace(/data-frame="/, '').replace(/"/g, '');
                                out.push({ title: 'Rezka', url: src, quality: 'HD' });
                            });
                            cb(out);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error(e) { eb && eb(e); }
                });
            }
        },
        filmix: {
            search(query, cb, eb) {
                const url = 'https://filmixapp.vip/api/v2/search?story=' + encodeURIComponent(query);
                safeRequest({
                    url: url,
                    success(str) {
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
                    error(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                const url = 'https://filmixapp.vip/api/v2/get-film-by-id?id=' + id;
                safeRequest({
                    url: url,
                    success(str) {
                        try {
                            const json = JSON.parse(str);
                            const out = [];
                            if (json.playlist) json.playlist.forEach(p => out.push({ title: p.title || 'Filmix', url: p.url, quality: p.quality || 'HD' }));
                            cb(out);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error(e) { eb && eb(e); }
                });
            }
        },
        kodik: {
            search(query, cb, eb) {
                // Kodik public HTML search parsing (template)
                const url = 'https://kodik.info/search/?q=' + encodeURIComponent(query);
                safeRequest({
                    url: url,
                    success(html) {
                        try {
                            const out = [];
                            const items = html.match(/<a[^>]*class="poster"[\s\S]*?<\/a>/g) || [];
                            items.slice(0, PLUGIN.maxResults).forEach(it => {
                                const link = (it.match(/href="([^"]+)"/) || [null, null])[1];
                                const title = (it.match(/alt="([^"]+)"/) || [null, null])[1];
                                if (link && title) out.push({ title: title, url: link, id: link.split('/').pop() });
                            });
                            cb(out);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error(e) { eb && eb(e); }
                });
            },
            links(id, cb) {
                cb([ { title: 'Kodik', url: 'https://kodik.info/embed/' + id, quality: 'Auto' } ]);
            }
        },
        videocdn: {
            search(query, cb, eb) {
                const url = 'https://api.videocdn.tv/api/short/' + encodeURIComponent(query) + '?api_token=3i4UbLuF';
                safeRequest({
                    url: url,
                    success(str) {
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
                    error(e) { eb && eb(e); }
                });
            },
            links(id, cb, eb) {
                const url = 'https://api.videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF';
                safeRequest({
                    url: url,
                    success(str) {
                        try {
                            const json = JSON.parse(str);
                            const out = [];
                            if (json.embed && json.embed.playlist) json.embed.playlist.forEach(p => out.push({ title: p.name || 'VideoCDN', url: p.file, quality: p.source || 'HD' }));
                            cb(out);
                        } catch(e) { eb && eb('parse_error'); }
                    },
                    error(e) { eb && eb(e); }
                });
            }
        }
    };

    /* ---------------- UI: search modal & play ---------------- */
    function createSearchModal(query, balancer) {
        const bal = balancer || BALANCERS.find(b => b.active) || BALANCERS[0];
        log('createSearchModal', query, bal && bal.id);

        Lampa.Modal.open({
            title: 'Androzon — ' + (bal ? bal.title : 'Search'),
            html: '<div class="search-body"><div class="loading">Поиск: ' + Lampa.Utils.textToHtml(query) + '...</div></div>',
            onBack() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            }
        });

        if (!bal || !Parsers[bal.parser]) {
            $('.modal .search-body').html('<div class="empty">Ошибка: парсер не найден</div>');
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
                       '<div class="selector__img"><img src="' + (r.img || '') + '"></div>' +
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

    /* ---------------- robust button insert ---------------- */
    const MENU_SELECTORS = ['.catalog__menu', '.content__menu', '.menu', '.sidebar', '.catalog__sidebar'];

    function tryInsertButton(root) {
        if (!root || !root.length) return false;
        for (let sel of MENU_SELECTORS) {
            const found = root.find(sel);
            if (found && found.length) {
                if (found.find('.androzon-search').length) {
                    log('button already exists at', sel);
                    return true;
                }

                const btn = Lampa.Dom.create('div', {
                    class: 'selector selector--hover androzon-search',
                    html: '<div class="selector__ico">🔍</div><div class="selector__title">Androzon</div>'
                });

                found.append(btn);

                btn.on('hover:enter', function() {
                    Lampa.Modal.prompt('Введите название для поиска', '', function(query) {
                        if (!query || String(query).length < 2) return;
                        const sorted = BALANCERS.filter(b => b.active).sort((a,b) => (b.weight||0)-(a.weight||0));
                        createSearchModal(query, sorted[0] || BALANCERS[0]);
                    });
                });

                log('Inserted button into', sel);
                return true;
            }
        }
        return false;
    }

    function insertButtonRetries(tries, interval) {
        let i = 0;
        const t = setInterval(() => {
            i++;
            try {
                const activity = Lampa.Activity.active();
                if (!activity || !activity.render) {
                    log('No activity render yet (try ' + i + ')');
                    if (i >= tries) clearInterval(t);
                    return;
                }
                const root = activity.render();
                const ok = tryInsertButton(root);
                if (ok) {
                    clearInterval(t);
                    log('Button inserted after tries:', i);
                } else {
                    log('Button not inserted on try', i);
                    if (i >= tries) {
                        clearInterval(t);
                        log('Giving up inserting button after ' + i + ' tries');
                        if (PLUGIN.debug) {
                            const diag = MENU_SELECTORS.map(s => ({ selector: s, found: !!root.find(s).length, count: root.find(s).length || 0 }));
                            console.warn('[ANDROZON] menu diagnostics:', diag);
                        }
                    }
                }
            } catch(e) { err('insertButtonRetries exception', e); clearInterval(t); }
        }, interval || 700);
    }

    /* ---------------- params & autosearch ---------------- */
    function registerParams() {
        try {
            const opts = Lampa.Params.options;
            if (opts && typeof opts === 'object') {
                opts[PLUGIN.id] = PLUGIN.name;
                storageSet('plugins', Object.keys(opts).join(','));
            }

            Lampa.Params.select(PLUGIN.id, '', {
                'enabled': {
                    title: 'Включить Androzon',
                    html: '<div class="settings-folder__value">' + (isEnabled() ? 'Вкл' : 'Выкл') + '</div>',
                    value: isEnabled(),
                    toggle() {
                        const val = !isEnabled();
                        storageSet(PLUGIN.id + '_enabled', val);
                        Lampa.Noty.show(val ? 'Androzon включен' : 'Androzon выключен');
                        Lampa.Params.update();
                    }
                },
                'debug': {
                    title: 'Отладка (логи)',
                    html: '<div class="settings-folder__value">' + (PLUGIN.debug ? 'Вкл' : 'Выкл') + '</div>',
                    value: PLUGIN.debug,
                    toggle() {
                        PLUGIN.debug = !PLUGIN.debug;
                        Lampa.Noty.show(PLUGIN.debug ? 'Androzon debug ON' : 'Androzon debug OFF');
                        Lampa.Params.update();
                    }
                }
            });
        } catch(e) { err('registerParams error', e); }
    }

    function registerAutoSearch() {
        if (!isEnabled()) {
            log('AutoSearch disabled in params');
            return;
        }

        try {
            Lampa.Listener.follow('full', function(e) {
                try {
                    if (e && e.type === 'complite' && e.object && e.object.movie && e.object.movie.title) {
                        const title = cleanTitle(e.object.movie.title);
                        if (!title || title.length < 2) return;
                        const sorted = BALANCERS.filter(b => b.active).sort((a,b) => (b.weight||0)-(a.weight||0));
                        const top = sorted[0] || BALANCERS[0];
                        log('AutoSearch fired for', title, '->', top && top.title);
                        setTimeout(() => createSearchModal(title, top), 1200);
                    }
                } catch(inner) { err('autoSearch inner error', inner); }
            });
        } catch(e) { err('registerAutoSearch error', e); }
    }

    /* ---------------- init ---------------- */
    function init() {
        log(PLUGIN.name + ' init v' + PLUGIN.version);
        registerParams();
        registerAutoSearch();

        insertButtonRetries(14, 700);

        // also try immediate on activity ready
        Lampa.Listener.follow('activity', function(e) {
            if (e.type === 'ready') {
                try {
                    const act = Lampa.Activity.active();
                    if (act && act.render) tryInsertButton(act.render());
                } catch(e) { err('activity handler error', e); }
            }
        });

        // fallback single attempt after a little delay
        setTimeout(() => {
            try {
                const act = Lampa.Activity.active();
                if (act && act.render) tryInsertButton(act.render());
            } catch(e) {}
        }, 2500);

        log(PLUGIN.name + ' initialized');
    }

    try {
        init();
    } catch(e) {
        err('init exception', e);
    }

})();
