/*!
 * SerVik — кнопка рядом с "Смотреть" на экране фильма
 * Работает на всех версиях Lampa (yumata / mod / SerVik / TV)
 */

(function () {
  const PLUGIN_ID = 'servik_button';
  const PLUGIN_TITLE = 'SerVik';
  const DEBUG = true;

  // Балансеры с API
  const BALANCERS = {
    'bwa': {
      name: 'BWA',
      url: 'https://bwa.to/rc',
      search: '/search.php?q=',
      parse: '/parse.php?url='
    },
    'rezka': {
      name: 'Rezka',
      url: 'https://rezka.ag',
      search: '/search/?do=search&subaction=search&q='
    },
    'filmix': {
      name: 'Filmix',
      url: 'https://filmix.ac',
      search: '/search/'
    }
  };

  function log(...args) {
    if (DEBUG) console.log('[SerVik]', ...args);
  }

  function safeNoty(text) {
    try {
      if (window.Lampa?.Noty?.show) Lampa.Noty.show(text);
      else console.log('[SerVik]', text);
    } catch (e) { console.log('[SerVik]', text); }
  }

  function createButton() {
    const button = $('<div class="full-start__button selector" style="background: linear-gradient(135deg, #ff7e00, #ffb700); border-radius: 50px; padding: 0 20px; margin-left: 10px;">')
      .html('<span>SerVik</span>');

    button.on('hover:enter', function () {
      safeNoty('Загрузка через SerVik...');
      openSerVik(); // Переименовано, чтобы соответствовать
    });

    return button;
  }

  // Получить информацию о текущем фильме
  function getMovieInfo() {
    const title = $('.full-start-new__title').text().trim();
    const year = $('.full-start__details').text().match(/\d{4}/)?.[0] || '';
    const originalTitle = $('.full-start__original').text().trim() || title;
    
    // Получаем ID фильма из URL
    const urlParams = new URLSearchParams(window.location.search);
    const kpId = urlParams.get('card') || '';
    
    return {
      title: title,
      originalTitle: originalTitle,
      year: year,
      kpId: kpId,
      searchQuery: `${title} ${year}`.trim()
    };
  }

  // Поиск через BWA API (как в примерах)
  async function searchBWA(movieInfo) {
    try {
      safeNoty('Поиск через BWA...');
      
      const searchUrl = `${BALANCERS.bwa.url}${BALANCERS.bwa.search}${encodeURIComponent(movieInfo.searchQuery)}`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data && data.results && data.results.length > 0) {
        // Найден результат - парсим ссылку
        const firstResult = data.results[0];
        const parseUrl = `${BALANCERS.bwa.url}${BALANCERS.bwa.parse}${encodeURIComponent(firstResult.url)}`;
        
        const parseResponse = await fetch(parseUrl);
        const parseData = await parseResponse.json();
        
        if (parseData && parseData.stream) {
          // Запускаем видео в плеере Lampa
          playVideo(parseData.stream, `${BALANCERS.bwa.name} - ${movieInfo.title}`);
        }
      } else {
        safeNoty('Ничего не найдено через BWA');
      }
    } catch (error) {
      console.error('BWA error:', error);
      safeNoty('Ошибка BWA');
    }
  }

  // Универсальный поиск через прокси
  async function searchUniversal(balancerId, movieInfo) {
    try {
      safeNoty(`Поиск через ${BALANCERS[balancerId].name}...`);
      
      // Используем прокси для обхода CORS
      const proxyUrl = 'https://corsproxy.io/?';
      const searchUrl = `${BALANCERS[balancerId].url}${BALANCERS[balancerId].search}${encodeURIComponent(movieInfo.searchQuery)}`;
      
      const response = await fetch(proxyUrl + encodeURIComponent(searchUrl));
      const html = await response.text();
      
      // Парсим HTML и находим ссылки на видео
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const videoLinks = findVideoLinks(doc, balancerId);
      
      if (videoLinks.length > 0) {
        showVideoLinks(videoLinks, BALANCERS[balancerId].name, movieInfo.title);
      } else {
        safeNoty(`Не найдено ссылок через ${BALANCERS[balancerId].name}`);
      }
      
    } catch (error) {
      console.error(`${balancerId} error:`, error);
      safeNoty(`Ошибка ${BALANCERS[balancerId].name}`);
    }
  }

  // Поиск видео ссылок в HTML
  function findVideoLinks(doc, balancerId) {
    const links = [];
    
    switch(balancerId) {
      case 'rezka':
        // Для Rezka ищем ссылки на просмотр
        doc.querySelectorAll('a[href*="/films/"], a[href*="/series/"]').forEach(link => {
          if (link.href && !link.href.includes('/search/')) {
            links.push({
              url: link.href,
              title: link.textContent.trim(),
              balancer: balancerId
            });
          }
        });
        break;
        
      case 'filmix':
        // Для Filmix
        doc.querySelectorAll('a[href*="/film/"], a[href*="/movie/"]').forEach(link => {
          links.push({
            url: link.href,
            title: link.textContent.trim(),
            balancer: balancerId
          });
        });
        break;
    }
    
    return links.slice(0, 5); // Ограничиваем 5 результатами
  }

  // Показать найденные ссылки для выбора
  function showVideoLinks(links, balancerName, movieTitle) {
    const html = $(`
      <div style="padding: 1em;">
        <h3 style="margin: 0 0 15px 0; color: #ff7e00;">${balancerName}</h3>
        <div style="color: #888; margin-bottom: 15px;">Найдено вариантов: ${links.length}</div>
        <div class="video-links" style="max-height: 300px; overflow-y: auto;">
          ${links.map((link, index) => `
            <div class="selector video-link" data-url="${link.url}" data-balancer="${link.balancer}"
                 style="background: #3a3a3a; padding: 12px; margin: 5px 0; border-radius: 8px; border: 2px solid transparent; cursor: pointer;">
              <div style="font-weight: bold;">${link.title || 'Без названия'}</div>
              <div style="font-size: 12px; color: #888; margin-top: 5px;">${link.url}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    // Обработчики для ссылок
    html.find('.video-link').on('hover:enter', function() {
      const url = $(this).data('url');
      const balancer = $(this).data('balancer');
      Lampa.Modal.close();
      parseAndPlayVideo(url, balancer, movieTitle);
    });

    Lampa.Modal.open({
      title: `Выбор ссылки - ${balancerName}`,
      html: html,
      size: 'medium',
      buttons: [{
        title: 'Назад',
        action: function() {
          Lampa.Modal.close();
          setTimeout(openSerVik, 300); // Переименовано
        }
      }]
    });
  }

  // Парсинг и воспроизведение видео
  async function parseAndPlayVideo(url, balancerId, title) {
    try {
      safeNoty('Парсинг видео...');
      
      // Для разных балансеров разный парсинг
      let videoUrl = url;
      
      if (balancerId === 'bwa') {
        // BWA уже дает прямую ссылку
        videoUrl = url;
      } else {
        // Для других используем прокси парсинг
        const proxyUrl = 'https://corsproxy.io/?';
        const response = await fetch(proxyUrl + encodeURIComponent(url));
        const html = await response.text();
        
        // Ищем прямые видео ссылки в HTML
        videoUrl = extractVideoUrl(html, balancerId);
      }
      
      if (videoUrl) {
        playVideo(videoUrl, `${BALANCERS[balancerId].name} - ${title}`);
      } else {
        safeNoty('Не удалось извлечь видео');
      }
      
    } catch (error) {
      console.error('Parse error:', error);
      safeNoty('Ошибка парсинга');
    }
  }

  // Извлечение видео URL из HTML
  function extractVideoUrl(html, balancerId) {
    // Простая regex-выборка (нужно доработать под каждый балансер)
    const regexMap = {
      'rezka': /(https?:[^"']*\.(mp4|m3u8|mkv)[^"']*)/i,
      'filmix': /(https?:[^"']*\.(mp4|m3u8)[^"']*)/i
    };
    
    const match = html.match(regexMap[balancerId]);
    return match ? match[1] : null;
  }

  // Запуск видео в плеере Lampa
  function playVideo(url, title) {
    if (!url) {
      safeNoty('Неверная ссылка на видео');
      return;
    }

    // Создаем объект для плеера Lampa
    const movieData = {
      title: title,
      file: url,
      type: 'movie' // или 'serial' для сериалов
    };

    // Запускаем в стандартном плеере Lampa
    if (window.Lampa && window.Lampa.Player && window.Lampa.Player.play) {
      Lampa.Player.play(movieData);
    } else {
      // Альтернативный способ через Activity
      Lampa.Activity.push({
        url: '',
        component: 'player',
        source: movieData,
        title: title
      });
    }
    
    safeNoty('Запуск видео...');
  }

  // Основное окно SerVik (переименовано)
  function openSerVik() {
    const movieInfo = getMovieInfo();
    
    const html = $(`
      <div class="z01-modal"> <!-- Класс не трогаем, как в оригинале -->
        <div style="padding: 1.5em;">
          <div style="text-align: center; margin-bottom: 1.5em;">
            <h2 style="margin: 0 0 10px 0; color: #ff7e00;">SerVik Player</h2>
            <div style="background: #2a2a2a; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
              <div style="font-weight: bold;">${movieInfo.title}</div>
              ${movieInfo.year ? `<div style="color: #888; font-size: 14px;">${movieInfo.year} год</div>` : ''}
            </div>
          </div>
          
          <div style="margin-bottom: 1.5em;">
            <h3 style="margin: 0 0 15px 0; color: #fff;">Выберите источник:</h3>
            <div class="balancers-list" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="selector balancer-item" data-balancer="bwa" 
                   style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #ff7e00;">BWA API</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Прямой поиск через API</div>
              </div>
              <div class="selector balancer-item" data-balancer="rezka" 
                   style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #4CAF50;">Rezka</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Поиск на rezka.ag</div>
              </div>
              <div class="selector balancer-item" data-balancer="filmix" 
                   style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #2196F3;">Filmix</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Поиск на filmix.ac</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    // Обработчики для балансеров
    html.find('.balancer-item').on('hover:enter', function() {
      const balancerId = $(this).data('balancer');
      Lampa.Modal.close();
      
      if (balancerId === 'bwa') {
        searchBWA(movieInfo);
      } else {
        searchUniversal(balancerId, movieInfo);
      }
    });

    // Эффекты фокуса
    html.find('.balancer-item').on('hover:focus', function() {
      html.find('.balancer-item').css({'border-color': 'transparent'});
      $(this).css({'border-color': '#ff7e00'});
    });

    Lampa.Modal.open({
      title: 'SerVik Player',
      html: html,
      size: 'medium',
      onBack: function() {
        Lampa.Modal.close();
      }
    });
  }

  function insertButton() {
    const buttonBlock = $('.full-start-new__buttons');
    if (buttonBlock.length && !buttonBlock.find('.' + PLUGIN_ID).length) {
      const btn = createButton();
      btn.addClass(PLUGIN_ID);
      buttonBlock.append(btn);
      log('✅ Кнопка SerVik добавлена');
    }
  }

  function followApp() {
    if (!window.Lampa?.Listener?.follow) return;
    Lampa.Listener.follow('full', e => {
      if (e.type === 'build') setTimeout(insertButton, 1000);
    });
  }

  function init() {
    followApp();
    log('✅ Плагин SerVik инициализирован');
  }

  init();
})();
