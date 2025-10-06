(function () {
    'use strict';

    const PROXY_URL = 'https://smotret24.ru/proxy?url='; // прокси для обхода CORS
    const SOURCES = [
        { title: 'cine.to', url: 'https://cine.to', active: true },
        { title: 'kinoger.to', active: false },
        { title: 'movie4k.to', active: false },
        { title: 'filmfriend.de', active: false },
        { title: 'netzkino.de', active: false },
    ];

    function startPlugin() {
        Lampa.Api.add('Androzon', () => {});

        Lampa.Panel.add({
            name: 'Androzon',
            onSelect: () => showSources()
        });
    }

    function showSources() {
        const list = SOURCES.map(source => ({
            title: source.title + (source.active ? '' : ' (bald verfügbar)'),
            source
        }));

        Lampa.List.show({
            title: 'Androzon – Quellen',
            items: list,
            onSelect: (item) => {
                if (!item.source.active) {
                    Lampa.Noty.show('Diese Quelle ist noch nicht aktiv');
                    return;
                }
                showSearch(item.source);
            }
        });
    }

    function showSearch(source) {
        Lampa.Search.start({
            title: 'Suche in ' + source.title,
            onSearch: (query) => {
                const url = `${PROXY_URL}${encodeURIComponent(source.url + '/?s=' + encodeURIComponent(query))}`;
                fetch(url)
                    .then(r => r.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const items = [];

                        doc.querySelectorAll('.ml-item').forEach(el => {
                            const title = el.querySelector('h2') ? el.querySelector('h2').innerText.trim() : 'Unbekannt';
                            const link = el.querySelector('a') ? el.querySelector('a').href : '';
                            const poster = el.querySelector('img') ? el.querySelector('img').src : '';
                            if (link) items.push({ title, poster, link });
                        });

                        if (items.length === 0) {
                            Lampa.Noty.show('Nichts gefunden');
                            return;
                        }

                        showResults(source, items);
                    })
                    .catch(() => Lampa.Noty.show('Fehler beim Laden der Seite'));
            }
        });
    }

    function showResults(source, items) {
        Lampa.List.show({
            title: 'Ergebnisse – ' + source.title,
            items: items.map(item => ({
                title: item.title,
                poster: item.poster,
                item
            })),
            onSelect: (listItem) => {
                showMoviePage(source, listItem.item);
            }
        });
    }

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
            onSelect: (btn) => {
                loadMovieStream(source, btn.item);
            }
        });
    }

    function loadMovieStream(source, item) {
        const url = PROXY_URL + encodeURIComponent(item.link);
        Lampa.Noty.show('Lade Videoseite...');

        fetch(url)
            .then(r => r.text())
            .then(html => {
                const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
                if (iframeMatch) {
                    const streamUrl = iframeMatch[1];
                    Lampa.Player.play({
                        title: item.title,
                        url: streamUrl,
                        subtitles: [],
                        poster: item.poster
                    });
                } else {
                    Lampa.Noty.show('Kein Video gefunden 😕');
                }
            })
            .catch(() => Lampa.Noty.show('Fehler beim Laden des Videos'));
    }

    startPlugin();
})();
