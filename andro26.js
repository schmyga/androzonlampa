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
                let bal = BALANCERS.find(b => b.id === 'rezka');
                let url = bal.url + bal.searchPath + encodeURIComponent(query);
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
                                url: linkMatch ? bal.url + linkMatch[1] : '',
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
                    iframeMatches.forEach(m => {
                        let src = m.replace(/data-frame="/, '').replace(/"/, '');
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
                    } catch(e) {
                        errback('Parse error');
                    }
                }, errback);
            },
            links: function(id, callback, errback) {
                let url = 'https://filmixapp.vip/api/v2/get-film-by-id?id=' + id;
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let plinks = [];
                        if (json.playlist) {
                            json.playlist.forEach(link => {
                                plinks.push({ title: link.title, url: link.url, quality: link.quality });
                            });
                        }
                        callback(plinks);
                    } catch(e) {
                        callback([]);
                    }
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
                    } catch(e) {
                        callback([]);
                    }
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
                    } catch(e) {
                        callback([]);
                    }
                }, errback);
            },
            links: function(id, callback, errback) {
                let url = 'https://api.videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF';
                safeRequest(url, function(str) {
                    try {
                        let json = JSON.parse(str);
                        let plinks = [];
                        if (json.embed && json.embed.playlist) {
                            json.embed.playlist.forEach(item => {
                                plinks.push({ title: item.name, url: item.file, quality: item.source || 'HD' });
                            });
                        }
                        callback(plinks);
                    } catch(e) {
                        callback([]);
                    }
                }, errback);
            }
        }
    };

    function createSearchModal(query, balancer) {
        let html = '<div class="search-body"><div class="loading">Поиск "' + query + '" на ' + balancer.title + '...</div></div>';
        Lampa.Modal.open({
            title: 'Androzon Поиск',
            html: html,
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            }
        });

        let parser = Parsers[balancer.parser];
        parser.search(query, function(results) {
            let body = $('.modal .search-body');
            if (results.length === 0) {
                body.html('<div class="empty">Ничего не найдено</div>');
                return;
            }
            let items = results.map(item => '<div class="selector" data-item="' +
                      JSON.stringify(item).replace(/"/g, '&quot;') + '">' +
                      '<div class="selector__img"><img src="' + (item.img || '') + '" /></div>' +
                      '<div class="selector__title">' + item.title + '</div></div>').join('');
            body.html(items);

            $('.modal .selector').on('hover:enter', function() {
                let item = JSON.parse($(this).attr('data-item'));
                loadLinks(item, balancer);
            });
        }, function(err) {
            $('.modal .search-body').html('<div class="empty">Ошибка: ' + err + '</div>');
        });
    }

    function loadLinks(item, balancer) {
        let parser = Parsers[balancer.parser];
        parser.links(item.id, function(plinks) {
            if (plinks.length === 0) {
                Lampa.Noty.show('Ссылки не найдены');
                return;
            }
            let playlist = plinks.map(p => ({ title: p.title, url: p.url, subtitles: [] }));
            Lampa.Player.play(playlist, { title: item.title });
            Lampa.Modal.close();
        }, function() {
            Lampa.Noty.show('Ошибка загрузки');
        });
    }

    // Автозапуск при окончании просмотра
    if (isEnabled()) {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                let query = cleanTitle(e.object.movie.title);
                if (query.length < 2) return;
                let sorted = BALANCERS.filter(b => b.active).sort((a,b) => b.weight - a.weight);
                if (sorted.length > 0) {
                    setTimeout(() => createSearchModal(query, sorted[0]), 2000);
                }
            }
        });
    }

    // **Исправленный код кнопки ручного поиска**
    Lampa.Listener.follow('catalog', function(e) {
        if (e.type === 'complite') {
            let activity = Lampa.Activity.active();
            if (!activity || !activity.render) return;

            // Подход: найти контейнер меню, часто с классом '.catalog__menu' или '.content__menu'
            let root = activity.render();
            let menu = root.find('.catalog__menu');
            if (!menu.length) {
                // В некоторых версиях меню может быть внутри другого узла
                menu = root.find('.content__menu'); 
            }
            if (!menu.length) {
                // Если всё же не нашли, можно попытаться в корневом элементе
                menu = root.find('.menu');
            }

            if (menu.length && !menu.find('.androzon-search').length) {
                let btn = Lampa.Dom.create('div', {
                    class: 'selector androzon-search',
                    html: '<div class="selector__ico">🔍</div><div class="selector__title">Androzon Поиск</div>'
                });
                menu.append(btn);

                btn.on('hover:enter', function() {
                    Lampa.Modal.prompt('Введите название для поиска', '', function(query) {
                        if (query && query.length > 1) {
                            createSearchModal(query, BALANCERS[0]);
                        }
                    });
                });
            }
        }
    });

    // Настройки плагина в меню
    let originalPlugins = Lampa.Params.options.plugins;
    if (originalPlugins && typeof originalPlugins === 'object') {
        originalPlugins[CONFIG.pluginId] = 'Androzon Auto Search';
        Lampa.Storage.set('plugins', Object.keys(originalPlugins).join(','));
    }

    Lampa.Params.select(CONFIG.pluginId, '', {
        'enabled': {
            title: 'Включить Androzon',
            html: '<div class="settings-folder__value">' + (isEnabled() ? 'Вкл' : 'Выкл') + '</div>',
            value: isEnabled(),
            toggle: function() {
                let status = !isEnabled();
                Lampa.Storage.set(CONFIG.pluginId + '_enabled', status);
                Lampa.Noty.show(status ? 'Androzon включен' : 'Androzon выключен');
                Lampa.Params.update();
            }
        }
    });

    console.log('Androzon v2.5 (исправлена кнопка по меню)');
})();
