(function(){
    'use strict';

    const PLUGIN_NAME = 'Androzon';
    const BALANCERS_JSON = 'https://raw.githubusercontent.com/schmyga/androzonlampa/main/plagin.json';
    const STORAGE_TOKEN = 'cub_token';
    const STORAGE_PROFILE = 'cub_profile';

    let TOKEN = Lampa.Storage.get(STORAGE_TOKEN, '');
    let PROFILE = Lampa.Storage.get(STORAGE_PROFILE, '');
    let BALANCERS = [];

    // ==================== Регистрация устройства ====================
    async function registerDevice(code){
        try {
            const res = await fetch('https://cub.rip/api/device/add', {
                method: 'POST',
                headers: {'content-type':'application/json'},
                body: JSON.stringify({code})
            });
            const data = await res.json();
            if(data.secuses){
                TOKEN = data.token;
                PROFILE = data.profile.id;
                Lampa.Storage.set(STORAGE_TOKEN, TOKEN);
                Lampa.Storage.set(STORAGE_PROFILE, PROFILE);
                Lampa.Noty.show('✅ Устройство добавлено');
                return true;
            } else {
                Lampa.Noty.show('❌ Ошибка регистрации устройства');
                return false;
            }
        } catch(e){
            console.error(e);
            Lampa.Noty.show('Ошибка сети');
            return false;
        }
    }

    // ==================== Загрузка балансеров ====================
    async function loadBalancers(){
        try {
            const res = await fetch(BALANCERS_JSON);
            BALANCERS = await res.json();
        } catch(e){
            console.error('Ошибка загрузки балансеров', e);
            BALANCERS = [];
        }
    }

    // ==================== Поиск через CUB ====================
    async function searchCub(query){
        if(!TOKEN){
            const code = await Lampa.Modal.prompt('Введите код с сайта cub.rip/add', '');
            if(!code) return [];
            const ok = await registerDevice(code);
            if(!ok) return [];
        }
        try {
            const res = await fetch(`https://cub.rip/api/search?query=${encodeURIComponent(query)}`, {
                headers: { 'token': TOKEN, 'profile': PROFILE }
            });
            const data = await res.json();
            return data.results || [];
        } catch(e){
            console.error('Ошибка поиска CUB', e);
            Lampa.Noty.show('❌ Ошибка поиска');
            return [];
        }
    }

    // ==================== Загрузка ссылок с балансеров ====================
    async function loadLinksFromBalancer(item, balancer){
        try {
            const res = await fetch(balancer.url + balancer.searchPath + encodeURIComponent(item.title));
            const html = await res.text();
            const links = [];
            const regex = /href="([^"]+)"/g;
            let m;
            while((m = regex.exec(html)) !== null){
                links.push({title: balancer.title, url: m[1], quality: 'HD'});
            }
            return links;
        } catch(e){
            console.error('Ошибка загрузки ссылок', e);
            return [];
        }
    }

    // ==================== Отображение результатов ====================
    async function showResults(list, query){
        const items = list.map(el => ({
            title: el.title || 'Без названия',
            img: el.poster || '',
            url: el.id || '',
            description: el.description || ''
        }));

        const activity = {
            component: 'search_results',
            title: `${PLUGIN_NAME}: ${query}`,
            results: items
        };
        Lampa.Activity.push(activity);

        $('.content__list .selector').on('hover:enter', async function(){
            const idx = $(this).index();
            const selected = items[idx];
            let links = [];

            for(const balancer of BALANCERS){
                if(balancer.active){
                    const l = await loadLinksFromBalancer(selected, balancer);
                    links = links.concat(l);
                }
            }

            if(links.length === 0){
                Lampa.Noty.show('❌ Ссылки не найдены');
                return;
            }

            const chosen = await Lampa.Modal.select('Выберите источник', links.map(l => ({
                title: l.title + ' [' + l.quality + ']', 
                value: l.url
            })));

            if(chosen) Lampa.Player.play([{title: selected.title, url: chosen, subtitles: []}]);
        });
    }

    // ==================== Добавление кнопки в меню ====================
    async function createAndrozonButton(){
        await loadBalancers();
        const activity = Lampa.Activity.active();
        if(!activity || !activity.render) return;
        const root = activity.render();
        const menu = root.find('.menu, .catalog__menu, .content__menu').first();
        if(!menu.length || menu.find('.androzon-search').length) return;

        const btn = $('<div class="selector androzon-search"><div class="selector__ico">🔍</div><div class="selector__title">Androzon</div></div>');
        menu.append(btn);

        btn.on('hover:enter', async function(){
            const query = await Lampa.Modal.prompt('Введите название для поиска', '');
            if(query && query.length > 1){
                const cubResults = await searchCub(query);
                showResults(cubResults, query);
            }
        });

        console.log('✅ Кнопка Androzon добавлена');
    }

    Lampa.Listener.follow('catalog', function(e){
        if(e.type === 'complite'){
            setTimeout(createAndrozonButton, 500);
        }
    });

    console.log('✅ Плагин Androzon v1 CDN загружен');
})();
