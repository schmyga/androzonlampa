(function () {
    'use strict';

    // === НАСТРОЙКИ ===
    const PROXY_URL = 'https://smotret24.ru/proxy?url='; // надёжный прокси для обхода CORS
    const SOURCES = [
        { title: 'cine.to', url: 'https://cine.to', active: true },
        { title: 'kinoger.to', url: 'https://kinoger.to', active: false },
        { title: 'filmfriend.de', url: 'https://www.filmfriend.de', active: false },
        { title: 'netzkino.de', url: 'https://www.netzkino.de', active: false }
    ];

    // === ИНИЦИАЛИЗАЦИЯ ПЛАГИНА ===
    function startPlugin() {
        console.log('Androzon Plugin gestartet ✅');

        // Добавляем кнопку в боковое меню Lampa
        Lampa.Panel.add({
            name: 'Androzon',
            onSelect: showSources
        });

        // Регистрируем источник для Lampa.Api
        Lampa.Api.add('Androzon', () => {});
    }

    // === ВЫБОР ИСТОЧНИКА ===
    function showSources() {
        const list = SOURCES.map(source => ({
            title: source.title + (source.active ? '' : ' (demnächst)'),
            source
        }));

        Lampa.List.show({
            title: 'Androzon – Quellen',
            items: list,
            onSelect: item => {
                if (!item.source.active) {
                    Lampa.Noty.show('Diese Quelle ist noch nicht aktiv');
                    return;
                }
                showSearch(item.source);
            }
        });
    }

    // === ПОИСК ФИЛЬМА ===
    function showSearch(source) {
        Lampa.Search.start({
            title: 'Suche in ' + source.title,
            onSearch: query => {
                const searchUrl = `${PROXY_URL}${encodeURIComponent(source.url + '/?s=' + encodeURIComponent(query))}`;

                Lampa.Noty.show('Suche läuft... 🔍');

                fetch(searchUrl)
                    .then(r => r.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const items = [];

                        doc.querySelectorAll('.ml-item, .movie, article').forEach(el => {
                            const a = el.querySelector('a');
                            const img = el.querySelector('img');
                            const h2 = el.querySelector('h2, .title');

                            const link = a ? a.href : '';
                            const poster = img ? img.src : '';
                            const title = h2 ? h2.textContent.trim() : (a ? a.title || a.textContent.trim() : '');

                            if (link && title) {
                                items.push({ title, poster, link });
                            }
                        });

                        if (items.length === 0) {
                            Lampa.Noty.show('Nichts gefunden 😕');
                            return;
                        }

                        showResults(source, items);
                    })
                    .catch(err => {
                        console.error('Fehler bei Suche:', err);
                        Lampa.Noty.show('Fehler beim Laden der Seite');
                    });
            }
        });
    }

    // === СПИСОК РЕЗУЛЬТАТОВ ===
    function showResults(source, items) {
        Lampa.List.show({
            title: 'Ergebnisse – ' + source.title,
            items: items.map(item => ({
                title: item.title,
                poster: item.poster,
                item
            })),
            onSelect: listItem => showMoviePage(source, listItem.item)
        });
    }

    // === СТРАНИЦА ФИЛЬМА ===
    function showMoviePage(source, item) {
        Lampa.List.show({
            title: item.title,
            items: [
                {
                    title: '🎬 Film ansehen',
                    subtitle: 'Über ' + source.title,
                    item
                }
            ],
            onSelect: btn => loadMovieStream(source, btn.item)
        });
    }

    // === ЗАГРУЗКА СТРАНИЦЫ ФИЛЬМА ===
    function loadMovieStream(source, item) {
        const pageUrl = PROXY_URL + encodeURIComponent(item.link);

        Lampa.Noty.show('Lade Videoseite... ⏳');

        fetch(pageUrl)
            .then(r => r.text())
            .then(html => {
                // Находим iframe с видеоплеером
                const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
                if (!iframeMatch) {
                    Lampa.Noty.show('Kein Video gefunden 😕');
                    return;
                }

                const videoUrl = iframeMatch[1];

                // Некоторые iframe могут быть относительными ссылками
                const finalUrl = videoUrl.startsWith('http') ? videoUrl : new URL(videoUrl, source.url).href;

                console.log('🎥 Stream URL gefunden:', finalUrl);

                // Запускаем плеер Lampa
                Lampa.Player.play({
                    title: item.title,
                    url: finalUrl,
                    poster: item.poster || '',
                    subtitles: []
                });
            })
            .catch(err => {
                console.error('Fehler beim Laden:', err);
                Lampa.Noty.show('Fehler beim Laden des Videos');
            });
    }

    // === СТАРТ ===
    startPlugin();

})();
