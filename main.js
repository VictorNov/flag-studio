const requestURL = 'https://raw.githubusercontent.com/VictorNov/flag-studio/master/data.json'
const request = new XMLHttpRequest()

/*
* Объект app хранит состояние и инициирует перерисовку сайдбара
* при фильтрации по стране
* */
const app = {
  _country: 'россия',
  _city: null,

  get country() {
    return this._country
  },
  set country(value) {
    this._country = value
    renderSidebar()
  },

  get city() {
    return this._city
  },
  set city(value) {
    this._city = value
    toggleCity(value)
  }
}

// Получаем данные с сервера и записываем массив с данными в объект app
request.open('GET', requestURL)
request.responseType = 'json'
request.send()
request.onload = () => {
  const { offices } = request.response

  app.offices = offices

  renderSidebar()
}

// Получаем кнопки фильтра по стране и вешаем Event Listener
const countryButtons = document.querySelectorAll('.sidebar__filter-button')

countryButtons.forEach(button => {
  button.addEventListener('click', () => {
    toggleCountry(button.textContent)
  })
})

// Функция переключает состояние кнопок фильтра и переписывает app.country
function toggleCountry(country) {
  app.country = country
  countryButtons.forEach(button => {
    button.textContent === country ?
      button.classList.add('filter-active') :
      button.classList.remove('filter-active')
  })
}

// Раскрываем элемент аккордеона когда app.city изменяется
function toggleCity(city) {
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
}

// Рисуем сайдбар, функция вызывается при каждом изменении app.country
function renderSidebar() {
  const accordion = document.querySelector('.sidebar__accordion')
  while ( accordion.firstChild ) {
    accordion.firstChild.remove()
  }
  const cities = getCitiesByCountry(app.country)
  console.log(cities)

  cities.forEach(city => {
    const filteredOffices = getOfficesByCity(city)
    console.log(filteredOffices)
    accordion.append(constructAccordionItem(city, filteredOffices))
  })
}

// Получаем список городов для офисов из выбранной страны
function getCitiesByCountry(country) {
  const cities = new Set()
  app.offices.forEach(item => {
    if (item.address.country.toLowerCase() === country.toLowerCase()) {
      cities.add(item.address.city)
    }
  })
  return Array.from(cities)
}

// Получаем массив офисов отфильтрованных по городу
function getOfficesByCity(city) {
  return app.offices.filter(item => item.address.city.toLowerCase() === city.toLowerCase())
}

function constructAccordionItem(city, filteredOffices) {
  const accordionItem = document.createElement('article')
  const accordionHeader = document.createElement('header')
  const accordionHeaderIcon = document.createElement('span')
  const accordionContent = document.createElement('main')

  accordionItem.classList.add('sidebar__accordion-item')
  accordionHeader.classList.add('sidebar__accordion-header')
  accordionHeaderIcon.classList.add('accordion-icon')
  accordionContent.classList.add('sidebar__accordion-content')

  accordionHeader.append(city, accordionHeaderIcon)
  accordionHeader.addEventListener('click', () => {
    if (app.city === accordionHeader.textContent) {
      app.city = null
    } else {
      app.city = accordionHeader.textContent
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
}