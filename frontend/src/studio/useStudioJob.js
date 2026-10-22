import { useEffect, useState } from 'react'
import { studioApi } from './studioApi'

export default function useStudioJob(jobId) {
  const [job, setJob] = useState(null)
  useEffect(() => {
    setJob(null)
    if (!jobId) return
    let stopped = false
    let timer
    const tick = async () => {
      try {
        const { data } = await studioApi.getJob(jobId)
        if (stopped) return
        setJob(data)
        if (data.status === 'queued' || data.status === 'running') timer = setTimeout(tick, 2000)
      } catch {
        if (!stopped) timer = setTimeout(tick, 4000)
      }
    }
    tick()
    return () => { stopped = true; clearTimeout(timer) }
  }, [jobId])
  return job
}