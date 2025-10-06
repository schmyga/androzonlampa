(function () {
    'use strict';

    // Инициализация плагина
    Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') {
            var plugin = {
                name: 'GermanLegalSources',
                desc: 'Легальные источники для немецкой аудитории: ARD, ZDF, Joyn, Arte',
                version: 'v5.1',
                balanser: 'ard', // По умолчанию ARD
                balancers: {
                    ard: {
                        base: 'https://api.ardmediathek.de/search',
                        search: '?q=',
                        movie: '/documents/', // Пример для детальной страницы
                    },
                    zdf: {
                        base: 'https://api.zdf.de/content/documents',
                        search: '?q=',
                        movie: '/documents/', // Адаптировать по API
                    },
                    joyn: {
                        base: 'https://api.joyn.de/graphql', // Joyn использует GraphQL, но для простоты симулируем REST-подобный
                        search: '?query=search&q=', // Уточнить реальный endpoint
                    },
                    arte: {
                        base: 'https://api.arte.tv/api/v1/videos',
                        search: '?query=',
                        movie: '/', // Детали по ID
                    }
                },

                init: function () {
                    // Настройка кнопки балансера
                    var select = Lampa.Params.select('balanser', Object.keys(this.balancers).map(function (k) {
                        return {
                            title: k.toUpperCase(),
                            subtitle: '',
                            selected: plugin.balanser == k
                        };
                    }), 0);

                    select.on('hover', function () {});
                    select.on('select', function (item) {
                        plugin.balanser = Object.keys(plugin.balancers)[item.index];
                        Lampa.Storage.set('online_balanser', plugin.balanser);
                    });

                    Lampa.Params.listener(select, 'balanser');
                    plugin.balanser = Lampa.Storage.field('online_balanser') || plugin.balanser;
                },

                search: function (query, onSuccess, onError) {
                    var base = this.balancers[this.balanser].base;
                    var url = base + this.balancers[this.balanser].search + encodeURIComponent(query);

                    fetch(url, { method: 'GET' })
                        .then(function (res) { return res.json(); })
                        .then(function (json) {
                            var items = [];
                            // Обработка результатов в зависимости от балансера
                            if (plugin.balanser === 'ard') {
                                json.results.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.originalTitle || elem.title,
                                        release_year: elem.publicationDate ? new Date(elem.publicationDate).getFullYear() : '',
                                        url: elem.id, // Используем ID для детальной загрузки
                                        img: elem.teaserImage ? elem.teaserImage.url : ''
                                    });
                                });
                            } else if (plugin.balanser === 'zdf') {
                                // Адаптировать для ZDF JSON структуры
                                json.documents.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.title,
                                        release_year: elem.broadcastDate ? new Date(elem.broadcastDate).getFullYear() : '',
                                        url: elem.id,
                                        img: elem.mainVideoImageUrl || ''
                                    });
                                });
                            } else if (plugin.balanser === 'joyn') {
                                // Для Joyn: предположим GraphQL response, адаптировать
                                json.data.search.results.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.originalTitle,
                                        release_year: elem.year,
                                        url: elem.id,
                                        img: elem.image
                                    });
                                });
                            } else if (plugin.balanser === 'arte') {
                                json.value.forEach(function (elem) {
                                    items.push({
                                        title: elem.title,
                                        original_title: elem.originalTitle,
                                        release_year: elem.productionYear,
                                        url: elem.programId,
                                        img: elem.images[0].url
                                    });
                                });
                            }
                            onSuccess(items);
                        })
                        .catch(onError);
                },

                movie: function (params, onSuccess, onError) {
                    // Загрузка деталей фильма/сериала по ID
                    var base = this.balancers[this.balanser].base;
                    var url = base + this.balancers[this.balanser].movie + params.url;

                    fetch(url, { method: 'GET' })
                        .then(function (res) { return res.json(); })
                        .then(function (json) {
                            var data = {};
                            // Адаптировать по балансеру
                            if (plugin.balanser === 'ard') {
                                data.title = json.title;
                                data.original_title = json.originalTitle;
                                data.release_year = json.publicationDate ? new Date(json.publicationDate).getFullYear() : '';
                                data.description = json.longDescription;
                                data.genres = json.genres;
                                data.actors = json.cast;
                                data.directors = json.directors;
                                data.rating_kinopoisk = json.rating; // Если есть
                                data.rating_imdb = json.imdbRating;
                                data.poster = json.teaserImage.url;
                            } // Аналогично для других балансеров...
                            onSuccess(data);
                        })
                        .catch(onError);
                },

                seasons: function (params, onSuccess, onError) {
                    // Логика для сезонов, если сериал
                    // Аналогично movie, но fetch сезонов
                    onSuccess([]); // Заглушка, если не сериал
                },

                episodes: function (params, onSuccess, onError) {
                    // Логика для эпизодов
                    onSuccess([]); // Заглушка
                },

                stream: function (params, onSuccess, onError) {
                    // Возврат стриминговых ссылок (легальные из API)
                    var base = this.balancers[this.balanser].base;
                    var url = base + '/streams/' + params.url; // Адаптировать endpoint

                    fetch(url)
                        .then(function (res) { return res.json(); })
                        .then(function (json) {
                            var streams = [];
                            // Пример: json.streams.forEach(...) push {quality: 'HD', url: stream.url}
                            onSuccess(streams);
                        })
                        .catch(onError);
                }
            };

            Lampa.Plugins.add(plugin);
            plugin.init();
        }
    });
})();
