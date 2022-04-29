const requestURL = 'https://raw.githubusercontent.com/VictorNov/flag-studio/master/data.json'
const request = new XMLHttpRequest()

/*
* Объект app хранит состояние и инициирует перерисовку сайдбара
* при фильтрации по стране
* */
const app = {
  _country: 'россия',
  _city: null,

  // При перезаписи страны перерисовываем сайдбар
  // и фильтруем объекты на карте
  get country() {
    return this._country
  },
  set country(value) {
    this._country = value
    sidebar.renderSidebar()
    mapSection.filterCollectionByCountry(value)
  },

  // При перезаписи города раскрываем аккордеон и,
  // если передан параметр isFilter - отображаем в
  // видимой области все объекты соответствующего города
  get city() {
    return this._city
  },
  set city({ value, isFilter }) {
    this._city = value
    sidebar.toggleCity(value)
    isFilter && mapSection.filterCollectionByCity(value)
  },

  // Функция переключает состояние кнопок фильтра и переписывает app.country
  toggleCountry(country) {
    this.country = country
    countryButtons.forEach(button => {
      button.textContent === country ?
        button.classList.add('filter-active') :
        button.classList.remove('filter-active')
    })
  },
}

/*
* Объект sidebar содержит всю логику аккордеона в боковой панели
* */
const sidebar = {
  // Рисуем сайдбар, функция вызывается при каждом изменении app.country
  renderSidebar() {
    const accordion = document.querySelector('.sidebar__accordion')
    while ( accordion.firstChild ) {
      accordion.firstChild.remove()
    }
    const cities = this.getCitiesByCountry(app.country)

    cities.forEach(city => {
      const filteredOffices = this.getOfficesByCity(city)

      accordion.append(this.constructAccordionItem(city, filteredOffices))
    })
  },

  // Получаем список городов для офисов из выбранной страны
  getCitiesByCountry(country) {
    const cities = new Set()
    app.offices.forEach(item => {
      if (item.address.country.toLowerCase() === country.toLowerCase()) {
        cities.add(item.address.city)
      }
    })
    return Array.from(cities)
  },

  // Получаем массив офисов отфильтрованных по городу
  getOfficesByCity(city) {
    return app.offices.filter(item => item.address.city.toLowerCase() === city.toLowerCase())
  },

  // Раскрываем элемент аккордеона когда app.city изменяется
  toggleCity(city) {
    const accordionItems = document.querySelectorAll('.sidebar__accordion-item')

    accordionItems.forEach(item => {
      const header = item.querySelector('.sidebar__accordion-header')
      const content = item.querySelector('.sidebar__accordion-content')

      if (header.textContent === city) {
        header.classList.add('accordion-open')
        content.style.height = `${content.scrollHeight}px`
      } else {
        header.classList.remove('accordion-open')
        content.removeAttribute('style')
      }
    })
  },

  // Собираем элемент аккордеона
  constructAccordionItem(city, filteredOffices) {
    const accordionItem = document.createElement('article')
    const accordionHeader = document.createElement('header')
    const accordionHeaderIcon = document.createElement('span')
    const accordionContent = document.createElement('main')

    accordionItem.classList.add('sidebar__accordion-item')
    accordionHeader.classList.add('sidebar__accordion-header')
    accordionHeaderIcon.classList.add('accordion-icon')
    accordionContent.classList.add('sidebar__accordion-content')

    accordionHeader.append(city, accordionHeaderIcon)

    // По клику по заголовку переписываем значение app.city
    // чтобы раскрыть аккордеон и центрировать соответствующие
    // объекты на карте
    accordionHeader.addEventListener('click', () => {
      if (app.city === accordionHeader.textContent) {
        app.city = {value: null, isFilter: true}
      } else {
        app.city = {value: accordionHeader.textContent, isFilter: true}
      }
    })

    filteredOffices.forEach(office => {
      const accordionCard = document.createElement('div')
      const officeName = document.createElement('p')
      const officeManager = document.createElement('p')
      const officePhones = document.createElement('p')
      const officeEmail = document.createElement('p')
      const officeEmailLink = document.createElement('a')

      accordionCard.classList.add('sidebar__accordion-card')
      officeName.classList.add('sidebar__accordion-card-name')
      officeManager.classList.add('sidebar__accordion-card-manager')
      officePhones.classList.add('sidebar__accordion-card-phones')
      officeEmail.classList.add('sidebar__accordion-card-email')

      // Клик по карточке офиса в сайдбаре сфокусирует соответствующий
      // объект в центре карты
      accordionCard.addEventListener('click', () => {
        mapSection.focusOnObject(office.id)
      })

      officeName.textContent = office.name

      officeManager.textContent = office.manager

      office.phones.forEach(({phone}) => {
        const officePhone = document.createElement('a')
        officePhone.setAttribute('href', `tel:${phone}`)
        officePhone.textContent = phone
        officePhones.append(officePhone)
      })

      officeEmailLink.setAttribute('href', `mailto:${office.email}`)
      officeEmailLink.textContent = office.email
      officeEmail.append(officeEmailLink)

      accordionCard.append(officeName, officeManager, officePhones, officeEmail)
      accordionContent.append(accordionCard)
    })

    accordionItem.append(accordionHeader, accordionContent)

    return accordionItem
  },
}

