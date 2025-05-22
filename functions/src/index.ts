// import { logger } from 'firebase-functions';//TODO loggerの使い方を調べる
import path from 'node:path'
import fs from 'node:fs'
import * as Sentry from '@sentry/serverless'
import { HttpsFunction, onRequest } from 'firebase-functions/v2/https'
import { Request, Response } from 'express'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ProfilingIntegration } from '@sentry/profiling-node'

import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import { createCanvas, registerFont, loadImage } from 'canvas'

import nunjucks from 'nunjucks'
import {
  CreateEventRequestParams,
  EventData,
  EventDataWithId,
  ParticipantData,
  ParticipantDataWithId,
  ResponseEventRequestParams,
  UpdateEventRequestParams,
} from './type'

const env = nunjucks.configure(path.join(__dirname, '../template'), {
  autoescape: true,
})

env.addGlobal('API_BASE_PATH', '/api')
env.addGlobal('SITE_ORIGIN', 'https://itsusuru.com')
env.addGlobal('SITE_DOMAIN', 'itsusuru.com')
env.addGlobal('SITE_NAME', 'イツスル？')

// specify the region for your functions
const region =
  process.env.FUNCTIONS_EMULATOR === 'true' ? 'us-central1' : 'asia-northeast1'

const app = initializeApp({
  // AppOptionsにapiKeyがないが、公式のサンプルにはapiKeyがあるし、実際に使えるので無視する
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  apiKey: process.env.API_KEY,
  authDomain: 'itsusuru-686b1.firebaseapp.com',
  projectId: 'itsusuru-686b1',
  storageBucket: 'itsusuru-686b1.appspot.com',
  messagingSenderId: '715253804816',
  appId: '1:715253804816:web:a70e4bc9b88a58eb75ff95',
  measurementId: 'G-9TXLH0VX2S',
})

const db = getFirestore(app)

Sentry.GCPFunction.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [new ProfilingIntegration()],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
})

const onRequestWrapper = (
  handler: (request: Request, response: Response) => void | Promise<void>
): HttpsFunction => {
  return onRequest({ region }, Sentry.GCPFunction.wrapHttpFunction(handler))
}

export const fetchHome = onRequestWrapper(async (req, res): Promise<void> => {
  const eventId = req.query.eventId as string

  if (eventId) {
    const event = await db
      .collection('events')
      .doc(eventId)
      .get()
      .then(async (docSnapshot) => {
        if (docSnapshot.exists) {
          console.log('Document data retrieved with ID: ', eventId)

          return docSnapshot.data() as EventData
        } else {
          const errorMessage = `No document found with ID: ${eventId}`
          console.error(errorMessage)
          res.sendStatus(404)
          return Promise.reject(new Error(errorMessage))
        }
      })

    const responseText = nunjucks.render('index.njk', {
      event: {
        id: eventId,
        name: event.name,
        candidateDates: event.candidateDates.join(', '),
        candidateTimes: event.candidateTimes || {},
        timeByDay: event.timeByDay,
        baseTime: event.baseTime,
      },
    })
    res.send(responseText)
  } else {
    const responseText = nunjucks.render('index.njk')

    res.send(responseText)
  }
})

export const createEvent = onRequestWrapper(async (req, res): Promise<void> => {
  const data = req.body as CreateEventRequestParams

  const event: EventData = {
    name: data.name,
    candidateDates: data.candidateDates
      .split(/\s*,\s*/)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    candidateTimes: data.candidateTimes || {},
    timeByDay: data.timeByDay === 'on',
    baseTime: data.baseTime || '',
    noSpecificTime: data.noSpecificTime === 'on',
    createdAt: FieldValue.serverTimestamp(),
  }

  await db
    .collection('events')
    .add(event)
    .then((docRef) => {
      res.set('HX-Location', `/event?eventId=${docRef.id}`)
      res.sendStatus(201)
    })
})

