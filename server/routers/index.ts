import { router } from '../trpc.js'
import { authRouter }       from './auth.js'
import { classroomRouter }  from './classroom.js'
import { eventRouter }      from './event.js'
import { diaryRouter }      from './diary.js'
import { supervisorRouter } from './supervisor.js'
import { checkinRouter }    from './checkin.js'
import { adminRouter }      from './admin.js'

export const appRouter = router({
  auth:       authRouter,
  classroom:  classroomRouter,
  event:      eventRouter,
  diary:      diaryRouter,
  supervisor: supervisorRouter,
  checkin:    checkinRouter,
  admin:      adminRouter,
})

export type AppRouter = typeof appRouter
