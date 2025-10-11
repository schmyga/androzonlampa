(function(){
    window.plugin = {
        type: 'online',
        name: 'ServikTV',
        version: '1.0',
        description: 'Источник Rezka с реальным воспроизведением',
        onLoad: function(){
            Lampa.Source.add('serviktv', {
                title: 'ServikTV',
                subtitle: 'Источник Rezka',
                search: function(query, call){
                    let url = 'https://rezka-source.vercel.app/search?q=' + encodeURIComponent(query);

                    fetch(url)
                        .then(res => res.json())
                        .then(json => {
                            let results = [];

                            json.forEach(item => {
                                results.push({
                                    title: item.title,
                                    url: item.url,
                                    player: true,
                                    timeline: [],
                                    quality: item.quality,
                                    voice: item.voice,
                                    info: item.info,
                                    poster: item.poster
                                });
                            });

                            call(results);
                        })
                        .catch(err => {
                            console.error('Ошибка Rezka:', err);
                            call([]);
                        });
                },
                item: function(url, call){
                    fetch('https://rezka-source.vercel.app/item?url=' + encodeURIComponent(url))
                        .then(res => res.json())
                        .then(json => {
                            call({
                                file: json.file,
                                quality: json.quality,
                                voice: json.voice
                            });
                        })
                        .catch(err => {
                            console.error('Ошибка получения видео:', err);
                            call({});
                        });
                }
            });
        },
        onUnload: function(){
            Lampa.Source.remove('serviktv');
        }
    };
})();
