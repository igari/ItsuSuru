// import { logger } from 'firebase-functions';//TODO loggerの使い方を調べる
import path from 'node:path'
import { HttpsFunction, Request, onRequest } from 'firebase-functions/v2/https'
import cors from 'cors'
import express from 'express'

import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'

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

const env = nunjucks.configure(path.join(__dirname, '../templates'), {
  autoescape: true,
})

const DOC_ORIGIN =
  process.env.FUNCTIONS_EMULATOR === 'true'
    ? (process.env.DOC_ORIGIN_FOR_EMULATOR as string)
    : (process.env.DOC_ORIGIN as string)

env.addGlobal('API_BASE_PATH', '/api')

const corsMiddleware = cors({
  origin: [DOC_ORIGIN],
})

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

const onRequestWrapper = (
  handler: (
    request: Request,
    response: express.Response
  ) => void | Promise<void>
): HttpsFunction => {
  return onRequest({ region }, async (req, res): Promise<void> => {
    corsMiddleware(req, res, async () => {
      handler(req, res)
    })
  })
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
        candidateDates: event.candidateDates
          .map(({ date, time }) => `${date} ${time}`)
          .join(','),
      },
    })

    res.send(responseText)
  } else {
    const responseText = nunjucks.render('index.njk')

    res.send(responseText)
  }
})

export const createEvent = onRequestWrapper(async (req, res): Promise<void> => {
  const data = req.body as EventData

  const event: CreateEventRequestParams = {
    name: data.name,
    candidateDates: data.candidateDates,
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

  const event: EventData = {
    name: data.name,
    candidateDates: data.candidateDates,
  }

  await db
    .collection('events')
    .doc(data.eventId)
    .set(event)
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

  const eventData = await db
    .collection('events')
    .doc(eventId)
    .get()
    .then(async (docRef) => {
      if (docRef.exists) {
        console.log('Document data retrieved with ID: ', eventId)
        const data = docRef.data() as EventData
        const event: EventDataWithId = {
          id: docRef.id,
          name: data.name,
          candidateDates: data.candidateDates,
        }

        return event
      } else {
        const errorMessage = `No document found with ID: ${eventId}`
        console.error(errorMessage)
        res.sendStatus(404)
        return Promise.reject(new Error(errorMessage))
      }
    })

  const eventParticipantsData = await db
    .collection('events')
    .doc(eventId)
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

  const responseText = nunjucks.render('event.njk', {
    event,
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

  const eventData = await db
    .collection('events')
    .doc(eventId)
    .get()
    .then(async (docSnapshot) => {
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

  const eventParticipantsData = await db
    .collection('events')
    .doc(eventId)
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

  const participant = participants.find((p) => {
    return p.id === participantId
  })

  if (participant) {
    const responseText = nunjucks.render('edit.njk', {
      event: {
        id: eventId,
        name: event.name,
        candidateDates: event.candidateDates,
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
        candidateDates: event.candidateDates,
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
