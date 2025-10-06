// Enhanced Androzon Lampa Plugin - Fixed Visibility for D6
// Version: 2.2 - Added proper plugin registration and menu integration
// Now visible in Settings > Plugins and auto-triggers on movie load
// Supports: Auto Search with Balancers (Rezka, Filmix, Kodik, VideoCDN)
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
function createSearch(query, balancer, onItemSelect) {
    var html = '<div class="search-container"><div class="loading">Поиск: ' + query + '</div></div>';
    var panel = Lampa.Template.get('full_start', { title: balancer.title + ' - Поиск' });
    panel.render().find('.full-start__body').html(html);

    var parser = Parsers[balancer.parser];
    parser.search(query, function(results) {
        if (results.length === 0) {
            panel.find('.loading').text('Ничего не найдено');
            return;
        }
        var itemsHtml = results.map(item => 
            '<div class="selector" data-url="' + item.url + '">' +
            '<div class="selector__img"><img src="' + (item.img || '') + '"></div>' +
            '<div class="selector__title">' + item.title + '</div>' +
            '</div>'
        ).join('');
        panel.find('.loading').replaceWith('<div class="items">' + itemsHtml + '</div>');

        panel.find('.selector').on('hover:enter', function() {
            var item = results[$(this).index()];
            loadLinks(item, balancer, onItemSelect);
        });
    }, function(err) {
        panel.find('.loading').text('Ошибка: ' + err);
        console.error('Search failed:', err);
    });

    Lampa.Modal.open({
        title: 'Результаты поиска',
        html: panel,
        size: 'large',
        onBack: function() { Lampa.Modal.close(); }
    });
}

function loadLinks(item, balancer, onSelect) {
    var parser = Parsers[balancer.parser];
    parser.links(item.id, function(plinks) {
        if (plinks.length === 0) {
            Lampa.Noty.show('Ссылки не найдены');
            return;
        }
        var playlist = plinks.map(link => ({ 
            title: link.title, 
            url: link.url, 
            subtitles: [] 
        }));
        Lampa.Player.play(playlist, { title: item.title });
        Lampa.Modal.close();
    }, function(err) {
        Lampa.Noty.show('Ошибка загрузки ссылок');
    });
}

// === AUTO-TRIGGER ===
if (isEnabled()) {
    Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
            var cleanQuery = cleanTitle(e.object.movie.title);
            if (cleanQuery.length < 2) return;

            var topBalancer = BALANCERS.filter(b => b.active).sort((a, b) => b.weight - a.weight)[0];
            if (topBalancer) {
                setTimeout(() => {
                    createSearch(cleanQuery, topBalancer, function(item, plinks) {});
                }, 1000);  // Delay to ensure movie loads
            }
        }
    });
}

// === PLUGIN REGISTRATION ===
// Register in Params for visibility in Settings > Plugins
Lampa.Params.trigger('plugins', {
    name: CONFIG.pluginId,
    title: 'Androzon Auto Search',
    component: true,
    html: function() {
        var html = '<div class="settings-folder">';
        html += '<div class="settings-folder__item selector" data-action="toggle">';
        html += '<div class="settings-folder__name">Включить авто-поиск</div>';
        html += '<div class="settings-folder__value selector" data-static="true">' + (isEnabled() ? 'Вкл' : 'Выкл') + '</div>';
        html += '</div>';
        html += '</div>';
        return html;
    },
    action: {
        toggle: function() {
            var status = !isEnabled();
            Lampa.Storage.set(CONFIG.pluginId + '_enabled', status.toString());
            Lampa.Noty.show(status ? 'Androzon включён' : 'Androzon выключен');
            Lampa.Params.update();
        }
    }
});

// Manual trigger button in main menu (optional visibility)
Lampa.Listener.follow('app', function(e) {
    if (e.type === 'ready') {
        var menuItem = {
            title: 'Androzon Поиск',
            html: '<div class="selector"><div class="selector__ico fa fa-search"></div><div class="selector__title">Androzon Auto</div></div>',
            onHover: function() {
                Lampa.Modal.open({
                    title: 'Androzon',
                    html: Lampa.Lang.translate('Включен авто-поиск по фильмам'),
                    size: 'small',
                    onBack: function() { Lampa.Modal.close(); }
                });
            }
        };
        // Add to catalog or full menu if possible
        if (Lampa.Activity.active().render) {
            Lampa.Activity.active().render().find('.full-start__menu .selector').last().after(menuItem.html);
            Lampa.Activity.active().render().find('.full-start__menu .selector').last().on('hover:enter', menuItem.onHover);
        }
    }
});

console.log('Androzon Plugin v2.2 Loaded - Visible in Settings');

})();
