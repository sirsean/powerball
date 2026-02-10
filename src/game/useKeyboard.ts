import { useEffect, useRef } from 'react'

const BLOCKED_CODES = new Set([
  'KeyW',
  'KeyS',
  'Space',
  'KeyX',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
])

export function useKeyboard() {
  const keysRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.code] = true
      if (BLOCKED_CODES.has(event.code)) {
        event.preventDefault()
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false
      if (BLOCKED_CODES.has(event.code)) {
        event.preventDefault()
      }
    }

    const onBlur = () => {
      keysRef.current = {}
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return keysRef
}
