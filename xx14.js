/*!
 * Androzon — кнопка рядом с "Смотреть" на экране фильма
 * Работает на всех версиях Lampa (yumata / mod / Androzon / TV)
 */

(function () {
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

  // Эмуляция открытия твоего плагина (позже добавим JSON балансеры)
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

  // Функция для вставки кнопки рядом с "Смотреть"
  function insertButton() {
    const buttonBlock = $('.full-start__buttons');

    if (buttonBlock.length && !buttonBlock.find('.' + PLUGIN_ID).length) {
      const btn = createButton();
      btn.addClass(PLUGIN_ID);
      buttonBlock.append(btn);
      log('✅ Кнопка Androzon добавлена на экран фильма');
    }
  }

  // Отслеживаем загрузку карточки фильма
  function followApp() {
    if (!window.Lampa?.Listener?.follow) return;
    Lampa.Listener.follow('full', e => {
      if (e.type === 'build') {
        setTimeout(insertButton, 500);
      }
    });
  }

  function init() {
    followApp();
    log('✅ Плагин Androzon инициализирован');
  }

  init();
})();
