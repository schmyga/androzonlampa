/*!
 * Androzon Source Plugin — кнопка в панели источников рядом с «Смотреть»
 */
(function () {
  const PLUGIN_TITLE = 'Androzon';
  const PLUGIN_NAME  = 'androzon_source';
  const LOG_PREFIX   = '[Androzon]';
  const DEBUG        = true;

  function log(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }

  // Показываем уведомление
  function safeNoty(text) {
    try {
      if (window.Lampa?.Noty?.show) Lampa.Noty.show(text);
      else console.log(LOG_PREFIX, text);
    } catch (e) { console.log(LOG_PREFIX, text); }
  }

  // Основной объект плагина
  function makePlugin() {
    return {
      title: PLUGIN_TITLE,
      id: PLUGIN_NAME,
      type: 'source', // важно: тип source — чтобы кнопка появилась в списке источников
      onClick() {
        safeNoty('Androzon запущен ✅');
      },
      // worker вызывается, когда пользователь выбирает этот источник
      worker(data, call) {
        log('worker вызван', data);
        // Здесь можно получать ссылки или балансеры из JSON
        safeNoty('Загрузка источников Androzon...');
        // call([]) — должен вернуть массив потоков, иначе кнопка просто останется активной
        call([]);
      }
    };
  }

  function register() {
    const plugin = makePlugin();

    if (window.Lampa?.Plugins?.add) {
      Lampa.Plugins.add(plugin);
      log('✅ Плагин добавлен через Lampa.Plugins.add');
      safeNoty('Плагин Androzon добавлен');
    } else {
      log('❌ Lampa.Plugins.add не найден, пробуем вручную');
      if (!window.plugin_list) window.plugin_list = [];
      window.plugin_list.push(plugin);
    }
  }

  // Запуск и реакция на готовность приложения
  function init() {
    register();

    if (window.Lampa?.Listener?.follow) {
      Lampa.Listener.follow('app', e => {
        if (e.type === 'ready') register();
      });
      log('Listener.follow активирован');
    }
  }

  init();
})();
