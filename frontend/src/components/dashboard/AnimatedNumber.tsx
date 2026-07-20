import { useState, useEffect } from 'react'

export function AnimatedNumber({ value }: { value: number }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    if (start === end) {
      setCurrent(end)
      return
    }

    const duration = 1000
    const frameRate = 1000 / 60
    const totalFrames = duration / frameRate
    const increment = end / totalFrames
    
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCurrent(end)
        clearInterval(timer)
      } else {
        setCurrent(Math.floor(start))
      }
    }, frameRate)

    return () => clearInterval(timer)
  }, [value])

  return <span>{current}</span>
}
