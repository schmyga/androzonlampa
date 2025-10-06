(function(){
    var plugin = {};

    // Список источников/балансировщиков
    plugin.sources = [
        { name: "Rezka", baseUrl: "https://rezka.ag/series/{id}" },
        { name: "Filmix", baseUrl: "https://filmix.ac/film/{id}" },
        { name: "CDNVideoHub", baseUrl: "https://cdnvideohub.com/watch/{id}" },
        { name: "Kodik", baseUrl: "https://kodikapi.com/watch/{id}" }
    ];

    // Получение потока по ID
    plugin.getStream = async function(id) {
        for(let source of this.sources){
            let url = source.baseUrl.replace("{id}", id);
            if(await this.checkStream(url)){
                return { url: url, source: source.name };
            }
        }
        return null;
    };

    // Проверка доступности потока
    plugin.checkStream = async function(url){
        try {
            let response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch(e) {
            return false;
        }
    };

    // Пример функции поиска и получения плейлиста
    plugin.search = async function(query){
        let results = [];
        for(let source of this.sources){
            let searchUrl = source.baseUrl.replace("{id}", encodeURIComponent(query));
            results.push({ title: query, url: searchUrl, source: source.name });
        }
        return results;
    };

    // Регистрация плагина в Lampa
    if(typeof Lampa !== "undefined"){
        Lampa.plugins.register("androzon", plugin);
    } else {
        window.AndrozonPlugin = plugin;
    }

})();