export const updateEvent = onRequestWrapper(async (req, res): Promise<void> => {
  const data = req.body as UpdateEventRequestParams

  const newEvent: EventData = {
    name: data.name,
    candidateDates: data.candidateDates
      .split(/\s*,\s*/)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    candidateTimes: data.candidateTimes || {},
    timeByDay: data.timeByDay === 'on',
    baseTime: data.baseTime || '',
    noSpecificTime: data.noSpecificTime === 'on',
  }

  const eventReference = db.collection('events').doc(data.eventId)

  const currentEvent: EventDataWithId = await eventReference
    .get()
    .then(async (docRef) => {
      if (docRef.exists) {
        const data = docRef.data() as EventData
        const event: EventDataWithId = {
          id: docRef.id,
          name: data.name,
          candidateDates: data.candidateDates,
          candidateTimes: data.candidateTimes || {},
          timeByDay: data.timeByDay,
          baseTime: data.baseTime,
        }
        return event
      } else {
        const errorMessage = `No document found with ID: ${data.eventId}`
        console.error(errorMessage)
        res.sendStatus(404)
        return Promise.reject(new Error(errorMessage))
      }
    })

  // 削除された候補日を取得
  const removedCandidateDates = currentEvent.candidateDates.filter(
    (candidateDate) => {
      return !newEvent.candidateDates.some((newCandidateDate) => {
        return newCandidateDate === candidateDate
      })
    }
  )

  if (removedCandidateDates.length) {
    // 特定のイベントに関連する参加者のコレクションを取得
    await eventReference
      .collection('participants')
      .get() // 参加者のコレクション全体を取得
      .then((participantRefs) => {
        // 取得した参加者のコレクションに対して処理を行う
        // 参加者のコレクション内の各ドキュメント（参加者）に対して処理を行う
        participantRefs.forEach((participantRef) => {
          // 削除する候補日の各日付に対して処理を行う
          removedCandidateDates.forEach((removedCandidateDate) => {
            const time =
              currentEvent.candidateTimes[removedCandidateDate] ||
              currentEvent.baseTime
            const deleteKey = `responses.${removedCandidateDate}T${time}`
            // 参加者のドキュメントを更新
            participantRef.ref.update({
              // 更新するフィールドを指定（削除する候補日に対応するレスポンスフィールド）
              [deleteKey]: FieldValue.delete(), // 指定したフィールドの値を削除
            })
          })
        })
      })
  }

  await db
    .collection('events')
    .doc(data.eventId)
    .set(newEvent)
    .then(() => {
      res.set('HX-Location', `/event?eventId=${data.eventId}`)
      res.sendStatus(201)
    })
})

