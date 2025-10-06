// Enhanced Androzon Lampa Plugin - Compatible with Lampa D6+ (v2.4)
// Based on standard Lampa plugin structure to avoid errors
// Fixed: Removed problematic DOM manipulations and Template calls
// Visibility: Added to Params 'plugins' option if exists
// Auto-trigger: On full movie complite
// Manual: Added button to main menu if possible
// Supports: Rezka, Filmix, Kodik, VideoCDN balancers

(function() { 'use strict';

    if (typeof Lampa === 'undefined') return;

    // === CONFIG ===
    const CONFIG = {
        pluginId: 'androzon',
        timeout: 5000,
        maxResults: 10
    };

    // === BALANCERS ===
    const BALANCERS = [
        { id: 'rezka', title: 'Rezka', url: 'https://rezka.ag', active: true, weight: 3, searchPath: '/search/?do=search&subaction=search&q=', parser: 'rezka' },
        { id: 'filmix', title: 'Filmix', url: 'https://filmixapp.vip/api/v2/', active: true, weight: 2, searchPath: '/search', parser: 'filmix' },
        { id: 'kodik', title: 'Kodik', url: 'https://kodikapi.com/search', active: true, weight: 2, searchPath: '/?q=', parser: 'kodik' },
        { id: 'videocdn', title: 'VideoCDN', url: 'https://api.videocdn.tv/api/short', active: true, weight: 1, searchPath: '?api_token=3i4UbLuF&title=', parser: 'videocdn' }
    ];

    // === UTILS ===
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

    // === PARSERS ===
    const Parsers = {
        rezka: {
            search: function(query, callback, errback) {
                var url = BALANCERS.find(b => b.id === 'rezka').url + BALANCERS.find(b => b.id === 'rezka').searchPath + encodeURIComponent(query);
                safeRequest(url, function(html) {
                    var results = [];
                    var matches = html.match(/<div class="b-search-result__card[^>]*>([\s\S]*?)<\/div>/g) || [];
                    matches.slice(0, CONFIG.maxResults).forEach(function(match) {
                        var titleMatch = match.match(/<a[^>]*>([^<]+)<\/a>/);
                        var yearMatch = match.match(/\d{4}/);
                        var imgMatch = match.match(/src="([^"]+)"/);
                        var linkMatch = match.match(/href="([^"]+)"/);
                        if (titleMatch) {
                            results.push({
                                title: titleMatch[1].trim() + (yearMatch ? ' (' + yearMatch[0] + ')' : ''),
                                img: imgMatch ? imgMatch[1] : '',
                                url: linkMatch ? BALANCERS.find(b => b.id === 'rezka').url + linkMatch[1] : '',
                                id: linkMatch ? linkMatch[1].split('/').pop() : ''
                            });
                        }
                    });
                    callback(results);
                }, errback);
            },
            links: function(id, callback, errback) {
                var url = BALANCERS.find(b => b.id === 'rezka').url + '/' + id;
                safeRequest(url, function(html) {
                    var plinks = [];
                    var iframeMatches = html.match(/data-frame="([^"]+)"/g) || [];
                    iframeMatches.forEach(function(match) {
                        var src = match.replace(/data-frame="/, '').replace(/"/, '');
                        plinks.push({ title: 'Rezka HD', url: src, quality: 'HD' });
                    });
                    callback(plinks.length > 0 ? plinks : [{ title: 'No links', url: '' }]);
                }, errback);
            }
        },
        filmix: {
            search: function(query, callback, errback) {
                var url = CONFIG.filmixApi + 'search?story=' + encodeURIComponent(query);
                safeRequest(url, function(str) {
                    try {
                        var json = JSON.parse(str);
                        var results = (json.list || []).map(item => ({
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
                var url = 'https://filmixapp.vip/api/v2/get-film-by-id?id=' + id;
                safeRequest(url, function(str) {
                    try {
                        var json = JSON.parse(str);
                        var plinks = [];
                        if (json.playlist) json.playlist.forEach(link => plinks.push({ title: link.title, url: link.url, quality: link.quality }));
                        callback(plinks);
                    } catch(e) {
                        callback([]);
                    }
                }, errback);
            }
        },
        kodik: {
            search: function(query, callback, errback) {
                var url = 'https://kodik.info/search/?q=' + encodeURIComponent(query);
                safeRequest(url, function(str) {
                    try {
                        var json = JSON.parse(str);
                        var results = (json.results || []).map(item => ({
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
                var url = 'https://api.videocdn.tv/api/short/' + encodeURIComponent(query) + '?api_token=3i4UbLuF';
                safeRequest(url, function(str) {
                    try {
                        var json = JSON.parse(str);
                        var results = (json.data || []).map(item => ({
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
                var url = 'https://api.videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF';
                safeRequest(url, function(str) {
                    try {
                        var json = JSON.parse(str);
                        var plinks = [];
                        if (json.embed && json.embed.playlist) json.embed.playlist.forEach(item => plinks.push({ title: item.name, url: item.file, quality: item.source || 'HD' }));
                        callback(plinks);
                    } catch(e) {
                        callback([]);
                    }
                }, errback);
            }
        }
    };

    // === SEARCH MODAL ===
    function createSearchModal(query, balancer) {
        var html = '<div class="search-body"><div class="loading">Поиск "' + query + '" на ' + balancer.title + '...</div></div>';
        Lampa.Modal.open({
            title: 'Androzon Поиск',
            html: html,
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            }
        });

        var parser = Parsers[balancer.parser];
        parser.search(query, function(results) {
            var body = $('.modal .search-body');
            if (results.length === 0) {
                body.html('<div class="empty">Ничего не найдено</div>');
                return;
            }
            var items = results.map(function(item) {
                return '<div class="selector" data-item="' + JSON.stringify(item).replace(/"/g, '&quot;') + '">' +
                       '<div class="selector__img"><img src="' + (item.img || '') + '" /></div>' +
                       '<div class="selector__title">' + item.title + '</div>' +
                       '</div>';
            }).join('');
            body.html(items);

            $('.modal .selector').on('hover:enter', function() {
                var item = JSON.parse($(this).attr('data-item'));
                loadLinks(item, balancer);
            });
        }, function(err) {
            $('.modal .search-body').html('<div class="empty">Ошибка: ' + err + '</div>');
        });
    }

    function loadLinks(item, balancer) {
        var parser = Parsers[balancer.parser];
        parser.links(item.id, function(plinks) {
            if (plinks.length === 0) {
                Lampa.Noty.show('Ссылки не найдены');
                return;
            }
            var playlist = plinks.map(function(p) {
                return { title: p.title, url: p.url, subtitles: [] };
            });
            Lampa.Player.play(playlist, { title: item.title });
            Lampa.Modal.close();
        }, function() {
            Lampa.Noty.show('Ошибка загрузки');
        });
    }

    // === AUTO TRIGGER ===
    if (isEnabled()) {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                var query = cleanTitle(e.object.movie.title);
                if (query.length < 2) return;
                var top = BALANCERS.filter(b => b.active).sort((a, b) => b.weight - a.weight)[0];
                if (top) {
                    setTimeout(function() {
                        createSearchModal(query, top);
                    }, 2000);
                }
            }
        });
    }

    // === PLUGIN MENU INTEGRATION ===
    // Add to existing 'plugins' option in Params
    var originalPlugins = Lampa.Params.options.plugins;
    if (originalPlugins && typeof originalPlugins === 'object') {
        originalPlugins[CONFIG.pluginId] = 'Androzon Auto Search';
        Lampa.Storage.set('plugins', Object.keys(originalPlugins).join(','));
    }

    // Add settings toggle if Params has plugins section
    Lampa.Params.select(CONFIG.pluginId, '', {
        'enabled': {
            title: 'Включить Androzon',
            html: '<div class="settings-folder__value">' + (isEnabled() ? 'Вкл' : 'Выкл') + '</div>',
            value: isEnabled(),
            toggle: function() {
                var status = !isEnabled();
                Lampa.Storage.set(CONFIG.pluginId + '_enabled', status);
                Lampa.Noty.show(status ? 'Androzon включен' : 'Androzon выключен');
                Lampa.Params.update();
            }
        }
    });

    // Manual search button in catalog
    Lampa.Listener.follow('catalog', function(e) {
        if (e.type === 'complite') {
            var activity = Lampa.Activity.active();
            if (activity && activity.render) {
                var menu = activity.render().find('.catalog__menu');
                if (menu.length && !menu.find('.androzon-search').length) {
                    var btn = $('<div class="selector androzon-search"><div class="selector__ico">🔍</div><div class="selector__title">Androzon Поиск</div></div>');
                    menu.append(btn);
                    btn.on('hover:enter', function() {
                        var query = prompt('Введите название для поиска:');
                        if (query) {
                            var top = BALANCERS[0];
                            createSearchModal(query, top);
                        }
                    });
                }
            }
        }
    });

    console.log('Androzon v2.4 loaded - Check Settings > Plugins');

})();
