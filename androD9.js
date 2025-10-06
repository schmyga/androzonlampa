// Enhanced Androzon Lampa Plugin - Fixed Render Error & Visibility
// Version: 2.3 - Removed Template.render() calls, pure HTML modals
// Added proper Params integration for Settings visibility
// Auto-trigger on movie load, manual button in catalog menu
// Compatible with Lampa TV D6+

(function() { 'use strict';

if (typeof Lampa === 'undefined') return;

// === CONFIGURATION ===
const CONFIG = {
    proxy: 'https://smotret24.ru/proxy?url=',
    filmixApi: 'https://filmixapp.vip/api/v2/',
    kodikApi: 'https://kodikapi.com/search',
    videocdnApi: 'https://api.videocdn.tv/api/short',
    timeout: 5000,
    maxResults: 10,
    pluginId: 'androzon'
};

// === BALANCERS ===
const BALANCERS = [
    {
        id: 'rezka',
        title: 'Rezka',
        url: 'https://rezka.ag',
        active: true,
        weight: 3,
        searchPath: '/search/?do=search&subaction=search&q=',
        parser: 'rezka'
    },
    {
        id: 'filmix',
        title: 'Filmix',
        url: CONFIG.filmixApi,
        active: true,
        weight: 2,
        searchPath: '/search',
        parser: 'filmix'
    },
    {
        id: 'kodik',
        title: 'Kodik',
        url: CONFIG.kodikApi,
        active: true,
        weight: 2,
        searchPath: '/?q=',
        parser: 'kodik'
    },
    {
        id: 'videocdn',
        title: 'VideoCDN',
        url: CONFIG.videocdnApi,
        active: true,
        weight: 1,
        searchPath: '?api_token=3i4UbLuF&title=',
        parser: 'videocdn'
    }
];

// === UTILS ===
function cleanTitle(title) {
    if (!title) return '';
    return title.replace(/\s*\(\d{4}\)/g, '').replace(/\s*(S\d+E\d+|сезон \d+|эпизод \d+)/gi, '').trim();
}

function safeRequest(url, success, error) {
    var req = new Lampa.Reguest();
    req.timeout(CONFIG.timeout);
    req.silent(url, function(data) {
        if (data && data.length > 0) {
            success(data);
        } else {
            if (error) error('Empty response');
        }
    }, function(err) {
        console.error('Request error:', err);
        if (error) error(err);
    });
}

function isEnabled() {
    return Lampa.Storage.get(CONFIG.pluginId + '_enabled', 'true') === 'true';
}

// === PARSERS ===
const Parsers = {
    rezka: {
        search: function(query, callback, errback) {
            var url = BALANCERS.find(b => b.id === 'rezka').url + BALANCERS.find(b => b.id === 'rezka').searchPath + encodeURIComponent(query);
            safeRequest(url, function(html) {
                var matches = html.match(/<div class="b-search-result__card[^>]*>([\s\S]*?)<\/div>/g) || [];
                var results = [];
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
                var iframeMatches = html.match(/data-frame="([^"]+)"/g) || [];
                var plinks = [];
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
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var results = (json.list || []).map(item => ({
                        title: item.title_ru + ' (' + item.year + ')',
                        img: item.poster_url,
                        url: item.id.toString(),
                        id: item.id
                    })).slice(0, CONFIG.maxResults);
                    callback(results);
                } catch(e) {
                    errback('JSON parse error');
                }
            }, errback);
        },
        links: function(id, callback, errback) {
            var url = CONFIG.filmixApi + 'get-film-by-id?id=' + id;
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var plinks = [];
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
            var url = CONFIG.kodikApi + encodeURIComponent(query);
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var results = (json || []).map(item => ({
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
            var url = CONFIG.videocdnApi + encodeURIComponent(query) + '&api_token=3i4UbLuF';
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
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
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var plinks = [];
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

// === SEARCH INTERFACE ===
// Use pure HTML to avoid Template.render() errors
function createSearch(query, balancer, onItemSelect) {
    var loadingHtml = '<div class="loading">Поиск: ' + query + '...</div>';
    var modalHtml = '<div class="search-container">' + loadingHtml + '</div>';

    Lampa.Modal.open({
        title: balancer.title + ' - Результаты поиска',
        html: modalHtml,
        size: 'large',
        onBack: function() { Lampa.Modal.close(); }
    });

    var parser = Parsers[balancer.parser];
    parser.search(query, function(results) {
        var container = $('.modal .search-container');
        if (results.length === 0) {
            container.html('<div class="empty">Ничего не найдено</div>');
            return;
        }
        var itemsHtml = results.map(function(item, index) {
            return '<div class="selector item-result" data-index="' + index + '">' +
                   '<div class="selector__img"><img src="' + (item.img || 'https://via.placeholder.com/150x225?text=No+Image') + '" onerror="this.src=\'https://via.placeholder.com/150x225?text=No+Image\'"></div>' +
                   '<div class="selector__title">' + item.title + '</div>' +
                   '</div>';
        }).join('');
        container.html('<div class="items">' + itemsHtml + '</div>');

        // Bind events safely
        setTimeout(function() {
            $('.modal .item-result').on('hover:enter', function() {
                var index = $(this).data('index');
                var item = results[index];
                loadLinks(item, balancer, onItemSelect);
            });
        }, 100);
    }, function(err) {
        $('.modal .search-container').html('<div class="empty">Ошибка: ' + err + '</div>');
        console.error('Search failed:', err);
    });
}

function loadLinks(item, balancer, onSelect) {
    var parser = Parsers[balancer.parser];
    parser.links(item.id, function(plinks) {
        if (plinks.length === 0) {
            Lampa.Noty.show('Ссылки не найдены');
            return;
        }
        var playlist = plinks.map(function(link) { 
            return { 
                title: link.title, 
                url: link.url, 
                subtitles: [] 
            }; 
        });
        Lampa.Player.play(playlist, { title: item.title });
        Lampa.Modal.close();
    }, function(err) {
        Lampa.Noty.show('Ошибка загрузки ссылок');
    });
}

// === AUTO-TRIGGER ===
if (isEnabled()) {
    Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite' && e.object && e.object.movie && e.object.movie.title) {
            var cleanQuery = cleanTitle(e.object.movie.title);
            if (cleanQuery.length < 2) return;

            var topBalancer = BALANCERS.filter(function(b) { return b.active; }).sort(function(a, b) { return b.weight - a.weight; })[0];
            if (topBalancer) {
                setTimeout(function() {
                    createSearch(cleanQuery, topBalancer, function(item, plinks) {});
                }, 1500);  // Increased delay for stable load
            }
        }
    });
}

// === PLUGIN REGISTRATION IN SETTINGS ===
// Add to Lampa Params for visibility in Settings > Plugins
Lampa.Params.parole(function(element) {
    if (!element.find('.selector[data-name="plugins"]').length) {
        var pluginsItem = $('<div class="selector" data-name="plugins"><div class="selector__title">Плагины</div></div>');
        element.append(pluginsItem);
        pluginsItem.on('hover:enter', function() {
            Lampa.Params.open({
                title: 'Плагины',
                html: createPluginSettingsHtml(),
                onBack: function() { Lampa.Params.close(); }
            });
        });
    }
});

function createPluginSettingsHtml() {
    var html = '<div class="about">';
    html += '<div class="selector"><div class="selector__title">Androzon Auto Search</div><div class="selector__descr">Авто-поиск ссылок на фильмы</div></div>';
    html += '<div class="selector" data-action="toggle"><div class="selector__title">Включить</div><div class="selector__value">' + (isEnabled() ? 'Да' : 'Нет') + '</div></div>';
    html += '<div class="selector" data-action="test"><div class="selector__title">Тест поиска</div></div>';
    html += '</div>';
    return html;
}

// Handle settings actions
$(document).on('click', '.about .selector[data-action="toggle"]', function() {
    var status = !isEnabled();
    Lampa.Storage.set(CONFIG.pluginId + '_enabled', status.toString());
    Lampa.Noty.show(status ? 'Androzon включён' : 'Androzon выключен');
    Lampa.Params.open({ title: 'Плагины', html: createPluginSettingsHtml() });
});

$(document).on('click', '.about .selector[data-action="test"]', function() {
    createSearch('Тестовый поиск', BALANCERS[0], function() {});
});

// === MANUAL BUTTON IN CATALOG MENU ===
Lampa.Listener.follow('catalog', function(e) {
    if (e.type === 'complite' && Lampa.Activity.active().activity && Lampa.Activity.active().activity.render) {
        var menu = Lampa.Activity.active().activity.render().find('.catalog__menu .selector').last();
        if (menu.length && !menu.next('.androzon-btn').length) {
            var btnHtml = '<div class="selector androzon-btn"><div class="selector__ico fa fa-search"></div><div class="selector__title">Androzon Поиск</div></div>';
            menu.after(btnHtml);
            $('.androzon-btn').on('hover:enter', function() {
                Lampa.Modal.open({
                    title: 'Androzon',
                    html: '<div class="about">Автоматический поиск ссылок включён. Выберите фильм для теста.</div>',
                    size: 'small',
                    onBack: function() { Lampa.Modal.close(); }
                });
            });
        }
    }
});

console.log('Androzon Plugin v2.3 Loaded - Fixed Render, Visible in Settings > Plugins');

})();
