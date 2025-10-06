(function(){
    'use strict';

    const PLUGIN_NAME = 'Androzon';

    function addButton(){
        const activity = Lampa.Activity.active();
        if(!activity || !activity.render) return false;

        const root = activity.render();
        const menu = root.find('.menu, .catalog__menu, .content__menu').first();
        if(!menu.length || menu.find('.androzon-search').length) return false;

        const btn = $('<div class="selector androzon-search"><div class="selector__ico">🔍</div><div class="selector__title">Androzon</div></div>');
        menu.append(btn);

        btn.on('hover:enter', function(){
            Lampa.Modal.prompt('Введите название для поиска', '').then(query => {
                if(query && query.length > 1){
                    console.log('Поиск:', query);
                    // тут вызвать функцию поиска через CUB
                }
            });
        });

        console.log('✅ Кнопка Androzon добавлена');
        return true;
    }

    // Пытаемся добавить кнопку каждые 300ms до успешного добавления
    const interval = setInterval(() => {
        if(addButton()) clearInterval(interval);
    }, 300);

})();
