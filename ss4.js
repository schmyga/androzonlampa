/*!
 * Androzon — кнопка рядом с "Смотреть" на экране фильма
 * Работает на всех версиях Lampa (yumata / mod / Androzon / TV)
 */

(function () {
  const PLUGIN_ID = 'androzon_button';
  const PLUGIN_TITLE = 'Androzon';
  const DEBUG = true;

  // Балансеры
  const BALANCERS = {
    'rezka': {
      name: 'Rezka',
      searchUrl: 'https://rezka.ag/search/?do=search&subaction=search&q=',
      playUrl: 'https://rezka.ag/'
    },
    'filmix': {
      name: 'Filmix',
      searchUrl: 'https://filmix.ac/search/',
      playUrl: 'https://filmix.ac/'
    },
    'bwa': {
      name: 'BWA',
      searchUrl: 'http://bwa.to/rc/search.php?q=',
      playUrl: 'http://bwa.to/rc/player.html'
    }
  };

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

  // Получить информацию о текущем фильме
  function getMovieInfo() {
    const title = $('.full-start-new__title').text().trim();
    const year = $('.full-start__details').text().match(/\d{4}/)?.[0] || '';
    const originalTitle = $('.full-start__original').text().trim() || title;
    
    return {
      title: title,
      originalTitle: originalTitle,
      year: year,
      searchQuery: `${title} ${year}`.trim()
    };
  }

  // Поиск через балансер
  function searchWithBalancer(balancerId, movieInfo) {
    const balancer = BALANCERS[balancerId];
    if (!balancer) return;

    safeNoty(`Поиск через ${balancer.name}...`);
    
    const searchUrl = balancer.searchUrl + encodeURIComponent(movieInfo.searchQuery);
    
    // Для web версии открываем в новой вкладке
    if (typeof window.chrome !== 'undefined') {
      window.open(searchUrl, '_blank');
    } else {
      // Для TV версии показываем ссылку
      Lampa.Modal.open({
        title: `${balancer.name} - Поиск`,
        html: $(`
          <div style="padding: 2em; text-align: center;">
            <h3>${movieInfo.title}</h3>
            <p>Открыть поиск в ${balancer.name}:</p>
            <div style="background: #2a2a2a; padding: 15px; border-radius: 10px; margin: 15px 0; word-break: break-all;">
              ${searchUrl}
            </div>
            <p style="color: #888; font-size: 14px;">Скопируйте ссылку или откройте в браузере</p>
          </div>
        `),
        size: 'medium',
        buttons: [
          {
            title: 'Открыть',
            action: function() {
              window.open(searchUrl, '_blank');
              Lampa.Modal.close();
            }
          },
          {
            title: 'Закрыть',
            action: function() {
              Lampa.Modal.close();
            }
          }
        ]
      });
    }
  }

  // Основное окно Androzon
  function openAndrozon() {
    const movieInfo = getMovieInfo();
    
    const html = $(`
      <div class="androzon-modal">
        <div style="padding: 1.5em;">
          <div style="text-align: center; margin-bottom: 1.5em;">
            <h2 style="margin: 0 0 10px 0; color: #ff7e00;">Androzon Player</h2>
            <div style="background: #2a2a2a; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
              <div style="font-weight: bold;">${movieInfo.title}</div>
              ${movieInfo.year ? `<div style="color: #888; font-size: 14px;">${movieInfo.year} год</div>` : ''}
            </div>
          </div>
          
          <div style="margin-bottom: 1.5em;">
            <h3 style="margin: 0 0 15px 0; color: #fff;">Выберите балансер:</h3>
            <div class="balancers-list" style="display: flex; flex-direction: column; gap: 10px;">
              ${Object.entries(BALANCERS).map(([id, balancer]) => `
                <div class="selector balancer-item" data-balancer="${id}" 
                     style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">
                  <div style="font-weight: bold; color: #ff7e00;">${balancer.name}</div>
                  <div style="font-size: 12px; color: #888; margin-top: 5px;">Автоматический поиск фильма</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div style="border-top: 1px solid #444; padding-top: 15px;">
            <div style="color: #888; font-size: 12px; text-align: center;">
              Androzon v1.0 • Балансеры: ${Object.keys(BALANCERS).length}
            </div>
          </div>
        </div>
      </div>
    `);

    // Добавляем обработчики для балансеров
    html.find('.balancer-item').on('hover:enter', function() {
      const balancerId = $(this).data('balancer');
      Lampa.Modal.close();
      setTimeout(() => {
        searchWithBalancer(balancerId, movieInfo);
      }, 300);
    });

    // Эффекты при фокусе
    html.find('.balancer-item').on('hover:focus', function() {
      html.find('.balancer-item').css({
        'border-color': 'transparent',
        'background': '#3a3a3a'
      });
      $(this).css({
        'border-color': '#ff7e00',
        'background': '#404040'
      });
    });

    Lampa.Modal.open({
      title: 'Androzon Player',
      html: html,
      size: 'medium',
      onBack: function() {
        Lampa.Modal.close();
      },
      onShow: function() {
        // Автофокус на первом балансере
        setTimeout(() => {
          html.find('.balancer-item').first().trigger('focus');
        }, 100);
      }
    });
  }

  function insertButton() {
    const buttonBlock = $('.full-start-new__buttons');

    if (buttonBlock.length && !buttonBlock.find('.' + PLUGIN_ID).length) {
      const btn = createButton();
      btn.addClass(PLUGIN_ID);
      buttonBlock.append(btn);
      log('✅ Кнопка Androzon добавлена на экран фильма');
    }
  }

  function followApp() {
    if (!window.Lampa?.Listener?.follow) return;
    Lampa.Listener.follow('full', e => {
      if (e.type === 'build') {
        setTimeout(insertButton, 1000);
      }
    });
  }

  function init() {
    followApp();
    log('✅ Плагин Androzon инициализирован');
  }

  init();
})();
