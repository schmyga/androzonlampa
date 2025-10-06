// Androzon Lampa Plugin - Fixed Button Visibility Based on andro_v15.js (v3.2)
// Button Added via DOM Manipulation in full-start__menu on App Ready
// This matches the working structure from andro_v15.js
// Auto-search on movie load
// Manual search via button in main menu

(function() {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    const CONFIG = {
        pluginId: 'androzon',
        timeout: 5000,
        maxResults: 10
    };

    const BALANCERS = [
        { id: 'rezka', title: 'Rezka', url: 'https://rezka.ag', active: true, weight: 3, searchPath: '/search/?do=search&subaction=search&q=', parser: 'rezka' },
        { id: 'filmix', title: 'Filmix', url: 'https://filmixapp.vip/api/v2/', active: true, weight: 2, searchPath: '/search', parser: 'filmix' },
        { id: 'kodik', title: 'Kodik', url: 'https://kodikapi.com/search', active: true, weight: 2, searchPath: '/?q=', parser: 'kodik' },
        { id: 'videocdn', title: 'VideoCDN', url: 'https://api.videocdn.tv/api/short', active: true, weight: 1, searchPath: '?api_token=3i4UbLuF&title=', parser: 'videocdn' }
    ];

    function cleanTitle(title) {
        return title ? title.replace(/\s*\(\d{4}\)/g, '').replace(/\s*(S\d+E\d+|сезон \d+|эпизод \d+)/gi, '').trim() : '';
    }

    function isEnabled() {
        return Lampa.Storage.get(CONFIG.pluginId + '_enabled', 'true') === 'true';
    }

    function safeRequest(url, success, error) {
        Lampa.Reguest({
            url: url,
            timeout: CONFIG.timeout,
            success: success,
            error: error || function() {}
        });
    }

    const Parsers = {
        rezka: {
            search: function(query, callback, errback) {
                let balancer = BALANCERS.find(b => b.id === 'rezka');
                let url = balancer.url + balancer.searchPath + encodeURIComponent(query);
                safeRequest(url, function(html) {
                    let results = [];
                    let matches = html.match(/<div class="b-search-result__card[^>]*>([\s\S]*?)<\/div>/g) || [];
                    matches.slice(0, CONFIG.maxResults).forEach(match => {
                        let titleMatch = match.match(/<a[^>]*>([^<]+)<\/a>/);
                        let yearMatch = match.match(/\d{4}/);
                        let imgMatch = match.match(/src="([^"]+)"/);
                        let linkMatch = match.match(/href="([^"]+)"/);
                        if (titleMatch) {
                            results.push({
                                title: titleMatch[1].trim() + (yearMatch ? ' (' + yearMatch[0] + ')' : ''),
                                img: imgMatch ? imgMatch[1] : '',
                                url: linkMatch ? balancer.url + linkMatch[1] : '',
                                id: linkMatch ? linkMatch[1].split('/').pop() : ''
                            });
                        }
                    });
                    callback(results);
                }, errback);
            },
            links: function(id, callback, errback) {
                let url = BALANCERS.find(b => b.id === 'rezka').url + '/' + id;
                safeRequest(url, function(html) {
                    let plinks = [];
                    let iframeMatches = html.match(/data-frame="([^"]+)"/g) || [];
                    iframeMatches.forEach(match => {
                        let src = match.replace(/data-frame="/, '').replace(/"/, '');
                        plinks.push({ title: 'Rezka HD', url: src, quality: 'HD' });
                    });
                    callback(plinks.length > 0 ? plinks : [{ title: 'No links', url: '' }]);
                }, errback);
            }
        },
        filmix: {
            search: function(query, callback, errback) {
                let url = 'https://filmixapp.vip/api/v2/search?story=' + encodeURIComponent(query);
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let results = (json.list || []).map(item => ({
                            title: item.title_ru + ' (' + item.year + ')',
                            img: item.poster_url,
                            url: item.id.toString(),
                            id: item.id
                        })).slice(0, CONFIG.maxResults);
                        callback(results);
                    } catch(e) { errback('Parse error'); }
                }, errback);
            },
            links: function(id, callback, errback) {
                let url = 'https://filmixapp.vip/api/v2/get-film-by-id?id=' + id;
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let plinks = [];
                        if (json.playlist) json.playlist.forEach(link => plinks.push({ title: link.title, url: link.url, quality: link.quality }));
                        callback(plinks);
                    } catch(e) { callback([]); }
                }, errback);
            }
        },
        kodik: {
            search: function(query, callback, errback) {
                let url = 'https://kodik.info/search/?q=' + encodeURIComponent(query);
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let results = (json.results || []).map(item => ({
                            title: item.title,
                            img: item.poster || '',
                            url: item.id.toString(),
                            id: item.id
                        })).slice(0, CONFIG.maxResults);
                        callback(results);
                    } catch(e) { callback([]); }
                }, errback);
            },
            links: function(id, callback, errback) {
                callback([{ title: 'Kodik Embed', url: 'https://kodik.info/embed/' + id, quality: 'Auto' }]);
            }
        },
        videocdn: {
            search: function(query, callback, errback) {
                let url = 'https://api.videocdn.tv/api/short/' + encodeURIComponent(query) + '?api_token=3i4UbLuF';
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let results = (json.data || []).map(item => ({
                            title: item.title + ' (' + (item.year || '') + ')',
                            img: item.poster || '',
                            url: item.id.toString(),
                            id: item.id
                        })).slice(0, CONFIG.maxResults);
                        callback(results);
                    } catch(e) { callback([]); }
                }, errback);
            },
            links: function(id, callback, errback) {
                let url = 'https://api.videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF';
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let plinks = [];
                        if (json.embed && json.embed.playlist) json.embed.playlist.forEach(item => plinks.push({ title: item.name, url: item.file, quality: item.source || 'HD' }));
                        callback(plinks);
                    } catch(e) { callback([]); }
                }, errback);
            }
        }
    };

    function createSearchModal(query, balancer) {
        let html = '<div class="search-body"><div class="loading">Поиск "' + query + '" на ' + balancer.title + '...</div></div>';
        Lampa.Modal.open({
            title: 'Androzon Поиск',
            html: html,
            onBack: function() { Lampa.Modal.close(); Lampa.Controller.toggle('content'); }
        });

        let parser = Parsers[balancer.parser];
        parser.search(query, function(results) {
            let body = $('.modal .search-body');
            if (results.length === 0) { body.html('<div class="empty">Ничего не найдено</div>'); return; }

            let items = results.map(item => '<div class="selector" data-item="' + JSON.stringify(item).replace(/"/g, '&quot;') + '">' +
                        '<div class="selector__img"><img src="' + (item.img || '') + '" /></div>' +
                        '<div class="selector__title">' + item.title + '</div></div>').join('');
            body.html(items);

            $('.modal .selector').on('hover:enter', function() {
                let item = JSON.parse($(this).attr('data-item'));
                loadLinks(item, balancer);
            });
        }, function(err) { $('.modal .search-body').html('<div class="empty">Ошибка: ' + err + '</div>'); });
    }

    function loadLinks(item, balancer) {
        let parser = Parsers[balancer.parser];
        parser.links(item.id, function(plinks) {
            if (plinks.length === 0) { Lampa.Noty.show('Ссылки не найдены'); return; }
            let playlist = plinks.map(p => ({ title: p.title, url: p.url, subtitles: [] }));
            Lampa.Player.play(playlist, { title: item.title });
            Lampa.Modal.close();
        }, function() { Lampa.Noty.show('Ошибка загрузки'); });
    }

    // Автопоиск
    if (isEnabled()) {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                let query = cleanTitle(e.object.movie.title);
                if (query.length < 2) return;
                let top = BALANCERS.filter(b => b.active).sort((a,b) => b.weight - a.weight)[0];
                if (top) setTimeout(() => createSearchModal(query, top), 2000);
            }
        });
    }

    // Кнопка в главном меню - точно как в andro_v15.js: DOM append to .full-start__menu on app ready
    Lampa.Listener.follow('app', function(e) {
        if (e.type === 'ready') {
            setTimeout(function() {
                let menu = $('.full-start__menu');
                if (menu.length && !menu.find('.androzon-btn').length) {
                    let btn = $('<div class="selector androzon-btn"><div class="selector__ico fa fa-search"></div><div class="selector__title">Androzon</div></div>');
                    menu.append(btn);
                    btn.on('hover:enter', function() {
                        Lampa.Modal.open({
                            title: 'Androzon - Поиск',
                            html: '<div class="input"><input type="text" id="androzon-query" placeholder="Введите название фильма"></div><div class="selector" style="margin-top:10px;"><div class="selector__title">Найти</div></div>',
                            onBack: function() { Lampa.Modal.close(); },
                            onEnter: function() {
                                let query = $('#androzon-query').val();
                                if (query && query.length > 1) {
                                    createSearchModal(query, BALANCERS[0]);
                                    Lampa.Modal.close();
                                } else {
                                    Lampa.Noty.show('Введите название');
                                }
                            }
                        });
                        setTimeout(() => $('#androzon-query').focus(), 100);
                    });
                    console.log('Androzon button added to full-start__menu');
                }
            }, 1500);  // Delay to ensure menu is rendered
        }
    });

    // Настройки в Params (fallback)
    try {
        Lampa.Params.select(CONFIG.pluginId, 'Androzon', {
            enabled: {
                title: 'Включить',
                type: 'toggle',
                value: isEnabled(),
                onChange: function(v) {
                    Lampa.Storage.set(CONFIG.pluginId + '_enabled', v);
                    Lampa.Noty.show(v ? 'Включен' : 'Выключен');
                }
            }
        });
    } catch (e) {
        console.warn('Params setup skipped');
    }

    console.log('Androzon v3.2 - Button added via DOM to full-start__menu on app ready (like andro_v15.js)');
})();
