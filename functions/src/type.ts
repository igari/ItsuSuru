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

export interface CandidateDate {
  date: string
  time: string
}

export interface EventData {
  name: string
  candidateDates: CandidateDate[]
  createdAt?: FieldValue
}
export interface EventDataWithId extends EventData {
  id: string
}

export interface CreateEventRequestParams {
  name: string
  candidateDates: string
}

export interface UpdateEventRequestParams {
  eventId: string
  name: string
  candidateDates: string
}

export interface ResponseEventRequestParams {
  eventId: string
  participantId?: string
  name: string
  responses: {
    [datetime: string]: ResponseType
  }
}
