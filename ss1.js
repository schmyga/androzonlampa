/*!
* @name Androzon
* @author Androzon
* @version 1.0.0
* @description Кнопка загрузки через Androzon
*/

(function(Plugin, Window, Document, $, undefined) {
  "use strict";
  
  const PLUGIN_ID = 'androzon_button';
  const PLUGIN_TITLE = 'Androzon';
  const DEBUG = true;

  function log(...args) {
    if (DEBUG) console.log('[Androzon]', ...args);
  }

  function safeNoty(text) {
    try {
      if (window.Lampa?.Noty?.show) Lampa.Noty.show(text);
      else console.log('[Androzon]', text);
    } catch (e) { console.log('[Androzon]', text); }
  }

  function createButton() {
    const button = $('<div class="full-start__button selector" style="background: linear-gradient(135deg, #ff7e00, #ffb700); border-radius: 50px; padding: 0 20px; margin-left: 10px;">')
      .html('<span>Androzon</span>');

    button.on('hover:enter', function () {
      safeNoty('Загрузка через Androzon...');
      openAndrozon();
    });

    return button;
  }

  function openAndrozon() {
    const html = $('<div class="player-info">').html(`
      <div style="padding: 2em; text-align: center;">
        <h2>Androzon</h2>
        <p>Тут будет выбор балансера и ссылки</p>
      </div>
    `);

    Lampa.Modal.open({
      title: 'Androzon Player',
      html: html,
      size: 'medium',
    });
  }

  function insertButton() {
    const buttonBlock = $('.full-start__buttons');
    if (buttonBlock.length && !buttonBlock.find('.' + PLUGIN_ID).length) {
      const btn = createButton();
      btn.addClass(PLUGIN_ID);
      buttonBlock.append(btn);
      log('✅ Кнопка Androzon добавлена');
    }
  }

  function followApp() {
    if (!window.Lampa?.Listener?.follow) return;
    Lampa.Listener.follow('full', e => {
      if (e.type === 'build') setTimeout(insertButton, 500);
    });
  }

  function start() {
    followApp();
    log('✅ Плагин Androzon запущен');
  }

  function stop() {
    $('.' + PLUGIN_ID).remove();
    log('🛑 Плагин Androzon остановлен');
  }

  // Автозапуск при загрузке
  if (Window.Lampa) {
    start();
  } else {
    Window.addEventListener('lampaLoaded', start);
  }

  // Экспорт для менеджера плагинов
  return {
    id: PLUGIN_ID,
    name: PLUGIN_TITLE,
    version: '1.0.0',
    description: 'Кнопка для загрузки через Androzon',
    start: start,
    stop: stop
  };

})(window.Plugin, window, document, window.jQuery);