export const fetchEvent = onRequestWrapper(async (req, res): Promise<void> => {
  const eventId = req.query.eventId as string

  if (!eventId) {
    res.status(400).send('Bad Request')
    return
  }

  const eventReference = db.collection('events').doc(eventId)

  const eventData = await eventReference.get().then(async (docRef) => {
    if (docRef.exists) {
      console.log('Document data retrieved with ID: ', eventId)
      const data = docRef.data() as EventData
      const event: EventDataWithId = {
        id: docRef.id,
        name: data.name,
        candidateDates: data.candidateDates,
        candidateTimes: data.candidateTimes || {},
        timeByDay: data.timeByDay,
        baseTime: data.baseTime,
      }

      return event
    } else {
      const errorMessage = `No document found with ID: ${eventId}`
      console.error(errorMessage)
      res.sendStatus(404)
      return Promise.reject(new Error(errorMessage))
    }
  })

  const eventParticipantsData = await eventReference
    .collection('participants')
    .get()
    .then((querySnapshot) => {
      const participants: ParticipantDataWithId[] = []
      querySnapshot.forEach((docRef) => {
        const data = docRef.data() as ParticipantData
        const participant: ParticipantDataWithId = {
          id: docRef.id,
          name: data.name,
          responses: data.responses,
        }
        participants.push(participant)
      })
      console.log('Participants retrieved for event ID: ', eventId)
      return participants
    })
    .catch((error) => {
      console.error('Error fetching participants: ', error)
      res.status(500).send('Error fetching participants')
      return Promise.reject(error)
    })

  const [event, participants] = await Promise.all([
    eventData,
    eventParticipantsData,
  ])

  // TODO: add type definition
  const responseText = nunjucks.render('event.njk', {
    event: {
      id: eventId,
      name: event.name,
      candidateDates: event.candidateDates.map((date) => {
        const responseCountMap = participants.reduce(
          (acc, participant) => {
            const time = event.candidateTimes[date] || event.baseTime
            const response = participant.responses[`${date}T${time}`]
            acc[response]++
            return acc
          },
          { YES: 0, MAYBE: 0, NO: 0 }
        )

        const status = (() => {
          if (
            participants.length > 0 &&
            responseCountMap.YES === participants.length
          ) {
            return 'primary'
          } else if (
            responseCountMap.NO === 0 &&
            responseCountMap.MAYBE > 0 &&
            responseCountMap.YES > 0
          ) {
            return 'secondary'
          } else {
            return 'never'
          }
        })()

        const time = event.noSpecificTime
          ? ''
          : event.candidateTimes[date] || event.baseTime

        const dateInstance = event.noSpecificTime
          ? new Date(`${date}T00:00:00`)
          : new Date(`${date}T${time}`)

        return {
          key: `${date}T${time}`,
          date: format(dateInstance, 'M/d'),
          time: format(dateInstance, 'H:mm'),
          dayOfWeek: format(dateInstance, 'E', { locale: ja }),
          status,
        }
      }),
      timeByDay: event.timeByDay,
      baseTime: event.baseTime,
    },
    participants,
  })

  res.send(responseText)
})

export const fetchEdit = onRequestWrapper(async (req, res): Promise<void> => {
  // TODO: add type to query
  const eventId = (req.query.eventId as string) || ''
  const participantId = (req.query.participantId as string) || ''

  if (!eventId) {
    res.status(400).send('Bad Request')
    return
  }
  const eventReference = db.collection('events').doc(eventId)

  const eventData = await eventReference.get().then(async (docSnapshot) => {
    if (docSnapshot.exists) {
      console.log('Document data retrieved with ID: ', eventId)

      const event = docSnapshot.data() as EventData

      return event
    } else {
      const errorMessage = `No document found with ID: ${eventId}`
      console.error(errorMessage)
      res.sendStatus(404)
      return Promise.reject(new Error(errorMessage))
    }
  })

  const eventParticipantsData = await eventReference
    .collection('participants')
    .get()
    .then((querySnapshot) => {
      const participants: ParticipantDataWithId[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data() as ParticipantData
        const participant: ParticipantDataWithId = {
          id: doc.id,
          name: data.name,
          responses: data.responses,
        }
        participants.push(participant)
      })
      return participants
    })
    .catch((error) => {
      console.error('Error fetching participants: ', error)
      res.status(500).send('Error fetching participants')
      return Promise.reject(error)
    })

  const [event, participants] = await Promise.all([
    eventData,
    eventParticipantsData,
  ])

  const participant = participants.find((p) => {
    return p.id === participantId
  })

  if (participant) {
    const responseText = nunjucks.render('edit.njk', {
      event: {
        id: eventId,
        name: event.name,
        candidateDates: event.candidateDates.map((date) => {
          const time = event.candidateTimes[date] || event.baseTime
          const dateInstance = new Date(`${date}T${time}`)
          return {
            key: `${date}T${time}`,
            date: format(dateInstance, 'MM/dd'),
            time: format(dateInstance, 'HH:mm'),
            dayOfWeek: format(dateInstance, 'E', { locale: ja }),
          }
        }),
        timeByDay: event.timeByDay,
        baseTime: event.baseTime,
      },
      participants,
      participant,
    })

    res.send(responseText)
  } else {
    const responseText = nunjucks.render('edit.njk', {
      event: {
        id: eventId,
        name: event.name,
        candidateDates: event.candidateDates.map((date) => {
          const time = event.candidateTimes[date] || event.baseTime
          const dateInstance = new Date(`${date}T${time}`)
          return {
            key: `${date}T${time}`,
            date: format(dateInstance, 'MM/dd'),
            time: format(dateInstance, 'HH:mm'),
            dayOfWeek: format(dateInstance, 'E', { locale: ja }),
          }
        }),
        timeByDay: event.timeByDay,
        baseTime: event.baseTime,
      },
      participants,
    })

    res.send(responseText)
  }
})

