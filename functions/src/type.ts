import { FieldValue } from 'firebase-admin/firestore'

type ResponseType = 'YES' | 'NO' | 'MAYBE'

export interface ParticipantData {
  name: string
  responses: {
    [datetime: string]: ResponseType
  }
}

export interface ParticipantDataWithId extends ParticipantData {
  id: string
}

export interface EventData {
  name: string
  candidateDates: string[]
  candidateTimes: { [date: string]: string }
  timeByDay: boolean
  baseTime: string
  noSpecificTime?: boolean
  createdAt?: FieldValue
}
export interface EventDataWithId extends EventData {
  id: string
}

export interface CreateEventRequestParams {
  name: string
  candidateDates: string
  candidateTimes?: { [date: string]: string }
  timeByDay?: string
  baseTime?: string
  noSpecificTime?: string
}

export interface UpdateEventRequestParams {
  eventId: string
  name: string
  candidateDates: string
  candidateTimes?: { [date: string]: string }
  timeByDay?: string
  baseTime?: string
  noSpecificTime?: string
}

export interface ResponseEventRequestParams {
  eventId: string
  participantId?: string
  name: string
  responses: {
    [datetime: string]: ResponseType
  }
}
