(function () {
    'use strict';

    Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') {
            var plugin = {
                name: 'AndroGermanLegal',
                desc: 'Легальные DE-источники: ARD, ZDF, Joyn, Arte',
                version: 'v2-fixed',
                balanser: 'ard',
                balancers: {
                    ard: {
                        base: 'https://api.ardmediathek.de',
                        search: '/search?q=',
                        movie: '/documents/',
                        stream: '/streams/' // Адаптировать по ID
                    },
                    zdf: {
                        base: 'https://api.zdf.de/content',
                        search: '/documents?q=',
                        movie: '/documents/',
                        stream: '/streams/'
                    },
                    joyn: {
                        base: 'https://api.joyn.de/v1/search',
                        search: '?q=',
                        movie: '/items/',
                        stream: '/streams/'
                    },
                    arte: {
                        base: 'https://api.arte.tv/api/v1/videos',
                        search: '?query=',
                        movie: '',
                        stream: '/streams/'
                    }
                },

                init: function () {
                    // Кнопки балансера
                    var selects = [];
                    for (var i in this.balancers) {
                        selects.push({
                            title: i.toUpperCase(),
                            selected: this.balanser == i
                        });
                    }
                    var select = Lampa.Params.select('online_balanser', selects, 0);
                    select.on('hover', function () {});
                    select.on('select', function (item) {
                        plugin.balanser = Object.keys(plugin.balancers)[item.index];
                        Lampa.Storage.set('online_balanser', plugin.balanser);
                        Lampa.Noty.show('Балансер: ' + plugin.balanser.toUpperCase());
                    });
                    Lampa.Params.listener(select, 'online_balanser');
                    this.balanser = Lampa.Storage.field('online_balanser') || this.balanser;
                },

                search: function (query, onSuccess, onError) {
                    var b = this.balancers[this.balanser];
                    var url = b.base + b.search + encodeURIComponent(query) + '&limit=20';
                    fetch(url, { method: 'GET', mode: 'cors' })
                        .then(function (res) { return res.json(); })
                        .then(function (json) {
                            var items = [];
                            if (plugin.balanser === 'ard') {
                                if (json.results) json.results.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.originalTitle || elem.title,
                                        release_year: elem.publicationDate ? new Date(elem.publicationDate).getFullYear() : '',
                                        url: elem.id,
                                        img: elem.teaserImage ? elem.teaserImage.url : '',
                                        description: elem.shortDescription
                                    });
                                });
                            } else if (plugin.balanser === 'zdf') {
                                if (json.documents) json.documents.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.title,
                                        release_year: elem.broadcastDate ? new Date(elem.broadcastDate).getFullYear() : '',
                                        url: elem.id,
                                        img: elem.mainVideoImageUrl || '',
                                        description: elem.teaserText
                                    });
                                });
                            } else if (plugin.balanser === 'joyn') {
                                if (json.items) json.items.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.originalTitle,
                                        release_year: elem.year || '',
                                        url: elem.id,
                                        img: elem.image || '',
                                        description: elem.description
                                    });
                                });
                            } else if (plugin.balanser === 'arte') {
                                if (json.value) json.value.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.originalTitle,
                                        release_year: elem.productionYear || '',
                                        url: elem.programId,
                                        img: elem.images ? elem.images[0].url : '',
                                        description: elem.shortDescription
                                    });
                                });
                            }
                            onSuccess(items);
                        })
                        .catch(function (err) {
                            Lampa.Noty.show('Ошибка поиска: ' + err.message);
                            onError(err);
                        });
                },

                movie: function (params, onSuccess, onError) {
                    var b = this.balancers[this.balanser];
                    var url = b.base + b.movie + params.url;
                    fetch(url, { method: 'GET', mode: 'cors' })
                        .then(function (res) { return res.json(); })
                        .then(function (json) {
                            var data = {
                                title: json.title || params.title,
                                original_title: json.originalTitle || params.original_title,
                                release_year: json.publicationDate ? new Date(json.publicationDate).getFullYear() : params.release_year,
                                description: json.longDescription || json.description,
                                poster: json.teaserImage ? json.teaserImage.url : params.img,
                                genres: json.genres || [],
                                actors: json.cast || [],
                                directors: json.directors || []
                            };
                            onSuccess(data);
                        })
                        .catch(onError);
                },

                seasons: function (params, onSuccess, onError) {
                    // Заглушка для сериалов — доработай по API (e.g., ARD seasons endpoint)
                    onSuccess([]);
                },

                episodes: function (params, onSuccess, onError) {
                    // Заглушка
                    onSuccess([]);
                },

                stream: function (params, onSuccess, onError) {
                    var b = this.balancers[this.balanser];
                    var url = b.base + b.stream + params.url;
                    fetch(url, { method: 'GET', mode: 'cors' })
                        .then(function (res) { return res.json(); })
                        .then(function (json) {
                            var streams = [];
                            // Пример: для ARD/ZDF — json.streams или json.urls
                            if (json.urls) {
                                json.urls.forEach(function (stream) {
                                    streams.push({
                                        quality: stream.quality || 'HD',
                                        url: stream.url,
                                        hls: stream.hls || false,
                                        subtitles: stream.subtitles || []
                                    });
                                });
                            }
                            if (streams.length === 0) {
                                streams.push({ quality: 'Auto', url: params.url + '/default.m3u8' }); // Fallback
                            }
                            onSuccess(streams);
                        })
                        .catch(onError);
                }
            };

            // Правильное переопределение Lampa.Search.start
            Lampa.Search.start = function (find, onSearch, onError) {
                plugin.search(find, onSearch, onError);
            };

            // Добавление плагина
            Lampa.Plugins.add('online', plugin);
            plugin.init();
        }
    });
})();
