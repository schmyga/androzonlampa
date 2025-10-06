// Androzon Lampa Plugin v16 (2025)
// Полностью рабочая версия с исправленной кнопкой и автозапуском
// Поддерживает Rezka, Filmix, Kodik, VideoCDN
// Для Lampa D6+ и выше

(function() {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    const CONFIG = {
        id: 'androzon',
        version: '16.0',
        timeout: 8000,
        maxResults: 10
    };

    // === Балансеры ===
    const BALANCERS = [
        { id: 'rezka', title: 'Rezka', url: 'https://rezka.ag', active: true, parser: 'rezka', weight: 3 },
        { id: 'filmix', title: 'Filmix', url: 'https://filmixapp.vip/api/v2/', active: true, parser: 'filmix', weight: 2 },
        { id: 'kodik', title: 'Kodik', url: 'https://kodikapi.com', active: true, parser: 'kodik', weight: 2 },
        { id: 'videocdn', title: 'VideoCDN', url: 'https://api.videocdn.tv', active: true, parser: 'videocdn', weight: 1 }
    ];

    // === Утилиты ===
    function cleanTitle(title) {
        return title ? title.replace(/\s*\(\d{4}\)/g, '').trim() : '';
    }

    function isEnabled() {
        return Lampa.Storage.get(CONFIG.id + '_enabled', true);
    }

    function safeRequest(url, success, error) {
        Lampa.Utils.request({
            url: url,
            timeout: CONFIG.timeout,
            success: success,
            error: error || function() {}
        });
    }

    // === Парсеры ===
    const Parsers = {
        rezka: {
            search(query, callback, errback) {
                const url = `${BALANCERS.find(b => b.id === 'rezka').url}/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
                safeRequest(url, (html) => {
                    const results = [];
                    const matches = html.match(/<div class="b-search-result__card[^>]*>([\s\S]*?)<\/div>/g) || [];
                    matches.slice(0, CONFIG.maxResults).forEach(match => {
                        const title = (match.match(/<a[^>]*>([^<]+)<\/a>/) || [])[1];
                        const link = (match.match(/href="([^"]+)"/) || [])[1];
                        const img = (match.match(/src="([^"]+)"/) || [])[1];
                        if (title && link) {
                            results.push({
                                title: title,
                                img: img || '',
                                url: BALANCERS.find(b => b.id === 'rezka').url + link,
                                id: link.split('/').pop()
                            });
                        }
                    });
                    callback(results);
                }, errback);
            },
            links(id, callback, errback) {
                const url = `${BALANCERS.find(b => b.id === 'rezka').url}/${id}`;
                safeRequest(url, (html) => {
                    const links = [];
                    const matches = html.match(/data-frame="([^"]+)"/g) || [];
                    matches.forEach(match => {
                        const src = match.replace(/data-frame="/, '').replace(/"/, '');
                        links.push({ title: 'Rezka HD', url: src, quality: 'HD' });
                    });
                    callback(links);
                }, errback);
            }
        },
        filmix: {
            search(query, callback, errback) {
                const url = `https://filmixapp.vip/api/v2/search?story=${encodeURIComponent(query)}`;
                safeRequest(url, (str) => {
                    try {
                        const json = JSON.parse(str);
                        const results = (json.list || []).map(item => ({
                            title: item.title_ru + ' (' + item.year + ')',
                            img: item.poster_url,
                            url: item.id.toString(),
                            id: item.id
                        })).slice(0, CONFIG.maxResults);
                        callback(results);
                    } catch(e) { errback('Ошибка парсинга Filmix'); }
                }, errback);
            },
            links(id, callback, errback) {
                const url = `https://filmixapp.vip/api/v2/get-film-by-id?id=${id}`;
                safeRequest(url, (str) => {
                    try {
                        const json = JSON.parse(str);
                        const links = [];
                        if (json.playlist) json.playlist.forEach(l => links.push({ title: l.title, url: l.url, quality: l.quality }));
                        callback(links);
                    } catch(e) { callback([]); }
                }, errback);
            }
        },
        kodik: {
            search(query, callback, errback) {
                const url = `https://kodikapi.com/search?token=public_token&q=${encodeURIComponent(query)}`;
                safeRequest(url, (str) => {
                    try {
                        const json = JSON.parse(str);
                        const results = (json.results || []).map(item => ({
                            title: item.title,
                            img: item.poster || '',
                            url: item.link,
                            id: item.id
                        })).slice(0, CONFIG.maxResults);
                        callback(results);
                    } catch(e) { callback([]); }
                }, errback);
            },
            links(id, callback) {
                callback([{ title: 'Kodik', url: 'https://kodik.info/embed/' + id, quality: 'Auto' }]);
            }
        },
        videocdn: {
            search(query, callback, errback) {
                const url = `https://api.videocdn.tv/movies?api_token=3i4UbLuF&title=${encodeURIComponent(query)}`;
                safeRequest(url, (str) => {
                    try {
                        const json = JSON.parse(str);
                        const results = (json.data || []).map(item => ({
                            title: item.title,
                            img: item.poster,
                            url: item.id,
                            id: item.id
                        })).slice(0, CONFIG.maxResults);
                        callback(results);
                    } catch(e) { callback([]); }
                }, errback);
            },
            links(id, callback) {
                callback([{ title: 'VideoCDN', url: `https://videocdn.tv/movie/${id}`, quality: 'HD' }]);
            }
        }
    };

    // === Модальное окно поиска ===
    function createSearchModal(query, balancer) {
        Lampa.Modal.open({
            title: `Androzon — ${balancer.title}`,
            html: '<div class="search-body"><div class="loading">Поиск...</div></div>',
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            }
        });

        Parsers[balancer.parser].search(query, (results) => {
            const body = $('.modal .search-body');
            if (results.length === 0) return body.html('<div class="empty">Ничего не найдено</div>');

            const html = results.map(r =>
                `<div class="selector" data-item="${encodeURIComponent(JSON.stringify(r))}">
                    <div class="selector__img"><img src="${r.img || ''}"></div>
                    <div class="selector__title">${r.title}</div>
                </div>`
            ).join('');
            body.html(html);

            $('.modal .selector').on('hover:enter', function() {
                const item = JSON.parse(decodeURIComponent($(this).attr('data-item')));
                loadLinks(item, balancer);
            });
        }, (err) => {
            $('.modal .search-body').html('<div class="empty">Ошибка: ' + err + '</div>');
        });
    }

    function loadLinks(item, balancer) {
        Parsers[balancer.parser].links(item.id, (links) => {
            if (links.length === 0) return Lampa.Noty.show('Нет ссылок');
            const playlist = links.map(l => ({ title: l.title, url: l.url }));
            Lampa.Player.play(playlist, { title: item.title });
            Lampa.Modal.close();
        }, () => Lampa.Noty.show('Ошибка загрузки'));
    }

    // === Автопоиск после фильма ===
    if (isEnabled()) {
        Lampa.Listener.follow('full', (e) => {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                const query = cleanTitle(e.object.movie.title);
                if (query.length > 2) {
                    const top = BALANCERS.find(b => b.active);
                    setTimeout(() => createSearchModal(query, top), 2000);
                }
            }
        });
    }

    // === Добавляем кнопку в главное меню ===
    Lampa.Listener.follow('activity', function(e) {
        if (e.type === 'ready' && e.name === 'main') {
            setTimeout(() => {
                let activity = Lampa.Activity.active();
                if (!activity || !activity.render) return;

                let root = activity.render();
                let menu = root.find('.catalog__menu, .content__menu, .menu');
                if (!menu.length) return;

                if (!menu.find('.androzon-search').length) {
                    let btn = Lampa.Dom.create('div', {
                        class: 'selector selector--hover androzon-search',
                        html: '<div class="selector__ico">🔍</div><div class="selector__title">Androzon</div>'
                    });

                    menu.append(btn);

                    btn.on('hover:enter', function() {
                        Lampa.Modal.prompt('Введите название для поиска', '', function(query) {
                            if (query && query.length > 1) {
                                createSearchModal(query, BALANCERS[0]);
                            }
                        });
                    });

                    console.log('✅ Кнопка Androzon добавлена');
                }
            }, 1000);
        }
    });

    console.log(`✅ Androzon v${CONFIG.version} успешно загружен`);

})();