/*
* Объект mapSection содержит всю логику контейнера карты
* */
const mapSection = {
  myMap: {},
  collection: {
    type: "FeatureCollection",
    features: []
  },

  // Инициализация карты
  init(app) {
    // Создание экземпляра карты
    this.myMap = new ymaps.Map('map', {
      center: [55.76, 37.64],
      zoom: 7,
      controls: [],
    }, {
      yandexMapDisablePoiInteractivity: true,
    })

    // Создание менеджера объектов
    this.objectManager = new ymaps.ObjectManager({
      clusterize: true,
      gridSize: 64,
    })

    // Настраиваем внешний вид иконок кластеров
    this.objectManager.clusters.options.set({
      clusterIconLayout: ymaps.templateLayoutFactory.createClass(
        '<div class="custom-cluster">{{ properties.geoObjects.length }}</div>'
      ),
      clusterIconShape: {
        type: 'Circle',
        coordinates: [0, 0],
        radius: 19
      },
    })

    // Создание макета балуна
    // (взято как есть с https://yandex.ru/dev/maps/jsbox/2.1/balloon_autopan)
    // с необходимыми корректировками
    const MyBalloonLayout = ymaps.templateLayoutFactory.createClass(
      '<div class="balloon">' +
      '<span class="close"></span>' +
      '<div class="arrow"></div>' +
      '<div class="balloon-inner">' +
      '$[[options.contentLayout observeSize]]' +
      '</div>' +
      '</div>', {
      /**
       * Строит экземпляр макета на основе шаблона и добавляет его в родительский HTML-элемент.
       * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base.xml#build
       * @function
       * @name build
       */
      build: function () {
        this.constructor.superclass.build.call(this);

        this._$element = $('.balloon', this.getParentElement());

        this.applyElementOffset();

        this._$element.find('.close')
          .on('click', $.proxy(this.onCloseClick, this));
      },

      /**
       * Удаляет содержимое макета из DOM.
       * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base.xml#clear
       * @function
       * @name clear
       */
      clear: function () {
        this._$element.find('.close')
          .off('click');

        this.constructor.superclass.clear.call(this);
      },

      /**
       * Метод будет вызван системой шаблонов АПИ при изменении размеров вложенного макета.
       * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
       * @function
       * @name onSublayoutSizeChange
       */
      onSublayoutSizeChange: function () {
        MyBalloonLayout.superclass.onSublayoutSizeChange.apply(this, arguments);

        if(!this._isElement(this._$element)) {
          return;
        }

        this.applyElementOffset();

        this.events.fire('shapechange');
      },

      /**
       * Сдвигаем балун, чтобы "хвостик" указывал на точку привязки.
       * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
       * @function
       * @name applyElementOffset
       */
      applyElementOffset: function () {
        this._$element.css({
          left: -(65),
          top: -(this._$element[0].offsetHeight + this._$element.find('.arrow')[0].offsetHeight + 2)
        });
      },

      /**
       * Закрывает балун при клике на крестик, кидая событие "userclose" на макете.
       * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
       * @function
       * @name onCloseClick
       */
      onCloseClick: function (e) {
        e.preventDefault();

        this.events.fire('userclose');
      },

      /**
       * Используется для автопозиционирования (balloonAutoPan).
       * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/ILayout.xml#getClientBounds
       * @function
       * @name getClientBounds
       * @returns {Number[][]} Координаты левого верхнего и правого нижнего углов шаблона относительно точки привязки.
       */
      getShape: function () {
        if(!this._isElement(this._$element)) {
          return MyBalloonLayout.superclass.getShape.call(this);
        }

        var position = this._$element.position();

        return new ymaps.shape.Rectangle(new ymaps.geometry.pixel.Rectangle([
          [position.left, position.top], [
            position.left + this._$element[0].offsetWidth,
            position.top + this._$element[0].offsetHeight + this._$element.find('.arrow')[0].offsetHeight
          ]
        ]));
      },

      /**
       * Проверяем наличие элемента (в ИЕ и Опере его еще может не быть).
       * @function
       * @private
       * @name _isElement
       * @param {jQuery} [element] Элемент.
       * @returns {Boolean} Флаг наличия.
       */
      _isElement: function (element) {
        return element && element[0] && element.find('.arrow')[0];
      }
    })

    // Настраиваем внешний вид иконок объектов
    this.objectManager.objects.options.set({
      hideIconOnBalloonOpen: false,
      iconLayout: ymaps.templateLayoutFactory.createClass(
        '<div class="custom-placemark"></div>'
      ),
      iconShape: {
        type: 'Circle',
        coordinates: [ 0, 0 ],
        radius: 12
      },
      balloonLayout: MyBalloonLayout,
    })

    // Создаем коллекцию объектов
    this.makeCollection(app.offices)

    // Добавляем коллекцию в менеджер объектов
    this.objectManager.add(this.collection)

    // Менеджер объектов связываем с картой
    this.myMap.geoObjects.add(this.objectManager)

    // Слушаем клики по иконкам и закрытие балуна
    this.myMap.balloon.events.add('close', this.onBalloonClose.bind(mapSection))
    this.objectManager.objects.events.add('click', this.onObjectClick.bind(mapSection))
    this.objectManager.clusters.events.add('click', this.onClusterClick.bind(mapSection))

    // Применяем фильтр по стране по умолчанию
    this.filterCollectionByCountry(app.country)
  },

  // Функция преобразует данные, полученные с сервера в коллекцию объектов
  makeCollection(offices) {
    this.collection.features = offices.map(office => {
      return {
        type: "feature",
        id: office.id,
        geometry: {
          type: "Point",
          coordinates: office.coordinates
        },
        properties: {
          balloonContentHeader: `
            <p class="balloon-header">${office.name}</p>
          `,
          balloonContent: `
            <p class="balloon-manager">${office.manager}</p>
            <p class="balloon-phones">${office.phones.map((phone) => {
            return `<a href="tel:${phone.phone}">${phone.phone}</a>`
          }).join('')}
            </p>
            <p class="balloon-email">
              <a href="mailto:${office.email}">${office.email}</a>
            </p>
          `,
          country: office.address.country,
          city: office.address.city
        },
      }
    })
  },

  // Фильтруем объекты по выбранной стране
  filterCollectionByCountry(country) {
    this.objectManager.setFilter(object => {
      return object.properties.country.toLowerCase() === country.toLowerCase()
    })
    this.myMap.setBounds(
      this.myMap.geoObjects.getBounds(), {
        checkZoomRange: true,
        duration: 700,
        timingFunction: 'ease-in-out'
      })
  },

  // Функция вызывается при раскрытии элемента аккордеона
  // Отфильтровывает объекты по соответствующему городу,
  // устанавливает границы видимой области так что помещаются все иконки
  // Возвращает остальные иконки на карту
  // Не срабатывает на закрытие аккордеона
  filterCollectionByCity(city) {
    if (city) {
      this.objectManager.setFilter(object => {
        return object.properties.city.toLowerCase() === city.toLowerCase()
      })
      this.myMap.setBounds(this.myMap.geoObjects.getBounds(), {
        checkZoomRange: true,
        duration: 700,
        timingFunction: 'ease-in-out'
      })
      this.objectManager.setFilter(object => {
        return object.properties.country.toLowerCase() === app.country.toLowerCase()
      })
    }
  },

  // При клике на объекте получаем id и сам объект
  // Фокусируемся на нем
  // Раскрываем соответствующий город на аккордеоне
  onObjectClick(e) {
    const objectId = e.get('objectId')
    const object = this.objectManager.objects.getById(objectId)

    this.focusOnObject(objectId)
    app.city = {value: object.properties.city, isFilter: false}
  },

  // Фокусируемся на выбранном объекте
  focusOnObject(id) {
    const object = this.objectManager.objects.getById(id)

    this.myMap.setCenter(object.geometry.coordinates, 16)
    this.objectManager.objects.balloon.open(id)

    this.setActivePlacemark(id)
  },

  // При закрытии балуна меняем иконку объекта на неактивную
  onBalloonClose() {
    this.setActivePlacemark(false)
  },

  // Функция принимает id объекта и применяет стиль активной иконке
  // того объекта, балун которого мы раскрыли
  // Если на вход передать false - все иконки изменят стиль на неактивный
  setActivePlacemark(id) {
    this.objectManager.objects.each(object => {
      if (object.id === id) {
        this.objectManager.objects.setObjectOptions(object.id, {
          iconLayout: ymaps.templateLayoutFactory.createClass(
            '<div class="custom-placemark active"></div>'
          )
        })
      } else {
        this.objectManager.objects.setObjectOptions(object.id, {
          iconLayout: ymaps.templateLayoutFactory.createClass(
            '<div class="custom-placemark"></div>'
          )
        })
      }
    })
  },

  // При клике по кластеру раскрываем аккордеон на городе,
  // которому этот кластер принадлежит
  onClusterClick(e) {
    const cluster = this.objectManager.clusters.getById(e.get('objectId'))

    app.city = {value: cluster.features[0].properties.city, isFilter: false}
  }
}

// Получаем данные с сервера и записываем массив с данными в объект app
request.open('GET', requestURL)
request.responseType = 'json'
request.send()
request.onload = () => {
  const { offices } = request.response

  // Сохраняем данные в главный объект
  app.offices = offices

  // Инициализируем отрисовку сайдбара
  sidebar.renderSidebar()

  // Инициализируем карту
  ymaps.ready(mapSection.init.bind(mapSection, app))
}

// Получаем кнопки фильтра по стране и вешаем Event Listener
const countryButtons = document.querySelectorAll('.sidebar__filter-button')

countryButtons.forEach(button => {
  button.addEventListener('click', () => {
    app.toggleCountry(button.textContent)
  })
})