export const responseEvent = onRequestWrapper(
  async (req, res): Promise<void> => {
    const data = req.body as ResponseEventRequestParams

    const eventReference = db.collection('events').doc(data.eventId)

    const participantsReference = eventReference.collection('participants')

    const response = {
      name: data.name,
      responses: data.responses,
    }

    if (data.participantId) {
      await participantsReference
        .doc(data.participantId)
        .set(response)
        .then(() => {
          res.set('HX-Location', `/event?eventId=${data.eventId}`)
          res.sendStatus(201)
        })
    } else {
      await participantsReference.add(response).then(() => {
        res.set('HX-Location', `/event?eventId=${data.eventId}`)
        res.sendStatus(201)
      })
    }
  }
)

export const deleteParticipant = onRequestWrapper(
  async (req, res): Promise<void> => {
    const eventId = req.query.eventId as string
    const participantId = req.query.participantId as string

    if (!eventId || !participantId) {
      res.status(400).send('Bad Request')
      return
    }

    await db
      .collection('events')
      .doc(eventId)
      .collection('participants')
      .doc(participantId)
      .delete()
      .then(() => {
        res.set('HX-Location', `/event?eventId=${eventId}`)
        res.sendStatus(200)
      })
  }
)

export const ogpImage = onRequestWrapper(async (req, res) => {
  const size = { width: 1200, height: 630 }
  const title = req.query.title as string

  if (!title) {
    throw new Error('Title is not specified')
  }

  // font を登録
  const font = path.join(__dirname, '../ogp/NotoSansJP-Bold.ttf')
  registerFont(font, { family: 'NotoSansJP' })

  // canvas を作成
  const { width, height } = size
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const lineHeight = 1.5

  // 元になる画像を読み込む
  const src = path.join(__dirname, '../ogp/bg.png')
  const image = await loadImage(fs.readFileSync(src))

  // 元の画像を canvas にセットする
  ctx.drawImage(image, 0, 0, width, height)

  // タイトルを元の画像にセットする
  const maxLengthByLine = 15
  const titleLines =
    title.match(new RegExp(`.{1,${maxLengthByLine}}`, 'g')) || []
  const rowCount = titleLines.length
  const padding = 100
  const titleFontSize = 72
  const datetimeFontSize = 42

  if (rowCount === 0) {
    throw new Error(`Invalid lines: ${rowCount}`)
  }

  const writeText = (
    text: string,
    y: number,
    fontSize: number,
    fontColor = '#3C3C41'
  ) => {
    ctx.font = `${fontSize}px NotoSansJP`
    ctx.fillStyle = fontColor
    ctx.fillText(text, padding, y, width - padding * 2)
  }

  // Write Title
  titleLines.forEach((line, i) => {
    const baseY = padding + 96
    const actualLineHeight = titleFontSize * lineHeight
    const y = baseY - i * actualLineHeight
    writeText(line, y, titleFontSize)
  })

  // Write Caption
  writeText('クリックして予定を入力してね', height - padding, datetimeFontSize)

  res.header('Content-Type', 'image/png')
  res.send(canvas.toBuffer('image/png'))
})
