import { format } from 'https://cdn.jsdelivr.net/npm/date-fns/+esm'
import { ja } from 'https://cdn.jsdelivr.net/npm/date-fns/locale/ja/+esm'

if (location.hostname === '127.0.0.1') {
  htmx.logAll()
}
// Function to initialize any JavaScript after HTMX content swap
function initDynamicContent() {
  // If you have any dynamic content that needs JS initialization, do it here.
  // For example, attaching event listeners to new DOM elements.
  switch (location.pathname) {
    case '/': {
      initHomePage()
      break
    }
    default:
      break
  }
}

// Initialize dynamic content on page load
initDynamicContent()

window.addEventListener('popstate', async function (event) {
  switch (location.pathname) {
    case '/': {
      window.location.reload()
      break
    }
    default:
      break
  }
})

document.body.addEventListener('htmx:load', function (event) {
  initDynamicContent()
})

// TODO: https://htmx.org/events/#htmx:validateUrl

/***************************************************
 * 以下、ページごとの初期化処理
 ***************************************************/
// TODO change to class
function initHomePage() {
  // TODO: dom取得のリファクタする
  const datepickerEl = document.getElementById('datepicker')
  const baseTimeEl = document.getElementById('base-time')
  const timeByDayEl = document.getElementById('time-by-day')
  const noSpecificTimeEl = document.getElementById('no-specific-time')

  const DEFAULT_TIME = '19:00'

  const fp = initFlatpickr()

  if (datepickerEl.value) {
    parseCandidateDates(fp.input.value)
  }

  if (!baseTimeEl.value) {
    baseTimeEl.value = DEFAULT_TIME
  }

  timeByDayEl.addEventListener('change', (e) => {
    baseTimeEl.disabled = e.target.checked
    parseCandidateDates(fp.input.value)
  })
  
  noSpecificTimeEl.addEventListener('change', (e) => {
    baseTimeEl.disabled = e.target.checked
    timeByDayEl.disabled = e.target.checked
    parseCandidateDates(fp.input.value)
  })

  function initFlatpickr() {
    const input = document.getElementById('datepicker')
    return flatpickr(input, {
      inline: true,
      mode: 'multiple',
      allowInput: true,
      locale: 'ja',
      dateFormat: 'Y-m-d',
      minDate: 'today',
      static: true,
      onReady: (dObj, dStr, instance) => {
        instance.setDate(input.value)
      },
      onChange: (selectedDates, dateStr, instance) => {
        parseCandidateDates(dateStr)
      },
    })
  }

  function parseCandidateDates(dateStr) {
    const isTimeByDay = document.getElementById('time-by-day').checked
    const isNoSpecificTime = document.getElementById('no-specific-time').checked
    
    if ((!isTimeByDay && !isNoSpecificTime) || !dateStr) {
      document.getElementById('event-time').innerHTML = ''
      return
    }

    const template = document.getElementById('event-time-template').innerHTML

    const data = htmx.values(htmx.find('#create-form'))
    const baseTime = document.getElementById('base-time').value

    const candidateDates = dateStr
      .split(', ')
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => {
        const time = isNoSpecificTime 
          ? '' 
          : isTimeByDay
            ? data[`candidateTimes[${date}]`] || baseTime
            : baseTime
        return {
          key: date,
          date: format(new Date(date), 'yyyy/MM/dd'),
          time: time,
          dayOfWeek: format(new Date(date), 'E', { locale: ja }),
        }
      })
    const renderedTemplate = nunjucks.renderString(template, {
      candidateDates,
    })
    document.getElementById('event-time').innerHTML = renderedTemplate
  }
}
